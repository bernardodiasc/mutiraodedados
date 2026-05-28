CREATE OR REPLACE FUNCTION public.cobertura_tentativas()
RETURNS TABLE(fonte text, escopo text, ano integer, mes integer, tentativas bigint, ultimo timestamptz)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT fonte, escopo, ano, mes, COUNT(*)::bigint AS tentativas, MAX(executado_em) AS ultimo
  FROM public.tentativas_ingestao
  GROUP BY fonte, escopo, ano, mes
$$;

REVOKE EXECUTE ON FUNCTION public.cobertura_tentativas() FROM PUBLIC, anon, authenticated;