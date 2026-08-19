# Migrations + RLS + roles

## Template de tabela de usuário

```sql
CREATE TABLE public.minha_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX minha_tabela_user_id_idx ON public.minha_tabela(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.minha_tabela TO authenticated;
GRANT ALL ON public.minha_tabela TO service_role;
-- NÃO conceder TO anon — dados privados do usuário.

ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono lê" ON public.minha_tabela
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "dono insere" ON public.minha_tabela
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono atualiza" ON public.minha_tabela
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono apaga" ON public.minha_tabela
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER minha_tabela_touch_updated_at
  BEFORE UPDATE ON public.minha_tabela
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
```

## Tabela pública read-only

Para dados editorialmente curados (`afirmacoes`, `lacunas` publicadas, etc.):

```sql
GRANT SELECT ON public.tabela_publica TO anon;
GRANT SELECT ON public.tabela_publica TO authenticated;

CREATE POLICY "leitura pública" ON public.tabela_publica
  FOR SELECT TO anon, authenticated USING (publica = true);

-- Escrita apenas admin
CREATE POLICY "admin escreve" ON public.tabela_publica
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

## Roles — nunca em `profiles`

Sempre via `user_roles` + `has_role`:

```sql
SELECT public.has_role(auth.uid(), 'admin'::app_role);
```

`has_role` é `SECURITY DEFINER`, `STABLE`, `SET search_path = public` — não recrie. Apenas use.

## Funções SQL novas

Toda função SQL nova:

- declara `SET search_path = public`
- declara `STABLE` ou `IMMUTABLE` quando aplicável
- usa `SECURITY DEFINER` apenas quando precisa atravessar RLS de forma controlada (e nunca recebe o user_id como argumento confiável vindo do cliente — sempre `auth.uid()`).

## Anti-exemplos

- ❌ `CREATE TABLE` sem `GRANT` → app vê erro `permission denied for table`.
- ❌ `RLS enable` sem nenhuma policy → tabela "trancada" (nenhuma linha retornada).
- ❌ `user_id uuid` nullable → permite escrita sem dono, viola RLS na inserção.
- ❌ `role text` em `profiles` → privilege escalation. Use `user_roles` + `has_role`.
- ❌ `CREATE POLICY ... USING (true)` para tabela com dados de usuário → vaza tudo.
- ❌ Tocar em `auth.*`, `storage.*`, `realtime.*`, `vault.*`, `supabase_functions.*`.
- ❌ Trigger em tabelas do schema `auth`.
- ❌ Mexer em `supabase/config.toml` (auto-gerado).
