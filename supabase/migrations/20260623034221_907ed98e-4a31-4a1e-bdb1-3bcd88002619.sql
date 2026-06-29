
UPDATE public.qa_findings f
SET status = 'corrigido_origem',
    resolvido_em = now(),
    updated_at = now(),
    detalhes = COALESCE(f.detalhes, '{}'::jsonb) || jsonb_build_object(
      'reprocessamento', jsonb_build_object(
        'motivo', 'limpeza retroativa — regra não viola mais o cache atual',
        'valor_atual', c.valor,
        'valor_inicial_atual', c.valor_inicial,
        'em', now()
      )
    )
FROM public.contratos_cache c
WHERE f.entidade_id = c.id
  AND f.fonte = 'cgu'
  AND f.status = 'aberto'
  AND (
    (f.regra = 'valor_muito_baixo'
       AND NOT (c.valor > 0 AND c.valor < 100))
    OR (f.regra = 'valor_final_truncado_suspeito'
       AND NOT (c.valor > 0 AND c.valor < 100 AND COALESCE(c.valor_inicial,0) > 1000))
    OR (f.regra = 'discrepancia_extrema_inicial_final'
       AND NOT (COALESCE(c.valor_inicial,0) > 0 AND c.valor > 0
                AND COALESCE(c.valor_inicial,0) > c.valor * 100))
  );
