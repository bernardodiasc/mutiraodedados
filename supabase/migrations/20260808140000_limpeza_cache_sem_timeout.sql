-- Limpeza de caches grandes sem esbarrar no statement_timeout.
--
-- O problema: a manutenção apagava cada fonte com um único DELETE via
-- PostgREST. Com 492 mil candidaturas do TSE isso já dava
-- "canceling statement due to statement timeout"; com as receitas de campanha
-- de 2022 (milhões de linhas) nenhuma retentativa resolveria.
--
-- Duas funções de propósito único, em vez de uma com modos:
--   - truncar_cache: o caso "apagar tudo". TRUNCATE não percorre linha a
--     linha, então o tamanho da tabela deixa de importar. Sem CASCADE de
--     propósito: se um dia existir uma FK real apontando para a tabela,
--     queremos o erro, não o apagamento silencioso da dependente.
--     Verificado em 2026-08-08: nenhuma FK real aponta para as tabelas abaixo
--     (as "cascatas" de votações/proposições são lógicas, resolvidas no app).
--     Isso importa porque TRUNCATE recusa a tabela referenciada por uma FK
--     ainda que a tabela dependente esteja vazia.
--   - limpar_cache_por_ano: o caso com filtro de período, que continua sendo
--     um DELETE — mas com orçamento de tempo próprio.
--
-- Ambas com SET statement_timeout local: manutenção de administrador tem outro
-- perfil de duração do que uma leitura de página, e o limite curto do PostgREST
-- não faz sentido aqui.
--
-- 55s, e não mais: o gateway HTTP do Supabase encerra a requisição por volta de
-- 60s. Um timeout de banco MAIOR que o do gateway daria 504 ao cliente com o
-- DELETE ainda rodando no servidor — o pior resultado possível, porque ninguém
-- fica sabendo se apagou. Com 55s o Postgres cancela primeiro e o erro chega
-- nomeando a fonte. TRUNCATE não percorre linhas, então o caso "apagar tudo"
-- termina em milissegundos mesmo com milhões de linhas.
--
-- Nomes de tabela e de coluna entram em SQL dinâmico, então os dois passam por
-- lista fechada — %I sozinho evitaria injeção, mas não evitaria apagar uma
-- tabela que não é cache de importação.

CREATE OR REPLACE FUNCTION public.tabela_cache_limpavel(_tabela text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _tabela = ANY (ARRAY[
    'camara_deputado_legislaturas',
    'camara_deputados_cache',
    'camara_despesas_cache',
    'camara_proposicoes_autores_cache',
    'camara_proposicoes_cache',
    'camara_votacoes_cache',
    'camara_votos_cache',
    'cgu_convenios_cache',
    'cgu_licitacoes_cache',
    'cgu_transferegov_emendas_cache',
    'contratos_cache',
    'fornecedores_cache',
    'orgaos_cache',
    'pncp_contratos_cache',
    'senado_despesas_cache',
    'senado_materias_autores_cache',
    'senado_materias_cache',
    'senado_senador_legislaturas',
    'senado_senadores_cache',
    'senado_votacoes_cache',
    'senado_votos_cache',
    'siconfi_relatorios_cache',
    'transferegov_instrumentos_cache',
    'tse_bens_candidato_cache',
    'tse_candidatos_cache',
    'tse_despesas_campanha_cache',
    'tse_receitas_campanha_cache',
    'tse_resultados_cache'
  ])
$$;

COMMENT ON FUNCTION public.tabela_cache_limpavel(text) IS
  'Lista fechada dos caches de importação que a manutenção pode esvaziar. Espelha FONTES_LIMPEZA em src/lib/data/limpeza.ts. `importacoes` fica de fora: a limpeza dela usa filtros de sub-modo e a tabela é pequena.';

-- Esvazia a tabela inteira e devolve quantas linhas havia.
CREATE OR REPLACE FUNCTION public.truncar_cache(_tabela text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '55s'
AS $$
DECLARE
  n bigint;
BEGIN
  IF NOT public.tabela_cache_limpavel(_tabela) THEN
    RAISE EXCEPTION 'tabela % não é um cache de importação limpável', _tabela;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', _tabela) INTO n;
  EXECUTE format('TRUNCATE TABLE public.%I', _tabela);
  RETURN n;
END;
$$;

-- Apaga um intervalo de anos e devolve quantas linhas saíram.
CREATE OR REPLACE FUNCTION public.limpar_cache_por_ano(
  _tabela text,
  _ano_col text,
  _ano_ini integer,
  _ano_fim integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '55s'
AS $$
DECLARE
  n bigint;
BEGIN
  IF NOT public.tabela_cache_limpavel(_tabela) THEN
    RAISE EXCEPTION 'tabela % não é um cache de importação limpável', _tabela;
  END IF;
  -- Únicas colunas de ano em uso nos caches (ver FONTES_LIMPEZA.yearCol).
  IF _ano_col NOT IN ('ano', 'ano_eleicao', 'exercicio') THEN
    RAISE EXCEPTION 'coluna de ano % não permitida', _ano_col;
  END IF;
  IF _ano_ini IS NULL OR _ano_fim IS NULL OR _ano_ini > _ano_fim THEN
    RAISE EXCEPTION 'intervalo de anos inválido: % a %', _ano_ini, _ano_fim;
  END IF;
  EXECUTE format(
    'DELETE FROM public.%I WHERE %I BETWEEN $1 AND $2', _tabela, _ano_col
  ) USING _ano_ini, _ano_fim;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Manutenção é ação de administrador, executada pela service_role no servidor.
REVOKE EXECUTE ON FUNCTION public.truncar_cache(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpar_cache_por_ano(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.truncar_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_cache_por_ano(text, text, integer, integer) TO service_role;
