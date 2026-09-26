-- Índice (exercicio, cod_ibge) em siconfi_relatorios_cache, para a contagem
-- da conferência do SICONFI em lote: linhas de um exercício nos entes de um
-- conjunto (as UFs, as capitais, os municípios de uma UF, um ente).
--
-- Com os índices de uma coluna só, o banco achava as linhas do exercício pelo
-- índice de `exercicio` e lia cada uma na tabela para filtrar o ente: em
-- ~2,8 milhões de linhas, a contagem das UFs de 2023 e das capitais de 2025
-- estourava o tempo-limite do PostgREST (8 s). Com este índice, a contagem
-- percorre só a faixa do índice que casa com o exercício e os códigos, sem
-- ler a tabela (index-only scan).
--
-- A criação trava as escritas nesta tabela enquanto o índice é montado: rode
-- fora de uma importação do SICONFI. O tempo-limite da sessão é desligado só
-- nesta transação, para a montagem não ser cancelada no meio.
SET LOCAL statement_timeout = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_siconfi_exercicio_cod_ibge
  ON public.siconfi_relatorios_cache (exercicio, cod_ibge);
