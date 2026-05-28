
CREATE TABLE public.roadmap_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','em_andamento','concluido')),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmap select all"
  ON public.roadmap_itens FOR SELECT
  USING (true);

CREATE POLICY "roadmap admin write"
  ON public.roadmap_itens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER roadmap_itens_touch
  BEFORE UPDATE ON public.roadmap_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX roadmap_itens_ordem_idx ON public.roadmap_itens (ordem, created_at);

-- Seed com o roadmap atual da página /sobre, para não ficar vazio
INSERT INTO public.roadmap_itens (titulo, status, ordem) VALUES
  ('Integração com Câmara e Senado (cota parlamentar)', 'concluido', 10),
  ('Integração com Judiciário e Ministério Público (folha, contratos)', 'planejado', 20),
  ('Estados e municípios, em parceria com observatórios locais', 'em_andamento', 30),
  ('Cruzamento gasto × resultado com DataSUS, INEP e SINESP', 'planejado', 40),
  ('Ranking de transparência institucional por órgão (cobertura, latência, completude)', 'planejado', 50),
  ('Sanitização de PII no momento da ingestão, não apenas na exibição', 'concluido', 60);
