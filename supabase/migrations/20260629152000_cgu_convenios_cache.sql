-- Portal da Transparência (CGU) — endpoint /convenios.
-- Entidade-tópico "Convênios". Varredura por janela de vigência (mesmo endpoint
-- que `transferegov_instrumentos_cache` já usa; tabela nova por decisão de
-- projeto para isolar os pipelines de QA/cobertura/limpeza dos dois eixos).
--
-- Campos travados por inspeção ao vivo (de-risking Fase 0):
--   id, dimConvenio{codigo,numero,objeto}, convenente{cnpjFormatado,nome},
--   municipioConvenente{codigoIBGE,nomeIBGE,uf}, orgao{codigoSIAFI,cnpj,nome},
--   situacao, tipoInstrumento{descricao}, valor, valorLiberado,
--   valorContrapartida, dataInicioVigencia, dataFinalVigencia, dataPublicacao.
--   ATENÇÃO: o objeto `uf` vem com sigla/nome trocados (sigla de 2 letras em
--   `uf.nome`).

CREATE TABLE public.cgu_convenios_cache (
  id text PRIMARY KEY,
  numero text,                     -- dimConvenio.numero
  codigo_siconv text,              -- dimConvenio.codigo
  objeto text,                     -- dimConvenio.objeto
  orgao_cod text,                  -- orgao.codigoSIAFI
  orgao_nome text,
  orgao_cnpj text,
  convenente_nome text,
  convenente_cnpj text,
  uf text,
  municipio_ibge text,
  municipio_nome text,
  situacao text,
  tipo_instrumento text,           -- tipoInstrumento.descricao
  valor numeric DEFAULT 0,
  valor_liberado numeric DEFAULT 0,
  valor_contrapartida numeric DEFAULT 0,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  data_publicacao date,
  ano integer NOT NULL,
  mes_referencia integer,
  url_oficial text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cgu_convenios_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cgu_convenios_cache TO anon, authenticated;
GRANT ALL ON public.cgu_convenios_cache TO service_role;

CREATE POLICY "cgu_convenios select all" ON public.cgu_convenios_cache
  FOR SELECT USING (true);
CREATE POLICY "cgu_convenios admin write" ON public.cgu_convenios_cache
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cgu_convenios_uf ON public.cgu_convenios_cache(uf);
CREATE INDEX idx_cgu_convenios_ano ON public.cgu_convenios_cache(ano);
CREATE INDEX idx_cgu_convenios_orgao ON public.cgu_convenios_cache(orgao_cod);
CREATE INDEX idx_cgu_convenios_mun ON public.cgu_convenios_cache(municipio_ibge);

-- Cobertura por ano × mês de REFERÊNCIA (a dimensão pela qual o endpoint
-- /convenios filtra a janela), linha única (sem órgão). Assim a célula do mês
-- na matriz casa com o que a varredura daquela janela ingeriu.
CREATE OR REPLACE FUNCTION public.cobertura_cgu_convenios()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano,
         COALESCE(mes_referencia::int, 0) AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.cgu_convenios_cache
  GROUP BY ano, COALESCE(mes_referencia::int, 0)
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_cgu_convenios() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_cgu_convenios() TO service_role;
