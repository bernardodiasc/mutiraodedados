-- Índice de busca (v0.16.0): despesas da cota parlamentar — CEAP (Câmara) e
-- CEAPS (Senado), categoria Despesas.
--
-- Uma linha por despesa, com o parlamentar como registro-pai e destino na
-- linha da despesa na ficha dele: `/…/<id>?ano=<ano>&mes=<mes>#despesa-<id>`.
-- A ficha abre filtrada no mês da despesa (a lista completa trunca) e rola até
-- a linha.
--
-- Projeção enxuta: categoria da despesa, fornecedor, parlamentar, documento,
-- período e valor. O fornecedor pessoa física entra pelo nome; o CPF nunca é
-- pesquisável (`busca_cnpj` só devolve CNPJ) e só aparece mascarado
-- (`busca_documento_publico`).
--
-- Data principal: a data do documento; sem ela, o mês de competência.

CREATE OR REPLACE FUNCTION public.busca_projecao_despesas_camara(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'camara_despesas_cache', e.id, 'despesas', 'ceap', 'Câmara',
    left(concat_ws(' — ', nullif(e.tipo_despesa, ''),
      coalesce(nullif(e.fornecedor_nome, ''), 'Fornecedor não informado')), 200),
    CASE WHEN nullif(e.num_documento, '') IS NOT NULL THEN 'Documento ' || e.num_documento END,
    NULL,
    concat_ws(' ', e.fornecedor_nome, d.nome, public.busca_cnpj(e.fornecedor_cnpj)),
    concat_ws(' · ',
      coalesce(d.nome, 'Deputado ' || e.deputado_id),
      nullif(concat_ws('-', d.sigla_partido, d.sigla_uf), ''),
      nullif(concat_ws(' ', e.tipo_documento, e.num_documento), ''),
      'competência ' || lpad(e.mes::text, 2, '0') || '/' || e.ano),
    NULL,
    coalesce(e.data_documento, make_date(e.ano, e.mes, 1)),
    CASE WHEN e.data_documento IS NOT NULL THEN 'fato' ELSE 'exercicio' END,
    CASE WHEN e.data_documento IS NOT NULL THEN 'dia' ELSE 'mes' END,
    d.sigla_uf,
    e.valor_liquido, 'valor líquido reembolsado', 'BRL',
    '/camara/deputados/' || e.deputado_id || '?ano=' || e.ano || '&mes=' || e.mes
      || '#despesa-' || public.busca_url_segmento(e.id),
    e.url_documento,
    'pessoas', e.deputado_id::text, coalesce(d.nome, 'Deputado ' || e.deputado_id),
    jsonb_strip_nulls(jsonb_build_object(
      'parlamentar', d.nome, 'tipo_despesa', nullif(e.tipo_despesa, ''),
      'fornecedor', e.fornecedor_nome,
      'documento_fornecedor', public.busca_documento_publico(e.fornecedor_cnpj)))
  FROM public.camara_despesas_cache e
  LEFT JOIN public.camara_deputados_cache d ON d.id = e.deputado_id
  WHERE p_ids IS NULL OR e.id = ANY (p_ids)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_despesas_senado(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'senado_despesas_cache', e.id, 'despesas', 'ceaps', 'Senado',
    left(concat_ws(' — ', nullif(e.tipo_despesa, ''),
      coalesce(nullif(e.fornecedor_nome, ''), 'Fornecedor não informado')), 200),
    CASE WHEN nullif(e.num_documento, '') IS NOT NULL THEN 'Documento ' || e.num_documento END,
    NULL,
    concat_ws(' ', e.fornecedor_nome, s.nome, public.busca_cnpj(e.fornecedor_cnpj)),
    concat_ws(' · ',
      coalesce(s.nome, 'Senador ' || e.senador_id),
      nullif(concat_ws('-', s.sigla_partido, s.sigla_uf), ''),
      left(nullif(e.detalhamento, ''), 200),
      'competência ' || lpad(e.mes::text, 2, '0') || '/' || e.ano),
    NULL,
    coalesce(e.data_documento, make_date(e.ano, e.mes, 1)),
    CASE WHEN e.data_documento IS NOT NULL THEN 'fato' ELSE 'exercicio' END,
    CASE WHEN e.data_documento IS NOT NULL THEN 'dia' ELSE 'mes' END,
    s.sigla_uf,
    e.valor_reembolsado, 'valor reembolsado', 'BRL',
    '/senado/senadores/' || e.senador_id || '?ano=' || e.ano || '&mes=' || e.mes
      || '#despesa-' || public.busca_url_segmento(e.id),
    NULL,
    'pessoas', e.senador_id::text, coalesce(s.nome, 'Senador ' || e.senador_id),
    jsonb_strip_nulls(jsonb_build_object(
      'parlamentar', s.nome, 'tipo_despesa', nullif(e.tipo_despesa, ''),
      'fornecedor', e.fornecedor_nome,
      'documento_fornecedor', public.busca_documento_publico(e.fornecedor_cnpj)))
  FROM public.senado_despesas_cache e
  LEFT JOIN public.senado_senadores_cache s ON s.id = e.senador_id
  WHERE p_ids IS NULL OR e.id = ANY (p_ids)
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION
  public.busca_projecao_despesas_camara(text[]),
  public.busca_projecao_despesas_senado(text[])
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('camara_despesas_cache', 'id', 'busca_projecao_despesas_camara');
--> statement-breakpoint
SELECT public.busca_registrar_colecao('senado_despesas_cache', 'id', 'busca_projecao_despesas_senado');
--> statement-breakpoint

-- Carga inicial: as duas tabelas são pequenas hoje.
SELECT public.busca_reconstruir('camara_despesas_cache');
--> statement-breakpoint
SELECT public.busca_reconstruir('senado_despesas_cache');
