-- Índice de busca (v0.16.0): bens declarados, receitas e despesas de campanha
-- e resultados eleitorais (categoria Eleições e campanhas).
--
-- Todos são sub-registros da candidatura: registro-pai na categoria Pessoas
-- (`pai_id` = `<sq>-<ano>`, o id da candidatura no índice) e destino na ficha
-- da candidatura, na linha do registro:
--   bem        /eleicoes/candidatos/<sq>?ano=<ano>&bem=<ordem>#bem-<ordem>
--   receita    /eleicoes/candidatos/<sq>?ano=<ano>&receita=<id>#receita-<id>
--   despesa    /eleicoes/candidatos/<sq>?ano=<ano>&despesa=<id>#despesa-<id>
--   resultado  /eleicoes/candidatos/<sq>?ano=<ano>#votacao
--
-- Dados pessoais (decisão de 2026-09-26): CPF e título de eleitor nunca entram.
-- Doador e fornecedor pessoa física são pesquisáveis pelo nome; o documento só
-- aparece na faceta de exibição, mascarado (`busca_documento_publico`), e só o
-- CNPJ entra no texto pesquisável (`busca_cnpj`). A descrição do bem fica fora
-- do índice: o bem é achado pelo tipo, pelo candidato e pela eleição. Cor/raça,
-- gênero, grau de instrução e ocupação ficam de fora.
--
-- Projeções enxutas (decisão de capacidade de 2026-09-26): sem texto longo; a
-- descrição da despesa entra cortada em 200 caracteres. O resultado é uma
-- linha por candidatura e turno (a soma dos municípios), não uma por município.
--
-- As projeções casam os ids pela chave primária da origem (junção com
-- `unnest(p_ids)`), para o gatilho não varrer a tabela inteira a cada lote.
--
-- Carga inicial: receitas, despesas e resultados (vazias hoje) aqui. Os bens
-- (~228 mil) NÃO: são carregados por eleição com
-- `CALL busca_carregar_eleitoral(ano_de, ano_ate)`, uma tarefa de cobertura.

