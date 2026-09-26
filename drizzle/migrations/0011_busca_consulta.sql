-- Consulta do índice de busca (`busca_indice`), chamada pelo servidor da
-- /buscar. Três entradas, todas devolvendo JSON:
--
--   busca_resumo        visão geral: total por categoria, até 3 prévias por
--                       categoria, facetas universais (fonte, UF, ano) e o
--                       registro de identificador exato.
--   busca_lista         uma categoria, paginada, com as facetas universais e
--                       as próprias da categoria.
--   busca_opcoes_faceta opções de uma faceta longa filtradas por um termo.
--
-- Filtros (`p_filtros`): {"fonte": [...], "uf": [...], "ano": [...],
-- "por_categoria": {"contratos": {"modalidade": [...]}}}. OU dentro de um
-- filtro, E entre filtros. Filtro de "por_categoria" só restringe as linhas da
-- própria categoria (as demais passam). "__vazio__" seleciona registros sem o
-- valor ("Sem informação"). A contagem de cada opção ignora o próprio filtro.
--
-- Corte (`p_ate`): só entram linhas com `indexado_em <= p_ate`; sem corte,
-- vale o instante da consulta, devolvido em `corte` para os links seguintes.
-- Com corte, `novos` conta os resultados que entraram depois dele.

-- Termos da consulta: as duas versões do tsquery e o identificador comparável.
-- CNPJ formatado vira só dígitos, como está no índice.
CREATE OR REPLACE FUNCTION public.busca_termos(p_q text)
RETURNS TABLE (pt tsquery, padrao tsquery, norm text)
LANGUAGE sql STABLE
AS $$
  SELECT
    websearch_to_tsquery('public.busca_pt'::regconfig, public.busca_texto_pt(q)),
    websearch_to_tsquery('pg_catalog.portuguese'::regconfig, q),
    CASE WHEN length(public.busca_normalizar_id(p_q)) >= 4 THEN public.busca_normalizar_id(p_q) END
  FROM (
    SELECT regexp_replace(coalesce(p_q, ''),
      '(\d{2})\.?(\d{3})\.?(\d{3})/?(\d{4})-?(\d{2})', '\1\2\3\4\5', 'g') AS q
  ) x
$$;
--> statement-breakpoint

-- Valores de uma faceta numa linha: universal (fonte, uf, ano) ou própria do
-- tipo (chave em `facetas`, com lista quando multivalorada). Sem valor =
-- "__vazio__".
-- Filtros que a linha NÃO passa (lista vazia = passa em todos). Calculado uma
-- vez por linha; a contagem de uma faceta usa as linhas que não falham em nada
-- ou que falham só nela (a própria faceta é ignorada). Sem SET search_path de
-- propósito: assim o planejador incorpora a função à consulta, em vez de
-- chamá-la linha a linha (referências todas qualificadas).
CREATE OR REPLACE FUNCTION public.busca_falhas(
  p_categoria text, p_fonte text, p_uf text, p_ano integer, p_facetas jsonb, f jsonb)
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT array_remove(ARRAY[
      CASE WHEN jsonb_array_length(coalesce(f -> 'fonte', '[]'::jsonb)) > 0
        AND NOT (f -> 'fonte') ? p_fonte THEN 'fonte' END,
      CASE WHEN jsonb_array_length(coalesce(f -> 'uf', '[]'::jsonb)) > 0
        AND NOT (f -> 'uf') ? coalesce(p_uf, '__vazio__') THEN 'uf' END,
      CASE WHEN jsonb_array_length(coalesce(f -> 'ano', '[]'::jsonb)) > 0
        AND NOT (f -> 'ano') ? coalesce(p_ano::text, '__vazio__') THEN 'ano' END
    ], NULL)
    || CASE WHEN (f -> 'por_categoria') ? p_categoria THEN ARRAY(
      SELECT e.key
      FROM jsonb_each(f -> 'por_categoria' -> p_categoria) e
      WHERE jsonb_array_length(e.value) > 0
        AND NOT CASE jsonb_typeof(p_facetas -> e.key)
          WHEN 'array' THEN (p_facetas -> e.key) ?| ARRAY(SELECT jsonb_array_elements_text(e.value))
          ELSE e.value ? coalesce(p_facetas ->> e.key, '__vazio__')
        END)
    ELSE '{}'::text[] END
