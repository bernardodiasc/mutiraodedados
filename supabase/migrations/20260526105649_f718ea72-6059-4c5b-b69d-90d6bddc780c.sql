ALTER TABLE public.tentativas_ingestao
  ADD COLUMN IF NOT EXISTS erro text;

CREATE INDEX IF NOT EXISTS idx_tentativas_executado_em
  ON public.tentativas_ingestao (executado_em DESC);

CREATE INDEX IF NOT EXISTS idx_importacoes_consultado_em
  ON public.importacoes (consultado_em DESC);