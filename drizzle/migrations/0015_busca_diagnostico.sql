-- Diagnóstico de busca por coleção no /admin/dados (v0.16.0): conciliar o
-- cache, o que a projeção considera publicável e o que está no índice.
-- Uma medida por chamada, para o servidor dar a cada uma o seu orçamento de
-- tempo e mostrar "indisponível" quando estourar, sem perder as outras.
--
--   cache        linhas da tabela de origem
--   publicaveis  linhas que a projeção devolve (o que deveria estar no índice)
--   indice       linhas da coleção em busca_indice
--
-- Só aceita coleção que tem os gatilhos do índice: o nome vira identificador
-- de tabela no SQL dinâmico.
CREATE OR REPLACE FUNCTION public.busca_diagnostico(p_colecao text, p_medida text)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public' AND c.relname = p_colecao AND t.tgname = 'busca_indice_ins'
  ) THEN
    RAISE EXCEPTION 'Coleção sem gatilho de índice: %', p_colecao;
  END IF;
  CASE p_medida
    WHEN 'cache' THEN
      EXECUTE format('SELECT count(*) FROM public.%I', p_colecao) INTO n;
    WHEN 'publicaveis' THEN
      SELECT count(*) INTO n FROM public.busca_projetar(p_colecao, NULL);
    WHEN 'indice' THEN
      SELECT count(*) INTO n FROM public.busca_indice WHERE colecao = p_colecao;
    ELSE
      RAISE EXCEPTION 'Medida desconhecida: %', p_medida;
  END CASE;
  RETURN n;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_diagnostico(text, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.busca_diagnostico(text, text) TO service_role;
