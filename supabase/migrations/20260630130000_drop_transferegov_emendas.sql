-- Aposenta a tabela de emendas EC 105 do Transferegov (Especiais/Finalidade).
-- O dado único (Transferências Especiais) foi migrado para
-- cgu_transferegov_emendas_cache, enriquecido durante a ingestão de /emendas.
DROP FUNCTION IF EXISTS public.cobertura_transferegov_emendas(text);
DROP TABLE IF EXISTS public.transferegov_emendas_cache CASCADE;
