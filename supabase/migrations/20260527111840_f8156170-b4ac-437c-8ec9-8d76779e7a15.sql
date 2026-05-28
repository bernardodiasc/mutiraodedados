REVOKE SELECT (notas) ON public.roadmap_itens FROM anon, authenticated;
GRANT SELECT (notas) ON public.roadmap_itens TO service_role;