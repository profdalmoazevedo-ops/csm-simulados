-- =============================================================================
-- csm-simulados · Performance dos filtros
-- Data: 2026-09-13
-- Como aplicar: cole o arquivo inteiro no SQL Editor do Supabase e execute.
-- Idempotente: pode rodar novamente sem erro (create or replace / if not exists).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ÍNDICES
-- -----------------------------------------------------------------------------
create index if not exists idx_questoes_banca  on public.questoes (banca);
create index if not exists idx_questoes_cargo  on public.questoes (cargo);
create index if not exists idx_questoes_materia on public.questoes (materia);
create index if not exists idx_questoes_topico  on public.questoes (topico);
create index if not exists idx_questoes_ano     on public.questoes (ano);
create index if not exists idx_questoes_tipo    on public.questoes (tipo_questao);

create index if not exists idx_respostas_aluno_correta
  on public.respostas_alunos (aluno_id, foi_correta);
create index if not exists idx_respostas_aluno_questao
  on public.respostas_alunos (aluno_id, questao_id);
create index if not exists idx_respostas_simulado
  on public.respostas_alunos (simulado_id);

create index if not exists idx_historico_aluno
  on public.historico_tentativas (aluno_id);
create index if not exists idx_simulado_questoes_simulado
  on public.simulado_questoes (simulado_id);

-- -----------------------------------------------------------------------------
-- 2. VIEWS DE OPÇÕES DE FILTRO
-- -----------------------------------------------------------------------------
-- Utilizada pelo Banco de Questões (/pratica): valores distintos + contagem por
-- coluna de filtro, sem baixar a tabela inteira para o navegador.
create or replace view vw_opcoes_filtro as
select 'banca'::text as tipo, trim(banca) as valor, count(*) as total
from public.questoes
where banca is not null
group by trim(banca)
union all
select 'cargo', trim(cargo), count(*)
from public.questoes
where cargo is not null
group by trim(cargo)
union all
select 'materia', trim(materia), count(*)
from public.questoes
where materia is not null
group by trim(materia)
union all
select 'topico', trim(topico), count(*)
from public.questoes
where topico is not null
group by trim(topico)
union all
select 'ano', ano::text, count(*)
from public.questoes
where ano is not null
group by ano::text
union all
select 'tipo_questao', trim(tipo_questao), count(*)
from public.questoes
where tipo_questao is not null
group by trim(tipo_questao);

-- Cascade matéria → tópico (com contagens), usado no /pratica e no /gerador.
create or replace view vw_topico_por_materia as
select trim(materia) as materia, trim(topico) as topico, count(*) as total
from public.questoes
where materia is not null and topico is not null
group by trim(materia), trim(topico);

grant select on vw_opcoes_filtro, vw_topico_por_materia to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. HELPERS DE CONDIÇÃO (uso interno)
-- -----------------------------------------------------------------------------
-- Monta a cláusula WHERE com os filtros ativos, ignorando um deles (o do próprio
-- dropdown). Replica a semântica do useMemo dos filtros do /gerador.
create or replace function _condicoes_filtro(
  p_bancas text[],
  p_cargos text[],
  p_materias text[],
  p_topicos text[],
  p_anos text[],
  p_formatos text[],
  p_excluir_respondidas uuid[],
  p_ignorar text
) returns text
language plpgsql
stable
as $$
declare
  v_cond text[] := '{}'::text[];
begin
  if p_bancas is not null and array_length(p_bancas, 1) > 0 and p_ignorar <> 'bancas' then
    v_cond := v_cond || format('trim(banca) = any(%L::text[])', p_bancas);
  end if;
  if p_cargos is not null and array_length(p_cargos, 1) > 0 and p_ignorar <> 'cargos' then
    v_cond := v_cond || format('trim(cargo) = any(%L::text[])', p_cargos);
  end if;
  if p_materias is not null and array_length(p_materias, 1) > 0 and p_ignorar <> 'materias' then
    v_cond := v_cond || format('trim(materia) = any(%L::text[])', p_materias);
  end if;
  if p_topicos is not null and array_length(p_topicos, 1) > 0 and p_ignorar <> 'topicos' then
    v_cond := v_cond || format('trim(topico) = any(%L::text[])', p_topicos);
  end if;
  if p_anos is not null and array_length(p_anos, 1) > 0 and p_ignorar <> 'anos' then
    v_cond := v_cond || format('ano::text = any(%L::text[])', p_anos);
  end if;
  if p_formatos is not null and array_length(p_formatos, 1) > 0 and p_ignorar <> 'formatos' then
    v_cond := v_cond || format('trim(tipo_questao) = any(%L::text[])', p_formatos);
  end if;
  if p_excluir_respondidas is not null and array_length(p_excluir_respondidas, 1) > 0 then
    v_cond := v_cond || format('id <> all(%L::uuid[])', p_excluir_respondidas);
  end if;

  if array_length(v_cond, 1) is null then
    return ' true';
  end if;
  return ' ' || array_to_string(v_cond, ' and ');
end $$;

