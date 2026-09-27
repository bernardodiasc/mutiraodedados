-- Índice de busca (v0.16.0): proposições, matérias, votações e votos — e o
-- registro de coleções, que tira a lista de casos de `busca_projetar`.
--
-- 1. Registro de coleções. Até aqui, cada coleção nova redefinia
--    `busca_projetar` com a lista inteira de casos e repetia o laço dos
--    gatilhos. Agora `busca_colecoes` guarda coleção → função de projeção, e
--    `busca_registrar_colecao(tabela, chave, funcao)` grava a linha e cria os
--    gatilhos. Coleção nova: a função de projeção e uma chamada ao registro.
--
-- 2. Coleções legislativas:
--    propostas  camara_proposicoes_cache, senado_materias_cache
--    votações   camara_votacoes_cache, senado_votacoes_cache (registro-pai: a
--               proposição ou matéria, quando houver)
--    votos      camara_votos_cache, senado_votos_cache — uma linha por voto,
--               com a votação como registro-pai e destino na linha do
--               parlamentar (`/…/votacoes/<id>#voto-<parlamentar>`)
--    Projeções enxutas (decisão de capacidade de 2026-09-26): o voto leva
--    nome, voto, partido/UF e o assunto da votação, sem texto longo.
--
-- 3. O índice trigram do título deixa de cobrir Votos e Despesas (o nome já
--    está nos tsvector; a consulta da busca não usa o trigram hoje).
--
-- 4. Carga inicial: proposições, matérias e votações aqui (~40 mil linhas).
--    Os votos (~660 mil) NÃO: são carregados por mês com
--    `CALL busca_carregar_votos(de, ate)`, uma tarefa de cobertura.

-- 1. Registro de coleções -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.busca_colecoes (
  colecao text PRIMARY KEY,
  funcao text NOT NULL
);
--> statement-breakpoint
ALTER TABLE public.busca_colecoes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.busca_colecoes FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT ALL ON public.busca_colecoes TO service_role;
--> statement-breakpoint

INSERT INTO public.busca_colecoes (colecao, funcao) VALUES
  ('pncp_contratos_cache', 'busca_projecao_pncp_contratos'),
  ('contratos_cache', 'busca_projecao_contratos_cgu'),
  ('cgu_licitacoes_cache', 'busca_projecao_licitacoes'),
  ('cgu_transferegov_emendas_cache', 'busca_projecao_emendas'),
  ('convenios_cache', 'busca_projecao_convenios'),
  ('fornecedores_cache', 'busca_projecao_fornecedores'),
  ('tse_candidatos_cache', 'busca_projecao_candidaturas'),
  ('artigos', 'busca_projecao_artigos'),
  ('camara_deputados_cache', 'busca_projecao_deputados'),
  ('senado_senadores_cache', 'busca_projecao_senadores'),
  ('orgaos_cache', 'busca_projecao_orgaos'),
  ('ibge_municipios_cache', 'busca_projecao_municipios'),
  ('perguntas', 'busca_projecao_perguntas'),
  ('pergunta_modelos', 'busca_projecao_pergunta_modelos'),
  ('roadmap_itens', 'busca_projecao_roadmap'),
  ('lacunas', 'busca_projecao_lacunas')
