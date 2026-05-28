
-- Atualiza handle_new_user para conceder admin automaticamente ao e-mail autorizado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  if lower(new.email) = 'admin@example.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
      on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'cidadao')
      on conflict do nothing;
  end if;

  return new;
end;
$function$;

-- Concede admin agora se o usuário já existir
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE lower(email) = 'admin@example.com'
ON CONFLICT DO NOTHING;
