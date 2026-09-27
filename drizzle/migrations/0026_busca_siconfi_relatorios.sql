-- Índice de busca (v0.16.0): relatórios fiscais do SICONFI, por relatório.
--
-- `siconfi_relatorios_cache` tem uma linha por conta (~2,8 milhões). A busca
-- indexa o RELATÓRIO — ente × tipo × exercício × período —, nunca a célula.
-- A tabela `siconfi_relatorios` é o catálogo desses relatórios, mantido por
-- gatilho por comando no cache (a importação grava em lote; o gatilho só
-- acrescenta as chaves novas e tira as que ficaram sem nenhuma conta). Ela é
-- a coleção registrada no índice.
--
-- Destino: /relatorios-fiscais filtrada no ente, exercício, tipo e período.
--
-- Carga dos relatórios já importados: `CALL busca_carregar_siconfi(de, ate)`,
-- por exercício, com commit a cada um (tarefa de cobertura).

CREATE TABLE IF NOT EXISTS public.siconfi_relatorios (
  id text PRIMARY KEY,
  cod_ibge text NOT NULL,
  ente_nome text NOT NULL,
  esfera text,
  uf text,
  exercicio integer NOT NULL,
  periodo integer NOT NULL,
  tipo_relatorio text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT siconfi_relatorios_id CHECK (id = cod_ibge || '|' || exercicio || '|' || periodo || '|' || tipo_relatorio)
);
--> statement-breakpoint

GRANT SELECT ON public.siconfi_relatorios TO anon, authenticated;
--> statement-breakpoint
GRANT ALL ON public.siconfi_relatorios TO service_role;
--> statement-breakpoint
ALTER TABLE public.siconfi_relatorios ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "leitura pública" ON public.siconfi_relatorios;
--> statement-breakpoint
CREATE POLICY "leitura pública" ON public.siconfi_relatorios
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint

-- A verificação "ainda há conta deste relatório" usa este índice.
CREATE INDEX IF NOT EXISTS idx_siconfi_relatorio_chave
  ON public.siconfi_relatorios_cache (cod_ibge, exercicio, tipo_relatorio, periodo);
--> statement-breakpoint

