
CREATE TABLE public.camara_deputados_cache (
  id BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_civil TEXT,
  sigla_partido TEXT,
  sigla_uf TEXT,
  id_legislatura INTEGER,
  url_foto TEXT,
  email TEXT,
  situacao TEXT,
  condicao_eleitoral TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.camara_deputados_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_dep select all" ON public.camara_deputados_cache FOR SELECT USING (true);
CREATE POLICY "camara_dep admin write" ON public.camara_deputados_cache FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.camara_despesas_cache (
  id TEXT PRIMARY KEY,
  deputado_id BIGINT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  tipo_despesa TEXT,
  cod_documento BIGINT,
  tipo_documento TEXT,
  num_documento TEXT,
  data_documento DATE,
  valor_documento NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC NOT NULL DEFAULT 0,
  valor_glosa NUMERIC NOT NULL DEFAULT 0,
  fornecedor_nome TEXT,
  fornecedor_cnpj TEXT,
  url_documento TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_camara_desp_deputado ON public.camara_despesas_cache(deputado_id);
CREATE INDEX idx_camara_desp_ano_mes ON public.camara_despesas_cache(ano, mes);
CREATE INDEX idx_camara_desp_fornecedor ON public.camara_despesas_cache(fornecedor_cnpj);
ALTER TABLE public.camara_despesas_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_desp select all" ON public.camara_despesas_cache FOR SELECT USING (true);
CREATE POLICY "camara_desp admin write" ON public.camara_despesas_cache FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
