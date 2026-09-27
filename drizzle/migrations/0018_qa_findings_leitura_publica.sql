-- A leitura pública de qa_findings segue o mesmo filtro da lista pública
-- (listarQualidadePublico): sinais e marcações cidadãs usam a tabela só para
-- o fluxo de investigação do admin e não são públicos. `detalhes` e
-- `notas_admin` ficam restritos ao service_role; o app lê a tabela pelas
-- server functions.
DROP POLICY IF EXISTS "qa_findings leitura publica" ON public.qa_findings;
--> statement-breakpoint

CREATE POLICY "qa_findings leitura publica"
  ON public.qa_findings FOR SELECT
  TO anon, authenticated
  USING (origem NOT IN ('sinal', 'marcacao_cidada'));
--> statement-breakpoint

-- Revogar o SELECT da tabela revoga também os grants por coluna.
REVOKE SELECT ON public.qa_findings FROM anon, authenticated;
--> statement-breakpoint

GRANT SELECT (
  id, fonte, entidade_tipo, entidade_id, regra, tipo, severidade, origem,
  valor_armazenado, valor_esperado, status, reportado_em, reporte_protocolo,
  reporte_canal, detectado_em, revalidado_em, resolvido_em, updated_at
) ON public.qa_findings TO anon, authenticated;
--> statement-breakpoint

-- Detalhe da página /qualidade/$id: mesmo filtro de origem da lista.
CREATE OR REPLACE FUNCTION public.qa_finding_publico(_id uuid)
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
    AND origem NOT IN ('sinal', 'marcacao_cidada')
  LIMIT 1
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.qa_finding_publico(uuid) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.qa_finding_publico(uuid) TO service_role;
