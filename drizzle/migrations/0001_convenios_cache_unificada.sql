CREATE TABLE IF NOT EXISTS public.convenios_cache (
  id                   text PRIMARY KEY,
  fonte                text NOT NULL DEFAULT 'cgu',
  numero               text,
  codigo_siconv        text,
  objeto               text,
  situacao             text,
  tipo_instrumento     text,
  orgao_cod            text,
  orgao_nome           text,
  orgao_cnpj           text,
  convenente_nome      text,
  convenente_cnpj      text,
  esfera_convenente    text,
  uf                   text,
  municipio_ibge       text,
  municipio_nome       text,
  valor                numeric,
  valor_liberado       numeric,
  valor_contrapartida  numeric,
  data_assinatura      date,
  data_inicio_vigencia date,
  data_fim_vigencia    date,
  data_publicacao      date,
  ano                  integer NOT NULL,
  mes_referencia       integer,
  url_oficial          text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS convenios_cache_uf_idx ON public.convenios_cache (uf);
CREATE INDEX IF NOT EXISTS convenios_cache_municipio_idx ON public.convenios_cache (municipio_ibge);
CREATE INDEX IF NOT EXISTS convenios_cache_orgao_idx ON public.convenios_cache (orgao_cod);
CREATE INDEX IF NOT EXISTS convenios_cache_assinatura_idx ON public.convenios_cache (data_assinatura);

GRANT ALL ON public.convenios_cache TO service_role;
GRANT SELECT ON public.convenios_cache TO anon, authenticated;
ALTER TABLE public.convenios_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convenios select all" ON public.convenios_cache
  FOR SELECT USING (true);
CREATE POLICY "convenios admin write" ON public.convenios_cache
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.convenios_cache (
  id, fonte, numero, codigo_siconv, objeto, situacao, tipo_instrumento,
  orgao_nome, orgao_cnpj, convenente_nome, convenente_cnpj, esfera_convenente,
  uf, municipio_ibge, municipio_nome, valor, valor_liberado,
  valor_contrapartida, data_assinatura, data_inicio_vigencia,
  data_fim_vigencia, ano, updated_at
)
SELECT id, 'cgu', numero, codigo_siconv, objeto, situacao, modalidade,
       orgao_concedente_nome, orgao_concedente_cnpj, beneficiario_nome,
       beneficiario_cnpj, esfera_beneficiario, uf_beneficiario,
       municipio_ibge, municipio_nome, valor_global, valor_repasse,
       valor_contrapartida, data_assinatura, data_inicio_vigencia,
       data_fim_vigencia,
       COALESCE(EXTRACT(YEAR FROM COALESCE(data_assinatura, data_inicio_vigencia))::int,
                EXTRACT(YEAR FROM updated_at)::int),
       updated_at
FROM public.transferegov_instrumentos_cache
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.convenios_cache (
  id, fonte, numero, codigo_siconv, objeto, situacao, tipo_instrumento,
  orgao_cod, orgao_nome, orgao_cnpj, convenente_nome, convenente_cnpj,
  uf, municipio_ibge, municipio_nome, valor, valor_liberado,
  valor_contrapartida, data_inicio_vigencia, data_fim_vigencia,
  data_publicacao, ano, mes_referencia, url_oficial, updated_at
)
SELECT id, 'cgu', numero, codigo_siconv, objeto, situacao, tipo_instrumento,
       orgao_cod, orgao_nome, orgao_cnpj, convenente_nome, convenente_cnpj,
       uf, municipio_ibge, municipio_nome, valor, valor_liberado,
       valor_contrapartida, data_inicio_vigencia, data_fim_vigencia,
       data_publicacao, ano, mes_referencia, url_oficial, updated_at
FROM public.cgu_convenios_cache
ON CONFLICT (id) DO UPDATE SET
  orgao_cod = COALESCE(EXCLUDED.orgao_cod, convenios_cache.orgao_cod),
  data_publicacao = COALESCE(EXCLUDED.data_publicacao, convenios_cache.data_publicacao),
  mes_referencia = COALESCE(EXCLUDED.mes_referencia, convenios_cache.mes_referencia),
  url_oficial = COALESCE(EXCLUDED.url_oficial, convenios_cache.url_oficial);

COMMENT ON TABLE public.cgu_convenios_cache IS 'DEPRECATED: substituída por convenios_cache (v0.9.0). Dados migrados; não usar.';
COMMENT ON TABLE public.transferegov_instrumentos_cache IS 'DEPRECATED: substituída por convenios_cache (v0.9.0). Dados migrados; não usar.';

CREATE OR REPLACE FUNCTION public.cobertura_cgu_convenios()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ano, COALESCE(mes_referencia::int, 0) AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.convenios_cache
  GROUP BY ano, COALESCE(mes_referencia::int, 0)
$function$;

CREATE OR REPLACE FUNCTION public.cobertura_transferegov()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXTRACT(YEAR  FROM COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia))::int,
         EXTRACT(MONTH FROM COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia))::int,
         COUNT(*)::bigint, MAX(updated_at)
  FROM public.convenios_cache
  WHERE COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia) IS NOT NULL
  GROUP BY 1, 2
$function$;

CREATE OR REPLACE FUNCTION public.tabela_cache_limpavel(_tabela text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT _tabela = ANY (ARRAY[
    'camara_deputado_legislaturas','camara_deputados_cache','camara_despesas_cache',
    'camara_proposicoes_autores_cache','camara_proposicoes_cache','camara_votacoes_cache',
    'camara_votos_cache','cgu_licitacoes_cache',
    'cgu_transferegov_emendas_cache','contratos_cache','convenios_cache',
    'fornecedores_cache','ibge_municipios_cache','orgaos_cache',
    'pncp_contratos_cache','senado_despesas_cache','senado_materias_autores_cache',
    'senado_materias_cache','senado_senador_legislaturas','senado_senadores_cache',
    'senado_votacoes_cache','senado_votos_cache','siconfi_relatorios_cache',
    'tse_bens_candidato_cache','tse_candidatos_cache',
    'tse_despesas_campanha_cache','tse_receitas_campanha_cache','tse_resultados_cache'
  ])
$function$;