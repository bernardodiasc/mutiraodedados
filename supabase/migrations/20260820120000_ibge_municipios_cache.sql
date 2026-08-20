-- IBGE como fonte de primeira classe (v0.7.0).
--
-- Até aqui a lista de municípios era baixada pelo NAVEGADOR do admin a cada
-- uso do combobox, e a de UFs era constante no código — nenhuma das duas
-- passava pelo contrato de fonte (retomada, histórico, limpeza, cobertura).
-- Este cache é alimentado pela API de localidades do IBGE, uma UF por passo.
CREATE TABLE IF NOT EXISTS public.ibge_municipios_cache (
  codigo      text PRIMARY KEY,          -- código IBGE de 7 dígitos
  nome        text NOT NULL,
  uf          text NOT NULL,             -- sigla (SP, RJ…)
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ibge_municipios_cache_uf_idx
  ON public.ibge_municipios_cache (uf);

GRANT ALL ON public.ibge_municipios_cache TO service_role;
-- Dado público do IBGE: leitura aberta (o combobox roda sem sessão de admin
-- em telas futuras); escrita só pelo servidor via service_role.
GRANT SELECT ON public.ibge_municipios_cache TO anon, authenticated;
ALTER TABLE public.ibge_municipios_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ibge_municipios_cache leitura publica" ON public.ibge_municipios_cache
  FOR SELECT TO anon, authenticated
  USING (true);
