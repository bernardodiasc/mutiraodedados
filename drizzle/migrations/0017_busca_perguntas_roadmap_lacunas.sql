-- Índice de busca (v0.16.0): conteúdo editorial público além dos artigos.
--
--   perguntas         investigações publicadas (visibilidade pública e slug);
--                     autoria, moderação e itens do caderno ficam fora
--   pergunta_modelos  modelos de pergunta ativos
--   roadmap_itens     itens públicos do roadmap cidadão (sem as notas internas)
--   lacunas           lacunas curadas publicadas (sem quem as criou)
--
-- Âncoras: /perguntas#modelo-<id>, /roadmap#item-<id> e /lacunas#lacuna-<id>
-- são criadas nas páginas no mesmo PR.
CREATE OR REPLACE FUNCTION public.busca_projecao_perguntas(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'perguntas', p.id::text, 'perguntas', 'investigacao', 'Mutirão de Dados',
    p.titulo, NULL, NULL,
    array_to_string(p.tags, ' '),
    p.descricao, p.contexto,
    p.publicada_em::date, CASE WHEN p.publicada_em IS NOT NULL THEN 'publicacao' END,
    CASE WHEN p.publicada_em IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/perguntas/' || public.busca_url_segmento(p.slug), NULL,
    NULL, NULL, NULL,
    jsonb_build_object('tipo_pergunta', 'Investigação publicada')
  FROM public.perguntas p
  WHERE p.visibilidade_publica AND p.slug IS NOT NULL
    AND (p_ids IS NULL OR p.id::text = ANY (p_ids))
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_pergunta_modelos(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'pergunta_modelos', m.id::text, 'perguntas', 'modelo', 'Mutirão de Dados',
    m.titulo, NULL, NULL,
    array_to_string(m.tags, ' '),
    m.descricao, m.contexto,
    NULL::date, NULL, NULL, NULL,
    NULL::numeric, NULL, NULL,
    '/perguntas#modelo-' || m.id, NULL,
    NULL, NULL, NULL,
    jsonb_build_object('tipo_pergunta', 'Modelo de pergunta')
  FROM public.pergunta_modelos m
  WHERE m.ativo AND (p_ids IS NULL OR m.id::text = ANY (p_ids))
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_roadmap(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'roadmap_itens', r.id::text, 'paginas', 'roadmap', 'Mutirão de Dados',
    r.titulo, NULL, NULL, NULL,
    r.descricao, NULL,
    r.concluido_em::date, CASE WHEN r.concluido_em IS NOT NULL THEN 'fato' END,
    CASE WHEN r.concluido_em IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/roadmap#item-' || r.id, NULL,
    NULL, NULL, NULL,
    jsonb_build_object('pagina_site', 'Roadmap', 'status', r.status)
  FROM public.roadmap_itens r
  WHERE r.publico AND (p_ids IS NULL OR r.id::text = ANY (p_ids))
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_lacunas(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'lacunas', l.id::text, 'qualidade', 'lacuna', 'Mutirão de Dados',
    l.titulo, NULL, NULL,
    array_to_string(l.tags, ' '),
    l.descricao, NULL,
    NULL::date, NULL, NULL, NULL,
    NULL::numeric, NULL, NULL,
    '/lacunas#lacuna-' || l.id, NULL,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'tipo_sinal', 'Lacuna', 'tipo_lacuna', l.tipo::text, 'ciclo', l.ciclo::text,
      'resolvida', CASE WHEN l.resolvida_em IS NOT NULL THEN 'Resolvida' ELSE 'Em aberto' END))
  FROM public.lacunas l
  WHERE l.publicada AND (p_ids IS NULL OR l.id::text = ANY (p_ids))
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projetar(p_colecao text, p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  CASE p_colecao
    WHEN 'pncp_contratos_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_pncp_contratos(p_ids);
    WHEN 'contratos_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_contratos_cgu(p_ids);
    WHEN 'cgu_licitacoes_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_licitacoes(p_ids);
    WHEN 'cgu_transferegov_emendas_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_emendas(p_ids);
    WHEN 'convenios_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_convenios(p_ids);
    WHEN 'fornecedores_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_fornecedores(p_ids);
    WHEN 'tse_candidatos_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_candidaturas(p_ids);
    WHEN 'artigos' THEN RETURN QUERY SELECT * FROM public.busca_projecao_artigos(p_ids);
    WHEN 'camara_deputados_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_deputados(p_ids);
    WHEN 'senado_senadores_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_senadores(p_ids);
    WHEN 'orgaos_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_orgaos(p_ids);
    WHEN 'ibge_municipios_cache' THEN RETURN QUERY SELECT * FROM public.busca_projecao_municipios(p_ids);
    WHEN 'perguntas' THEN RETURN QUERY SELECT * FROM public.busca_projecao_perguntas(p_ids);
    WHEN 'pergunta_modelos' THEN RETURN QUERY SELECT * FROM public.busca_projecao_pergunta_modelos(p_ids);
    WHEN 'roadmap_itens' THEN RETURN QUERY SELECT * FROM public.busca_projecao_roadmap(p_ids);
    WHEN 'lacunas' THEN RETURN QUERY SELECT * FROM public.busca_projecao_lacunas(p_ids);
    ELSE RAISE EXCEPTION 'Coleção sem adaptador de busca: %', p_colecao;
  END CASE;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN SELECT * FROM (VALUES
    ('perguntas', 'id'),
    ('pergunta_modelos', 'id'),
    ('roadmap_itens', 'id'),
    ('lacunas', 'id')
  ) AS t(tabela, chave)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_ins ON public.%I', alvo.tabela);
    EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_upd ON public.%I', alvo.tabela);
    EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_del ON public.%I', alvo.tabela);
    EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_trunc ON public.%I', alvo.tabela);
    EXECUTE format(
      'CREATE TRIGGER busca_indice_ins AFTER INSERT ON public.%I REFERENCING NEW TABLE AS novos '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', alvo.tabela, alvo.chave);
    EXECUTE format(
      'CREATE TRIGGER busca_indice_upd AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS antigos NEW TABLE AS novos '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', alvo.tabela, alvo.chave);
    EXECUTE format(
      'CREATE TRIGGER busca_indice_del AFTER DELETE ON public.%I REFERENCING OLD TABLE AS antigos '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', alvo.tabela, alvo.chave);
    EXECUTE format(
      'CREATE TRIGGER busca_indice_trunc AFTER TRUNCATE ON public.%I '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', alvo.tabela, alvo.chave);
  END LOOP;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION
  public.busca_projecao_perguntas(text[]),
  public.busca_projecao_pergunta_modelos(text[]),
  public.busca_projecao_roadmap(text[]),
  public.busca_projecao_lacunas(text[])
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_reconstruir('perguntas');
--> statement-breakpoint
SELECT public.busca_reconstruir('pergunta_modelos');
--> statement-breakpoint
SELECT public.busca_reconstruir('roadmap_itens');
--> statement-breakpoint
SELECT public.busca_reconstruir('lacunas');
