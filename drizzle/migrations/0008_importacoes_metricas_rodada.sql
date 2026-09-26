-- Métricas de desempenho de cada rodada de importação, em colunas próprias.
--
-- Até aqui só a duração aparecia, dentro do texto de `endpoint`. Gravadas em
-- toda linha de rodada (as que passam por `montarLinhaRodada`, inclusive as
-- varreduras da CGU); linhas anteriores e linhas por consulta ficam nulas.
--
-- duracao_ms: duração da rodada.
-- itens_processados: passos confirmados (votações, consultas, páginas…).
-- subrequisicoes: subrequisições que os passos reportaram ao runner.
-- motivo_parada: fim (origem acabou), tempo, subrequisicoes, erro
--   (interrupção) ou passos (limite de páginas/passos).
ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS duracao_ms integer,
  ADD COLUMN IF NOT EXISTS itens_processados integer,
  ADD COLUMN IF NOT EXISTS subrequisicoes integer,
  ADD COLUMN IF NOT EXISTS motivo_parada text
    CHECK (motivo_parada IN ('fim', 'tempo', 'subrequisicoes', 'erro', 'passos'));
--> statement-breakpoint

-- Soma das métricas do recorte filtrado do Histórico em /admin/dados. Os
-- filtros repetem os de `aplicarFiltrosHistorico` (historico-filtros.ts), e
-- as linhas de requisição da varredura por detalhe ficam fora, como na
-- listagem. Chamada só pelo servidor (service_role).
CREATE OR REPLACE FUNCTION public.resumo_historico_importacoes(
  p_fonte text DEFAULT NULL,
  p_gatilho text DEFAULT NULL,
  p_resultado text DEFAULT NULL,
  p_conferencia text DEFAULT NULL,
  p_execucao uuid DEFAULT NULL,
  p_motivo_parada text DEFAULT NULL,
  p_de timestamptz DEFAULT NULL,
  p_ate timestamptz DEFAULT NULL
)
RETURNS TABLE (
  rodadas bigint,
  rodadas_com_metricas bigint,
  duracao_ms_soma bigint,
  itens_soma bigint,
  subrequisicoes_soma bigint,
  por_motivo jsonb
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH recorte AS (
    SELECT duracao_ms, itens_processados, subrequisicoes, motivo_parada
    FROM public.importacoes
    WHERE (log_kind IS NULL OR log_kind <> 'requisicao')
      AND (p_fonte IS NULL OR fonte = p_fonte)
      AND (p_gatilho IS NULL OR gatilho = p_gatilho)
      AND (p_resultado IS NULL OR resultado = p_resultado)
      AND (p_conferencia IS NULL OR conferencia->>'estado' = p_conferencia)
      AND (p_execucao IS NULL OR execucao_id = p_execucao)
      AND (p_motivo_parada IS NULL OR motivo_parada = p_motivo_parada)
      AND (p_de IS NULL OR consultado_em >= p_de)
      AND (p_ate IS NULL OR consultado_em < p_ate)
  )
  SELECT
    count(*),
    count(duracao_ms),
    sum(duracao_ms),
    sum(itens_processados),
    sum(subrequisicoes),
    (SELECT coalesce(jsonb_object_agg(m.motivo_parada, m.n), '{}'::jsonb)
       FROM (SELECT motivo_parada, count(*) AS n
               FROM recorte
              WHERE motivo_parada IS NOT NULL
              GROUP BY motivo_parada) m)
  FROM recorte;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.resumo_historico_importacoes(text, text, text, text, uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resumo_historico_importacoes(text, text, text, text, uuid, text, timestamptz, timestamptz) TO service_role;
