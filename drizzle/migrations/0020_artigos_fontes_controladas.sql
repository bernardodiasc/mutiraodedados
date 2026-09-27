-- `artigos.fontes_usadas` vira lista controlada (v0.16.0): as fontes do acervo,
-- com os rótulos da faceta Fonte da busca, e as fontes oficiais externas que
-- os artigos citam. A lista vive no código (`src/lib/artigos/fontes.ts`) e a
-- validação no servidor; esta migration normaliza os valores antigos.
--
-- O mapeamento cobre os valores encontrados em produção em 2026-09-26 e cada
-- rótulo da lista para ele mesmo (rodar de novo só reordena, sem perder nada). Valor sem
-- correspondência — leis, conceitos, "Metodologia interna" — sai da lista e é
-- guardado nas notas internas do artigo, para não se perder.
WITH mapa(de, para) AS (VALUES
  -- rótulos da lista (idempotência)
  ('cgu', 'CGU'), ('pncp', 'PNCP'), ('transferegov', 'Transferegov'),
  ('siconfi', 'SICONFI'), ('câmara', 'Câmara'), ('senado', 'Senado'), ('tse', 'TSE'),
  ('ibge', 'IBGE'), ('siop', 'SIOP'), ('receita federal', 'Receita Federal'),
  ('sicaf', 'SICAF'), ('painel de preços', 'Painel de Preços'), ('ceis', 'CEIS'),
  ('cnep', 'CNEP'), ('tcu', 'TCU'), ('mgi', 'MGI'),
  -- valores antigos
  ('portal da transparência', 'CGU'), ('siafi', 'CGU'), ('licitações', 'CGU'),
  ('convênios', 'CGU'),
  ('https://api.portaldatransparencia.gov.br/swagger-ui/index.html', 'CGU'),
  ('câmara dos deputados', 'Câmara'), ('câmara ceap', 'Câmara'),
  ('senado federal', 'Senado'), ('senado ceaps', 'Senado'),
  ('transferências (ec 105)', 'Transferegov'), ('transferências da união', 'Transferegov'),
  ('https://docs.api.transferegov.gestao.gov.br/', 'Transferegov'),
  ('municípios', 'IBGE')
),
novo AS (
  SELECT a.id,
    coalesce(array_agg(DISTINCT m.para ORDER BY m.para) FILTER (WHERE m.para IS NOT NULL),
      '{}'::text[]) AS fontes,
    string_agg(f, ', ' ORDER BY f) FILTER (WHERE m.para IS NULL) AS retiradas
  FROM public.artigos a
  CROSS JOIN LATERAL unnest(a.fontes_usadas) AS f
  LEFT JOIN mapa m ON m.de = lower(btrim(f))
  GROUP BY a.id
)
UPDATE public.artigos a
SET fontes_usadas = n.fontes,
    notas_internas = CASE
      WHEN n.retiradas IS NULL THEN a.notas_internas
      ELSE concat_ws(E'\n\n', nullif(a.notas_internas, ''),
        'Fontes retiradas da lista controlada em 2026-09-26 (v0.16.0): ' || n.retiradas)
    END
FROM novo n
WHERE n.id = a.id
  AND (a.fontes_usadas IS DISTINCT FROM n.fontes OR n.retiradas IS NOT NULL);