CREATE OR REPLACE FUNCTION public.busca_projecao_bens_candidato(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH alvo AS (
    SELECT b.sq_candidato, b.ano_eleicao, b.ordem_bem
    FROM public.tse_bens_candidato_cache b
    WHERE p_ids IS NULL
    UNION
    SELECT split_part(i, '-', 1), split_part(i, '-', 2)::integer, split_part(i, '-', 3)::integer
    FROM unnest(p_ids) i
  )
  SELECT 'tse_bens_candidato_cache', b.sq_candidato || '-' || b.ano_eleicao || '-' || b.ordem_bem, 'eleicoes', 'bem', 'TSE',
    coalesce(nullif(b.tipo_bem, ''), 'Bem declarado') || ' · '
      || coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || b.sq_candidato),
    NULL, NULL,
    c.nome_completo,
    concat_ws(' · ', 'Bem declarado', c.cargo_nome, c.partido_sigla, c.uf),
    NULL,
    make_date(b.ano_eleicao, 1, 1), 'eleicao', 'ano', c.uf,
    b.valor, 'valor declarado do bem', 'BRL',
    '/eleicoes/candidatos/' || public.busca_url_segmento(b.sq_candidato) || '?ano=' || b.ano_eleicao
      || '&bem=' || b.ordem_bem || '#bem-' || b.ordem_bem,
    NULL,
    'pessoas', b.sq_candidato || '-' || b.ano_eleicao,
    coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || b.sq_candidato),
    jsonb_strip_nulls(jsonb_build_object(
      'registro', 'Bem declarado', 'tipo_bem', b.tipo_bem,
      'cargo', c.cargo_nome, 'partido', c.partido_sigla))
  FROM alvo
  JOIN public.tse_bens_candidato_cache b
    ON b.sq_candidato = alvo.sq_candidato AND b.ano_eleicao = alvo.ano_eleicao
   AND b.ordem_bem = alvo.ordem_bem
  LEFT JOIN public.tse_candidatos_cache c
    ON c.sq_candidato = b.sq_candidato AND c.ano_eleicao = b.ano_eleicao
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_receitas_campanha(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH alvo AS (
    SELECT r.id FROM public.tse_receitas_campanha_cache r WHERE p_ids IS NULL
    UNION
    SELECT unnest(p_ids)
  )
  SELECT 'tse_receitas_campanha_cache', r.id, 'eleicoes', 'receita', 'TSE',
    'Receita de ' || coalesce(nullif(r.nome_doador, ''), 'doador não informado') || ' · '
      || coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || r.sq_candidato),
    NULL, NULL,
    concat_ws(' ', c.nome_completo, public.busca_cnpj(r.cpf_cnpj_doador),
      public.busca_cnpj(r.cnpj_doador_originario)),
    concat_ws(' · ', r.tipo_receita, r.forma_recebimento, c.cargo_nome, c.partido_sigla),
    NULL,
    make_date(r.ano_eleicao, 1, 1), 'eleicao', 'ano', coalesce(c.uf, r.uf),
    r.valor, 'valor recebido', 'BRL',
    '/eleicoes/candidatos/' || public.busca_url_segmento(r.sq_candidato) || '?ano=' || r.ano_eleicao
      || '&receita=' || public.busca_url_segmento(r.id) || '#receita-' || public.busca_url_segmento(r.id),
    NULL,
    'pessoas', r.sq_candidato || '-' || r.ano_eleicao,
    coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || r.sq_candidato),
    jsonb_strip_nulls(jsonb_build_object(
      'registro', 'Receita', 'cargo', c.cargo_nome, 'partido', c.partido_sigla,
      'doador', r.nome_doador,
      'documento_doador', public.busca_documento_publico(r.cpf_cnpj_doador)))
  FROM alvo
  JOIN public.tse_receitas_campanha_cache r ON r.id = alvo.id
  LEFT JOIN public.tse_candidatos_cache c
    ON c.sq_candidato = r.sq_candidato AND c.ano_eleicao = r.ano_eleicao
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_despesas_campanha(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH alvo AS (
    SELECT d.id FROM public.tse_despesas_campanha_cache d WHERE p_ids IS NULL
    UNION
    SELECT unnest(p_ids)
  )
  SELECT 'tse_despesas_campanha_cache', d.id, 'eleicoes', 'despesa', 'TSE',
    'Despesa com ' || coalesce(nullif(d.nome_fornecedor, ''), 'fornecedor não informado') || ' · '
      || coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || d.sq_candidato),
    NULL, NULL,
    concat_ws(' ', c.nome_completo, public.busca_cnpj(d.cnpj_fornecedor)),
    concat_ws(' · ', d.tipo_despesa, left(d.descricao, 200), c.cargo_nome, c.partido_sigla),
    NULL,
    make_date(d.ano_eleicao, 1, 1), 'eleicao', 'ano', coalesce(c.uf, d.uf),
    d.valor, 'valor contratado', 'BRL',
    '/eleicoes/candidatos/' || public.busca_url_segmento(d.sq_candidato) || '?ano=' || d.ano_eleicao
      || '&despesa=' || public.busca_url_segmento(d.id) || '#despesa-' || public.busca_url_segmento(d.id),
    NULL,
    'pessoas', d.sq_candidato || '-' || d.ano_eleicao,
    coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || d.sq_candidato),
    jsonb_strip_nulls(jsonb_build_object(
      'registro', 'Despesa', 'cargo', c.cargo_nome, 'partido', c.partido_sigla,
      'fornecedor', d.nome_fornecedor,
      'documento_fornecedor', public.busca_documento_publico(d.cnpj_fornecedor)))
  FROM alvo
  JOIN public.tse_despesas_campanha_cache d ON d.id = alvo.id
  LEFT JOIN public.tse_candidatos_cache c
    ON c.sq_candidato = d.sq_candidato AND c.ano_eleicao = d.ano_eleicao
$$;
--> statement-breakpoint

