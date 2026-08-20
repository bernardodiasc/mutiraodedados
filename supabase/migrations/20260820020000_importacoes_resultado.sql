-- Classificação do resultado de cada rodada de importação.
--
-- `importados = 0` cobria cinco situações muito diferentes e o Histórico não
-- distinguia nenhuma: erro nosso, falha da origem, período legitimamente sem
-- dados, período ainda não publicado ou período anterior ao início da fonte.
-- Na prática, o PNCP passou meses devolvendo 404 e aparecendo como "0 sem
-- erro" — o defeito ficou invisível para quem operava.
--
-- Valores possíveis (ver src/lib/data/resultado-rodada.ts):
--   com_dados · sem_dados · nao_publicado · fora_da_janela
--   erro_origem · erro_nosso
--
-- Coluna anulável de propósito: linhas antigas (e as de log_kind='requisicao')
-- ficam sem classificação, e o Histórico mostra isso como "—" em vez de
-- inventar uma leitura retroativa que não temos como apurar.
ALTER TABLE public.importacoes
  ADD COLUMN IF NOT EXISTS resultado text;

-- O Histórico e a matriz filtram por rodadas que exigem atenção.
CREATE INDEX IF NOT EXISTS idx_importacoes_resultado
  ON public.importacoes (resultado, consultado_em DESC)
  WHERE resultado IS NOT NULL;
