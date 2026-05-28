
CREATE TABLE public.camara_proposicoes_cache (
  id BIGINT PRIMARY KEY,
  sigla_tipo TEXT NOT NULL,
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  ementa TEXT,
  ementa_detalhada TEXT,
  keywords TEXT,
  data_apresentacao DATE,
  cod_tipo INTEGER,
  descricao_tipo TEXT,
  url_inteiro_teor TEXT,
  ultimo_status_data DATE,
  ultimo_status_descricao TEXT,
  ultimo_status_despacho TEXT,
  ultimo_status_situacao TEXT,
  ultimo_status_orgao_sigla TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.camara_proposicoes_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_prop select all" ON public.camara_proposicoes_cache FOR SELECT USING (true);
CREATE POLICY "camara_prop admin write" ON public.camara_proposicoes_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_camara_prop_ano ON public.camara_proposicoes_cache(ano);
CREATE INDEX idx_camara_prop_tipo ON public.camara_proposicoes_cache(sigla_tipo);

CREATE TABLE public.camara_proposicoes_autores_cache (
  proposicao_id BIGINT NOT NULL,
  deputado_id BIGINT,
  nome TEXT NOT NULL,
  tipo TEXT,
  ordem_assinatura INTEGER,
  proponente BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposicao_id, nome)
);
ALTER TABLE public.camara_proposicoes_autores_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_prop_aut select all" ON public.camara_proposicoes_autores_cache FOR SELECT USING (true);
CREATE POLICY "camara_prop_aut admin write" ON public.camara_proposicoes_autores_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_camara_prop_aut_dep ON public.camara_proposicoes_autores_cache(deputado_id);
CREATE INDEX idx_camara_prop_aut_prop ON public.camara_proposicoes_autores_cache(proposicao_id);
