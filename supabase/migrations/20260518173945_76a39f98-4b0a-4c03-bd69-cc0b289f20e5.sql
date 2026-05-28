
CREATE TABLE public.camara_votacoes_cache (
  id TEXT PRIMARY KEY,
  data DATE,
  data_hora_registro TIMESTAMPTZ,
  sigla_orgao TEXT,
  descricao TEXT,
  aprovacao SMALLINT,
  descricao_resultado TEXT,
  proposicao_id BIGINT,
  proposicao_titulo TEXT,
  votos_sim INTEGER NOT NULL DEFAULT 0,
  votos_nao INTEGER NOT NULL DEFAULT 0,
  votos_outros INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.camara_votacoes_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_vot select all" ON public.camara_votacoes_cache FOR SELECT USING (true);
CREATE POLICY "camara_vot admin write" ON public.camara_votacoes_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_camara_vot_data ON public.camara_votacoes_cache(data);
CREATE INDEX idx_camara_vot_prop ON public.camara_votacoes_cache(proposicao_id);

CREATE TABLE public.camara_votos_cache (
  votacao_id TEXT NOT NULL,
  deputado_id BIGINT NOT NULL,
  tipo_voto TEXT NOT NULL,
  sigla_partido TEXT,
  sigla_uf TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (votacao_id, deputado_id)
);
ALTER TABLE public.camara_votos_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_votos select all" ON public.camara_votos_cache FOR SELECT USING (true);
CREATE POLICY "camara_votos admin write" ON public.camara_votos_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_camara_votos_dep ON public.camara_votos_cache(deputado_id);
CREATE INDEX idx_camara_votos_part ON public.camara_votos_cache(sigla_partido);
