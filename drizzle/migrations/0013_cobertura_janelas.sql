-- Modelo de cobertura estruturada (v0.16.0): o estado de cada janela é
-- derivado na leitura do que a importação já grava em `importacoes`, sem
-- tabela própria de estado. Esta função devolve, por janela de uma fonte, a
-- última rodada (resultado, motivo de parada e horário) e a conferência mais
-- recente (estado, situação da contagem e horário). A classificação em
-- estados fica no código (`src/lib/data/cobertura-estado.ts`), que também
-- sabe se a célula tem registros no cache.
--
-- Janela = (escopo, ano, mes): o escopo é a linha da matriz (órgão, ente,
-- sigla, relatório). Cadastro não tem ano nem mês: vira (0, 0). `orgao_cod`
-- fica fora da chave porque a linha de conferência sem reimportação não o
-- grava; no SICONFI, em que o ente mora nele, as janelas somam os entes.
-- Rodada é a linha sem `log_kind` (as de requisição e as de conferência sem
-- reimportação têm); a conferência pode estar na própria última rodada ou
-- numa linha `log_kind = 'conferencia'`.
CREATE OR REPLACE FUNCTION public.cobertura_janelas(p_fonte text)
RETURNS TABLE (
  escopo text,
  ano integer,
  mes integer,
  ultimo_resultado text,
  ultimo_motivo_parada text,
  ultima_rodada_em timestamptz,
  conferencia_estado text,
  conferencia_contagem text,
  conferencia_em timestamptz
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
      i.consultado_em
    FROM public.importacoes i
    WHERE i.fonte = p_fonte AND i.conferencia IS NOT NULL
    ORDER BY 1, 2, 3, i.consultado_em DESC
  )
  SELECT
    coalesce(r.escopo, c.escopo), coalesce(r.ano, c.ano), coalesce(r.mes, c.mes),
    r.resultado, r.motivo_parada, r.consultado_em,
    c.estado, c.contagem, c.consultado_em
  FROM rodadas r
  FULL JOIN conferencias c
    ON c.escopo = r.escopo AND c.ano = r.ano AND c.mes = r.mes
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.cobertura_janelas(text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cobertura_janelas(text) TO service_role;
