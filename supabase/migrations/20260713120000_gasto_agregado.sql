-- Agregação de gastos no banco, para não esbarrar no teto de 1000 linhas do
-- PostgREST (db-max-rows). Somar as despesas cruas no servidor de aplicação
-- truncava em 1000 lançamentos e ainda transferia centenas de milhares de linhas.
--
-- Estratégia:
--  - Total geral: função escalar (um único número, sem problema de linhas).
--  - Ranking por parlamentar: view agregada (uma linha por deputado/senador),
--    lida com varredura paginada no app — poucos milhares de linhas, não as
--    despesas cruas. security_invoker mantém a checagem de acesso na role que lê
--    (service_role, que já ignora RLS); a view não é exposta ao anon.

-- ── Câmara ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.camara_gasto_por_deputado
  WITH (security_invoker = true) AS
  SELECT deputado_id, SUM(valor_liquido)::numeric AS total
  FROM public.camara_despesas_cache
  GROUP BY deputado_id;

GRANT SELECT ON public.camara_gasto_por_deputado TO service_role;

CREATE OR REPLACE FUNCTION public.camara_gasto_total()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(valor_liquido), 0)::numeric FROM public.camara_despesas_cache
$$;

REVOKE EXECUTE ON FUNCTION public.camara_gasto_total() FROM PUBLIC, anon, authenticated;

-- ── Senado ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.senado_gasto_por_senador
  WITH (security_invoker = true) AS
  SELECT senador_id, SUM(valor_reembolsado)::numeric AS total
  FROM public.senado_despesas_cache
  GROUP BY senador_id;

GRANT SELECT ON public.senado_gasto_por_senador TO service_role;

CREATE OR REPLACE FUNCTION public.senado_gasto_total()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(valor_reembolsado), 0)::numeric FROM public.senado_despesas_cache
$$;

REVOKE EXECUTE ON FUNCTION public.senado_gasto_total() FROM PUBLIC, anon, authenticated;