$$;
--> statement-breakpoint


-- Linhas que casam com a consulta até o corte, com os filtros que cada uma não
-- passa (a filtragem fica com quem chama).
CREATE OR REPLACE FUNCTION public.busca_casados(
  p_q text, p_categoria text, p_corte timestamptz, p_filtros jsonb, p_limite integer DEFAULT NULL)
RETURNS TABLE (
  colecao text, id_origem text, categoria text, fonte text, uf text, ano integer,
  facetas jsonb, data_principal date, exato boolean, rank real, falhas text[])
LANGUAGE sql STABLE
AS $$
  SELECT b.colecao, b.id_origem, b.categoria, b.fonte, b.uf, b.ano, b.facetas, b.data_principal,
    coalesce(b.identificador_norm = t.norm, false),
    ts_rank_cd(b.tsv_pt, t.pt) + ts_rank_cd(b.tsv_padrao, t.padrao),
    public.busca_falhas(b.categoria, b.fonte, b.uf, b.ano, b.facetas, coalesce(p_filtros, '{}'::jsonb))
  FROM public.busca_indice b, public.busca_termos(p_q) t
  WHERE b.indexado_em <= p_corte
    AND (p_categoria IS NULL OR b.categoria = p_categoria)
    AND (b.tsv_pt @@ t.pt OR b.tsv_padrao @@ t.padrao OR b.identificador_norm = t.norm)
  LIMIT p_limite
$$;
--> statement-breakpoint

-- Opções de facetas: {faceta: {"opcoes": [{valor, n}], "mais": bool}}. Até
-- p_max_opcoes por faceta (mais os valores selecionados, mesmo com zero);
-- ano em ordem decrescente, as demais pela contagem.
CREATE OR REPLACE FUNCTION public.busca_facetas(
  p_q text, p_categoria text, p_filtros jsonb, p_corte timestamptz, p_lista text[],
  p_max_opcoes integer DEFAULT 100)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH base AS MATERIALIZED (
    SELECT c.fonte, c.uf, c.ano, c.facetas, c.falhas
    FROM public.busca_casados(p_q, p_categoria, p_corte, p_filtros) c
    WHERE cardinality(c.falhas) <= 1
  ),
  especificas AS (
    SELECT x.faceta FROM unnest(p_lista) x(faceta) WHERE x.faceta NOT IN ('fonte', 'uf', 'ano')
  ),
  contadas AS (
    SELECT 'fonte' AS faceta, fonte AS valor, count(*) AS n FROM base
    WHERE 'fonte' = ANY (p_lista) AND falhas <@ ARRAY['fonte'] GROUP BY 2
    UNION ALL
    SELECT 'uf', coalesce(uf, '__vazio__'), count(*) FROM base
    WHERE 'uf' = ANY (p_lista) AND falhas <@ ARRAY['uf'] GROUP BY 2
    UNION ALL
    SELECT 'ano', coalesce(ano::text, '__vazio__'), count(*) FROM base
    WHERE 'ano' = ANY (p_lista) AND falhas <@ ARRAY['ano'] GROUP BY 2
    UNION ALL
    SELECT e.faceta, v.valor, count(*)
    FROM base b
    CROSS JOIN especificas e
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements_text(b.facetas -> e.faceta)
      WHERE jsonb_typeof(b.facetas -> e.faceta) = 'array'
      UNION ALL
      SELECT coalesce(b.facetas ->> e.faceta, '__vazio__')
      WHERE coalesce(jsonb_typeof(b.facetas -> e.faceta), 'null') <> 'array'
    ) v(valor)
    WHERE b.falhas <@ ARRAY[e.faceta]
    GROUP BY 1, 2
  ),
  selecionadas AS (
    SELECT x.faceta, s.valor
    FROM unnest(p_lista) x(faceta)
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(
      CASE WHEN x.faceta IN ('fonte', 'uf', 'ano') THEN p_filtros -> x.faceta
           ELSE p_filtros -> 'por_categoria' -> p_categoria -> x.faceta END,
      '[]'::jsonb)) s(valor)
  ),
  todas AS (
    SELECT c.faceta, c.valor, c.n, s.valor IS NOT NULL AS selecionada
    FROM contadas c LEFT JOIN selecionadas s USING (faceta, valor)
    UNION ALL
    SELECT s.faceta, s.valor, 0, true FROM selecionadas s
    WHERE NOT EXISTS (SELECT 1 FROM contadas c WHERE c.faceta = s.faceta AND c.valor = s.valor)
  ),
  ordenadas AS (
    SELECT *, row_number() OVER (
      PARTITION BY faceta
      ORDER BY CASE WHEN faceta = 'ano' AND valor <> '__vazio__' THEN valor END DESC NULLS LAST, n DESC, valor) AS pos
    FROM todas
  )
  SELECT coalesce(jsonb_object_agg(x.faceta, jsonb_build_object(
      'opcoes', coalesce((
        SELECT jsonb_agg(jsonb_build_object('valor', o.valor, 'n', o.n) ORDER BY o.pos)
        FROM ordenadas o
        WHERE o.faceta = x.faceta AND (o.pos <= p_max_opcoes OR o.selecionada)), '[]'::jsonb),
      'mais', EXISTS (SELECT 1 FROM ordenadas o WHERE o.faceta = x.faceta AND o.pos > p_max_opcoes))),
    '{}'::jsonb)
  FROM unnest(p_lista) x(faceta)
