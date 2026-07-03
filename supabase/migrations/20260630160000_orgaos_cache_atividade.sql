-- Torna orgaos_cache a fonte dinâmica do catálogo de órgãos (SIAFI-driven).
--
-- - `ativo`: false = sem execução orçamentária recente (extinto/inativo). O sinal
--   vem da sonda /despesas/por-orgao (verificarAtividadeOrgaos), NÃO da ausência no
--   /orgaos-siafi (o SIAFI congela e mantém códigos de órgãos extintos).
-- - `sigla`/`funcao` passam a ser opcionais: o /orgaos-siafi não os fornece; vêm do
--   overlay de enriquecimento (catalog.ts) ou do próprio payload dos documentos.
-- - `orgao_vinculado_*`: contexto capturado no ingest para a fase 2 (sucessão).

ALTER TABLE public.orgaos_cache
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ultima_verificacao_atividade timestamptz,
  ADD COLUMN IF NOT EXISTS ano_ultima_despesa integer,
  ADD COLUMN IF NOT EXISTS orgao_vinculado_cod text,
  ADD COLUMN IF NOT EXISTS orgao_vinculado_nome text;

ALTER TABLE public.orgaos_cache ALTER COLUMN sigla DROP NOT NULL;
ALTER TABLE public.orgaos_cache ALTER COLUMN funcao DROP NOT NULL;

-- Default para `poder`: permite que o sync SIAFI faça upsert só de {cod, nome}
-- sem classificar poder (o /orgaos-siafi mistura esferas e não é fonte confiável
-- de poder). Órgãos das demais esferas são cards curados (catalog.ts), e a busca
-- por /orgaos/$cod os resolve antes do orgaos_cache — então rotular o catálogo
-- como 'executivo' por padrão é inócuo.
ALTER TABLE public.orgaos_cache ALTER COLUMN poder SET DEFAULT 'executivo';

-- RLS e políticas de orgaos_cache já existem (select público + escrita admin) e
-- cobrem as colunas novas; nada a alterar aqui.
