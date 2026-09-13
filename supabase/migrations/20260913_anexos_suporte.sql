-- Bucket público de anexos do suporte + policies (idempotente; pode rodar no SQL Editor)
begin;

insert into storage.buckets (id, name, public)
values ('anexos-suporte', 'anexos-suporte', true)
on conflict (id) do update set public = true;

drop policy if exists "anexos_suporte_insert" on storage.objects;
create policy "anexos_suporte_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'anexos-suporte');

drop policy if exists "anexos_suporte_select" on storage.objects;
create policy "anexos_suporte_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'anexos-suporte');

commit;