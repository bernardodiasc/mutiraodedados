CREATE OR REPLACE FUNCTION public.cobertura_cgu()
 RETURNS TABLE(orgao_cod text, ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT orgao_cod,
         COALESCE(EXTRACT(YEAR FROM data_inicio_vigencia)::int, ano) AS ano,
         COALESCE(
           EXTRACT(MONTH FROM data_inicio_vigencia)::int,
           mes_referencia::int,
           0
         ) AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.contratos_cache
  GROUP BY orgao_cod,
           COALESCE(EXTRACT(YEAR FROM data_inicio_vigencia)::int, ano),
           COALESCE(
             EXTRACT(MONTH FROM data_inicio_vigencia)::int,
             mes_referencia::int,
             0
           )
$function$;

REVOKE EXECUTE ON FUNCTION public.cobertura_cgu() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_cgu() TO service_role;