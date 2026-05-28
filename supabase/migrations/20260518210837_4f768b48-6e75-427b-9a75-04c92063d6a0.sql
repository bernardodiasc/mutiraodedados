
-- Restrict user_roles SELECT to own row (admins use server functions with service role)
DROP POLICY IF EXISTS "roles select all" ON public.user_roles;
CREATE POLICY "roles select self" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Restrict importacoes SELECT to owner; admins read via server-side admin client
DROP POLICY IF EXISTS "importacoes select all" ON public.importacoes;
CREATE POLICY "importacoes select self" ON public.importacoes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
