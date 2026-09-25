DROP POLICY IF EXISTS "profiles select all" ON public.profiles;
CREATE POLICY "profiles select autenticados" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon;