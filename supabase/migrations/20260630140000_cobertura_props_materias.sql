-- Cobertura (anual) para Câmara proposições e Senado matérias.
-- Mesmo molde de cobertura_cgu_emendas(): agrega por ano com mes=1 como âncora.

CREATE OR REPLACE FUNCTION public.cobertura_camara_proposicoes()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano, 1 AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.camara_proposicoes_cache
  GROUP BY ano
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_camara_proposicoes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_camara_proposicoes() TO service_role;

CREATE OR REPLACE FUNCTION public.cobertura_senado_materias()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ano, 1 AS mes, COUNT(*)::bigint, MAX(updated_at)
  FROM public.senado_materias_cache
  GROUP BY ano
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_senado_materias() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_senado_materias() TO service_role;
