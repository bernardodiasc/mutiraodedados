-- Tabela de contestações cidadãs/institucionais
CREATE TABLE public.contestacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  url_pagina text NOT NULL CHECK (length(url_pagina) BETWEEN 1 AND 500),
  tipo text NOT NULL CHECK (tipo IN ('correcao_factual','dado_desatualizado','pii_exposicao','classificacao_inadequada','outro')),
  solicitante_tipo text NOT NULL CHECK (solicitante_tipo IN ('cidadao','empresa','orgao','representante','anonimo')),
  descricao text NOT NULL CHECK (length(descricao) BETWEEN 10 AND 4000),
  fundamento text NULL CHECK (fundamento IS NULL OR length(fundamento) <= 4000),
  contato text NULL CHECK (contato IS NULL OR length(contato) <= 255),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_analise','respondida','arquivada')),
  resposta text NULL CHECK (resposta IS NULL OR length(resposta) <= 8000),
  respondido_em timestamptz NULL,
  respondido_por uuid NULL
);

CREATE INDEX idx_contestacoes_user ON public.contestacoes(user_id);
CREATE INDEX idx_contestacoes_status ON public.contestacoes(status);
CREATE INDEX idx_contestacoes_created ON public.contestacoes(created_at DESC);

ALTER TABLE public.contestacoes ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (logada ou anônima) pode abrir uma contestação.
-- Decisão deliberada: o canal de contestação é instrumento de direito,
-- não pode ser bloqueado por exigência de cadastro.
CREATE POLICY "contestacoes insert publico"
  ON public.contestacoes FOR INSERT
  WITH CHECK (
    -- se autenticado, user_id deve bater com auth.uid()
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Admin lê tudo
CREATE POLICY "contestacoes select admin"
  ON public.contestacoes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Usuário autenticado lê apenas as próprias
CREATE POLICY "contestacoes select self"
  ON public.contestacoes FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Apenas admin atualiza status/resposta
CREATE POLICY "contestacoes update admin"
  ON public.contestacoes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Apenas admin apaga
CREATE POLICY "contestacoes delete admin"
  ON public.contestacoes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contestacoes_updated
  BEFORE UPDATE ON public.contestacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();