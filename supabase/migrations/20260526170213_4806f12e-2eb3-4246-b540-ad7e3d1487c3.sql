
-- Public read for published articles
CREATE POLICY "artigos public select publicos"
ON public.artigos
FOR SELECT
TO anon, authenticated
USING (publico = true);

-- Public read for published roadmap items
CREATE POLICY "roadmap public select publicos"
ON public.roadmap_itens
FOR SELECT
TO anon, authenticated
USING (publico = true);

-- Lock down SECURITY DEFINER cobertura functions: only service_role (server) may execute.
REVOKE EXECUTE ON FUNCTION public.cobertura_cgu() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_pncp() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov_emendas(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_siconfi() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_ceap() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_votacoes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_ceaps() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_votacoes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_tentativas() FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.cobertura_cgu() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_pncp() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_transferegov() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_transferegov_emendas(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_siconfi() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_camara_ceap() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_camara_votacoes() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_senado_ceaps() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_senado_votacoes() TO service_role;
GRANT EXECUTE ON FUNCTION public.cobertura_tentativas() TO service_role;
