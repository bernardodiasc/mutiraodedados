-- Ordem manual (drag-and-drop no admin) para artigos e perguntas.
-- Antes a ordem pública era só por data; agora o admin define a sequência.
--
-- Os backfills são condicionais (só rodam quando a ordem ainda está no default),
-- para que uma reaplicação da migração não sobrescreva reordenações manuais.

-- ── Artigos ──────────────────────────────────────────────────────────────
ALTER TABLE public.artigos
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  -- Só faz o backfill inicial se nenhuma ordem foi customizada ainda.
  IF NOT EXISTS (SELECT 1 FROM public.artigos WHERE ordem <> 0) THEN
    WITH numerados AS (
      SELECT id,
             (row_number() OVER (ORDER BY publicado_em DESC NULLS LAST, created_at DESC) - 1) AS n
      FROM public.artigos
    )
    UPDATE public.artigos a
    SET ordem = numerados.n
    FROM numerados
    WHERE a.id = numerados.id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS artigos_categoria_ordem_idx
  ON public.artigos (categoria, ordem);

-- ── Perguntas (publicadas) ───────────────────────────────────────────────
ALTER TABLE public.perguntas
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perguntas WHERE ordem <> 0) THEN
    WITH numeradas AS (
      SELECT id,
             (row_number() OVER (ORDER BY publicada_em DESC NULLS LAST, created_at DESC) - 1) AS n
      FROM public.perguntas
      WHERE status = 'publicada'
    )
    UPDATE public.perguntas p
    SET ordem = numeradas.n
    FROM numeradas
    WHERE p.id = numeradas.id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS perguntas_ordem_idx
  ON public.perguntas (ordem);
