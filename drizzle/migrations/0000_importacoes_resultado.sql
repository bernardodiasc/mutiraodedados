ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS resultado text;

CREATE INDEX IF NOT EXISTS idx_importacoes_resultado
  ON public.importacoes (resultado, consultado_em DESC)
  WHERE resultado IS NOT NULL;