-- -----------------------------------------------------------------------------
-- 4. RPC DO GERADOR (/gerador)
-- -----------------------------------------------------------------------------
-- Retorna, em uma única chamada, as opções de cada dropdown com contagem (que
-- encolhem conforme o aluno filtra) e o total de questões disponíveis.
-- p_formatos: valores de banco ('certo_errado' | 'multipla_escolha').
create or replace function obter_opcoes_simulado(
  p_bancas text[] default null,
  p_cargos text[] default null,
  p_materias text[] default null,
  p_topicos text[] default null,
  p_anos text[] default null,
  p_formatos text[] default null,
  p_excluir_respondidas uuid[] default null
) returns jsonb
language plpgsql
stable
as $$
declare
  v_json_bancas jsonb;
  v_json_cargos jsonb;
  v_json_materias jsonb;
  v_json_topicos jsonb;
  v_json_anos jsonb;
  v_json_formatos jsonb;
  v_total integer;
  v_where text;
begin
  v_where := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'nenhum');
  execute 'select count(*)::integer from public.questoes q where' || v_where into v_total;

  v_where := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'bancas');
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''valor'', valor, ''total'', total) order by valor), ''[]''::jsonb)
     from (select trim(banca) as valor, count(*) as total from public.questoes where%s group by trim(banca)) t',
    v_where) into v_json_bancas;

  v_where := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'cargos');
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''valor'', valor, ''total'', total) order by valor), ''[]''::jsonb)
     from (select trim(cargo) as valor, count(*) as total from public.questoes where%s group by trim(cargo)) t',
    v_where) into v_json_cargos;

  v_where := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'materias');
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''valor'', valor, ''total'', total) order by valor), ''[]''::jsonb)
     from (select trim(materia) as valor, count(*) as total from public.questoes where%s group by trim(materia)) t',
    v_where) into v_json_materias;

  -- Tópicos só é listado quando há matéria selecionada (mesmo comportamento atual)
  if p_materias is not null and array_length(p_materias, 1) > 0 then
    v_where := _condicoes_filtro(
      p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'topicos');
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''valor'', valor, ''total'', total) order by valor), ''[]''::jsonb)
       from (select trim(topico) as valor, count(*) as total from public.questoes where%s group by trim(topico)) t',
      v_where) into v_json_topicos;
  else
    v_json_topicos := '[]'::jsonb;
  end if;

  v_where := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'anos');
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''valor'', valor, ''total'', total) order by valor::integer desc), ''[]''::jsonb)
     from (select ano::text as valor, count(*) as total from public.questoes where%s group by ano::text) t',
    v_where) into v_json_anos;

  v_where := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'formatos');
  execute format(
    $q$
      select coalesce(jsonb_agg(
        case when valor in ('certo_errado', 'multipla_escolha')
             then jsonb_build_object(
                    'valor',
                    case valor
                      when 'certo_errado' then 'Certo ou Errado'
                      else 'Múltipla Escolha'
                    end,
                    'total', total)
             else jsonb_build_object('valor', valor, 'total', total)
        end
        order by valor), '[]'::jsonb)
      from (
        select trim(tipo_questao) as valor, count(*) as total
        from public.questoes
        where%s
        group by trim(tipo_questao)
      ) t
    $q$,
    v_where) into v_json_formatos;

  return jsonb_build_object(
    'bancas', v_json_bancas,
    'cargos', v_json_cargos,
    'materias', v_json_materias,
    'topicos', v_json_topicos,
    'anos', v_json_anos,
    'formatos', v_json_formatos,
    'total', v_total
  );
end $$;

grant execute on function _condicoes_filtro(text[], text[], text[], text[], text[], text[], uuid[], text) to anon, authenticated, service_role;
grant execute on function obter_opcoes_simulado(text[], text[], text[], text[], text[], text[], uuid[]) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4b. RPC DE IDS DISPONÍVEIS (/gerador)
-- -----------------------------------------------------------------------------
-- Retorna apenas os ids das questões que casam com TODOS os filtros ativos
-- (incluindo a exclusão de respondidas). Retorna via pointer (POST) justamente
-- para suportar listas grandes de ids excluídos sem estourar a URL.
create or replace function obter_ids_questoes(
  p_bancas text[] default null,
  p_cargos text[] default null,
  p_materias text[] default null,
  p_topicos text[] default null,
  p_anos text[] default null,
  p_formatos text[] default null,
  p_excluir_respondidas uuid[] default null
) returns table (questao_id uuid)
language plpgsql
stable
as $$
declare
  v_where text := _condicoes_filtro(
    p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas, 'nenhum');
begin
  return query execute
    'select q.id from public.questoes q where' || v_where;
end $$;

grant execute on function obter_ids_questoes(text[], text[], text[], text[], text[], text[], uuid[]) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. RPC DO CADERNO DE ERROS (/gerador?aba=erros)
-- -----------------------------------------------------------------------------
-- Retorna os ids distintos de questões erradas pelo aluno, com matéria/tópico.
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
$$;

grant execute on function obter_caderno_erros(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. RPC DE ESTATÍSTICAS DO ALUNO (dashboard / caderno de erros)
-- -----------------------------------------------------------------------------
-- total_respondidas conta cada registro de resposta (mesma métrica atual);
-- total_acertos / total_erros são filtros sobre o mesmo conjunto.
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
$$;

grant execute on function obter_estatisticas_aluno(uuid) to anon, authenticated, service_role;