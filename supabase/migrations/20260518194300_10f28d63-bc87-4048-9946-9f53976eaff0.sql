
-- PNCP: contratos públicos de União, Estados e Municípios
CREATE TABLE public.pncp_contratos_cache (
  id text PRIMARY KEY,
  numero_controle_pncp text NOT NULL,
  ano integer NOT NULL,
  orgao_cnpj text NOT NULL,
  orgao_nome text NOT NULL,
  esfera text,
  poder text,
  uf text,
  municipio_ibge text,
  municipio_nome text,
  numero_contrato text,
  objeto text,
  modalidade text,
  situacao text,
  fornecedor_cnpj_cpf text,
  fornecedor_nome text,
  valor_inicial numeric DEFAULT 0,
  valor_global numeric DEFAULT 0,
  data_assinatura date,
  data_vigencia_inicio date,
  data_vigencia_fim date,
  url_pncp text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pncp_contratos_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pncp_contratos select all" ON public.pncp_contratos_cache FOR SELECT USING (true);
CREATE POLICY "pncp_contratos admin write" ON public.pncp_contratos_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_pncp_uf ON public.pncp_contratos_cache(uf);
CREATE INDEX idx_pncp_mun ON public.pncp_contratos_cache(municipio_ibge);
CREATE INDEX idx_pncp_orgao ON public.pncp_contratos_cache(orgao_cnpj);
CREATE INDEX idx_pncp_ano ON public.pncp_contratos_cache(ano);

-- SICONFI: relatórios fiscais (RREO, RGF, DCA) de todos os entes
CREATE TABLE public.siconfi_relatorios_cache (
  id text PRIMARY KEY,
  cod_ibge text NOT NULL,
  esfera text NOT NULL,
  uf text,
  ente_nome text NOT NULL,
  exercicio integer NOT NULL,
  periodo integer,
  periodicidade text,
  tipo_relatorio text NOT NULL,
  anexo text,
  coluna text,
  cod_conta text,
  conta text,
  valor numeric DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.siconfi_relatorios_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "siconfi select all" ON public.siconfi_relatorios_cache FOR SELECT USING (true);
CREATE POLICY "siconfi admin write" ON public.siconfi_relatorios_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_siconfi_ibge ON public.siconfi_relatorios_cache(cod_ibge);
CREATE INDEX idx_siconfi_uf ON public.siconfi_relatorios_cache(uf);
CREATE INDEX idx_siconfi_exer ON public.siconfi_relatorios_cache(exercicio);
CREATE INDEX idx_siconfi_tipo ON public.siconfi_relatorios_cache(tipo_relatorio);

-- Transferegov: convênios e contratos de repasse
CREATE TABLE public.transferegov_instrumentos_cache (
  id text PRIMARY KEY,
  numero text NOT NULL,
  modalidade text,
  situacao text,
  objeto text,
  orgao_concedente_nome text,
  orgao_concedente_cnpj text,
  beneficiario_nome text,
  beneficiario_cnpj text,
  esfera_beneficiario text,
  uf_beneficiario text,
  municipio_ibge text,
  municipio_nome text,
  valor_global numeric DEFAULT 0,
  valor_repasse numeric DEFAULT 0,
  valor_contrapartida numeric DEFAULT 0,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  data_assinatura date,
  url_transferegov text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transferegov_instrumentos_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transferegov select all" ON public.transferegov_instrumentos_cache FOR SELECT USING (true);
CREATE POLICY "transferegov admin write" ON public.transferegov_instrumentos_cache FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE INDEX idx_tg_uf ON public.transferegov_instrumentos_cache(uf_beneficiario);
CREATE INDEX idx_tg_mun ON public.transferegov_instrumentos_cache(municipio_ibge);
CREATE INDEX idx_tg_sit ON public.transferegov_instrumentos_cache(situacao);
