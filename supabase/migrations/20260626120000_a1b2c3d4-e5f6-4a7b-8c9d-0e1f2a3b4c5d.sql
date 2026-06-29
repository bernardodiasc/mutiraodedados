-- Estado da varredura retomável de contratos da CGU.
--
-- A API /contratos da CGU filtra por VIGÊNCIA (não por assinatura) e devolve
-- páginas fixas de 15 registros. Órgãos grandes têm milhares de contratos no
-- histórico e excedem o orçamento de páginas de uma única execução (limite de
-- tempo do job). Por isso a ingestão roda em rodadas: cada rodada paginar a
-- partir de `ultima_pagina + 1` por um orçamento de páginas e atualiza o
-- progresso aqui; quando uma página vem incompleta, marca `completa = true`.
CREATE TABLE IF NOT EXISTS public.cgu_varredura (
  orgao_cod       text PRIMARY KEY,
  ultima_pagina   integer NOT NULL DEFAULT 0,
  completa        boolean NOT NULL DEFAULT false,
  total_importado integer NOT NULL DEFAULT 0,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cgu_varredura TO service_role;
ALTER TABLE public.cgu_varredura ENABLE ROW LEVEL SECURITY;

-- Apenas admins leem (as escritas são feitas pelo servidor via service_role,
-- que ignora RLS). Sem políticas para anon/authenticated escreverem.
CREATE POLICY "cgu_varredura admin le" ON public.cgu_varredura
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
