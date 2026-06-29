-- `contratos_cache.numero`: número do contrato (ex.: "17/2011"). A API da CGU o
-- fornece (campo `numero`), mas não era guardado. Necessário para montar o link
-- da fonte oficial via /contratos/consulta (a página /contratos/{id} dá 404
-- porque o id da API ≠ id do site).
--
-- NOTA: as demais mudanças desta leva (importacoes.log_kind, índice,
-- qa_findings_publicos) já foram aplicadas pela migração 20260628110455. Esta
-- adiciona apenas a coluna que ficou de fora.
ALTER TABLE public.contratos_cache
  ADD COLUMN IF NOT EXISTS numero text;
