CREATE TABLE public.anotacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT,
  conteudo_md TEXT NOT NULL DEFAULT '',
  entidade_tipo TEXT,
  entidade_id TEXT,
  pergunta_id UUID REFERENCES public.perguntas(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes TO authenticated;
GRANT ALL ON public.anotacoes TO service_role;

ALTER TABLE public.anotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas próprias anotações"
  ON public.anotacoes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário insere suas próprias anotações"
  ON public.anotacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza suas próprias anotações"
  ON public.anotacoes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove suas próprias anotações"
  ON public.anotacoes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX anotacoes_user_idx ON public.anotacoes (user_id, created_at DESC);
CREATE INDEX anotacoes_entidade_idx ON public.anotacoes (entidade_tipo, entidade_id);
CREATE INDEX anotacoes_pergunta_idx ON public.anotacoes (pergunta_id);

CREATE TRIGGER update_anotacoes_updated_at
  BEFORE UPDATE ON public.anotacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();