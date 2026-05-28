CREATE OR REPLACE FUNCTION public.cobertura_cgu()
 RETURNS TABLE(orgao_cod text, ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT orgao_cod,
         ano,
         COALESCE(EXTRACT(MONTH FROM data_assinatura)::int, 0) AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.contratos_cache
  GROUP BY orgao_cod, ano, COALESCE(EXTRACT(MONTH FROM data_assinatura)::int, 0)
$function$;