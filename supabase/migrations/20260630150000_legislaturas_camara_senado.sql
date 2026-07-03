-- Histórico de mandatos por legislatura (Câmara + Senado).
-- O cadastro (*_cache) guarda a IDENTIDADE da pessoa (1 linha por id) e o estado
-- "mais recente"; estas tabelas-filhas guardam o partido/UF/situação em CADA
-- legislatura, permitindo histórico de múltiplos mandatos sem quebrar as FKs
-- existentes (despesas/votos continuam apontando para o id da pessoa).

CREATE TABLE public.camara_deputado_legislaturas (
  deputado_id BIGINT NOT NULL,
  id_legislatura INTEGER NOT NULL,
  sigla_partido TEXT,
  sigla_uf TEXT,
  situacao TEXT,
  condicao_eleitoral TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deputado_id, id_legislatura)
);
GRANT SELECT ON public.camara_deputado_legislaturas TO anon, authenticated;
GRANT ALL ON public.camara_deputado_legislaturas TO service_role;
ALTER TABLE public.camara_deputado_legislaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camara_dep_leg select all" ON public.camara_deputado_legislaturas FOR SELECT USING (true);
CREATE POLICY "camara_dep_leg admin write" ON public.camara_deputado_legislaturas FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_camara_dep_leg_dep ON public.camara_deputado_legislaturas(deputado_id);
CREATE INDEX idx_camara_dep_leg_leg ON public.camara_deputado_legislaturas(id_legislatura);

CREATE TABLE public.senado_senador_legislaturas (
  codigo_parlamentar BIGINT NOT NULL,
  legislatura INTEGER NOT NULL,
  sigla_partido TEXT,
  sigla_uf TEXT,
  participacao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo_parlamentar, legislatura)
);
GRANT SELECT ON public.senado_senador_legislaturas TO anon, authenticated;
GRANT ALL ON public.senado_senador_legislaturas TO service_role;
ALTER TABLE public.senado_senador_legislaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_sen_leg select all" ON public.senado_senador_legislaturas FOR SELECT USING (true);
CREATE POLICY "senado_sen_leg admin write" ON public.senado_senador_legislaturas FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_senado_sen_leg_sen ON public.senado_senador_legislaturas(codigo_parlamentar);
CREATE INDEX idx_senado_sen_leg_leg ON public.senado_senador_legislaturas(legislatura);
