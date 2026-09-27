-- Índice de busca (v0.16.0): parlamentares, órgãos federais e municípios.
--
-- Pessoas: deputados e senadores entram como pessoa (uma linha por
-- parlamentar), com o mandato atual como faceta e resumo — não uma linha por
-- mandato. E-mail e foto não entram. O id da Casa vai em `nomes` (pesquisável),
-- não como identificador exato: número curto casaria com qualquer busca
-- numérica.
--
-- Organizações: órgãos do catálogo SIAFI e municípios do IBGE, com código
-- como identificador exato (buscar "26000" ou "3550308" destaca o registro).
-- A faceta `tipo_organizacao` separa órgão, município e fornecedor — por isso
-- a projeção dos fornecedores a ganha e a coleção é reindexada.
CREATE OR REPLACE FUNCTION public.busca_projecao_deputados(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'camara_deputados_cache', d.id::text, 'pessoas', 'deputado', 'Câmara',
    d.nome,
    concat_ws(' · ', 'Deputado federal', d.sigla_partido, d.sigla_uf),
    NULL,
    concat_ws(' ', d.nome_civil, d.id::text),
    concat_ws(' · ', 'Deputado federal', d.sigla_partido, d.sigla_uf, d.situacao,
      d.condicao_eleitoral, 'legislatura ' || d.id_legislatura),
    NULL,
    NULL::date, NULL, NULL, d.sigla_uf,
    NULL::numeric, NULL, NULL,
    '/camara/deputados/' || d.id, 'https://www.camara.leg.br/deputados/' || d.id,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'cargo', 'Deputado federal', 'partido', d.sigla_partido, 'mandato', d.situacao))
  FROM public.camara_deputados_cache d
  WHERE p_ids IS NULL OR d.id::text = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_senadores(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'senado_senadores_cache', s.id::text, 'pessoas', 'senador', 'Senado',
    s.nome,
    concat_ws(' · ', 'Senador', s.sigla_partido, s.sigla_uf),
    NULL,
    concat_ws(' ', s.nome_completo, s.codigo_parlamentar::text),
    concat_ws(' · ', 'Senador', s.sigla_partido, s.sigla_uf, s.situacao),
    NULL,
    NULL::date, NULL, NULL, s.sigla_uf,
    NULL::numeric, NULL, NULL,
    '/senado/senadores/' || s.id,
    'https://www25.senado.leg.br/web/senadores/senador/-/perfil/' || s.codigo_parlamentar,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'cargo', 'Senador', 'partido', s.sigla_partido, 'mandato', s.situacao))
  FROM public.senado_senadores_cache s
  WHERE p_ids IS NULL OR s.id::text = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_orgaos(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'orgaos_cache', o.cod, 'organizacoes', 'orgao', 'CGU',
    o.nome,
    'Órgão SIAFI ' || o.cod,
    public.busca_normalizar_id(o.cod),
    concat_ws(' ', o.sigla, o.orgao_vinculado_nome),
    concat_ws(' · ', o.sigla, o.poder, o.funcao, 'vinculado a ' || o.orgao_vinculado_nome),
    NULL,
    NULL::date, NULL, NULL, NULL,
    NULL::numeric, NULL, NULL,
    '/orgaos/' || public.busca_url_segmento(o.cod),
    'https://portaldatransparencia.gov.br/orgaos/' || o.cod,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object('tipo_organizacao', 'Órgão federal', 'poder', o.poder))
  FROM public.orgaos_cache o
  WHERE p_ids IS NULL OR o.cod = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_municipios(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'ibge_municipios_cache', m.codigo, 'organizacoes', 'municipio', 'IBGE',
    m.nome || ' (' || m.uf || ')',
    'IBGE ' || m.codigo,
    public.busca_normalizar_id(m.codigo),
    NULL,
    'Município · ' || m.uf,
    NULL,
    NULL::date, NULL, NULL, m.uf,
    NULL::numeric, NULL, NULL,
    '/entes/' || public.busca_url_segmento(m.codigo), NULL,
    NULL, NULL, NULL,
    jsonb_build_object('tipo_organizacao', 'Município')
  FROM public.ibge_municipios_cache m
  WHERE p_ids IS NULL OR m.codigo = ANY (p_ids)
$$;
--> statement-breakpoint

-- Fornecedores: a mesma projeção da 0010, com `tipo_organizacao` nas facetas.
CREATE OR REPLACE FUNCTION public.busca_projecao_fornecedores(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'fornecedores_cache', f.cnpj, 'organizacoes', 'fornecedor', 'CGU',
    f.nome,
    CASE WHEN public.busca_cnpj(f.cnpj) IS NOT NULL THEN 'CNPJ ' ELSE 'CPF ' END
      || public.busca_documento_publico(f.cnpj),
    public.busca_cnpj(f.cnpj),
    public.busca_cnpj(f.cnpj),
    NULL, NULL,
    NULL::date, NULL, NULL, NULL,
    NULL::numeric, NULL, NULL,
    '/fornecedores/' || public.busca_url_segmento(f.cnpj), NULL,
    NULL, NULL, NULL,
    jsonb_build_object('tipo_organizacao', 'Fornecedor')
  FROM public.fornecedores_cache f
  WHERE (p_ids IS NULL OR f.cnpj = ANY (p_ids))
    AND length(regexp_replace(f.cnpj, '\D', '', 'g')) <> 11
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
    ELSE RAISE EXCEPTION 'Coleção sem adaptador de busca: %', p_colecao;
  END CASE;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN SELECT * FROM (VALUES
    ('camara_deputados_cache', 'id'),
    ('senado_senadores_cache', 'id'),
    ('orgaos_cache', 'cod'),
    ('ibge_municipios_cache', 'codigo')
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
  public.busca_projecao_deputados(text[]),
  public.busca_projecao_senadores(text[]),
  public.busca_projecao_orgaos(text[]),
  public.busca_projecao_municipios(text[])
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- Carga inicial (tabelas pequenas: ~2 mil deputados, ~700 senadores, ~600
-- órgãos, 5.570 municípios) e fornecedores com a faceta nova.
SELECT public.busca_reconstruir('camara_deputados_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('senado_senadores_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('orgaos_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('ibge_municipios_cache');
--> statement-breakpoint
SELECT public.busca_indexar('fornecedores_cache', NULL);
