-- Enum: estado da pergunta
DO $$ BEGIN
  CREATE TYPE public.pergunta_estado AS ENUM (
    'aberta',
    'em_investigacao',
    'respondida_parcialmente',
    'respondida',
    'sem_resposta_possivel',
    'dormente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela: perguntas
CREATE TABLE public.perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto text NOT NULL,
  contexto text,
  estado public.pergunta_estado NOT NULL DEFAULT 'aberta',
  tags text[] NOT NULL DEFAULT '{}',
  entidades_vinculadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  origem_url text,
  publica boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perguntas_texto_len CHECK (char_length(texto) BETWEEN 5 AND 500),
  CONSTRAINT perguntas_contexto_len CHECK (contexto IS NULL OR char_length(contexto) <= 4000)
);

CREATE INDEX perguntas_autor_idx ON public.perguntas (autor_id, created_at DESC);
CREATE INDEX perguntas_publica_idx ON public.perguntas (publica, created_at DESC) WHERE publica = true;
CREATE INDEX perguntas_estado_idx ON public.perguntas (estado);
CREATE INDEX perguntas_tags_idx ON public.perguntas USING gin (tags);

-- GRANTs (anon pode ler perguntas públicas)
GRANT SELECT ON public.perguntas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perguntas TO authenticated;
GRANT ALL ON public.perguntas TO service_role;

-- RLS
ALTER TABLE public.perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ler perguntas públicas"
  ON public.perguntas FOR SELECT
  USING (publica = true);

CREATE POLICY "Autor pode ler suas próprias perguntas"
  ON public.perguntas FOR SELECT
  TO authenticated
  USING (auth.uid() = autor_id);

CREATE POLICY "Admins podem ler tudo"
  ON public.perguntas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados criam como autor"
  ON public.perguntas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Autor edita suas perguntas"
  ON public.perguntas FOR UPDATE
  TO authenticated
  USING (auth.uid() = autor_id)
  WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Admin edita qualquer pergunta"
  ON public.perguntas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autor exclui suas perguntas"
  ON public.perguntas FOR DELETE
  TO authenticated
  USING (auth.uid() = autor_id);

CREATE POLICY "Admin exclui qualquer pergunta"
  ON public.perguntas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger de updated_at
CREATE TRIGGER perguntas_touch_updated_at
  BEFORE UPDATE ON public.perguntas
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();