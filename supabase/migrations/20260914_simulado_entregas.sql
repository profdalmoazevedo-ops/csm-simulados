-- =============================================================================
-- csm-simulados · Correção das entregas de simulado
-- Data: 2026-09-14
-- Como aplicar: cole o arquivo inteiro no SQL Editor do Supabase e execute.
-- Idempotente: pode rodar novamente sem erro.
--
-- Problema corrigido: a entrega da prova não persistia porque
--   1) respostas_alunos.alternativa_marcada é NOT NULL, mas a entrega grava
--      linhas com NULL para questões em branco (o insert em lote falha inteiro);
--   2) historico_tentativas.id não tinha default (e o app não envia o id);
--   3) historico_tentativas.numero_tentativa é NOT NULL sem default (e o app
--      não enviava o número).
-- Também ajusta as RPCs de estatísticas/caderno de erros para ignorar linhas
-- em branco (que não podem contar como erro nem como respondida).
-- =============================================================================

-- 1) Questões em branco podem ser gravadas como NULL
alter table public.respostas_alunos
  alter column alternativa_marcada drop not null;

-- 2) Id do histórico de tentativas gerado automaticamente
alter table public.historico_tentativas
  alter column id set default gen_random_uuid();

-- 3) Número da tentativa com fallback 1 (o app também envia o número real)
alter table public.historico_tentativas
  alter column numero_tentativa set default 1;

-- 4) RPC do caderno de erros ignora respostas em branco
create or replace function obter_caderno_erros(p_aluno uuid)
returns table (questao_id uuid, materia text, topico text)
language sql
stable
as $$
  select distinct r.questao_id, q.materia, q.topico
  from public.respostas_alunos r
  join public.questoes q on q.id = r.questao_id
  where r.aluno_id = p_aluno
    and r.foi_correta = false
    and r.alternativa_marcada is not null
$$;

grant execute on function obter_caderno_erros(uuid) to anon, authenticated, service_role;

-- 5) RPC de estatísticas ignora respostas em branco
create or replace function obter_estatisticas_aluno(p_aluno uuid)
returns table (total_respondidas bigint, total_acertos bigint, total_erros bigint)
language sql
stable
as $$
  select count(*)::bigint,
         count(*) filter (where foi_correta)::bigint,
         count(*) filter (where not foi_correta)::bigint
  from public.respostas_alunos
  where aluno_id = p_aluno
    and alternativa_marcada is not null
$$;

grant execute on function obter_estatisticas_aluno(uuid) to anon, authenticated, service_role;