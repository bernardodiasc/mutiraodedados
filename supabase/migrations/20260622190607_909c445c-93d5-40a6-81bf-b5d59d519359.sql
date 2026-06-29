-- 1) artigos: remover SELECT amplo e re-conceder coluna-a-coluna sem notas_internas
REVOKE SELECT ON public.artigos FROM anon, authenticated;
GRANT SELECT (
  id, slug, titulo, resumo, conteudo_md, categoria, capa_url, dificuldade,
  tempo_estimado_min, fontes_usadas, publico, publicado_em, autor_id,
  created_at, updated_at
) ON public.artigos TO anon, authenticated;
-- Mantém INSERT/UPDATE/DELETE pra authenticated (admin via RLS), nenhum pra anon.
GRANT INSERT, UPDATE, DELETE ON public.artigos TO authenticated;

-- 2) qa_findings: idem, escondendo notas_admin
REVOKE SELECT ON public.qa_findings FROM anon, authenticated;
GRANT SELECT (
  id, fonte, entidade_tipo, entidade_id, regra, severidade, origem,
  valor_armazenado, valor_esperado, detalhes, status, reportado_em,
  reporte_protocolo, reporte_canal, detectado_em, revalidado_em,
  resolvido_em, updated_at
) ON public.qa_findings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qa_findings TO authenticated;

-- 3) perguntas: garantir que o trigger de guarda da publicação esteja ativo
DROP TRIGGER IF EXISTS perguntas_guard_publicacao ON public.perguntas;
CREATE TRIGGER perguntas_guard_publicacao
BEFORE UPDATE ON public.perguntas
FOR EACH ROW
EXECUTE FUNCTION public.tg_perguntas_guard_publicacao();