-- Gatilho no cache: acrescenta os relatórios das linhas novas ou alteradas.
-- O nome do ente varia por linha no RGF (cada poder e órgão tem o seu: "São
-- Paulo", "Defensoria Pública do Estado de São Paulo"…): o relatório guarda o
-- mais curto, que é o do próprio ente.
CREATE OR REPLACE FUNCTION public.siconfi_relatorios_tg_upsert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.siconfi_relatorios
    (id, cod_ibge, ente_nome, esfera, uf, exercicio, periodo, tipo_relatorio)
  SELECT DISTINCT ON (1)
    n.cod_ibge || '|' || n.exercicio || '|' || coalesce(n.periodo, 0) || '|' || n.tipo_relatorio,
    n.cod_ibge, n.ente_nome, n.esfera, n.uf, n.exercicio, coalesce(n.periodo, 0), n.tipo_relatorio
  FROM novos n
  ORDER BY 1, length(n.ente_nome)
  ON CONFLICT (id) DO UPDATE SET
    ente_nome = excluded.ente_nome, esfera = excluded.esfera, uf = excluded.uf,
    atualizado_em = now()
  WHERE length(excluded.ente_nome) < length(siconfi_relatorios.ente_nome);
  RETURN NULL;
END $$;
--> statement-breakpoint

-- Gatilho no cache: tira o relatório que ficou sem nenhuma conta.
CREATE OR REPLACE FUNCTION public.siconfi_relatorios_tg_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.siconfi_relatorios r
  USING (SELECT DISTINCT cod_ibge, exercicio, coalesce(periodo, 0) AS periodo, tipo_relatorio
         FROM antigos) a
  WHERE r.cod_ibge = a.cod_ibge AND r.exercicio = a.exercicio
    AND r.periodo = a.periodo AND r.tipo_relatorio = a.tipo_relatorio
    AND NOT EXISTS (
      SELECT 1 FROM public.siconfi_relatorios_cache c
      WHERE c.cod_ibge = a.cod_ibge AND c.exercicio = a.exercicio
        AND c.tipo_relatorio = a.tipo_relatorio AND coalesce(c.periodo, 0) = a.periodo);
  RETURN NULL;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.siconfi_relatorios_tg_truncate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.siconfi_relatorios;
  RETURN NULL;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION
  public.siconfi_relatorios_tg_upsert(),
  public.siconfi_relatorios_tg_delete(),
  public.siconfi_relatorios_tg_truncate()
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

DROP TRIGGER IF EXISTS siconfi_relatorios_ins ON public.siconfi_relatorios_cache;
--> statement-breakpoint
CREATE TRIGGER siconfi_relatorios_ins AFTER INSERT ON public.siconfi_relatorios_cache
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION public.siconfi_relatorios_tg_upsert();
--> statement-breakpoint
DROP TRIGGER IF EXISTS siconfi_relatorios_upd ON public.siconfi_relatorios_cache;
--> statement-breakpoint
CREATE TRIGGER siconfi_relatorios_upd AFTER UPDATE ON public.siconfi_relatorios_cache
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION public.siconfi_relatorios_tg_upsert();
--> statement-breakpoint
DROP TRIGGER IF EXISTS siconfi_relatorios_del ON public.siconfi_relatorios_cache;
--> statement-breakpoint
CREATE TRIGGER siconfi_relatorios_del AFTER DELETE ON public.siconfi_relatorios_cache
  REFERENCING OLD TABLE AS antigos
  FOR EACH STATEMENT EXECUTE FUNCTION public.siconfi_relatorios_tg_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS siconfi_relatorios_trunc ON public.siconfi_relatorios_cache;
--> statement-breakpoint
CREATE TRIGGER siconfi_relatorios_trunc AFTER TRUNCATE ON public.siconfi_relatorios_cache
  FOR EACH STATEMENT EXECUTE FUNCTION public.siconfi_relatorios_tg_truncate();
--> statement-breakpoint

-- Projeção: um relatório por linha no índice, categoria Finanças públicas.
CREATE OR REPLACE FUNCTION public.busca_projecao_siconfi_relatorios(p_ids text[])
RETURNS SETOF public.busca_linha
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 'siconfi_relatorios', r.id, 'financas', 'relatorio_fiscal', 'SICONFI',
    r.tipo_relatorio || ' ' ||
      CASE
        WHEN r.periodo = 0 THEN r.exercicio::text
        WHEN r.tipo_relatorio LIKE 'RREO%' THEN r.periodo || 'º bimestre de ' || r.exercicio
        WHEN r.tipo_relatorio LIKE 'RGF%' THEN r.periodo || 'º período de ' || r.exercicio
        ELSE r.periodo || 'º período de ' || r.exercicio
      END
      || ' — ' || r.ente_nome || coalesce(' (' || r.uf || ')', ''),
    r.tipo_relatorio || ' ' || r.exercicio || coalesce('/' || nullif(r.periodo, 0), ''),
    NULL,
    r.ente_nome || ' ' || r.cod_ibge,
    concat_ws(' · ',
      CASE
        WHEN r.tipo_relatorio LIKE 'RREO%' THEN 'Relatório Resumido da Execução Orçamentária'
        WHEN r.tipo_relatorio LIKE 'RGF%' THEN 'Relatório de Gestão Fiscal'
        WHEN r.tipo_relatorio LIKE 'DCA%' THEN 'Declaração de Contas Anuais'
      END,
      r.esfera, r.ente_nome),
    NULL,
    make_date(r.exercicio, 1, 1), 'exercicio', 'ano', r.uf,
    NULL::numeric, NULL, NULL,
    '/relatorios-fiscais?codIbge=' || r.cod_ibge || '&exercicio=' || r.exercicio
      || '&tipo=' || public.busca_url_segmento(r.tipo_relatorio) || '&periodo=' || r.periodo,
    NULL,
    NULL, NULL, NULL,
    jsonb_strip_nulls(jsonb_build_object('tipo_relatorio', r.tipo_relatorio, 'esfera', r.esfera))
  FROM public.siconfi_relatorios r
  WHERE p_ids IS NULL OR r.id = ANY (p_ids)
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.busca_projecao_siconfi_relatorios(text[])
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

SELECT public.busca_registrar_colecao('siconfi_relatorios', 'id', 'busca_projecao_siconfi_relatorios');
--> statement-breakpoint

-- Carga dos relatórios já importados, por exercício, com commit a cada um. O
-- INSERT dispara o gatilho do índice da coleção.
CREATE OR REPLACE PROCEDURE public.busca_carregar_siconfi(p_de integer, p_ate integer)
LANGUAGE plpgsql
AS $$
DECLARE
  ano integer;
BEGIN
  FOR ano IN p_de .. p_ate LOOP
    INSERT INTO public.siconfi_relatorios
      (id, cod_ibge, ente_nome, esfera, uf, exercicio, periodo, tipo_relatorio)
    SELECT DISTINCT ON (1)
      c.cod_ibge || '|' || c.exercicio || '|' || coalesce(c.periodo, 0) || '|' || c.tipo_relatorio,
      c.cod_ibge, c.ente_nome, c.esfera, c.uf, c.exercicio, coalesce(c.periodo, 0), c.tipo_relatorio
    FROM public.siconfi_relatorios_cache c
    WHERE c.exercicio = ano
    ORDER BY 1, length(c.ente_nome)
    ON CONFLICT (id) DO NOTHING;
    COMMIT;
  END LOOP;
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON PROCEDURE public.busca_carregar_siconfi(integer, integer)
  FROM PUBLIC, anon, authenticated;
