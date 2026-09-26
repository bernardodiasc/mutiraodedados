-- Índice de busca unificado da /buscar.
--
-- Uma linha por registro pesquisável de qualquer coleção (tabela
-- `busca_indice`), mantida por gatilhos nas tabelas de origem: inclusão,
-- alteração, exclusão e TRUNCATE atualizam o índice na mesma transação. Cada
-- coleção tem uma função de projeção (a "linha cache → linha do índice") e a
-- reconstrução completa usa a mesma projeção. Só entram registros que podem
-- ser públicos: artigo não publicado não entra, e a projeção aplica a política
-- de dados pessoais — CPF e título de eleitor nunca vão para o índice, CPF de
-- pessoa física só mascarado, e cor/raça, gênero, grau de instrução e ocupação
-- de candidatos ficam de fora.
--
-- Texto: duas versões pesquisáveis de cada linha, com pesos (A título; B
-- identificador e nomes; C resumo e corpo). A versão `busca_pt` tira o acento
-- e troca "-ões" por "-ão" antes do radical, então "licitacao", "licitacoes",
-- "licitação" e "licitações" casam entre si; a `portuguese` padrão cobre as
-- demais flexões com acento. A consulta usa as duas com OU.
--
-- Este arquivo não popula o índice: depois de aplicá-lo, rode
-- `SELECT public.busca_reconstruir('<coleção>')` para cada coleção (ver o PR).

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config
    WHERE cfgname = 'busca_pt' AND cfgnamespace = 'public'::regnamespace
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION public.busca_pt (COPY = pg_catalog.portuguese);
    ALTER TEXT SEARCH CONFIGURATION public.busca_pt
      ALTER MAPPING FOR hword, hword_part, word WITH extensions.unaccent, portuguese_stem;
  END IF;
END $$;
--> statement-breakpoint

-- Funções auxiliares (puras) -------------------------------------------------