$$;
--> statement-breakpoint

-- Trecho com os termos marcados por [[ e ]] (marcadores que não são HTML; a
-- interface os troca por destaque). NULL quando nenhum termo aparece.
CREATE OR REPLACE FUNCTION public.busca_trecho(p_doc text, p_pt tsquery, p_padrao tsquery)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  opcoes constant text := 'StartSel=[[, StopSel=]], MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter=" … "';
  h text;
BEGIN
  IF coalesce(p_doc, '') = '' THEN RETURN NULL; END IF;
  h := ts_headline('pg_catalog.portuguese'::regconfig, p_doc, p_padrao, opcoes);
  IF position('[[' IN h) = 0 THEN
    h := ts_headline('public.busca_pt'::regconfig, p_doc, p_pt, opcoes);
  END IF;
  RETURN CASE WHEN position('[[' IN h) > 0 THEN h END;
END $$;
--> statement-breakpoint

-- Item de resultado, com motivo (onde casou) e trecho.
CREATE OR REPLACE FUNCTION public.busca_item(b public.busca_indice, p_pt tsquery, p_padrao tsquery, p_norm text)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'colecao', b.colecao, 'id', b.id_origem, 'categoria', b.categoria, 'subtipo', b.subtipo,
    'fonte', b.fonte, 'titulo', b.titulo, 'identificador', b.identificador, 'resumo', b.resumo,
    'data', CASE WHEN b.data_principal IS NOT NULL THEN jsonb_build_object(
      'valor', b.data_principal, 'natureza', b.data_natureza, 'precisao', b.data_precisao) END,
    'valor', CASE WHEN b.valor IS NOT NULL THEN jsonb_build_object(
      'n', b.valor, 'natureza', b.valor_natureza, 'unidade', b.valor_unidade) END,
    'uf', b.uf, 'href', b.href_interno, 'urlOficial', b.url_oficial,
    'pai', CASE WHEN b.pai_id IS NOT NULL THEN jsonb_build_object(
      'categoria', b.pai_categoria, 'id', b.pai_id, 'titulo', b.pai_titulo) END,
    'exato', coalesce(b.identificador_norm = p_norm, false),
    'motivo', CASE
      WHEN coalesce(b.identificador_norm = p_norm, false) THEN 'identificador'
      WHEN to_tsvector('pg_catalog.portuguese'::regconfig, b.titulo) @@ p_padrao
        OR to_tsvector('public.busca_pt'::regconfig, public.busca_texto_pt(b.titulo)) @@ p_pt THEN 'titulo'
      WHEN to_tsvector('pg_catalog.portuguese'::regconfig, concat_ws(' ', b.identificador, b.nomes)) @@ p_padrao
        OR to_tsvector('public.busca_pt'::regconfig, public.busca_texto_pt(concat_ws(' ', b.identificador, b.nomes))) @@ p_pt
        THEN 'nomes'
      ELSE 'texto' END,
    'trecho', public.busca_trecho(concat_ws(' … ', b.resumo, left(b.texto, 20000)), p_pt, p_padrao))
