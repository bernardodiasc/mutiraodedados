
-- Funções de agregação para a matriz de cobertura do painel admin.
-- Retornam contagens (ano, mês) e updated_at mais recente por fonte.
-- Acesso restrito a admin via SECURITY DEFINER + verificação interna.

CREATE OR REPLACE FUNCTION public.cobertura_cgu()
RETURNS TABLE(orgao_cod text, ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT orgao_cod,
         ano,
         EXTRACT(MONTH FROM data_assinatura)::int AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.contratos_cache
  WHERE data_assinatura IS NOT NULL
  GROUP BY orgao_cod, ano, EXTRACT(MONTH FROM data_assinatura)
$$;

CREATE OR REPLACE FUNCTION public.cobertura_camara_ceap()
RETURNS TABLE(ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ano, mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.camara_despesas_cache
  GROUP BY ano, mes
$$;

CREATE OR REPLACE FUNCTION public.cobertura_camara_votacoes()
RETURNS TABLE(ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(YEAR FROM data)::int AS ano,
         EXTRACT(MONTH FROM data)::int AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.camara_votacoes_cache
  WHERE data IS NOT NULL
  GROUP BY EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)
$$;

CREATE OR REPLACE FUNCTION public.cobertura_senado_ceaps()
RETURNS TABLE(ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ano, mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.senado_despesas_cache
  GROUP BY ano, mes
$$;

CREATE OR REPLACE FUNCTION public.cobertura_senado_votacoes()
RETURNS TABLE(ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(YEAR FROM data)::int AS ano,
         EXTRACT(MONTH FROM data)::int AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.senado_votacoes_cache
  WHERE data IS NOT NULL
  GROUP BY EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)
$$;

CREATE OR REPLACE FUNCTION public.cobertura_pncp()
RETURNS TABLE(ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(YEAR FROM data_assinatura)::int AS ano,
         EXTRACT(MONTH FROM data_assinatura)::int AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.pncp_contratos_cache
  WHERE data_assinatura IS NOT NULL
  GROUP BY EXTRACT(YEAR FROM data_assinatura), EXTRACT(MONTH FROM data_assinatura)
$$;

CREATE OR REPLACE FUNCTION public.cobertura_transferegov()
RETURNS TABLE(ano int, mes int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(YEAR FROM data_assinatura)::int AS ano,
         EXTRACT(MONTH FROM data_assinatura)::int AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.transferegov_instrumentos_cache
  WHERE data_assinatura IS NOT NULL
  GROUP BY EXTRACT(YEAR FROM data_assinatura), EXTRACT(MONTH FROM data_assinatura)
$$;

-- SICONFI: cobertura por tipo_relatorio × exercicio × periodo (mes ≈ periodo quando aplicável)
CREATE OR REPLACE FUNCTION public.cobertura_siconfi()
RETURNS TABLE(tipo_relatorio text, ano int, periodo int, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tipo_relatorio,
         exercicio,
         COALESCE(periodo, 0),
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.siconfi_relatorios_cache
  GROUP BY tipo_relatorio, exercicio, COALESCE(periodo, 0)
$$;

-- Estas funções só serão chamadas via supabaseAdmin no servidor (verificação de
-- admin é feita na camada da server function). Revogamos execute do público
-- para defesa em profundidade.
REVOKE EXECUTE ON FUNCTION public.cobertura_cgu() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_ceap() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_camara_votacoes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_ceaps() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_senado_votacoes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_pncp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_transferegov() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cobertura_siconfi() FROM PUBLIC;
