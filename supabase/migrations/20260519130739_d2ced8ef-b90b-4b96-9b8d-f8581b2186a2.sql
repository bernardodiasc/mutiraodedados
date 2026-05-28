DROP TRIGGER IF EXISTS promote_admin_on_signup_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.promote_admin_on_signup();