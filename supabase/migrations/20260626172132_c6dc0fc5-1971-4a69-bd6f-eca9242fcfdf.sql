CREATE TABLE IF NOT EXISTS public.cgu_varredura (
  orgao_cod       text PRIMARY KEY,
  ultima_pagina   integer NOT NULL DEFAULT 0,
  completa        boolean NOT NULL DEFAULT false,
  total_importado integer NOT NULL DEFAULT 0,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cgu_varredura TO service_role;
ALTER TABLE public.cgu_varredura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cgu_varredura admin le" ON public.cgu_varredura
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));