$$;
--> statement-breakpoint

-- Visão geral. Com p_contar = false (a contagem estourou o orçamento), devolve
-- prévias de uma amostra das correspondências, sem totais nem facetas.
CREATE OR REPLACE FUNCTION public.busca_resumo(
  p_q text, p_filtros jsonb DEFAULT '{}'::jsonb, p_ate timestamptz DEFAULT NULL,
  p_contar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  corte constant timestamptz := coalesce(p_ate, now());
  f constant jsonb := coalesce(p_filtros, '{}'::jsonb);
  t record;
  resultado jsonb;
BEGIN
  SELECT * INTO t FROM public.busca_termos(p_q);

  WITH casados AS MATERIALIZED (
    SELECT * FROM public.busca_casados(p_q, NULL, corte, f, CASE WHEN p_contar THEN NULL ELSE 2000 END)
  ),
  filtrados AS MATERIALIZED (
    SELECT * FROM casados c WHERE cardinality(c.falhas) = 0
  ),
  contagens AS (
    SELECT categoria, count(*) AS n FROM filtrados GROUP BY 1
  ),
  previas AS (
    SELECT * FROM (
      SELECT colecao, id_origem, categoria, row_number() OVER (
        PARTITION BY categoria
        ORDER BY exato DESC, rank DESC, data_principal DESC NULLS LAST, colecao, id_origem) AS pos
      FROM filtrados) x
    WHERE pos <= 3
  )
  SELECT jsonb_build_object(
    'corte', corte,
    'contado', p_contar,
    'categorias', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'categoria', c.categoria,
        'total', CASE WHEN p_contar THEN c.n END,
        'previas', (
          SELECT jsonb_agg(public.busca_item(b, t.pt, t.padrao, t.norm) ORDER BY p.pos)
          FROM previas p JOIN public.busca_indice b USING (colecao, id_origem)
          WHERE p.categoria = c.categoria)))
      FROM contagens c), '[]'::jsonb),
    'exato', (
      SELECT public.busca_item(b, t.pt, t.padrao, t.norm)
      FROM filtrados x JOIN public.busca_indice b USING (colecao, id_origem)
      WHERE x.exato
      ORDER BY x.categoria, x.colecao
      LIMIT 1))
  INTO resultado;

  IF p_contar THEN
    resultado := resultado || jsonb_build_object(
      'facetas', public.busca_facetas(p_q, NULL, f, corte, ARRAY['fonte', 'uf', 'ano']));
  END IF;

  IF p_ate IS NOT NULL THEN
    resultado := resultado || jsonb_build_object('novos', (
      SELECT count(*)
      FROM public.busca_indice b, public.busca_termos(p_q) q
      WHERE b.indexado_em > p_ate
        AND (b.tsv_pt @@ q.pt OR b.tsv_padrao @@ q.padrao OR b.identificador_norm = q.norm)
        AND cardinality(public.busca_falhas(b.categoria, b.fonte, b.uf, b.ano, b.facetas, f)) = 0));
  END IF;

  RETURN resultado;
