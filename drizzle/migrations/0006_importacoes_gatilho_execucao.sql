-- Quem disparou cada rodada e a qual execução ela pertence.
--
-- gatilho: painel (admin logado), cron (fila da automação) ou ferramenta
--   (modo nomeado de /api/cron-importar, chamado pelo script `bun run importar`).
--   Linhas anteriores ficam nulas: antes desta coluna, só `user_id` nulo
--   distinguia a rodada sem operador.
-- execucao_id: gerado por quem chama o modo nomeado, um por janela; agrupa
--   todas as rodadas daquela janela.
-- conferencia: veredito sobre a janela inteira, gravado na linha da última
--   rodada da execução. A coluna nasce aqui; quem a preenche é a conferência.
ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS gatilho text
    CHECK (gatilho IN ('painel', 'cron', 'ferramenta')),
  ADD COLUMN IF NOT EXISTS execucao_id uuid,
  ADD COLUMN IF NOT EXISTS conferencia jsonb;

CREATE INDEX IF NOT EXISTS idx_importacoes_execucao
  ON public.importacoes (execucao_id)
  WHERE execucao_id IS NOT NULL;
