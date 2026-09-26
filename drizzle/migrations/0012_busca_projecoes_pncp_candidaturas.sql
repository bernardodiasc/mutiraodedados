-- Correções em duas projeções do índice de busca (`0010_busca_indice`).
--
-- Contratos do PNCP: `pncp_contratos_cache.modalidade` guarda o tipo do
-- contrato (`tipoContrato.nome` da API: "Contrato (termo inicial)",
-- "Empenho", "Outros"), não a modalidade da licitação. O índice passa a pôr
-- esse valor na faceta `tipo_contrato`, e a faceta `modalidade` fica só com a
-- modalidade de verdade (contratos da CGU).
--
-- Candidaturas: a eleição aparecia três vezes no cartão (identificador,
-- resumo e data principal). Fica só na data principal ("Eleição: 2026");
-- o identificador passa a ser o número do candidato.
--
-- Depois de aplicar, reconstruir as duas coleções (ver o PR).

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
      'tipo_contrato', c.modalidade, 'orgao', c.orgao_nome, 'situacao', c.situacao,
      'esfera', c.esfera, 'municipio', c.municipio_nome, 'fornecedor', c.fornecedor_nome,
      'documento_fornecedor', public.busca_documento_publico(c.fornecedor_cnpj_cpf)))
  FROM public.pncp_contratos_cache c
  WHERE p_ids IS NULL OR c.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_candidaturas(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'tse_candidatos_cache', c.sq_candidato || '-' || c.ano_eleicao, 'pessoas', 'candidatura', 'TSE',
    coalesce(nullif(c.nome_urna, ''), c.nome_completo, c.sq_candidato),
    'nº ' || nullif(c.numero_candidato, ''),
    NULL,
    concat_ws(' ', c.nome_completo, c.partido_sigla),
    concat_ws(' · ', c.cargo_nome, c.partido_sigla, c.uf, c.situacao_totalizacao),
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

REVOKE EXECUTE ON FUNCTION
  public.busca_projecao_pncp_contratos(text[]),
  public.busca_projecao_candidaturas(text[])
FROM PUBLIC, anon, authenticated;
