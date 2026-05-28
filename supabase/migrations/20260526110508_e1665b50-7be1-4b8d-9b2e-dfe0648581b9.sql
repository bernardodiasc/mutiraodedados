-- Lock down user_flags: remove public SELECT, scope to owner + admin
DROP POLICY IF EXISTS "flags select all" ON public.user_flags;

CREATE POLICY "flags select self or admin"
ON public.user_flags
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Lock down votos_flag: remove public SELECT, scope to owner + admin
DROP POLICY IF EXISTS "votos select all" ON public.votos_flag;

CREATE POLICY "votos select self or admin"
ON public.votos_flag
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));