-- Restaurar EXECUTE em has_role para authenticated.
-- A função é SECURITY DEFINER e apenas confere se o user_id passado tem o role.
-- Sem este GRANT, qualquer SELECT em tabelas cuja policy permissiva use has_role()
-- (por ex. user_roles) falha com 42501 "permission denied for function has_role".
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
