
-- 1. Make CGU-specific columns nullable
ALTER TABLE public.importacoes
  ALTER COLUMN orgao_cod DROP NOT NULL,
  ALTER COLUMN data_inicial DROP NOT NULL,
  ALTER COLUMN data_final DROP NOT NULL;

-- 2. Add unified columns
ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ano integer,
  ADD COLUMN IF NOT EXISTS mes integer;

-- 3. Backfill: existing CGU rows → set fonte='cgu', escopo=orgao_cod, ano/mes from data_inicial
UPDATE public.importacoes
SET
  fonte = 'cgu',
  escopo = COALESCE(NULLIF(escopo, ''), orgao_cod, ''),
  ano = COALESCE(ano, EXTRACT(YEAR FROM data_inicial)::int),
  mes = COALESCE(mes, EXTRACT(MONTH FROM data_inicial)::int)
WHERE fonte = 'Portal da Transparência (CGU)' OR fonte IS NULL;

-- 4. Change default for fonte
ALTER TABLE public.importacoes ALTER COLUMN fonte SET DEFAULT 'cgu';

-- 5. Copy tentativas_ingestao → importacoes
INSERT INTO public.importacoes (
  fonte, escopo, ano, mes,
  total_bruto, importados, erros,
  consultado_em, user_id,
  orgao_cod, data_inicial, data_final
)
SELECT
  fonte,
  COALESCE(escopo, ''),
  ano,
  mes,
  registros,
  registros,
  CASE WHEN erro IS NOT NULL AND erro <> '' THEN to_jsonb(ARRAY[erro]) ELSE '[]'::jsonb END,
  executado_em,
  user_id,
  NULL, NULL, NULL
FROM public.tentativas_ingestao;

-- 6. Drop and recreate cobertura_tentativas pointing at importacoes
DROP FUNCTION IF EXISTS public.cobertura_tentativas();

CREATE OR REPLACE FUNCTION public.cobertura_tentativas()
RETURNS TABLE(fonte text, escopo text, ano integer, mes integer, tentativas bigint, ultimo timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT fonte, escopo, ano, mes, COUNT(*)::bigint AS tentativas, MAX(consultado_em) AS ultimo
  FROM public.importacoes
  WHERE ano IS NOT NULL AND mes IS NOT NULL
  GROUP BY fonte, escopo, ano, mes
$$;

-- 7. Drop old table
DROP TABLE public.tentativas_ingestao;

-- 8. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_importacoes_consultado_em ON public.importacoes (consultado_em DESC);
CREATE INDEX IF NOT EXISTS idx_importacoes_fonte_ano_mes ON public.importacoes (fonte, ano, mes);
