
ALTER TABLE public.roadmap_itens
  ADD COLUMN IF NOT EXISTS publico boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS concluido_em date;

CREATE INDEX IF NOT EXISTS roadmap_itens_publico_idx ON public.roadmap_itens(publico);
CREATE INDEX IF NOT EXISTS roadmap_itens_concluido_em_idx ON public.roadmap_itens(concluido_em DESC);
