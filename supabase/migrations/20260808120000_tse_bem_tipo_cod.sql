-- Guarda o código do tipo de bem declarado ao TSE (CD_TIPO_BEM_CANDIDATO).
--
-- O CSV de bens sempre trouxe a coluna, mas o parser só persistia a descrição
-- (DS_TIPO_BEM_CANDIDATO), que é texto livre e varia de ano para ano. O código é
-- a tabela "Bens e Direitos" da Receita: dois dígitos estáveis onde a dezena é o
-- grupo (12 = Casa, 19 = Outros bens imóveis, 21 = Veículo automotor terrestre,
-- 49 = Outras aplicações e Investimentos). Com ele, agrupar bens por categoria
-- vira exato em vez de casar palavra-chave em descrição.
--
-- Nullable e sem backfill: linhas importadas antes desta migration ficam NULL e
-- caem no fallback por descrição (src/lib/data/tse/categorias-bens.ts). Para
-- preencher, reimporte os bens em /admin/dados → aba TSE.

ALTER TABLE public.tse_bens_candidato_cache
  ADD COLUMN IF NOT EXISTS tipo_bem_cod text;

COMMENT ON COLUMN public.tse_bens_candidato_cache.tipo_bem_cod IS
  'CD_TIPO_BEM_CANDIDATO do TSE (tabela Bens e Direitos). NULL em linhas importadas antes de 2026-08.';
