-- Track import attempts per (fonte, escopo, ano, mes) so we can distinguish
-- "never tried" from "tried but no data" in the coverage matrix.
CREATE TABLE IF NOT EXISTS public.tentativas_ingestao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  escopo text NOT NULL DEFAULT '',
  ano integer NOT NULL,
  mes integer NOT NULL,
  registros integer NOT NULL DEFAULT 0,
  executado_em timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);

CREATE INDEX IF NOT EXISTS tentativas_ingestao_lookup_idx
  ON public.tentativas_ingestao (fonte, escopo, ano, mes, executado_em DESC);

ALTER TABLE public.tentativas_ingestao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tentativas admin all" ON public.tentativas_ingestao;
CREATE POLICY "tentativas admin all" ON public.tentativas_ingestao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Aggregated view used by the coverage matrix.
CREATE OR REPLACE FUNCTION public.cobertura_tentativas()
RETURNS TABLE(fonte text, escopo text, ano integer, mes integer, tentativas bigint, ultimo timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fonte, escopo, ano, mes, COUNT(*)::bigint AS tentativas, MAX(executado_em) AS ultimo
  FROM public.tentativas_ingestao
  GROUP BY fonte, escopo, ano, mes
$$;

GRANT EXECUTE ON FUNCTION public.cobertura_tentativas() TO authenticated;