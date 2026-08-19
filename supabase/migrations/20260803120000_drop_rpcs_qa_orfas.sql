-- Remove as RPCs de leitura de qa_findings que nunca ganharam caller no app.
-- A leitura pública consulta a tabela direto via server function
-- (listarQualidadePublico em src/lib/data/qa.functions.ts, que suporta
-- multi-seleção por grupo — fontes/status/regras/tipos — coisa que a RPC de
-- parâmetros escalares não suportava).
--
-- `qa_finding_publico(_id uuid)` é MANTIDA: é usada por detalheQualidadePublico
-- (página /qualidade/$id).

DROP FUNCTION IF EXISTS public.qa_findings_publicos(text, text, text, integer, text);

DROP FUNCTION IF EXISTS public.qa_findings_agregado();
