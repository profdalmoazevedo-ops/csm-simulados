-- Proteção RLS para chamados_suporte (idempotente — pode rodar de novo).
--
-- Estado encontrado antes desta migration: RLS já habilitada, com policies
-- desconhecidas/permissivas somadas. Aqui DROPAMOS todas as policies existentes
-- da tabela e recriamos um conjunto explícito e mínimo:
--   * anon: só INSERIR chamado sem conta (aluno_id null). Não lê/edita/apaga.
--   * authenticated: lê/insere/atualiza/apaga SOMENTE o próprio chamado.
--   * professor (e-mail hardcoded, igual ao front): acesso total.

begin;

alter table public.chamados_suporte enable row level security;

-- Remove qualquer policy pré-existente da tabela (sem nome fixo).
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'chamados_suporte'
  loop
    execute format('drop policy if exists %I on public.chamados_suporte', p.policyname);
  end loop;
end $$;

-- Helper: e-mail admin usado no JWT (mesmo valor do Navbar/Notificacoes/layout).
create or replace function public.eh_admin_suporte()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'profdalmoazevedo@gmail.com';
$$;

create policy "chamados_suporte_select"
  on public.chamados_suporte
  for select
  to authenticated
  using (
    auth.uid() = aluno_id
    or public.eh_admin_suporte()
  );

create policy "chamados_suporte_insert_aluno"
  on public.chamados_suporte
  for insert
  to authenticated
  with check (auth.uid() = aluno_id);

create policy "chamados_suporte_insert_visita"
  on public.chamados_suporte
  for insert
  to anon
  with check (aluno_id is null);

create policy "chamados_suporte_update"
  on public.chamados_suporte
  for update
  to authenticated
  using (
    auth.uid() = aluno_id
    or public.eh_admin_suporte()
  )
  with check (
    auth.uid() = aluno_id
    or public.eh_admin_suporte()
  );

create policy "chamados_suporte_delete"
  on public.chamados_suporte
  for delete
  to authenticated
  using (
    auth.uid() = aluno_id
    or public.eh_admin_suporte()
  );

commit;