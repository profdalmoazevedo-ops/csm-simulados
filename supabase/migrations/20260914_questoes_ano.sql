-- Garante a existência da coluna ano nas questões
alter table public.questoes add column if not exists ano integer;

-- Backfill: todas as questões atuais são de 2026 (a tag ANO nunca foi populada antes)
update public.questoes set ano = 2026 where ano is null;

-- Default para novas inserções que não enviem ano
alter table public.questoes alter column ano set default 2026;

-- Índice (re-rodar é seguro; já criado pela migration de performance)
create index if not exists idx_questoes_ano on public.questoes (ano);