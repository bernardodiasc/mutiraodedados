ALTER TABLE public.orgaos_cache
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ultima_verificacao_atividade timestamptz,
  ADD COLUMN IF NOT EXISTS ano_ultima_despesa integer,
  ADD COLUMN IF NOT EXISTS orgao_vinculado_cod text,
  ADD COLUMN IF NOT EXISTS orgao_vinculado_nome text;

ALTER TABLE public.orgaos_cache ALTER COLUMN sigla DROP NOT NULL;
ALTER TABLE public.orgaos_cache ALTER COLUMN funcao DROP NOT NULL;
ALTER TABLE public.orgaos_cache ALTER COLUMN poder SET DEFAULT 'executivo';