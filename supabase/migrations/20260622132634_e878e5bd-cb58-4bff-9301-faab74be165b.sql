CREATE TABLE public.itens_salvos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url TEXT,
  contexto TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT itens_salvos_user_entidade_unique UNIQUE (user_id, entidade_tipo, entidade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_salvos TO authenticated;
GRANT ALL ON public.itens_salvos TO service_role;

ALTER TABLE public.itens_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus próprios itens"
  ON public.itens_salvos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário insere seus próprios itens"
  ON public.itens_salvos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza seus próprios itens"
  ON public.itens_salvos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove seus próprios itens"
  ON public.itens_salvos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX itens_salvos_user_idx ON public.itens_salvos (user_id, created_at DESC);
CREATE INDEX itens_salvos_entidade_idx ON public.itens_salvos (entidade_tipo, entidade_id);

CREATE TRIGGER update_itens_salvos_updated_at
  BEFORE UPDATE ON public.itens_salvos
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();