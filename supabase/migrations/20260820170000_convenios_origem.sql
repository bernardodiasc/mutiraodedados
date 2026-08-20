-- Enriquecimento dos convênios pela ORIGEM (CSV do SICONV/Transferegov) — v0.10.0.
--
-- A origem sabe o que o espelho da CGU não publica: a situação corrente do
-- instrumento e a execução financeira (empenhado, desembolsado). A regra do
-- ingest é "a origem enriquece, não corrige": estas colunas são DELA; os
-- campos do espelho nunca são sobrescritos — exceto data_assinatura, que é
-- apenas PREENCHIDA quando o espelho veio sem ela.
ALTER TABLE public.convenios_cache
  ADD COLUMN IF NOT EXISTS situacao_origem     text,
  ADD COLUMN IF NOT EXISTS valor_empenhado     numeric,
  ADD COLUMN IF NOT EXISTS valor_desembolsado  numeric,
  ADD COLUMN IF NOT EXISTS atualizado_origem_em timestamptz;

CREATE INDEX IF NOT EXISTS convenios_cache_codigo_siconv_idx
  ON public.convenios_cache (codigo_siconv);

-- Um lote do CSV por chamada: atualiza por codigo_siconv e devolve quantos
-- acharam espelho e quantos não — o "sem espelho" mede o quanto do acervo da
-- origem o site ainda não mostra.
CREATE OR REPLACE FUNCTION public.enriquecer_convenios_origem(_itens jsonb)
 RETURNS TABLE(atualizados integer, sem_espelho integer)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH itens AS (
    SELECT * FROM jsonb_to_recordset(_itens) AS x(
      codigo_siconv text,
      situacao_origem text,
      data_assinatura date,
      valor_empenhado numeric,
      valor_desembolsado numeric
    )
  ),
  upd AS (
    UPDATE public.convenios_cache c SET
      situacao_origem      = i.situacao_origem,
      valor_empenhado      = i.valor_empenhado,
      valor_desembolsado   = i.valor_desembolsado,
      data_assinatura      = COALESCE(c.data_assinatura, i.data_assinatura),
      atualizado_origem_em = now()
    FROM itens i
    WHERE c.codigo_siconv = i.codigo_siconv
    RETURNING i.codigo_siconv
  )
  SELECT (SELECT COUNT(*) FROM upd)::int,
         ((SELECT COUNT(*) FROM itens) - (SELECT COUNT(DISTINCT codigo_siconv) FROM upd))::int
$function$;

-- Só o servidor enriquece.
REVOKE ALL ON FUNCTION public.enriquecer_convenios_origem(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enriquecer_convenios_origem(jsonb) TO service_role;

-- Cobertura do enriquecimento: quantos registros têm dado da origem.
CREATE OR REPLACE FUNCTION public.cobertura_convenios_origem()
 RETURNS TABLE(total bigint, ultimo timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COUNT(*) FILTER (WHERE atualizado_origem_em IS NOT NULL)::bigint,
         MAX(atualizado_origem_em)
  FROM public.convenios_cache
$function$;
