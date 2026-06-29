-- Reformulação da ingestão CGU (conferência por detalhe) + filtro de regra no
-- /qualidade público.
--
-- 1) `importacoes.log_kind`: marcador que distingue as linhas de RODADA de
--    import (uma por execução — alimentam o Histórico) das linhas de
--    REQUISIÇÃO (uma por GET de página/detalhe da varredura por detalhe). A
--    varredura por detalhe gera milhares de requisições; logá-las como linhas
--    normais inundaria o Histórico. Marcamos com log_kind='requisicao' e o
--    Histórico (listHistoricoUnificado) as filtra fora. A matriz
--    cobertura_tentativas já ignora linhas sem ano/mes (as de requisição têm
--    ano/mes NULL), então não é afetada.
ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS log_kind text;

-- Índice parcial para o Histórico filtrar rapidamente as linhas "normais".
CREATE INDEX IF NOT EXISTS idx_importacoes_log_kind
  ON public.importacoes (consultado_em DESC)
  WHERE log_kind IS DISTINCT FROM 'requisicao';

-- 2) qa_findings_publicos ganha o parâmetro _regra (filtro "Todas as regras"
--    na página pública /qualidade). Trocamos a assinatura (3 → 4 args), então
--    derrubamos a versão antiga antes de recriar.
DROP FUNCTION IF EXISTS public.qa_findings_publicos(text, text, integer);

CREATE OR REPLACE FUNCTION public.qa_findings_publicos(
  _fonte text DEFAULT NULL,
  _status text DEFAULT NULL,
  _regra text DEFAULT NULL,
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
    AND (_regra IS NULL OR regra = _regra)
  ORDER BY
    CASE severidade WHEN 'critico' THEN 0 WHEN 'aviso' THEN 1 ELSE 2 END,
    detectado_em DESC
  LIMIT GREATEST(1, LEAST(_limit, 500))
$$;

GRANT EXECUTE ON FUNCTION public.qa_findings_publicos(text, text, text, integer)
  TO anon, authenticated, service_role;
