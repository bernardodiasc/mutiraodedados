
CREATE TABLE public.senado_senadores_cache (
  id bigint PRIMARY KEY,
  codigo_parlamentar bigint NOT NULL,
  nome text NOT NULL,
  nome_completo text,
  sigla_partido text,
  sigla_uf text,
  url_foto text,
  email text,
  situacao text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.senado_senadores_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_sen select all" ON public.senado_senadores_cache FOR SELECT USING (true);
CREATE POLICY "senado_sen admin write" ON public.senado_senadores_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.senado_despesas_cache (
  id text PRIMARY KEY,
  senador_id bigint NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL,
  tipo_despesa text,
  fornecedor_nome text,
  fornecedor_cnpj text,
  data_documento date,
  num_documento text,
  valor_reembolsado numeric NOT NULL DEFAULT 0,
  detalhamento text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.senado_despesas_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_desp select all" ON public.senado_despesas_cache FOR SELECT USING (true);
CREATE POLICY "senado_desp admin write" ON public.senado_despesas_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_senado_desp_senador ON public.senado_despesas_cache(senador_id);
CREATE INDEX idx_senado_desp_ano_mes ON public.senado_despesas_cache(ano,mes);

CREATE TABLE public.senado_materias_cache (
  id bigint PRIMARY KEY,
  sigla_subtipo text NOT NULL,
  numero integer NOT NULL,
  ano integer NOT NULL,
  ementa text,
  data_apresentacao date,
  autor_principal text,
  ultima_situacao text,
  ultima_data date,
  url_texto text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.senado_materias_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_mat select all" ON public.senado_materias_cache FOR SELECT USING (true);
CREATE POLICY "senado_mat admin write" ON public.senado_materias_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.senado_materias_autores_cache (
  materia_id bigint NOT NULL,
  senador_id bigint,
  nome text NOT NULL,
  tipo text,
  proponente boolean NOT NULL DEFAULT false,
  ordem integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.senado_materias_autores_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_mat_aut select all" ON public.senado_materias_autores_cache FOR SELECT USING (true);
CREATE POLICY "senado_mat_aut admin write" ON public.senado_materias_autores_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_senado_mat_aut_mat ON public.senado_materias_autores_cache(materia_id);

CREATE TABLE public.senado_votacoes_cache (
  id text PRIMARY KEY,
  data date,
  descricao text,
  resultado text,
  materia_id bigint,
  materia_titulo text,
  sigla_orgao text,
  votos_sim integer NOT NULL DEFAULT 0,
  votos_nao integer NOT NULL DEFAULT 0,
  votos_outros integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.senado_votacoes_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_vot select all" ON public.senado_votacoes_cache FOR SELECT USING (true);
CREATE POLICY "senado_vot admin write" ON public.senado_votacoes_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.senado_votos_cache (
  votacao_id text NOT NULL,
  senador_id bigint NOT NULL,
  tipo_voto text NOT NULL,
  sigla_partido text,
  sigla_uf text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.senado_votos_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "senado_votos select all" ON public.senado_votos_cache FOR SELECT USING (true);
CREATE POLICY "senado_votos admin write" ON public.senado_votos_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_senado_votos_vot ON public.senado_votos_cache(votacao_id);
CREATE INDEX idx_senado_votos_sen ON public.senado_votos_cache(senador_id);
