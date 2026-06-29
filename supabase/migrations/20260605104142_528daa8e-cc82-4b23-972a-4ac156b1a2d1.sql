drop policy if exists "leitura publica artigos-imagens" on storage.objects;

create policy "admins listam artigos-imagens"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'artigos-imagens' and public.has_role(auth.uid(), 'admin'));