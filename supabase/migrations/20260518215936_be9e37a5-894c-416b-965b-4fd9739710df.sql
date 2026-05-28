DROP POLICY IF EXISTS "roles admin write" ON public.user_roles;
DROP POLICY IF EXISTS "roles restrict insert to admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles restrict update to admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles restrict delete to admin" ON public.user_roles;

DROP POLICY IF EXISTS "roles select self" ON public.user_roles;
CREATE POLICY "roles select self"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;