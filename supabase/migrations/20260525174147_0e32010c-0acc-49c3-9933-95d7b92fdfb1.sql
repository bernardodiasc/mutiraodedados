
-- Remove permissive public SELECT policies that exposed internal note columns.
-- Public reads continue to flow through server functions (supabaseAdmin) with
-- explicit safe-column projection; admin policies remain in place.

DROP POLICY IF EXISTS "artigos select publico" ON public.artigos;
DROP POLICY IF EXISTS "roadmap select all" ON public.roadmap_itens;
