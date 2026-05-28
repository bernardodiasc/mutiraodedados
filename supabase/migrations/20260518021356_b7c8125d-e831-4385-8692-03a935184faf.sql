
-- Enum de papéis
create type public.app_role as enum ('admin', 'curador', 'cidadao');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles select all" on public.profiles for select using (true);
create policy "profiles insert self" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update self" on public.profiles for update using (auth.uid() = id);

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles select all" on public.user_roles for select using (true);
create policy "roles admin write" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- user_flags
create table public.user_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entidade_tipo text not null check (entidade_tipo in ('orgao','fornecedor','contrato')),
  entidade_id text not null,
  tipo text not null,
  comentario text,
  created_at timestamptz not null default now()
);
alter table public.user_flags enable row level security;
create index user_flags_entidade_idx on public.user_flags(entidade_tipo, entidade_id);

create policy "flags select all" on public.user_flags for select using (true);
create policy "flags insert self" on public.user_flags for insert with check (auth.uid() = user_id);
create policy "flags update self" on public.user_flags for update using (auth.uid() = user_id);
create policy "flags delete self" on public.user_flags for delete using (auth.uid() = user_id);

-- votos_flag
create table public.votos_flag (
  flag_id uuid not null references public.user_flags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  valor smallint not null check (valor in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (flag_id, user_id)
);
alter table public.votos_flag enable row level security;

create policy "votos select all" on public.votos_flag for select using (true);
create policy "votos insert self" on public.votos_flag for insert with check (auth.uid() = user_id);
create policy "votos update self" on public.votos_flag for update using (auth.uid() = user_id);
create policy "votos delete self" on public.votos_flag for delete using (auth.uid() = user_id);

-- trigger: criar profile no signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'cidadao');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
