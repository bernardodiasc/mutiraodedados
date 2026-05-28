
CREATE TABLE public.orgaos_cache (
  cod text PRIMARY KEY,
  sigla text NOT NULL,
  nome text NOT NULL,
  funcao text NOT NULL,
  poder text NOT NULL,
  disponivel_portal boolean NOT NULL DEFAULT true,
  nota text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fornecedores_cache (
  cnpj text PRIMARY KEY,
  nome text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contratos_cache (
  id text PRIMARY KEY,
  orgao_cod text NOT NULL,
  fornecedor_cnpj text NOT NULL,
  objeto text NOT NULL,
  modalidade text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  ano integer NOT NULL,
  data_assinatura date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contratos_cache_orgao_idx ON public.contratos_cache(orgao_cod);
CREATE INDEX contratos_cache_forn_idx ON public.contratos_cache(fornecedor_cnpj);
CREATE INDEX contratos_cache_data_idx ON public.contratos_cache(data_assinatura);

CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_cod text NOT NULL,
  data_inicial date NOT NULL,
  data_final date NOT NULL,
  total_bruto integer NOT NULL DEFAULT 0,
  importados integer NOT NULL DEFAULT 0,
  erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  fonte text NOT NULL DEFAULT 'Portal da Transparência (CGU)',
  consultado_em timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);
CREATE INDEX importacoes_orgao_idx ON public.importacoes(orgao_cod, consultado_em DESC);

ALTER TABLE public.orgaos_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "orgaos_cache select all" ON public.orgaos_cache FOR SELECT USING (true);
CREATE POLICY "fornecedores_cache select all" ON public.fornecedores_cache FOR SELECT USING (true);
CREATE POLICY "contratos_cache select all" ON public.contratos_cache FOR SELECT USING (true);
CREATE POLICY "importacoes select all" ON public.importacoes FOR SELECT USING (true);

-- Escrita apenas admin
CREATE POLICY "orgaos_cache admin write" ON public.orgaos_cache FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fornecedores_cache admin write" ON public.fornecedores_cache FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "contratos_cache admin write" ON public.contratos_cache FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "importacoes admin write" ON public.importacoes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
