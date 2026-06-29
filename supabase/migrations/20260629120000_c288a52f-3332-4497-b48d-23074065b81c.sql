-- Cobertura da CGU passa a alocar os contratos pelo mês de INÍCIO DE VIGÊNCIA
-- (data_inicio_vigencia), não mais pela data de assinatura.
--
-- Motivo: a API /contratos da CGU filtra por VIGÊNCIA (dataInicial =
-- dataInicioVigencia, dataFinal = dataFimVigencia). Para a matriz de cobertura
-- (admin /admin/dados e pública /cobertura) refletir a mesma dimensão usada no
-- filtro/ingestão, cada contrato é alocado ao ano+mês do início da sua vigência.
-- Fallback para a coluna `ano` (ano de assinatura) e `mes_referencia` quando a
-- data de início de vigência estiver ausente.
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

GRANT EXECUTE ON FUNCTION public.cobertura_cgu() TO service_role;
