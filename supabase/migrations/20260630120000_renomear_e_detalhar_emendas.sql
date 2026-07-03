-- Renomeia cgu_emendas_cache → cgu_transferegov_emendas_cache.
--
-- A tabela passou a guardar dados de DUAS fontes: o resumo das emendas vindo do
-- Portal CGU (/emendas) MAIS o detalhe de execução das Transferências Especiais
-- (EC 105) vindo da API do Transferegov (plano_acao_especial), juntado por código
-- da emenda durante a ingestão. O prefixo "cgu" sozinho era enganoso.
--
-- Também adiciona as colunas de detalhe (a migração anterior que as criava tinha
-- timestamp anterior à criação da tabela no fluxo do Lovable; consolidado aqui,
-- com timestamp posterior a tudo, conforme o padrão do projeto).
--
-- Idempotente: IF EXISTS / IF NOT EXISTS para rodar em qualquer estado.

ALTER TABLE IF EXISTS public.cgu_emendas_cache
  RENAME TO cgu_transferegov_emendas_cache;

ALTER TABLE public.cgu_transferegov_emendas_cache
  ADD COLUMN IF NOT EXISTS planos_acao_count integer,
  ADD COLUMN IF NOT EXISTS valor_custeio numeric,
  ADD COLUMN IF NOT EXISTS valor_investimento numeric,
  ADD COLUMN IF NOT EXISTS beneficiario_nome text,
  ADD COLUMN IF NOT EXISTS beneficiario_cnpj text,
  ADD COLUMN IF NOT EXISTS plano_acao_situacao text,
  ADD COLUMN IF NOT EXISTS areas_politicas text;

-- A RPC de cobertura mantém o nome (cobertura_cgu_emendas); só muda a tabela-base.
CREATE OR REPLACE FUNCTION public.cobertura_cgu_emendas()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano, 1 AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.cgu_transferegov_emendas_cache
  GROUP BY ano
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_cgu_emendas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_cgu_emendas() TO service_role;
