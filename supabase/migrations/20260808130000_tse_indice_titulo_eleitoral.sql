-- Índice para ligar candidaturas da mesma pessoa pelo título eleitoral.
--
-- Por que não basta o CPF: o TSE parou de divulgar NR_CPF_CANDIDATO em 2024
-- (o campo vem "NÃO DIVULGÁVEL"/-4 em todas as linhas) e passou a divulgar
-- NR_TITULO_ELEITORAL_CANDIDATO. Na base atual são 463.583 candidaturas de 2024
-- com título e ZERO com CPF. Ligar só por CPF deixaria a eleição inteira de 2024
-- sem histórico, e nenhuma ficha de 2022 alcançaria a candidatura de 2024 da
-- mesma pessoa.
--
-- O título é a chave de ligação primária; o CPF continua como reforço para os
-- anos em que ele existe e o título veio sentinela.

CREATE INDEX IF NOT EXISTS tse_candidatos_titulo_idx
  ON public.tse_candidatos_cache(titulo_eleitoral);