ON CONFLICT (colecao) DO UPDATE SET funcao = excluded.funcao;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projetar(p_colecao text, p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  f text;
BEGIN
  SELECT funcao INTO f FROM public.busca_colecoes WHERE colecao = p_colecao;
  IF f IS NULL THEN
    RAISE EXCEPTION 'Coleção sem adaptador de busca: %', p_colecao;
  END IF;
  RETURN QUERY EXECUTE format('SELECT * FROM public.%I($1)', f) USING p_ids;
END $$;
--> statement-breakpoint

-- Registra a coleção e cria os gatilhos. `p_chave` é a expressão do id de
-- origem sobre as linhas da tabela (ex.: 'id', ou `votacao_id || ':' || …`).
CREATE OR REPLACE FUNCTION public.busca_registrar_colecao(p_tabela text, p_chave text, p_funcao text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.busca_colecoes (colecao, funcao) VALUES (p_tabela, p_funcao)
  ON CONFLICT (colecao) DO UPDATE SET funcao = excluded.funcao;
  EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_ins ON public.%I', p_tabela);
  EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_upd ON public.%I', p_tabela);
  EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_del ON public.%I', p_tabela);
  EXECUTE format('DROP TRIGGER IF EXISTS busca_indice_trunc ON public.%I', p_tabela);
  EXECUTE format(
    'CREATE TRIGGER busca_indice_ins AFTER INSERT ON public.%I REFERENCING NEW TABLE AS novos '
    'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', p_tabela, p_chave);
  EXECUTE format(
    'CREATE TRIGGER busca_indice_upd AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS antigos NEW TABLE AS novos '
    'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', p_tabela, p_chave);
  EXECUTE format(
    'CREATE TRIGGER busca_indice_del AFTER DELETE ON public.%I REFERENCING OLD TABLE AS antigos '
    'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', p_tabela, p_chave);
  EXECUTE format(
    'CREATE TRIGGER busca_indice_trunc AFTER TRUNCATE ON public.%I '
    'FOR EACH STATEMENT EXECUTE FUNCTION public.busca_tg_indexar(%L)', p_tabela, p_chave);
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_registrar_colecao(text, text, text)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- 2. Projeções legislativas ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.busca_projecao_proposicoes(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'camara_proposicoes_cache', p.id::text, 'propostas', 'proposicao', 'Câmara',
    p.sigla_tipo || ' ' || p.numero || '/' || p.ano,
    p.sigla_tipo || ' ' || p.numero || '/' || p.ano,
    public.busca_normalizar_id(p.sigla_tipo || p.numero || p.ano),
    concat_ws(' ', p.descricao_tipo, p.keywords),
    left(p.ementa, 400), left(p.ementa_detalhada, 1000),
    p.data_apresentacao::date, CASE WHEN p.data_apresentacao IS NOT NULL THEN 'apresentacao' END,
    CASE WHEN p.data_apresentacao IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/camara/proposicoes/' || p.id,
    'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=' || p.id,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'tipo_proposta', p.sigla_tipo, 'situacao', p.ultimo_status_situacao))
  FROM public.camara_proposicoes_cache p
  WHERE p_ids IS NULL OR p.id::text = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_materias(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'senado_materias_cache', m.id::text, 'propostas', 'materia', 'Senado',
    m.sigla_subtipo || ' ' || m.numero || '/' || m.ano,
    m.sigla_subtipo || ' ' || m.numero || '/' || m.ano,
    public.busca_normalizar_id(m.sigla_subtipo || m.numero || m.ano),
    m.autor_principal,
    left(m.ementa, 400), NULL,
    m.data_apresentacao::date, CASE WHEN m.data_apresentacao IS NOT NULL THEN 'apresentacao' END,
    CASE WHEN m.data_apresentacao IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/senado/materias/' || m.id,
    'https://www25.senado.leg.br/web/atividade/materias/-/materia/' || m.id,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'tipo_proposta', m.sigla_subtipo, 'situacao', m.ultima_situacao))
  FROM public.senado_materias_cache m
  WHERE p_ids IS NULL OR m.id::text = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_votacoes_camara(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'camara_votacoes_cache', v.id, 'votacoes', 'votacao', 'Câmara',
    left(coalesce(nullif(v.proposicao_titulo, ''), v.descricao, 'Votação ' || v.id), 200),
    'Votação ' || v.id,
    NULL,
    v.sigla_orgao,
    left(concat_ws(' · ', v.descricao, v.descricao_resultado), 400), NULL,
    v.data::date, CASE WHEN v.data IS NOT NULL THEN 'fato' END,
    CASE WHEN v.data IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/camara/votacoes/' || public.busca_url_segmento(v.id), NULL,
    CASE WHEN v.proposicao_id IS NOT NULL THEN 'propostas' END,
    v.proposicao_id::text, v.proposicao_titulo,
    jsonb_strip_nulls(jsonb_build_object(
      'orgao', v.sigla_orgao,
      'resultado', CASE WHEN v.aprovacao = 1 THEN 'Aprovada'
                        WHEN v.aprovacao = 0 THEN 'Rejeitada' END))
  FROM public.camara_votacoes_cache v
  WHERE p_ids IS NULL OR v.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_votacoes_senado(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'senado_votacoes_cache', v.id, 'votacoes', 'votacao', 'Senado',
    left(coalesce(nullif(v.materia_titulo, ''), v.descricao, 'Votação ' || v.id), 200),
    'Votação ' || v.id,
    NULL,
    v.sigla_orgao,
    left(concat_ws(' · ', v.descricao, v.resultado), 400), NULL,
    v.data::date, CASE WHEN v.data IS NOT NULL THEN 'fato' END,
    CASE WHEN v.data IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/senado/votacoes/' || public.busca_url_segmento(v.id), NULL,
    CASE WHEN v.materia_id IS NOT NULL THEN 'propostas' END,
    v.materia_id::text, v.materia_titulo,
    jsonb_strip_nulls(jsonb_build_object('orgao', v.sigla_orgao, 'resultado', v.resultado))
  FROM public.senado_votacoes_cache v
  WHERE p_ids IS NULL OR v.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_votos_camara(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'camara_votos_cache', v.votacao_id || ':' || v.deputado_id, 'votos', 'voto', 'Câmara',
    coalesce(d.nome, 'Deputado ' || v.deputado_id) || ': ' || v.tipo_voto,
    NULL, NULL, NULL,
    concat_ws(' · ', nullif(concat_ws('-', v.sigla_partido, v.sigla_uf), ''),
      left(coalesce(nullif(vt.proposicao_titulo, ''), vt.descricao), 200)),
    NULL,
    vt.data::date, CASE WHEN vt.data IS NOT NULL THEN 'fato' END,
    CASE WHEN vt.data IS NOT NULL THEN 'dia' END, v.sigla_uf,
    NULL::numeric, NULL, NULL,
    '/camara/votacoes/' || public.busca_url_segmento(v.votacao_id) || '#voto-' || v.deputado_id,
    NULL,
    'votacoes', v.votacao_id,
    left(coalesce(nullif(vt.proposicao_titulo, ''), vt.descricao, 'Votação ' || v.votacao_id), 200),
    jsonb_strip_nulls(jsonb_build_object('voto', v.tipo_voto, 'partido', v.sigla_partido))
  FROM public.camara_votos_cache v
  LEFT JOIN public.camara_deputados_cache d ON d.id = v.deputado_id
  LEFT JOIN public.camara_votacoes_cache vt ON vt.id = v.votacao_id
  WHERE p_ids IS NULL OR (v.votacao_id || ':' || v.deputado_id) = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_votos_senado(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'senado_votos_cache', v.votacao_id || ':' || v.senador_id, 'votos', 'voto', 'Senado',
    coalesce(s.nome, 'Senador ' || v.senador_id) || ': ' || v.tipo_voto,
    NULL, NULL, NULL,
    concat_ws(' · ', nullif(concat_ws('-', v.sigla_partido, v.sigla_uf), ''),
      left(coalesce(nullif(vt.materia_titulo, ''), vt.descricao), 200)),
    NULL,
    vt.data::date, CASE WHEN vt.data IS NOT NULL THEN 'fato' END,
    CASE WHEN vt.data IS NOT NULL THEN 'dia' END, v.sigla_uf,
    NULL::numeric, NULL, NULL,
    '/senado/votacoes/' || public.busca_url_segmento(v.votacao_id) || '#voto-' || v.senador_id,
    NULL,
    'votacoes', v.votacao_id,
    left(coalesce(nullif(vt.materia_titulo, ''), vt.descricao, 'Votação ' || v.votacao_id), 200),
    jsonb_strip_nulls(jsonb_build_object('voto', v.tipo_voto, 'partido', v.sigla_partido))
  FROM public.senado_votos_cache v
  LEFT JOIN public.senado_senadores_cache s ON s.id = v.senador_id
  LEFT JOIN public.senado_votacoes_cache vt ON vt.id = v.votacao_id
  WHERE p_ids IS NULL OR (v.votacao_id || ':' || v.senador_id) = ANY (p_ids)
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION
  public.busca_projecao_proposicoes(text[]),
  public.busca_projecao_materias(text[]),
  public.busca_projecao_votacoes_camara(text[]),
  public.busca_projecao_votacoes_senado(text[]),
  public.busca_projecao_votos_camara(text[]),
  public.busca_projecao_votos_senado(text[])
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('camara_proposicoes_cache', 'id', 'busca_projecao_proposicoes');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('senado_materias_cache', 'id', 'busca_projecao_materias');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('camara_votacoes_cache', 'id', 'busca_projecao_votacoes_camara');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('senado_votacoes_cache', 'id', 'busca_projecao_votacoes_senado');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('camara_votos_cache',
  $k$votacao_id || ':' || deputado_id$k$, 'busca_projecao_votos_camara');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('senado_votos_cache',
  $k$votacao_id || ':' || senador_id$k$, 'busca_projecao_votos_senado');
--> statement-breakpoint

-- 3. Trigram do título sem Votos e Despesas ------------------------------------

DROP INDEX IF EXISTS public.busca_indice_titulo_trgm_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS busca_indice_titulo_trgm_idx
  ON public.busca_indice USING gin (lower(public.busca_sem_acento(titulo)) extensions.gin_trgm_ops)
  WHERE categoria NOT IN ('votos', 'despesas');
--> statement-breakpoint

-- 4. Carga: votos por mês, com commit a cada mês (tarefa de cobertura) --------

CREATE OR REPLACE PROCEDURE public.busca_carregar_votos(p_de date, p_ate date)
LANGUAGE plpgsql
AS $$
DECLARE
  mes date;
  ids text[];
BEGIN
  FOR mes IN SELECT generate_series(date_trunc('month', p_de), date_trunc('month', p_ate), '1 month')::date
  LOOP
    SELECT array_agg(v.votacao_id || ':' || v.deputado_id) INTO ids
    FROM public.camara_votos_cache v
    JOIN public.camara_votacoes_cache vt ON vt.id = v.votacao_id
    WHERE vt.data >= mes AND vt.data < mes + interval '1 month';
    IF ids IS NOT NULL THEN PERFORM public.busca_indexar('camara_votos_cache', ids); END IF;

    SELECT array_agg(v.votacao_id || ':' || v.senador_id) INTO ids
    FROM public.senado_votos_cache v
    JOIN public.senado_votacoes_cache vt ON vt.id = v.votacao_id
    WHERE vt.data >= mes AND vt.data < mes + interval '1 month';
    IF ids IS NOT NULL THEN PERFORM public.busca_indexar('senado_votos_cache', ids); END IF;

    COMMIT;
  END LOOP;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON PROCEDURE public.busca_carregar_votos(date, date) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_reconstruir('camara_proposicoes_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('senado_materias_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('camara_votacoes_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('senado_votacoes_cache');