-- `unaccent` é STABLE; índice e coluna gerada exigem IMMUTABLE. A promessa de
-- imutabilidade é nossa: se as regras do dicionário mudarem, reconstruir.
CREATE OR REPLACE FUNCTION public.busca_sem_acento(t text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = public
AS $$ SELECT extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;
--> statement-breakpoint

-- Texto para a versão sem acento: minúsculo, sem acento e com "-ões" trocado
-- por "-ão" antes do radical. Sem isso, o radical de "licitacoes" e o de
-- "licitações" (ambos "licitaco") não casam com o de "licitação"
-- ("licitaca"). A consulta aplica a mesma função ao termo antes de
-- `websearch_to_tsquery('public.busca_pt', …)`.
CREATE OR REPLACE FUNCTION public.busca_texto_pt(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$ SELECT regexp_replace(public.busca_sem_acento(lower(coalesce(t, ''))), 'oes\M', 'ao', 'g') $$;
--> statement-breakpoint

-- Forma comparável de um identificador: sem acento, minúsculo, só letras e
-- dígitos ("PL 1234/2023" → "pl12342023").
CREATE OR REPLACE FUNCTION public.busca_normalizar_id(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$ SELECT nullif(lower(regexp_replace(public.busca_sem_acento(coalesce(t, '')), '[^a-zA-Z0-9]', '', 'g')), '') $$;
--> statement-breakpoint

-- Os 14 dígitos de um CNPJ, ou NULL quando o documento não é CNPJ (CPF nunca
-- entra no texto pesquisável).
CREATE OR REPLACE FUNCTION public.busca_cnpj(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE WHEN length(d) = 14 THEN d END
  FROM (SELECT regexp_replace(coalesce(t, ''), '\D', '', 'g') AS d) x
$$;
--> statement-breakpoint

-- Documento como pode ser exibido: CNPJ formatado; CPF completo vira
-- mascarado (***.456.789-**); CPF que já veio mascarado da fonte fica como
-- veio; qualquer outra coisa vira NULL.
CREATE OR REPLACE FUNCTION public.busca_documento_publico(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(d) = 14 THEN format('%s.%s.%s/%s-%s',
      substr(d, 1, 2), substr(d, 3, 3), substr(d, 6, 3), substr(d, 9, 4), substr(d, 13, 2))
    WHEN length(d) = 11 THEN format('***.%s.%s-**', substr(d, 4, 3), substr(d, 7, 3))
    WHEN t LIKE '%*%' THEN t
  END
  FROM (SELECT regexp_replace(coalesce(t, ''), '\D', '', 'g') AS d) x
$$;
--> statement-breakpoint

-- Codificação de um segmento de URL (equivalente a encodeURIComponent).
CREATE OR REPLACE FUNCTION public.busca_url_segmento(t text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = public
AS $$
  SELECT coalesce(string_agg(
    CASE WHEN ch ~ '^[A-Za-z0-9_.~-]$' THEN ch
         ELSE upper(regexp_replace(encode(convert_to(ch, 'UTF8'), 'hex'), '(..)', '%\1', 'g'))
    END, '' ORDER BY i), '')
  FROM unnest(string_to_array(t, NULL)) WITH ORDINALITY AS x(ch, i)
$$;
--> statement-breakpoint

-- Tabela -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.busca_indice (
  colecao text NOT NULL,
  id_origem text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN (
    'propostas', 'normas', 'votacoes', 'votos', 'documentos', 'eventos', 'pessoas',
    'organizacoes', 'contratos', 'licitacoes', 'emendas', 'convenios', 'despesas',
    'eleicoes', 'financas', 'estudos', 'artigos', 'perguntas', 'qualidade', 'paginas'
  )),
  subtipo text,
  fonte text NOT NULL,
  titulo text NOT NULL,
  -- Identificador como é exibido ("PNCP 4637…-2-004859/2026") e sua forma
  -- comparável, usada para destacar o registro exato. Nunca CPF.
  identificador text,
  identificador_norm text,
  -- Nomes e documentos públicos relacionados (órgão, fornecedor, autor; CNPJ
  -- só com dígitos), pesquisáveis com peso intermediário.
  nomes text,
  resumo text,
  texto text,
  data_principal date,
  data_natureza text CHECK (data_natureza IN
    ('assinatura', 'apresentacao', 'publicacao', 'fato', 'exercicio', 'eleicao')),
  data_precisao text CHECK (data_precisao IN ('dia', 'mes', 'ano')),
  ano integer GENERATED ALWAYS AS (extract(year FROM data_principal)::integer) STORED,
  uf text,
  valor numeric,
  valor_natureza text,
  valor_unidade text,
  href_interno text NOT NULL,
  url_oficial text,
  pai_categoria text,
  pai_id text,
  pai_titulo text,
  facetas jsonb NOT NULL DEFAULT '{}'::jsonb,
  tsv_pt tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('public.busca_pt'::regconfig, public.busca_texto_pt(titulo)), 'A') ||
    setweight(to_tsvector('public.busca_pt'::regconfig, public.busca_texto_pt(coalesce(identificador, '') || ' ' || coalesce(nomes, ''))), 'B') ||
    setweight(to_tsvector('public.busca_pt'::regconfig, public.busca_texto_pt(coalesce(resumo, '') || ' ' || coalesce(texto, ''))), 'C')
  ) STORED,
  tsv_padrao tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('pg_catalog.portuguese'::regconfig, coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese'::regconfig, coalesce(identificador, '') || ' ' || coalesce(nomes, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.portuguese'::regconfig, coalesce(resumo, '') || ' ' || coalesce(texto, '')), 'C')
  ) STORED,
  -- Quando a linha entrou no índice: base do corte `ate` (edição). A
  -- reconstrução preserva este horário.
  indexado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (colecao, id_origem)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_tsv_pt_idx ON public.busca_indice USING gin (tsv_pt);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_tsv_padrao_idx ON public.busca_indice USING gin (tsv_padrao);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_categoria_ano_idx ON public.busca_indice (categoria, ano);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_identificador_idx ON public.busca_indice (identificador_norm);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_indexado_em_idx ON public.busca_indice (indexado_em);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_facetas_idx ON public.busca_indice USING gin (facetas jsonb_path_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_titulo_trgm_idx
  ON public.busca_indice USING gin (lower(public.busca_sem_acento(titulo)) extensions.gin_trgm_ops);
--> statement-breakpoint

-- Leitura só pelo servidor (service_role), pelas funções de consulta da busca.
-- RLS ligada sem política de propósito: anon e authenticated não leem nada.
REVOKE ALL ON public.busca_indice FROM anon, authenticated;
--> statement-breakpoint
GRANT ALL ON public.busca_indice TO service_role;
--> statement-breakpoint
ALTER TABLE public.busca_indice ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Linha projetada: as colunas graváveis do índice, na ordem da tabela.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'busca_linha' AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.busca_linha AS (
      colecao text, id_origem text, categoria text, subtipo text, fonte text, titulo text,
      identificador text, identificador_norm text, nomes text, resumo text, texto text,
      data_principal date, data_natureza text, data_precisao text, uf text,
      valor numeric, valor_natureza text, valor_unidade text,
      href_interno text, url_oficial text, pai_categoria text, pai_id text, pai_titulo text,
      facetas jsonb
    );
  END IF;
END $$;
--> statement-breakpoint

-- Adaptadores: uma projeção por coleção (p_ids NULL = coleção inteira) ----------

CREATE OR REPLACE FUNCTION public.busca_projecao_pncp_contratos(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'pncp_contratos_cache', c.id, 'contratos', NULL, 'PNCP',
    'Contrato ' || coalesce(nullif(c.numero_contrato, ''), c.numero_controle_pncp) || ' — ' || c.orgao_nome,
    'PNCP ' || c.numero_controle_pncp,
    public.busca_normalizar_id(c.numero_controle_pncp),
    concat_ws(' ', c.orgao_nome, c.fornecedor_nome, c.municipio_nome,
      public.busca_cnpj(c.orgao_cnpj), public.busca_cnpj(c.fornecedor_cnpj_cpf)),
    left(c.objeto, 400), NULL,
    c.data_assinatura::date, 'assinatura', 'dia', c.uf,
    c.valor_global, 'valor global contratado', 'BRL',
    '/contratos/' || public.busca_url_segmento(c.id), c.url_pncp,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'modalidade', c.modalidade, 'orgao', c.orgao_nome, 'situacao', c.situacao,
      'esfera', c.esfera, 'municipio', c.municipio_nome, 'fornecedor', c.fornecedor_nome,
      'documento_fornecedor', public.busca_documento_publico(c.fornecedor_cnpj_cpf)))
  FROM public.pncp_contratos_cache c
  WHERE p_ids IS NULL OR c.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_contratos_cgu(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'contratos_cache', c.id, 'contratos', NULL, 'CGU',
    'Contrato ' || coalesce(nullif(c.numero, ''), c.id) || coalesce(' — ' || o.nome, ''),
    'CGU ' || c.id,
    public.busca_normalizar_id(c.id),
    concat_ws(' ', o.nome, f.nome, public.busca_cnpj(c.fornecedor_cnpj)),
    left(c.objeto, 400), NULL,
    c.data_assinatura::date, 'assinatura', 'dia', NULL,
    c.valor, 'valor contratado', 'BRL',
    '/contratos/' || public.busca_url_segmento(c.id),
    'https://portaldatransparencia.gov.br/contratos/' || public.busca_url_segmento(c.id),
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'modalidade', c.modalidade, 'orgao', coalesce(o.nome, c.orgao_cod), 'fornecedor', f.nome,
      'documento_fornecedor', public.busca_documento_publico(c.fornecedor_cnpj)))
  FROM public.contratos_cache c
  LEFT JOIN public.orgaos_cache o ON o.cod = c.orgao_cod
  LEFT JOIN public.fornecedores_cache f ON f.cnpj = c.fornecedor_cnpj
  WHERE p_ids IS NULL OR c.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_licitacoes(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'cgu_licitacoes_cache', l.id, 'licitacoes', NULL, 'CGU',
    'Licitação ' || coalesce(nullif(l.numero, ''), l.id) || coalesce(' — ' || l.unidade_gestora, ''),
    coalesce('Processo ' || nullif(l.numero_processo, ''), 'Licitação ' || nullif(l.numero, '')),
    public.busca_normalizar_id(coalesce(nullif(l.numero_processo, ''), l.numero)),
    concat_ws(' ', l.unidade_gestora, l.municipio_nome, public.busca_cnpj(l.orgao_cnpj)),
    left(l.objeto, 400), NULL,
    coalesce(l.data_abertura, l.data_publicacao)::date,
    CASE WHEN l.data_abertura IS NOT NULL THEN 'fato' WHEN l.data_publicacao IS NOT NULL THEN 'publicacao' END,
    CASE WHEN coalesce(l.data_abertura, l.data_publicacao) IS NOT NULL THEN 'dia' END,
    l.uf,
    l.valor, 'valor da licitação', 'BRL',
    '/licitacoes/' || public.busca_url_segmento(l.id), l.url_oficial,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'modalidade', l.modalidade, 'situacao', l.situacao, 'orgao', l.unidade_gestora,
      'municipio', l.municipio_nome))
  FROM public.cgu_licitacoes_cache l
  WHERE p_ids IS NULL OR l.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_emendas(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'cgu_transferegov_emendas_cache', e.id, 'emendas', NULL, 'CGU',
    'Emenda ' || e.id || coalesce(' — ' || e.autor, ''),
    'Código ' || e.id,
    public.busca_normalizar_id(e.id),
    concat_ws(' ', e.autor, e.beneficiario_nome, e.localidade, public.busca_cnpj(e.beneficiario_cnpj)),
    concat_ws(' · ', e.funcao, e.subfuncao, e.localidade, e.beneficiario_nome),
    concat_ws(' ', e.tipo_emenda, e.areas_politicas),
    make_date(e.ano, 1, 1), 'exercicio', 'ano', e.uf,
    e.valor_pago, 'valor pago', 'BRL',
    '/emendas/' || public.busca_url_segmento(e.id), e.url_oficial,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'tipo', e.tipo_emenda, 'funcao', e.funcao, 'autor', e.autor))
  FROM public.cgu_transferegov_emendas_cache e
  WHERE p_ids IS NULL OR e.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_convenios(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'convenios_cache', c.id, 'convenios', c.tipo_instrumento,
    CASE lower(c.fonte) WHEN 'cgu' THEN 'CGU' WHEN 'transferegov' THEN 'Transferegov' ELSE c.fonte END,
    'Convênio ' || coalesce(nullif(c.numero, ''), c.id) || coalesce(' — ' || c.convenente_nome, ''),
    coalesce('Nº ' || nullif(c.numero, ''), 'SICONV ' || nullif(c.codigo_siconv, '')),
    public.busca_normalizar_id(coalesce(nullif(c.numero, ''), c.codigo_siconv)),
    concat_ws(' ', c.orgao_nome, c.convenente_nome, c.municipio_nome,
      public.busca_cnpj(c.orgao_cnpj), public.busca_cnpj(c.convenente_cnpj)),
    left(c.objeto, 400), NULL,
    coalesce(c.data_assinatura, c.data_inicio_vigencia)::date,
    CASE WHEN c.data_assinatura IS NOT NULL THEN 'assinatura' WHEN c.data_inicio_vigencia IS NOT NULL THEN 'fato' END,
    CASE WHEN coalesce(c.data_assinatura, c.data_inicio_vigencia) IS NOT NULL THEN 'dia' END,
    c.uf,
    c.valor, 'valor conveniado', 'BRL',
    '/convenios/' || public.busca_url_segmento(c.id), c.url_oficial,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'situacao', c.situacao, 'orgao', c.orgao_nome, 'convenente', c.convenente_nome,
      'municipio', c.municipio_nome))
  FROM public.convenios_cache c
  WHERE p_ids IS NULL OR c.id = ANY (p_ids)
