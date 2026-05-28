CREATE OR REPLACE FUNCTION public.cobertura_transferegov()
 RETURNS TABLE(ano integer, mes integer, qtd bigint, ultimo timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXTRACT(YEAR  FROM COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia))::int AS ano,
         EXTRACT(MONTH FROM COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia))::int AS mes,
         COUNT(*)::bigint,
         MAX(updated_at)
  FROM public.transferegov_instrumentos_cache
  WHERE COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia) IS NOT NULL
  GROUP BY EXTRACT(YEAR  FROM COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia)),
           EXTRACT(MONTH FROM COALESCE(data_assinatura, data_inicio_vigencia, data_fim_vigencia))
$function$;