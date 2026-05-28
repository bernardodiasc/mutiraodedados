-- Substitui a promoção a admin por e-mail hardcoded por uma regra
-- baseada em "primeiro usuário cadastrado vira admin". Isso permite
-- distribuir as migrations no repositório open source sem vazar o
-- e-mail do mantenedor original.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_existe_admin boolean;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  select exists (select 1 from public.user_roles where role = 'admin') into v_existe_admin;

  if not v_existe_admin then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
      on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'cidadao')
      on conflict do nothing;
  end if;

  return new;
end;
$$;