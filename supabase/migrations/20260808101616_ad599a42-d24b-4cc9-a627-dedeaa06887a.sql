ALTER TABLE public.tse_bens_candidato_cache
  ADD COLUMN IF NOT EXISTS tipo_bem_cod text;

COMMENT ON COLUMN public.tse_bens_candidato_cache.tipo_bem_cod IS
  'CD_TIPO_BEM_CANDIDATO do TSE (tabela Bens e Direitos). NULL em linhas importadas antes de 2026-08.';

CREATE INDEX IF NOT EXISTS tse_candidatos_titulo_idx
  ON public.tse_candidatos_cache(titulo_eleitoral);

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
  'Lista fechada dos caches de importação que a manutenção pode esvaziar. Espelha FONTES_LIMPEZA em src/lib/data/limpeza.ts.';

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

REVOKE EXECUTE ON FUNCTION public.truncar_cache(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpar_cache_por_ano(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.truncar_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_cache_por_ano(text, text, integer, integer) TO service_role;