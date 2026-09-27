-- Referências de um artigo a registros e consultas (v0.16.0): a base de
-- "Aprenda a investigar este registro" nas fichas e do alerta de revisão no
-- /admin/artigos.
--
-- Registro: identidade do índice de busca — tabela de origem (`colecao`) e
-- chave (`id_origem`) —, válida também para tipos ainda não indexados.
-- Consulta: URL de /buscar normalizada (parâmetros ordenados, sem página nem
-- corte); não vira entidade.
--
-- `titulo_citado` e `verificado_em` guardam o que o autor conferiu: o registro
-- mudar depois disso (`busca_indice.atualizado_em` maior) pede revisão, mas o
-- texto do artigo nunca é reescrito.
CREATE TABLE IF NOT EXISTS public.artigo_referencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id uuid NOT NULL REFERENCES public.artigos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('registro', 'consulta')),
  colecao text,
  id_origem text,
  consulta_url text,
  rotulo text,
  ordem integer NOT NULL DEFAULT 0,
  titulo_citado text,
  verificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artigo_referencias_alvo CHECK (
    (tipo = 'registro' AND colecao IS NOT NULL AND id_origem IS NOT NULL AND consulta_url IS NULL)
    OR (tipo = 'consulta' AND consulta_url IS NOT NULL AND colecao IS NULL AND id_origem IS NULL)
  )
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS artigo_referencias_registro_uidx
  ON public.artigo_referencias (artigo_id, colecao, id_origem) WHERE tipo = 'registro';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS artigo_referencias_consulta_uidx
  ON public.artigo_referencias (artigo_id, consulta_url) WHERE tipo = 'consulta';
--> statement-breakpoint
-- "Aprenda a investigar este registro": artigos que citam o registro.
CREATE INDEX IF NOT EXISTS artigo_referencias_alvo_idx
  ON public.artigo_referencias (colecao, id_origem) WHERE tipo = 'registro';
--> statement-breakpoint

DROP TRIGGER IF EXISTS tg_artigo_referencias_touch ON public.artigo_referencias;
--> statement-breakpoint
CREATE TRIGGER tg_artigo_referencias_touch BEFORE UPDATE ON public.artigo_referencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
--> statement-breakpoint

GRANT SELECT ON public.artigo_referencias TO anon, authenticated;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON public.artigo_referencias TO authenticated;
--> statement-breakpoint
GRANT ALL ON public.artigo_referencias TO service_role;
--> statement-breakpoint
ALTER TABLE public.artigo_referencias ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Mesmo desenho de `mapa_prompts`: o público lê as referências de artigo
-- publicado; só admin escreve.
DROP POLICY IF EXISTS "referencias de artigo publico" ON public.artigo_referencias;
--> statement-breakpoint
CREATE POLICY "referencias de artigo publico" ON public.artigo_referencias
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.artigos a WHERE a.id = artigo_id AND a.publico)
    OR public.has_role(auth.uid(), 'admin')
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "referencias admin escreve" ON public.artigo_referencias;
--> statement-breakpoint
CREATE POLICY "referencias admin escreve" ON public.artigo_referencias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
