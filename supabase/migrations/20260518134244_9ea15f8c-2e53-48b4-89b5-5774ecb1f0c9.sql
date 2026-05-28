-- Trigger: ao criar usuário, se o email for do admin principal, atribui role admin
CREATE OR REPLACE FUNCTION public.promote_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'bernardodiasdacruz@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promote_admin_on_signup_trigger ON auth.users;
CREATE TRIGGER promote_admin_on_signup_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.promote_admin_on_signup();

-- Caso a conta já exista, promove agora
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE email = 'bernardodiasdacruz@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;