END $$;
--> statement-breakpoint

-- Uma categoria, paginada. `p_facetas` são as facetas próprias da categoria
-- (do registro no código). Ordem: relevancia (padrão), data-desc, data-asc;
-- sempre com desempate estável. Página só até o resultado 10.000.
CREATE OR REPLACE FUNCTION public.busca_lista(
  p_q text, p_categoria text, p_filtros jsonb DEFAULT '{}'::jsonb, p_ate timestamptz DEFAULT NULL,
  p_ordem text DEFAULT 'relevancia', p_pagina integer DEFAULT 1, p_itens integer DEFAULT 20,
  p_facetas text[] DEFAULT '{}', p_contar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  corte constant timestamptz := coalesce(p_ate, now());
  f constant jsonb := coalesce(p_filtros, '{}'::jsonb);
  t record;
  resultado jsonb;
BEGIN
  IF p_itens NOT IN (20, 50, 100) THEN
    RAISE EXCEPTION 'Quantidade por página inválida: %', p_itens USING ERRCODE = '22023';
  END IF;
  IF p_pagina < 1 OR p_pagina * p_itens > 10000 THEN
    RAISE EXCEPTION 'Página fora do limite de 10.000 resultados: %', p_pagina USING ERRCODE = '22023';
  END IF;
  IF p_ordem NOT IN ('relevancia', 'data-desc', 'data-asc') THEN
    RAISE EXCEPTION 'Ordenação inválida: %', p_ordem USING ERRCODE = '22023';
  END IF;

  SELECT * INTO t FROM public.busca_termos(p_q);

  WITH filtrados AS MATERIALIZED (
    SELECT * FROM public.busca_casados(p_q, p_categoria, corte, f) c
    WHERE cardinality(c.falhas) = 0
  ),
  pagina AS (
    SELECT colecao, id_origem, pos - (p_pagina - 1) * p_itens AS pos
    FROM (
      SELECT colecao, id_origem, row_number() OVER (ORDER BY
        CASE WHEN p_ordem = 'relevancia' THEN exato END DESC,
        CASE WHEN p_ordem = 'relevancia' THEN rank END DESC,
        CASE WHEN p_ordem = 'data-asc' THEN data_principal END ASC NULLS LAST,
        data_principal DESC NULLS LAST,
        colecao, id_origem) AS pos
      FROM filtrados) x
    WHERE pos > (p_pagina - 1) * p_itens AND pos <= p_pagina * p_itens + 1
  )
  SELECT jsonb_build_object(
    'corte', corte,
    'categoria', p_categoria,
    'pagina', p_pagina,
    'itens', p_itens,
    'total', CASE WHEN p_contar THEN (SELECT count(*) FROM filtrados) END,
    'temMais', (SELECT count(*) FROM pagina) > p_itens,
    'resultados', coalesce((
      SELECT jsonb_agg(public.busca_item(b, t.pt, t.padrao, t.norm) ORDER BY p.pos)
      FROM pagina p JOIN public.busca_indice b USING (colecao, id_origem)
      WHERE p.pos <= p_itens), '[]'::jsonb))
  INTO resultado;

  IF p_contar THEN
    resultado := resultado || jsonb_build_object(
      'facetas', public.busca_facetas(p_q, p_categoria, f, corte,
        ARRAY['fonte', 'uf', 'ano'] || coalesce(p_facetas, '{}')));
  END IF;

  IF p_ate IS NOT NULL THEN
    resultado := resultado || jsonb_build_object('novos', (
      SELECT count(*)
      FROM public.busca_indice b, public.busca_termos(p_q) q
      WHERE b.indexado_em > p_ate AND b.categoria = p_categoria
        AND (b.tsv_pt @@ q.pt OR b.tsv_padrao @@ q.padrao OR b.identificador_norm = q.norm)
        AND cardinality(public.busca_falhas(b.categoria, b.fonte, b.uf, b.ano, b.facetas, f)) = 0));
  END IF;

  RETURN resultado;
END $$;
--> statement-breakpoint

-- Opções de uma faceta longa (órgão, fornecedor, município…) que contêm o
-- termo digitado no filtro, sem acento e sem diferenciar maiúsculas.
CREATE OR REPLACE FUNCTION public.busca_opcoes_faceta(
  p_q text, p_categoria text, p_faceta text, p_termo text,
  p_filtros jsonb DEFAULT '{}'::jsonb, p_ate timestamptz DEFAULT NULL, p_limite integer DEFAULT 50)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('valor', valor, 'n', n) ORDER BY n DESC, valor), '[]'::jsonb)
  FROM (
    SELECT v.valor, count(*) AS n
    FROM public.busca_casados(p_q, p_categoria, coalesce(p_ate, now()), coalesce(p_filtros, '{}'::jsonb)) c
    CROSS JOIN LATERAL (
      SELECT CASE p_faceta WHEN 'fonte' THEN c.fonte WHEN 'uf' THEN coalesce(c.uf, '__vazio__')
        ELSE coalesce(c.ano::text, '__vazio__') END
      WHERE p_faceta IN ('fonte', 'uf', 'ano')
      UNION ALL
      SELECT jsonb_array_elements_text(c.facetas -> p_faceta)
      WHERE p_faceta NOT IN ('fonte', 'uf', 'ano') AND jsonb_typeof(c.facetas -> p_faceta) = 'array'
      UNION ALL
      SELECT coalesce(c.facetas ->> p_faceta, '__vazio__')
      WHERE p_faceta NOT IN ('fonte', 'uf', 'ano')
        AND coalesce(jsonb_typeof(c.facetas -> p_faceta), 'null') <> 'array'
    ) v(valor)
    WHERE c.falhas <@ ARRAY[p_faceta]
      AND public.busca_sem_acento(lower(v.valor)) LIKE '%' || public.busca_sem_acento(lower(coalesce(p_termo, ''))) || '%'
    GROUP BY 1
    ORDER BY 2 DESC, 1
    LIMIT least(coalesce(p_limite, 50), 200)
  ) x
