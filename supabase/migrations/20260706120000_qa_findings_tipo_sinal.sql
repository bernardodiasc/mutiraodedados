-- Taxonomia dos três tipos de sinal (ver docs/qualidade-dados.md):
--   'qualidade'     — defeito técnico do dado ou da importação (inspeção do próprio registro)
--   'lacuna'        — ausência detectável (algo que deveria existir e não é encontrado)
--   'investigativo' — padrão detectável por cruzamento de dados (nunca é acusação)
--
-- Decisão de schema: coluna única em qa_findings (em vez de tabelas separadas)
-- para manter o pipeline (flagQA, revalidação, canais, admin) comum aos três
-- tipos. A tabela `lacunas` continua sendo a camada CURADA (editorial) — um
-- finding tipo='lacuna' pode ser promovido a ela via converterFindingEmLacuna.

-- 1) Coluna tipo com backfill implícito: todas as regras existentes inspecionam
--    o próprio registro/lote (heurísticas de importação), logo são 'qualidade'.
ALTER TABLE public.qa_findings
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'qualidade'
  CHECK (tipo IN ('qualidade', 'lacuna', 'investigativo'));

CREATE INDEX IF NOT EXISTS qa_findings_tipo_idx ON public.qa_findings(tipo);

-- 2) Funções de leitura passam a expor/filtrar o tipo (retorno muda → DROP +
--    recreate). Assinatura vigente veio de 20260628110455 (_regra incluído);
--    o acesso é server-side (service_role) desde a revogação de 20260629001626.
DROP FUNCTION IF EXISTS public.qa_findings_publicos(text, text, text, integer);
CREATE FUNCTION public.qa_findings_publicos(
  _fonte text DEFAULT NULL,
  _status text DEFAULT NULL,
  _regra text DEFAULT NULL,
  _limit integer DEFAULT 100,
  _tipo text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  fonte text,
  entidade_tipo text,
  entidade_id text,
  regra text,
  tipo text,
  severidade text,
  origem text,
  valor_armazenado numeric,
  valor_esperado numeric,
  status text,
  reportado_em timestamptz,
  reporte_canal text,
  reporte_protocolo text,
  detectado_em timestamptz,
  revalidado_em timestamptz,
  resolvido_em timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, fonte, entidade_tipo, entidade_id, regra, tipo, severidade, origem,
         valor_armazenado, valor_esperado, status, reportado_em, reporte_canal,
         reporte_protocolo, detectado_em, revalidado_em, resolvido_em
  FROM public.qa_findings
  WHERE (_fonte IS NULL OR fonte = _fonte)
    AND (_status IS NULL OR status = _status)
    AND (_regra IS NULL OR regra = _regra)
    AND (_tipo IS NULL OR tipo = _tipo)
  ORDER BY
    CASE severidade WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 ELSE 2 END,
    detectado_em DESC
  LIMIT GREATEST(1, LEAST(_limit, 500))
$$;

REVOKE EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, text, integer, text) TO service_role;

DROP FUNCTION IF EXISTS public.qa_finding_publico(uuid);
CREATE FUNCTION public.qa_finding_publico(_id uuid)
RETURNS TABLE (
  id uuid,
  fonte text,
  entidade_tipo text,
  entidade_id text,
  regra text,
  tipo text,
  severidade text,
  origem text,
  valor_armazenado numeric,
  valor_esperado numeric,
  detalhes jsonb,
  status text,
  reportado_em timestamptz,
  reporte_canal text,
  reporte_protocolo text,
  detectado_em timestamptz,
  revalidado_em timestamptz,
  resolvido_em timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, fonte, entidade_tipo, entidade_id, regra, tipo, severidade, origem,
         valor_armazenado, valor_esperado, detalhes, status, reportado_em,
         reporte_canal, reporte_protocolo, detectado_em, revalidado_em, resolvido_em
  FROM public.qa_findings
  WHERE id = _id
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.qa_finding_publico(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_finding_publico(uuid) TO service_role;

-- 3) Agregado por fonte ganha contagens por tipo (retorno muda → DROP + recreate).
DROP FUNCTION IF EXISTS public.qa_findings_agregado();
CREATE FUNCTION public.qa_findings_agregado()
RETURNS TABLE (
  fonte text,
  total bigint,
  abertos bigint,
  confirmados bigint,
  reportados bigint,
  corrigidos bigint,
  falsos_positivos bigint,
  criticos bigint,
  qualidade bigint,
  lacunas bigint,
  investigativos bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fonte,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE status = 'aberto')::bigint AS abertos,
    COUNT(*) FILTER (WHERE status = 'confirmado')::bigint AS confirmados,
    COUNT(*) FILTER (WHERE status = 'reportado')::bigint AS reportados,
    COUNT(*) FILTER (WHERE status = 'corrigido_origem')::bigint AS corrigidos,
    COUNT(*) FILTER (WHERE status = 'falso_positivo')::bigint AS falsos_positivos,
    COUNT(*) FILTER (WHERE severidade = 'critico' AND status IN ('aberto','confirmado','reportado'))::bigint AS criticos,
    COUNT(*) FILTER (WHERE tipo = 'qualidade')::bigint AS qualidade,
    COUNT(*) FILTER (WHERE tipo = 'lacuna')::bigint AS lacunas,
    COUNT(*) FILTER (WHERE tipo = 'investigativo')::bigint AS investigativos
  FROM public.qa_findings
  GROUP BY fonte
$$;

REVOKE EXECUTE ON FUNCTION public.qa_findings_agregado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_findings_agregado() TO service_role;
