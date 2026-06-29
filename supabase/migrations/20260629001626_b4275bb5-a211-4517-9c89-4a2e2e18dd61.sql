
-- 1) Column-level revokes for sensitive internal columns
REVOKE SELECT (notas_internas) ON public.artigos FROM anon, authenticated;
REVOKE SELECT (notas_admin) ON public.qa_findings FROM anon, authenticated;
REVOKE SELECT (notas) ON public.roadmap_itens FROM anon, authenticated;

-- 2) Perguntas moderation guard trigger (function already exists)
DROP TRIGGER IF EXISTS perguntas_guard_publicacao ON public.perguntas;
CREATE TRIGGER perguntas_guard_publicacao
  BEFORE UPDATE ON public.perguntas
  FOR EACH ROW EXECUTE FUNCTION public.tg_perguntas_guard_publicacao();

-- 3) Revoke EXECUTE on SECURITY DEFINER functions not meant for direct API calls.
--    All cobertura_*/qa_*  RPCs are invoked server-side via service_role, which
--    keeps access. has_role stays callable by authenticated (used in RLS checks
--    and client lookups). Trigger functions never need anon/authenticated EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_lacuna_de_finding() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_perguntas_guard_publicacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_validate_contestacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cobertura_senado_votacoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_ceap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_cgu() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_pncp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_siconfi() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_votacoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov_emendas(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_ceaps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_tentativas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qa_finding_publico(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qa_findings_agregado() FROM PUBLIC, anon, authenticated;

-- has_role must remain callable by authenticated users (used by client code and
-- referenced from RLS policies). Keep PUBLIC revoked to be explicit.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