$$;
--> statement-breakpoint

-- Fornecedor cuja chave é CPF completo fica fora: o destino levaria o CPF na
-- URL. CPF que já veio mascarado da fonte entra.
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
    '{}'::jsonb
  FROM public.fornecedores_cache f
  WHERE (p_ids IS NULL OR f.cnpj = ANY (p_ids))
    AND length(regexp_replace(f.cnpj, '\D', '', 'g')) <> 11
$$;
--> statement-breakpoint

-- Candidaturas: CPF, título de eleitor, cor/raça, gênero, grau de instrução e
-- ocupação não entram.
CREATE OR REPLACE FUNCTION public.busca_projecao_candidaturas(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'tse_candidatos_cache', c.sq_candidato || '-' || c.ano_eleicao, 'pessoas', 'candidatura', 'TSE',
    coalesce(nullif(c.nome_urna, ''), c.nome_completo, c.sq_candidato),
    concat_ws(' · ', c.cargo_nome, c.uf, 'Eleição ' || c.ano_eleicao, 'nº ' || nullif(c.numero_candidato, '')),
    NULL,
    concat_ws(' ', c.nome_completo, c.partido_sigla),
    concat_ws(' · ', c.cargo_nome, c.partido_sigla, c.uf, 'Eleição ' || c.ano_eleicao, c.situacao_totalizacao),
    NULL,
    make_date(c.ano_eleicao, 1, 1), 'eleicao', 'ano', c.uf,
    c.bens_total_declarado, 'total de bens declarados', 'BRL',
    '/eleicoes/candidatos/' || public.busca_url_segmento(c.sq_candidato), c.url_prestacao_contas,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'cargo', c.cargo_nome, 'partido', c.partido_sigla, 'situacao', c.situacao_totalizacao))
  FROM public.tse_candidatos_cache c
  WHERE p_ids IS NULL OR (c.sq_candidato || '-' || c.ano_eleicao) = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_artigos(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'artigos', a.id::text, 'artigos', a.categoria, 'Mutirão de Dados',
    a.titulo, NULL, NULL,
    array_to_string(a.fontes_usadas, ' '),
    a.resumo, a.conteudo_md,
    a.publicado_em::date, CASE WHEN a.publicado_em IS NOT NULL THEN 'publicacao' END,
    CASE WHEN a.publicado_em IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    CASE a.categoria WHEN 'mapa' THEN '/mapas/' WHEN 'nota' THEN '/notas/' ELSE '/tutoriais/' END
      || public.busca_url_segmento(a.slug),
    NULL,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'dificuldade', a.dificuldade, 'fontes', to_jsonb(a.fontes_usadas)))
  FROM public.artigos a
  WHERE a.publico AND (p_ids IS NULL OR a.id::text = ANY (p_ids))
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
    ELSE RAISE EXCEPTION 'Coleção sem adaptador de busca: %', p_colecao;
  END CASE;
