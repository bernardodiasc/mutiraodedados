-- Tabela única para Transferências Especiais e Finalidade Definida (EC 105/2019)
CREATE TABLE IF NOT EXISTS public.transferegov_emendas_cache (
  id text PRIMARY KEY,
  modalidade text NOT NULL CHECK (modalidade IN ('especial','finalidade_definida')),
  ano integer NOT NULL,
  numero_emenda text,
  autor_emenda text,
  beneficiario_nome text,
  beneficiario_cnpj text,
  uf text,
  municipio_ibge text,
  municipio_nome text,
  valor numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  data_referencia date,
  funcao text,
  subfuncao text,
  finalidade text,
  url_transferegov text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emendas_modalidade_ano ON public.transferegov_emendas_cache (modalidade, ano);
CREATE INDEX IF NOT EXISTS idx_emendas_uf ON public.transferegov_emendas_cache (uf);
CREATE INDEX IF NOT EXISTS idx_emendas_municipio ON public.transferegov_emendas_cache (municipio_ibge);
CREATE INDEX IF NOT EXISTS idx_emendas_autor ON public.transferegov_emendas_cache (autor_emenda);
CREATE INDEX IF NOT EXISTS idx_emendas_data ON public.transferegov_emendas_cache (data_referencia);

ALTER TABLE public.transferegov_emendas_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emendas select all" ON public.transferegov_emendas_cache FOR SELECT USING (true);
CREATE POLICY "emendas admin write" ON public.transferegov_emendas_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Função de cobertura por modalidade (ano/mês via data_referencia, fallback ano)
CREATE OR REPLACE FUNCTION public.cobertura_transferegov_emendas(_modalidade text)
RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(EXTRACT(YEAR FROM data_referencia)::int, ano) AS ano,
    COALESCE(EXTRACT(MONTH FROM data_referencia)::int, 0) AS mes,
    COUNT(*)::bigint,
    MAX(updated_at)
  FROM public.transferegov_emendas_cache
  WHERE modalidade = _modalidade
  GROUP BY COALESCE(EXTRACT(YEAR FROM data_referencia)::int, ano),
           COALESCE(EXTRACT(MONTH FROM data_referencia)::int, 0)
$$;