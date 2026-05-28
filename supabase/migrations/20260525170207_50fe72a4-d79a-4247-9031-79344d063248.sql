
CREATE TABLE public.artigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  resumo text,
  conteudo_md text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'nota' CHECK (categoria IN ('mapa','tutorial','nota')),
  capa_url text,
  dificuldade text CHECK (dificuldade IN ('iniciante','intermediario','avancado')),
  tempo_estimado_min integer CHECK (tempo_estimado_min IS NULL OR (tempo_estimado_min >= 0 AND tempo_estimado_min <= 1000)),
  fontes_usadas text[] NOT NULL DEFAULT '{}',
  notas_internas text,
  publico boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_artigos_categoria ON public.artigos(categoria);
CREATE INDEX idx_artigos_publico ON public.artigos(publico, publicado_em DESC);
CREATE INDEX idx_artigos_slug ON public.artigos(slug);

ALTER TABLE public.artigos ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas para itens publicados
CREATE POLICY "artigos select publico" ON public.artigos
  FOR SELECT
  USING (publico = true AND publicado_em IS NOT NULL AND publicado_em <= now());

-- Admin: tudo
CREATE POLICY "artigos admin all" ON public.artigos
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at (reusa função existente)
CREATE TRIGGER tg_artigos_touch
  BEFORE UPDATE ON public.artigos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_touch_updated_at();
