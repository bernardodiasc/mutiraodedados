
REVOKE EXECUTE ON FUNCTION public.tg_lacuna_de_finding() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_lacuna_de_finding() TO service_role;
