-- Catálogo de imagens da galeria de artigos
create table public.artigos_imagens (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  url text not null,
  nome_original text not null,
  mime text not null,
  tamanho_bytes integer not null,
  largura integer,
  altura integer,
  legenda text,
  autor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.artigos_imagens to authenticated;
grant all on public.artigos_imagens to service_role;

alter table public.artigos_imagens enable row level security;

create policy "admins leem galeria"
  on public.artigos_imagens for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admins inserem galeria"
  on public.artigos_imagens for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') and autor_id = auth.uid());

create policy "admins atualizam galeria"
  on public.artigos_imagens for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "admins excluem galeria"
  on public.artigos_imagens for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger trg_artigos_imagens_touch
  before update on public.artigos_imagens
  for each row execute function public.tg_touch_updated_at();

-- Storage policies: bucket artigos-imagens
create policy "leitura publica artigos-imagens"
  on storage.objects for select
  to public
  using (bucket_id = 'artigos-imagens');

create policy "admins enviam artigos-imagens"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'artigos-imagens' and public.has_role(auth.uid(), 'admin'));

create policy "admins atualizam artigos-imagens"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'artigos-imagens' and public.has_role(auth.uid(), 'admin'));

create policy "admins excluem artigos-imagens"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'artigos-imagens' and public.has_role(auth.uid(), 'admin'));