-- Uma linha por candidatura e turno: `tse_resultados_cache` tem uma linha por
-- município, e o índice guarda a soma (o id é `<sq>-<ano>-<turno>`).
CREATE OR REPLACE FUNCTION public.busca_projecao_resultados(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH alvo AS (
    SELECT DISTINCT r.sq_candidato, r.ano_eleicao, r.nr_turno
    FROM public.tse_resultados_cache r
    WHERE p_ids IS NULL
    UNION
    SELECT split_part(i, '-', 1), split_part(i, '-', 2)::integer, split_part(i, '-', 3)::integer
    FROM unnest(p_ids) i
  ),
  soma AS (
    SELECT r.sq_candidato, r.ano_eleicao, r.nr_turno,
      sum(r.votos_nominais) AS votos, count(*) AS municipios,
      max(r.situacao_totalizacao) AS situacao, max(r.uf) AS uf
    FROM alvo
    JOIN public.tse_resultados_cache r
      ON r.sq_candidato = alvo.sq_candidato AND r.ano_eleicao = alvo.ano_eleicao
     AND r.nr_turno = alvo.nr_turno
    GROUP BY r.sq_candidato, r.ano_eleicao, r.nr_turno
  )
  SELECT 'tse_resultados_cache', s.sq_candidato || '-' || s.ano_eleicao || '-' || s.nr_turno, 'eleicoes', 'resultado', 'TSE',
    'Resultado · ' || coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || s.sq_candidato)
      || coalesce(': ' || coalesce(s.situacao, c.situacao_totalizacao), ''),
    NULL, NULL,
    concat_ws(' ', c.nome_completo, c.partido_sigla),
    concat_ws(' · ', c.cargo_nome, c.partido_sigla, coalesce(c.uf, s.uf), s.nr_turno || 'º turno',
      s.municipios || CASE WHEN s.municipios = 1 THEN ' município' ELSE ' municípios' END),
    NULL,
    make_date(s.ano_eleicao, 1, 1), 'eleicao', 'ano', coalesce(c.uf, s.uf),
    s.votos, 'votos nominais', 'votos',
    '/eleicoes/candidatos/' || public.busca_url_segmento(s.sq_candidato) || '?ano=' || s.ano_eleicao
      || '#votacao',
    NULL,
    'pessoas', s.sq_candidato || '-' || s.ano_eleicao,
    coalesce(nullif(c.nome_urna, ''), c.nome_completo, 'Candidatura ' || s.sq_candidato),
    jsonb_strip_nulls(jsonb_build_object(
      'registro', 'Resultado', 'cargo', c.cargo_nome, 'partido', c.partido_sigla,
      'situacao', coalesce(s.situacao, c.situacao_totalizacao)))
  FROM soma s
  LEFT JOIN public.tse_candidatos_cache c
    ON c.sq_candidato = s.sq_candidato AND c.ano_eleicao = s.ano_eleicao
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION
  public.busca_projecao_bens_candidato(text[]),
  public.busca_projecao_receitas_campanha(text[]),
  public.busca_projecao_despesas_campanha(text[]),
  public.busca_projecao_resultados(text[])
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('tse_bens_candidato_cache',
  $k$sq_candidato || '-' || ano_eleicao || '-' || ordem_bem$k$, 'busca_projecao_bens_candidato');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('tse_receitas_campanha_cache', 'id',
  'busca_projecao_receitas_campanha');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('tse_despesas_campanha_cache', 'id',
  'busca_projecao_despesas_campanha');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('tse_resultados_cache',
  $k$sq_candidato || '-' || ano_eleicao || '-' || nr_turno$k$, 'busca_projecao_resultados');
--> statement-breakpoint

-- Carga por eleição, com commit a cada décimo da eleição (último dígito do
-- sq): os bens já importados e o que houver de contas e resultados. Os
-- registros novos entram pelos gatilhos.
CREATE OR REPLACE PROCEDURE public.busca_carregar_eleitoral(p_ano_de integer, p_ano_ate integer)
LANGUAGE plpgsql
AS $$
DECLARE
  ano integer;
  digito text;
  ids text[];
BEGIN
  FOR ano IN SELECT generate_series(p_ano_de, p_ano_ate) LOOP
    FOREACH digito IN ARRAY string_to_array('0123456789', NULL) LOOP
      SELECT array_agg(b.sq_candidato || '-' || b.ano_eleicao || '-' || b.ordem_bem) INTO ids
      FROM public.tse_bens_candidato_cache b
      WHERE b.ano_eleicao = ano AND right(b.sq_candidato, 1) = digito;
      IF ids IS NOT NULL THEN PERFORM public.busca_indexar('tse_bens_candidato_cache', ids); END IF;

      SELECT array_agg(r.id) INTO ids
      FROM public.tse_receitas_campanha_cache r
      WHERE r.ano_eleicao = ano AND right(r.sq_candidato, 1) = digito;
      IF ids IS NOT NULL THEN PERFORM public.busca_indexar('tse_receitas_campanha_cache', ids); END IF;

      SELECT array_agg(d.id) INTO ids
      FROM public.tse_despesas_campanha_cache d
      WHERE d.ano_eleicao = ano AND right(d.sq_candidato, 1) = digito;
      IF ids IS NOT NULL THEN PERFORM public.busca_indexar('tse_despesas_campanha_cache', ids); END IF;

      SELECT array_agg(DISTINCT r.sq_candidato || '-' || r.ano_eleicao || '-' || r.nr_turno) INTO ids
      FROM public.tse_resultados_cache r
      WHERE r.ano_eleicao = ano AND right(r.sq_candidato, 1) = digito;
      IF ids IS NOT NULL THEN PERFORM public.busca_indexar('tse_resultados_cache', ids); END IF;

      COMMIT;
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON PROCEDURE public.busca_carregar_eleitoral(integer, integer)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_reconstruir('tse_receitas_campanha_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('tse_despesas_campanha_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('tse_resultados_cache');
