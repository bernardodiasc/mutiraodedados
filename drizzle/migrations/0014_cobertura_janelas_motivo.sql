-- A matriz de cobertura do admin mostra, em cada célula, o motivo da
-- conferência e a execução que a conferiu (para abrir o Histórico filtrado).
-- A função ganha duas colunas; mudar o tipo de retorno exige recriá-la.
-- Mesma lógica da 0013 (ver o comentário lá).
DROP FUNCTION IF EXISTS public.cobertura_janelas(text);
--> statement-breakpoint

CREATE FUNCTION public.cobertura_janelas(p_fonte text)
RETURNS TABLE (
  escopo text,
  ano integer,
  mes integer,
  ultimo_resultado text,
  ultimo_motivo_parada text,
  ultima_rodada_em timestamptz,
  conferencia_estado text,
  conferencia_contagem text,
  conferencia_em timestamptz,
  conferencia_motivo text,
  conferencia_execucao_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH rodadas AS (
    SELECT DISTINCT ON (1, 2, 3)
      coalesce(i.escopo, '') AS escopo, coalesce(i.ano, 0) AS ano, coalesce(i.mes, 0) AS mes,
      i.resultado, i.motivo_parada, i.consultado_em
    FROM public.importacoes i
    WHERE i.fonte = p_fonte AND i.log_kind IS NULL
    ORDER BY 1, 2, 3, i.consultado_em DESC
  ),
  conferencias AS (
    SELECT DISTINCT ON (1, 2, 3)
      coalesce(i.escopo, '') AS escopo, coalesce(i.ano, 0) AS ano, coalesce(i.mes, 0) AS mes,
      i.conferencia ->> 'estado' AS estado,
      i.conferencia #>> '{checagens,contagem,situacao}' AS contagem,
      i.consultado_em,
      i.conferencia ->> 'motivo' AS motivo,
      i.execucao_id
    FROM public.importacoes i
    WHERE i.fonte = p_fonte AND i.conferencia IS NOT NULL
    ORDER BY 1, 2, 3, i.consultado_em DESC
  )
  SELECT
    coalesce(r.escopo, c.escopo), coalesce(r.ano, c.ano), coalesce(r.mes, c.mes),
    r.resultado, r.motivo_parada, r.consultado_em,
    c.estado, c.contagem, c.consultado_em, c.motivo, c.execucao_id
  FROM rodadas r
  FULL JOIN conferencias c
    ON c.escopo = r.escopo AND c.ano = r.ano AND c.mes = r.mes
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.cobertura_janelas(text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cobertura_janelas(text) TO service_role;
