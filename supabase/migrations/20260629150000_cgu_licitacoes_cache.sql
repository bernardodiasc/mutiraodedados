-- Portal da Transparência (CGU) — endpoint /licitacoes.
-- Primeira entidade-tópico nova do barramento multi-endpoint da CGU (além de
-- contratos). Mesma mecânica de varredura por órgão (ver src/lib/data/real/
-- sweep.ts + licitacoes.functions.ts). Granularidade de cobertura: ano + mês
-- (mês de abertura/publicação da licitação).
--
-- Campos travados por inspeção ao vivo do endpoint (de-risking Fase 0):
--   id, licitacao{numero,objeto,numeroProcesso}, dataAbertura, dataPublicacao,
--   dataResultadoCompra, situacaoCompra, modalidadeLicitacao, valor,
--   municipio{codigoIBGE,nomeIBGE,uf}, unidadeGestora{orgaoMaximo.codigo,
--   orgaoVinculado.cnpj}. ATENÇÃO: o objeto `uf` da API vem com sigla/nome
--   trocados — a sigla de 2 letras está em `uf.nome`.

CREATE TABLE public.cgu_licitacoes_cache (
  id text PRIMARY KEY,
  orgao_cod text NOT NULL,
  orgao_cnpj text,              -- unidadeGestora.orgaoVinculado.cnpj (p/ busca PNCP)
  unidade_gestora text,
  ano integer NOT NULL,
  uf text,
  municipio_ibge text,
  municipio_nome text,
  numero text,                  -- licitacao.numero
  numero_processo text,         -- licitacao.numeroProcesso
  objeto text,
  modalidade text,              -- modalidadeLicitacao
  situacao text,                -- situacaoCompra
  valor numeric DEFAULT 0,
  data_abertura date,
  data_publicacao date,
  data_resultado date,
  mes_referencia integer,       -- mês de abertura (fallback publicação)
  url_oficial text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cgu_licitacoes_cache ENABLE ROW LEVEL SECURITY;

-- Cache público read-only (mesmo padrão de pncp_contratos_cache / contratos_cache):
-- leitura para todos, escrita só admin (via service_role nas server functions).
GRANT SELECT ON public.cgu_licitacoes_cache TO anon, authenticated;
GRANT ALL ON public.cgu_licitacoes_cache TO service_role;

CREATE POLICY "cgu_licitacoes select all" ON public.cgu_licitacoes_cache
  FOR SELECT USING (true);
CREATE POLICY "cgu_licitacoes admin write" ON public.cgu_licitacoes_cache
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cgu_licitacoes_uf ON public.cgu_licitacoes_cache(uf);
CREATE INDEX idx_cgu_licitacoes_ano ON public.cgu_licitacoes_cache(ano);
CREATE INDEX idx_cgu_licitacoes_orgao ON public.cgu_licitacoes_cache(orgao_cod);
CREATE INDEX idx_cgu_licitacoes_mun ON public.cgu_licitacoes_cache(municipio_ibge);

-- Cobertura por órgão × ano × mês (mesmo formato de cobertura_cgu).
CREATE OR REPLACE FUNCTION public.cobertura_cgu_licitacoes()
 RETURNS TABLE(orgao_cod text, ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT orgao_cod,
         COALESCE(EXTRACT(YEAR FROM data_abertura)::int, ano) AS ano,
         COALESCE(
           EXTRACT(MONTH FROM data_abertura)::int,
           mes_referencia::int,
           0
         ) AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.cgu_licitacoes_cache
  GROUP BY orgao_cod,
           COALESCE(EXTRACT(YEAR FROM data_abertura)::int, ano),
           COALESCE(
             EXTRACT(MONTH FROM data_abertura)::int,
             mes_referencia::int,
             0
           )
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_cgu_licitacoes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_cgu_licitacoes() TO service_role;
