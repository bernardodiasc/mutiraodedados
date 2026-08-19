CREATE OR REPLACE FUNCTION public.tabela_cache_limpavel(_tabela text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _tabela = ANY (ARRAY[
    'camara_deputado_legislaturas','camara_deputados_cache','camara_despesas_cache',
    'camara_proposicoes_autores_cache','camara_proposicoes_cache','camara_votacoes_cache',
    'camara_votos_cache','cgu_convenios_cache','cgu_licitacoes_cache',
    'cgu_transferegov_emendas_cache','contratos_cache','fornecedores_cache','orgaos_cache',
    'pncp_contratos_cache','senado_despesas_cache','senado_materias_autores_cache',
    'senado_materias_cache','senado_senador_legislaturas','senado_senadores_cache',
    'senado_votacoes_cache','senado_votos_cache','siconfi_relatorios_cache',
    'transferegov_instrumentos_cache','tse_bens_candidato_cache','tse_candidatos_cache',
    'tse_despesas_campanha_cache','tse_receitas_campanha_cache','tse_resultados_cache'
  ])
$$;