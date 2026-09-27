-- Índice de busca (v0.16.0): páginas estáticas públicas (ajuda, método,
-- trilhas, referências, páginas de fonte, listas), categoria Páginas e ajuda.
--
-- As páginas só existem no código. A lista delas também: fica em
-- `src/lib/paginas-publicas/lista.ts`, e esta tabela é a cópia que o índice
-- lê. A cópia é feita pelo botão "Sincronizar páginas" da aba Busca do
-- /admin/dados, que grava as entradas novas ou alteradas e apaga as que
-- saíram da lista; os gatilhos da coleção levam a mudança ao índice. Esta
-- migration não semeia linhas (o texto não fica duplicado no SQL): depois de
-- aplicá-la, sincronize uma vez.
--
-- Uma linha por destino: a página (`rota`) ou uma seção dela (`rota#ancora`).
-- A seção aparece na busca "em <página>".

CREATE TABLE IF NOT EXISTS public.paginas_publicas (
  id text PRIMARY KEY,
  rota text NOT NULL CHECK (rota LIKE '/%'),
  ancora text,
  pagina text NOT NULL,
  titulo text NOT NULL,
  resumo text,
  palavras text,
  texto text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paginas_publicas_id_destino CHECK (id = rota || coalesce('#' || ancora, ''))
);
--> statement-breakpoint

GRANT SELECT ON public.paginas_publicas TO anon, authenticated;
--> statement-breakpoint
GRANT ALL ON public.paginas_publicas TO service_role;
--> statement-breakpoint
ALTER TABLE public.paginas_publicas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "leitura pública" ON public.paginas_publicas;
--> statement-breakpoint
CREATE POLICY "leitura pública" ON public.paginas_publicas
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.busca_projecao_paginas_publicas(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'paginas_publicas', p.id, 'paginas', CASE WHEN p.ancora IS NULL THEN 'pagina' ELSE 'secao' END,
    'Mutirão de Dados',
    p.titulo, NULL, NULL,
    p.palavras,
    p.resumo, p.texto,
    NULL::date, NULL, NULL, NULL,
    NULL::numeric, NULL, NULL,
    p.id, NULL,
    CASE WHEN p.ancora IS NOT NULL THEN 'paginas' END,
    CASE WHEN p.ancora IS NOT NULL THEN p.rota END,
    CASE WHEN p.ancora IS NOT NULL THEN p.pagina END,
    jsonb_build_object('pagina_site', p.pagina)
  FROM public.paginas_publicas p
  WHERE p_ids IS NULL OR p.id = ANY (p_ids)
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_projecao_paginas_publicas(text[])
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('paginas_publicas', 'id', 'busca_projecao_paginas_publicas');
