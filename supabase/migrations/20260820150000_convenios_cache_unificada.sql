-- Uma tabela para convênios, com coluna de fonte (v0.9.0).
--
-- `cgu_convenios_cache` e `transferegov_instrumentos_cache` guardavam o MESMO
-- convênio vindo do MESMO endpoint (/convenios do Portal da Transparência),
-- cada uma mapeando um subconjunto do payload: 11 colunas idênticas, 9 pares
-- que eram o mesmo campo bruto renomeado (valor/valor_global, valor_liberado/
-- valor_repasse, convenente_*/beneficiario_*, tipo_instrumento/modalidade), e
-- as demais presentes no payload que ambas recebiam. O custo real da
-- duplicação: dois pipelines de QA, duas limpezas, duas coberturas e
-- divergência silenciosa — os links oficiais e os rótulos de fonte divergiram
-- na v0.6.0 exatamente por isso.
--
-- Esta tabela é o superconjunto, com nomes canônicos do lado CGU. `fonte`
-- registra a API consultada: 'cgu' hoje; 'transferegov' quando o módulo
-- Discricionárias e Legais ganhar API (prevista 2026/2027) — aí o seletor de
-- /convenios volta a distinguir fontes, e o modelo já comporta.
CREATE TABLE IF NOT EXISTS public.convenios_cache (
  id                   text PRIMARY KEY,
  fonte                text NOT NULL DEFAULT 'cgu',
  numero               text,
  codigo_siconv        text,
  objeto               text,
  situacao             text,
  tipo_instrumento     text,
  -- ponta federal (quem concede)
  orgao_cod            text,
  orgao_nome           text,
  orgao_cnpj           text,
  -- ponta do ente (quem recebe)
  convenente_nome      text,
  convenente_cnpj      text,
  esfera_convenente    text,
  uf                   text,
  municipio_ibge       text,
  municipio_nome       text,
  -- valores (mesmo campo bruto nas duas tabelas antigas)
  valor                numeric,
  valor_liberado       numeric,
  valor_contrapartida  numeric,
  -- datas
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

-- Dados existentes: o ângulo por ente primeiro (traz assinatura e esfera)…
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

-- …e o ângulo de execução por cima, completando as colunas que só ele tinha.
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

DROP TABLE public.cgu_convenios_cache;
DROP TABLE public.transferegov_instrumentos_cache;

-- As duas RPCs de cobertura continuam existindo (os ids de histórico
-- `cgu_convenios` e `transferegov` seguem gravados em `importacoes`), agora
-- sobre a tabela única: uma lê o acervo pela referência mensal do Portal, a
-- outra pela data de assinatura — os dois calendários do mesmo dado.
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

-- Allowlist da limpeza: entra a tabela nova, saem as duas antigas — e entra
-- também a ibge_municipios_cache da v0.7.0, que ficou fora por engano (a
-- limpeza do IBGE falharia na primeira tentativa).
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