END $$;
--> statement-breakpoint

-- Atualiza o índice para os ids dados (NULL = coleção inteira): grava o que a
-- projeção devolve e apaga do índice o que ela não devolve mais (registro
-- excluído, despublicado ou que deixou de poder ser público). Sem p_forcar,
-- linha igual não é regravada; com p_forcar, toda linha é regravada, o que
-- recalcula os tsvector (use depois de mudar a configuração de texto).
-- `indexado_em` nunca muda depois da primeira gravação.
CREATE OR REPLACE FUNCTION public.busca_indexar(p_colecao text, p_ids text[], p_forcar boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH proj AS MATERIALIZED (
    SELECT * FROM public.busca_projetar(p_colecao, p_ids)
  ),
  apagados AS (
    DELETE FROM public.busca_indice b
    WHERE b.colecao = p_colecao
      AND (p_ids IS NULL OR b.id_origem = ANY (p_ids))
      AND NOT EXISTS (SELECT 1 FROM proj p WHERE p.id_origem = b.id_origem)
    RETURNING 1
  ),
  gravados AS (
    INSERT INTO public.busca_indice AS b (
      colecao, id_origem, categoria, subtipo, fonte, titulo, identificador, identificador_norm,
      nomes, resumo, texto, data_principal, data_natureza, data_precisao, uf, valor,
      valor_natureza, valor_unidade, href_interno, url_oficial, pai_categoria, pai_id,
      pai_titulo, facetas)
    SELECT colecao, id_origem, categoria, subtipo, fonte, titulo, identificador, identificador_norm,
      nomes, resumo, texto, data_principal, data_natureza, data_precisao, uf, valor,
      valor_natureza, valor_unidade, href_interno, url_oficial, pai_categoria, pai_id,
      pai_titulo, facetas
    FROM proj
    ON CONFLICT (colecao, id_origem) DO UPDATE SET
      categoria = excluded.categoria, subtipo = excluded.subtipo, fonte = excluded.fonte,
      titulo = excluded.titulo, identificador = excluded.identificador,
      identificador_norm = excluded.identificador_norm, nomes = excluded.nomes,
      resumo = excluded.resumo, texto = excluded.texto, data_principal = excluded.data_principal,
      data_natureza = excluded.data_natureza, data_precisao = excluded.data_precisao,
      uf = excluded.uf, valor = excluded.valor, valor_natureza = excluded.valor_natureza,
      valor_unidade = excluded.valor_unidade, href_interno = excluded.href_interno,
      url_oficial = excluded.url_oficial, pai_categoria = excluded.pai_categoria,
      pai_id = excluded.pai_id, pai_titulo = excluded.pai_titulo, facetas = excluded.facetas,
      atualizado_em = now()
    WHERE p_forcar OR (
      b.categoria, b.subtipo, b.fonte, b.titulo, b.identificador, b.identificador_norm,
      b.nomes, b.resumo, b.texto, b.data_principal, b.data_natureza, b.data_precisao, b.uf,
      b.valor, b.valor_natureza, b.valor_unidade, b.href_interno, b.url_oficial,
      b.pai_categoria, b.pai_id, b.pai_titulo, b.facetas
    ) IS DISTINCT FROM (
      excluded.categoria, excluded.subtipo, excluded.fonte, excluded.titulo,
      excluded.identificador, excluded.identificador_norm, excluded.nomes, excluded.resumo,
      excluded.texto, excluded.data_principal, excluded.data_natureza, excluded.data_precisao,
      excluded.uf, excluded.valor, excluded.valor_natureza, excluded.valor_unidade,
      excluded.href_interno, excluded.url_oficial, excluded.pai_categoria, excluded.pai_id,
      excluded.pai_titulo, excluded.facetas
    )
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM gravados) + (SELECT count(*) FROM apagados) INTO n;
  RETURN n;
END $$;
--> statement-breakpoint

-- Reconstrução completa de uma coleção (carga inicial, ou depois de mudar a
-- configuração de texto). Sem tempo-limite: a coleção inteira passa de uma vez.
CREATE OR REPLACE FUNCTION public.busca_reconstruir(p_colecao text)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
SET statement_timeout = 0
AS $$
BEGIN
  RETURN public.busca_indexar(p_colecao, NULL, true);
END $$;
--> statement-breakpoint

-- Gatilho por comando: TG_ARGV[0] é a expressão da chave (id_origem) sobre as
-- linhas da tabela de origem.
CREATE OR REPLACE FUNCTION public.busca_tg_indexar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chave text := TG_ARGV[0];
  novos_ids text[];
  antigos_ids text[];
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    DELETE FROM public.busca_indice WHERE colecao = TG_TABLE_NAME;
    RETURN NULL;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    EXECUTE format('SELECT array_agg(DISTINCT (%s)::text) FROM novos', chave) INTO novos_ids;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    EXECUTE format('SELECT array_agg(DISTINCT (%s)::text) FROM antigos', chave) INTO antigos_ids;
  END IF;
  IF novos_ids IS NOT NULL OR antigos_ids IS NOT NULL THEN
    PERFORM public.busca_indexar(
      TG_TABLE_NAME,
      ARRAY(SELECT DISTINCT unnest(coalesce(novos_ids, '{}') || coalesce(antigos_ids, '{}'))));
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN SELECT * FROM (VALUES
    ('pncp_contratos_cache', 'id'),
    ('contratos_cache', 'id'),
    ('cgu_licitacoes_cache', 'id'),
    ('cgu_transferegov_emendas_cache', 'id'),
    ('convenios_cache', 'id'),
    ('fornecedores_cache', 'cnpj'),
    ('tse_candidatos_cache', $k$sq_candidato || '-' || ano_eleicao$k$),
    ('artigos', 'id')
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

-- Funções de escrita e projeção: só o servidor chama.
REVOKE EXECUTE ON FUNCTION
  public.busca_indexar(text, text[], boolean),
  public.busca_reconstruir(text),
  public.busca_projetar(text, text[]),
  public.busca_projecao_pncp_contratos(text[]),
  public.busca_projecao_contratos_cgu(text[]),
  public.busca_projecao_licitacoes(text[]),
  public.busca_projecao_emendas(text[]),
  public.busca_projecao_convenios(text[]),
  public.busca_projecao_fornecedores(text[]),
  public.busca_projecao_candidaturas(text[]),
  public.busca_projecao_artigos(text[])
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  public.busca_indexar(text, text[], boolean),
  public.busca_reconstruir(text),
  public.busca_projetar(text, text[])
TO service_role;
