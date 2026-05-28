
-- 1) Remove public SELECT on artigos (all reads happen server-side via service role)
DROP POLICY IF EXISTS "artigos public select publicos" ON public.artigos;

-- 2) Revoke EXECUTE on SECURITY DEFINER helper functions from anon/authenticated.
--    These are only called server-side via supabaseAdmin (service_role).
REVOKE EXECUTE ON FUNCTION public.cobertura_cgu() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_pncp() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov_emendas(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_siconfi() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_ceap() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_votacoes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_ceaps() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_votacoes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cobertura_tentativas() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.qa_findings_agregado() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.qa_finding_publico(uuid) FROM anon, authenticated, public;

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
GRANT EXECUTE ON FUNCTION public.qa_findings_agregado() TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_finding_publico(uuid) TO service_role;
