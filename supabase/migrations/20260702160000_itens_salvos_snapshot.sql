-- Snapshot de prova nos itens salvos: ao salvar uma entidade, guarda-se uma
-- cópia canônica dos dados naquele momento. "Verificar mudança" re-busca o dado
-- ao vivo e compara pelo hash; divergência marca o item (valor de prova é
-- preservado — só é substituído por ação explícita do usuário).
-- Idempotente: já aplicada manualmente no banco de produção (fora do tracker
-- do Supabase) — os IF NOT EXISTS tornam uma re-aplicação um no-op seguro.
ALTER TABLE public.itens_salvos
  ADD COLUMN IF NOT EXISTS conteudo_snapshot text
    CHECK (conteudo_snapshot IS NULL OR length(conteudo_snapshot) <= 20000),
  ADD COLUMN IF NOT EXISTS snapshot_em timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_hash text,
  ADD COLUMN IF NOT EXISTS snapshot_verificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_divergiu_em timestamptz;

-- Emendas e licitações agora têm "Salvar no caderno" na página de detalhe e
-- entram em pastas com o tipo verdadeiro (antes caíam no fallback "link").
ALTER TYPE public.pergunta_item_tipo ADD VALUE IF NOT EXISTS 'emenda';
ALTER TYPE public.pergunta_item_tipo ADD VALUE IF NOT EXISTS 'licitacao';
