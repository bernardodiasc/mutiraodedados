-- Índice de busca (v0.16.0): prompts do Kit de investigação.
--
-- A coleção é o vínculo `mapa_prompts`: uma linha por prompt em cada mapa,
-- com id de origem `<prompt>:<mapa>`. O mesmo prompt em dois mapas aparece
-- duas vezes, cada uma levando ao Kit daquele mapa
-- (`/mapas/<slug>#prompt-<id>`, âncora criada na página no mesmo PR).
--
-- Visibilidade igual à do site: só entra prompt ativo vinculado a mapa
-- público. O texto indexado é o template do prompt (não tem dado pessoal).
--
-- Gatilhos: o registro cria os de `mapa_prompts`. Mudar o prompt (ativo,
-- título, texto) ou o mapa (publicação, título, slug) também muda o que o
-- índice mostra, então `prompt_modelos` e `artigos` ganham gatilhos próprios
-- (`busca_kit_*`) que reindexam os vínculos afetados. Os gatilhos de índice
-- dos artigos (`busca_indice_*`) continuam como estão.

CREATE OR REPLACE FUNCTION public.busca_projecao_kit(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'mapa_prompts', mp.prompt_modelo_id::text || ':' || mp.artigo_id::text, 'artigos', 'prompt', 'Mutirão de Dados',
    pm.titulo, NULL, NULL,
    array_to_string(pm.tags, ' '),
    left(concat_ws(' · ', pm.descricao, 'No mapa ' || a.titulo), 400), pm.prompt_template,
    NULL::date, NULL, NULL, NULL,
    NULL::numeric, NULL, NULL,
    '/mapas/' || public.busca_url_segmento(a.slug) || '#prompt-' || pm.id, NULL,
    'artigos', a.id::text, a.titulo,
    '{}'::jsonb
  FROM public.mapa_prompts mp
  JOIN public.prompt_modelos pm ON pm.id = mp.prompt_modelo_id
  JOIN public.artigos a ON a.id = mp.artigo_id
  WHERE pm.ativo AND a.publico AND a.categoria = 'mapa'
    AND (p_ids IS NULL OR (mp.prompt_modelo_id::text || ':' || mp.artigo_id::text) = ANY (p_ids))
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_projecao_kit(text[]) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('mapa_prompts',
  $k$prompt_modelo_id::text || ':' || artigo_id::text$k$, 'busca_projecao_kit');
--> statement-breakpoint

-- Prompt alterado: reindexa os vínculos dele. Apagar o prompt apaga os
-- vínculos em cascata, e o gatilho de `mapa_prompts` tira as linhas do índice.
CREATE OR REPLACE FUNCTION public.busca_kit_tg_prompt()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids text[];
BEGIN
  SELECT array_agg(mp.prompt_modelo_id::text || ':' || mp.artigo_id::text) INTO ids
  FROM public.mapa_prompts mp
  WHERE mp.prompt_modelo_id IN (
    SELECT n.id FROM novos n JOIN antigos o ON o.id = n.id
    WHERE (n.ativo, n.titulo, n.descricao, n.prompt_template, n.tags)
      IS DISTINCT FROM (o.ativo, o.titulo, o.descricao, o.prompt_template, o.tags));
  IF ids IS NOT NULL THEN
    PERFORM public.busca_indexar('mapa_prompts', ids);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint

-- Mapa alterado: publicar, despublicar, renomear ou mudar o slug reindexa os
-- vínculos do mapa. Apagar o mapa apaga os vínculos em cascata.
CREATE OR REPLACE FUNCTION public.busca_kit_tg_artigo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids text[];
BEGIN
  SELECT array_agg(mp.prompt_modelo_id::text || ':' || mp.artigo_id::text) INTO ids
  FROM public.mapa_prompts mp
  WHERE mp.artigo_id IN (
    SELECT n.id FROM novos n JOIN antigos o ON o.id = n.id
    WHERE (n.publico, n.categoria, n.titulo, n.slug)
      IS DISTINCT FROM (o.publico, o.categoria, o.titulo, o.slug));
  IF ids IS NOT NULL THEN
    PERFORM public.busca_indexar('mapa_prompts', ids);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_kit_tg_prompt(), public.busca_kit_tg_artigo()
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

DROP TRIGGER IF EXISTS busca_kit_upd ON public.prompt_modelos;
--> statement-breakpoint
CREATE TRIGGER busca_kit_upd AFTER UPDATE ON public.prompt_modelos
  REFERENCING OLD TABLE AS antigos NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION public.busca_kit_tg_prompt();
--> statement-breakpoint

DROP TRIGGER IF EXISTS busca_kit_upd ON public.artigos;
--> statement-breakpoint
CREATE TRIGGER busca_kit_upd AFTER UPDATE ON public.artigos
  REFERENCING OLD TABLE AS antigos NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION public.busca_kit_tg_artigo();
--> statement-breakpoint

SELECT public.busca_reconstruir('mapa_prompts');