$$;
--> statement-breakpoint

-- Só o servidor consulta.
REVOKE EXECUTE ON FUNCTION
  public.busca_termos(text),
  public.busca_falhas(text, text, text, integer, jsonb, jsonb),
  public.busca_casados(text, text, timestamptz, jsonb, integer),
  public.busca_facetas(text, text, jsonb, timestamptz, text[], integer),
  public.busca_trecho(text, tsquery, tsquery),
  public.busca_item(public.busca_indice, tsquery, tsquery, text),
  public.busca_resumo(text, jsonb, timestamptz, boolean),
  public.busca_lista(text, text, jsonb, timestamptz, text, integer, integer, text[], boolean),
  public.busca_opcoes_faceta(text, text, text, text, jsonb, timestamptz, integer)
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  public.busca_termos(text),
  public.busca_falhas(text, text, text, integer, jsonb, jsonb),
  public.busca_casados(text, text, timestamptz, jsonb, integer),
  public.busca_facetas(text, text, jsonb, timestamptz, text[], integer),
  public.busca_trecho(text, tsquery, tsquery),
  public.busca_item(public.busca_indice, tsquery, tsquery, text),
  public.busca_resumo(text, jsonb, timestamptz, boolean),
  public.busca_lista(text, text, jsonb, timestamptz, text, integer, integer, text[], boolean),
  public.busca_opcoes_faceta(text, text, text, text, jsonb, timestamptz, integer)
TO service_role;
