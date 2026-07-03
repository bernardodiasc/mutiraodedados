CREATE TABLE public.cgu_emendas_cache (
  id text PRIMARY KEY,
  ano integer NOT NULL,
  tipo_emenda text,
  autor text,
  numero_emenda text,
  localidade text,
  uf text,
  funcao text,
  subfuncao text,
  valor_empenhado numeric DEFAULT 0,
  valor_liquidado numeric DEFAULT 0,
  valor_pago numeric DEFAULT 0,
  valor_resto_inscrito numeric DEFAULT 0,
  valor_resto_pago numeric DEFAULT 0,
  valor_resto_cancelado numeric DEFAULT 0,
  url_oficial text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cgu_emendas_cache TO anon, authenticated;
GRANT ALL ON public.cgu_emendas_cache TO service_role;

ALTER TABLE public.cgu_emendas_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cgu_emendas select all" ON public.cgu_emendas_cache
  FOR SELECT USING (true);
CREATE POLICY "cgu_emendas admin write" ON public.cgu_emendas_cache
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cgu_emendas_ano ON public.cgu_emendas_cache(ano);
CREATE INDEX idx_cgu_emendas_uf ON public.cgu_emendas_cache(uf);
CREATE INDEX idx_cgu_emendas_autor ON public.cgu_emendas_cache(autor);

CREATE OR REPLACE FUNCTION public.cobertura_cgu_emendas()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano, 1 AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.cgu_emendas_cache
  GROUP BY ano
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_cgu_emendas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_cgu_emendas() TO service_role;

CREATE TABLE public.cgu_convenios_cache (
  id text PRIMARY KEY,
  numero text,
  codigo_siconv text,
  objeto text,
  orgao_cod text,
  orgao_nome text,
  orgao_cnpj text,
  convenente_nome text,
  convenente_cnpj text,
  uf text,
  municipio_ibge text,
  municipio_nome text,
  situacao text,
  tipo_instrumento text,
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

GRANT SELECT ON public.cgu_convenios_cache TO anon, authenticated;
GRANT ALL ON public.cgu_convenios_cache TO service_role;

ALTER TABLE public.cgu_convenios_cache ENABLE ROW LEVEL SECURITY;

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