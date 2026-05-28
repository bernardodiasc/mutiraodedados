-- 1) Coluna valor_inicial em contratos_cache (CGU) — necessária para a regra "final < inicial"
ALTER TABLE public.contratos_cache
  ADD COLUMN IF NOT EXISTS valor_inicial numeric DEFAULT 0;

-- 2) Tabela qa_findings — defeitos detectados pela plataforma (auditoria automática)
CREATE TABLE public.qa_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  entidade_tipo text NOT NULL,
  entidade_id text NOT NULL,
  regra text NOT NULL,
  severidade text NOT NULL DEFAULT 'aviso',
  origem text NOT NULL DEFAULT 'heuristica',
  valor_armazenado numeric,
  valor_esperado numeric,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberto',
  reportado_em timestamptz,
  reporte_protocolo text,
  reporte_canal text,
  notas_admin text,
  detectado_em timestamptz NOT NULL DEFAULT now(),
  revalidado_em timestamptz,
  resolvido_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_findings_unique_open UNIQUE (fonte, entidade_id, regra)
);

CREATE INDEX qa_findings_status_idx ON public.qa_findings(status);
CREATE INDEX qa_findings_fonte_idx ON public.qa_findings(fonte);
CREATE INDEX qa_findings_detectado_idx ON public.qa_findings(detectado_em DESC);

-- 3) GRANTs (leitura pública é via SECURITY DEFINER fns abaixo; tabela direta só admin/service_role)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_findings TO authenticated;
GRANT ALL ON public.qa_findings TO service_role;

-- 4) RLS
ALTER TABLE public.qa_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_findings admin all"
  ON public.qa_findings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5) Trigger de updated_at
CREATE TRIGGER qa_findings_touch
  BEFORE UPDATE ON public.qa_findings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_touch_updated_at();

-- 6) Função SECURITY DEFINER para listagem pública sanitizada
CREATE OR REPLACE FUNCTION public.qa_findings_publicos(
  _fonte text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  fonte text,
  entidade_tipo text,
  entidade_id text,
  regra text,
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
  SELECT id, fonte, entidade_tipo, entidade_id, regra, severidade, origem,
         valor_armazenado, valor_esperado, status, reportado_em, reporte_canal,
         reporte_protocolo, detectado_em, revalidado_em, resolvido_em
  FROM public.qa_findings
  WHERE (_fonte IS NULL OR fonte = _fonte)
    AND (_status IS NULL OR status = _status)
  ORDER BY
    CASE severidade WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 ELSE 2 END,
    detectado_em DESC
  LIMIT GREATEST(1, LEAST(_limit, 500))
$$;

GRANT EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, integer) TO anon, authenticated;

-- 7) Função SECURITY DEFINER de detalhe público (sem notas_admin)
CREATE OR REPLACE FUNCTION public.qa_finding_publico(_id uuid)
RETURNS TABLE (
  id uuid,
  fonte text,
  entidade_tipo text,
  entidade_id text,
  regra text,
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
  SELECT id, fonte, entidade_tipo, entidade_id, regra, severidade, origem,
         valor_armazenado, valor_esperado, detalhes, status, reportado_em,
         reporte_canal, reporte_protocolo, detectado_em, revalidado_em, resolvido_em
  FROM public.qa_findings
  WHERE id = _id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.qa_finding_publico(uuid) TO anon, authenticated;

-- 8) Função SECURITY DEFINER agregando totais por fonte/status (para /cobertura e /qualidade)
CREATE OR REPLACE FUNCTION public.qa_findings_agregado()
RETURNS TABLE (
  fonte text,
  total bigint,
  abertos bigint,
  confirmados bigint,
  reportados bigint,
  corrigidos bigint,
  falsos_positivos bigint,
  criticos bigint
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
    COUNT(*) FILTER (WHERE severidade = 'critico' AND status IN ('aberto','confirmado','reportado'))::bigint AS criticos
  FROM public.qa_findings
  GROUP BY fonte
$$;

GRANT EXECUTE ON FUNCTION public.qa_findings_agregado() TO anon, authenticated;