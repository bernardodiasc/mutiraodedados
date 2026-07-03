-- Portal da Transparência (CGU) — endpoint /emendas.
-- Entidade-tópico "Emendas parlamentares". DIFERENTE das demais: o endpoint NÃO
-- é por órgão — filtra por ANO (varredura por ano, ver licitacoes/emendas
-- functions). Cada emenda já traz as 3 fases da despesa (empenhado/liquidado/
-- pago) e os restos. Há sobreposição com `transferegov_emendas_cache`
-- (finalidade definida), aceita por decisão de projeto para isolar pipelines.
--
-- Campos travados por inspeção ao vivo (de-risking Fase 0):
--   codigoEmenda, ano, tipoEmenda, autor/nomeAutor, numeroEmenda,
--   localidadeDoGasto ("CIDADE - UF"), funcao, subfuncao,
--   valorEmpenhado/Liquidado/Pago/RestoInscrito/RestoPago/RestoCancelado
--   (strings pt-BR "10.000,00").

CREATE TABLE public.cgu_emendas_cache (
  id text PRIMARY KEY,             -- codigoEmenda
  ano integer NOT NULL,
  tipo_emenda text,
  autor text,
  numero_emenda text,
  localidade text,                 -- localidadeDoGasto cru ("CIDADE - UF")
  uf text,                         -- derivado da localidade
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

ALTER TABLE public.cgu_emendas_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cgu_emendas_cache TO anon, authenticated;
GRANT ALL ON public.cgu_emendas_cache TO service_role;

CREATE POLICY "cgu_emendas select all" ON public.cgu_emendas_cache
  FOR SELECT USING (true);
CREATE POLICY "cgu_emendas admin write" ON public.cgu_emendas_cache
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cgu_emendas_ano ON public.cgu_emendas_cache(ano);
CREATE INDEX idx_cgu_emendas_uf ON public.cgu_emendas_cache(uf);
CREATE INDEX idx_cgu_emendas_autor ON public.cgu_emendas_cache(autor);

-- Cobertura por ano (granularidade "ano" — uma coluna por ano na matriz, como
-- as transferências EC 105). mes=1 é a âncora do ano.
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
