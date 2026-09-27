-- Índice de busca (v0.16.0): alertas de qualidade e lacunas detectados nas
-- importações (`qa_findings`), categoria Qualidade e sinais, destino
-- `/qualidade/<id>`. Mesmo filtro da leitura pública: sinais e marcações
-- cidadãs ficam fora. `detalhes` e `notas_admin` não entram.
--
-- Custo nas importações: o `flagQA` regrava, linha a linha, os findings
-- abertos detectados de novo (severidade, valores, detalhes). O gatilho de
-- UPDATE por comando da coleção reindexaria um finding por comando a cada
-- reimportação. Por isso ele é trocado por um gatilho POR LINHA com `WHEN`:
-- só dispara quando muda uma coluna que a projeção publica. (O Postgres não
-- aceita lista de colunas em gatilho com tabela de transição.) Inclusão de
-- findings novos é em lote (50 por comando): um disparo por lote.
--
-- Carga dos findings existentes: `SELECT busca_reconstruir('qa_findings')`
-- (tarefa de cobertura; ver o PR).

CREATE OR REPLACE FUNCTION public.busca_projecao_qa_findings(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'qa_findings', f.id::text, 'qualidade', 'alerta',
    CASE
      WHEN f.fonte LIKE 'cgu%' THEN 'CGU'
      WHEN f.fonte LIKE 'pncp%' THEN 'PNCP'
      WHEN f.fonte LIKE 'tse%' THEN 'TSE'
      WHEN f.fonte LIKE 'camara%' THEN 'Câmara'
      WHEN f.fonte LIKE 'senado%' THEN 'Senado'
      WHEN f.fonte LIKE 'siconfi%' THEN 'SICONFI'
      WHEN f.fonte LIKE 'transferegov%' OR f.fonte LIKE 'convenios%' THEN 'Transferegov'
      ELSE upper(f.fonte)
    END,
    initcap(replace(f.regra, '_', ' ')) || ' — ' || f.entidade_tipo || ' ' || f.entidade_id,
    NULL, NULL,
    f.entidade_id,
    concat_ws(' · ', CASE f.tipo WHEN 'lacuna' THEN 'Lacuna' WHEN 'investigativo' THEN 'Sinal investigativo'
      ELSE 'Alerta de qualidade' END, f.status),
    NULL,
    f.detectado_em::date, CASE WHEN f.detectado_em IS NOT NULL THEN 'fato' END,
    CASE WHEN f.detectado_em IS NOT NULL THEN 'dia' END, NULL,
    NULL::numeric, NULL, NULL,
    '/qualidade/' || f.id, NULL,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'tipo_sinal', CASE f.tipo WHEN 'lacuna' THEN 'Lacuna' WHEN 'investigativo' THEN 'Sinal investigativo'
        ELSE 'Alerta de qualidade' END,
      'status', f.status))
  FROM public.qa_findings f
  WHERE f.origem NOT IN ('sinal', 'marcacao_cidada')
    AND (p_ids IS NULL OR f.id::text = ANY (p_ids))
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_projecao_qa_findings(text[]) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('qa_findings', 'id', 'busca_projecao_qa_findings');
--> statement-breakpoint

-- O registro cria o gatilho de UPDATE por comando; aqui ele vira por linha,
-- só quando muda o que é publicado.
CREATE OR REPLACE FUNCTION public.busca_tg_indexar_finding()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.busca_indexar('qa_findings', ARRAY[NEW.id::text]);
  RETURN NULL;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_tg_indexar_finding() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

DROP TRIGGER IF EXISTS busca_indice_upd ON public.qa_findings;
--> statement-breakpoint
CREATE TRIGGER busca_indice_upd
  AFTER UPDATE ON public.qa_findings
  FOR EACH ROW
  WHEN ((OLD.fonte, OLD.entidade_tipo, OLD.entidade_id, OLD.regra, OLD.tipo, OLD.origem,
         OLD.status, OLD.detectado_em)
        IS DISTINCT FROM
        (NEW.fonte, NEW.entidade_tipo, NEW.entidade_id, NEW.regra, NEW.tipo, NEW.origem,
         NEW.status, NEW.detectado_em))
  EXECUTE FUNCTION public.busca_tg_indexar_finding();
