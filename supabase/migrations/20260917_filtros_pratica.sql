-- =============================================================================
-- csm-simulados · Filtros avançados do Banco de Questões (/pratica)
-- Data: 2026-09-17
-- Como aplicar: cole o arquivo inteiro no SQL Editor do Supabase e execute.
-- Idempotente: pode rodar novamente sem erro (create or replace / if not exists).
-- =============================================================================
--
-- Objetivo: permitir, na resolução livre de questões (/pratica), filtrar por
--   1. situação do aluno  → todas | nao_respondidas | erradas | acertadas
--   2. data de inclusão  → 7 dias | 1 mês | 3 meses | 6 meses
--   3. órgão
--   4. ordenação         → id | aleatorio | recentes | antigas
--
-- Por que uma RPC: a página buscava direto na tabela e aplicava os filtros no
-- navegador. Isso impedia dois requisitos novos — excluir as questões já
-- respondidas (a lista de ids cresceria sem limite e estouraria a URL) e contar
-- o total respeitando todos os filtros. Movendo filtros + contagem + paginação
-- para o banco, a chamada continua pequena e o contador continua exato.
--
-- Segurança: o aluno é obtido de auth.uid() dentro da função, nunca por
-- parâmetro — assim é impossível ler o histórico de respostas de outra pessoa.

-- -----------------------------------------------------------------------------
-- 1. ÍNDICES
-- -----------------------------------------------------------------------------
create index if not exists idx_questoes_orgao on public.questoes (orgao);

-- O índice de criado_em é criado apenas se a coluna existir (o acervo antigo
-- não a tinha; o filtro de período só funciona com ela presente).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questoes' and column_name = 'criado_em'
  ) then
    execute 'create index if not exists idx_questoes_criado_em on public.questoes (criado_em desc)';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. VIEW DE OPÇÕES: ACRESCENTA O TIPO "orgao"
-- -----------------------------------------------------------------------------
-- O /pratica lê esta view e já separa as opções pelo campo `tipo`, então basta
-- acrescentar a linha. O /gerador não é afetado (usa obter_opcoes_simulado).
-- Rode 20260916_normalizar_classificacoes.sql antes, senão variantes de caixa
-- ("PREFEITURA DE RIO CLARO - SP" x "Prefeitura de Rio Claro - SP") aparecem
-- duplicadas no dropdown.
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
select 'orgao', trim(orgao), count(*)
from public.questoes
where orgao is not null
group by trim(orgao)
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

grant select on vw_opcoes_filtro to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. RPC DE PÁGINA (/pratica)
-- -----------------------------------------------------------------------------
-- Devolve { itens, total } em uma única chamada: a página do lote e a contagem
-- do contador "X questões encontradas".
--
--   p_banca, p_cargo, p_orgao, p_materia, p_topico, p_ano, p_formato
--       texto; null ou '' = não filtrar. Compara com trim(), igual à view.
--   p_periodo     '7d' | '1m' | '3m' | '6m' | null
--       Janela sobre questoes.criado_em (data em que entrou no acervo), que é
--       diferente de questoes.ano (ano da prova).
--   p_situacao    'todas' | 'nao_respondidas' | 'erradas' | 'acertadas'
--       Baseada em respostas_alunos do próprio aluno (auth.uid()).
--   p_ordem       'id' | 'aleatorio' | 'recentes' | 'antigas'
--   p_limite      tamanho do lote (limitado a 100 no servidor)
--   p_offset      deslocamento, calculado como pagina * p_limite no cliente
--
-- Nota sobre 'aleatorio': order by random() não é estável entre chamadas, então
-- cada página do "Carregar mais" sorteia um lote novo — pode repetir ou deixar
-- de fora questões já vistas. As demais ordenações são estáveis.
--
-- Nota sobre 'erradas'/'acertadas': usam EXISTS, não a última tentativa. Uma
-- questão errada numa tentativa e acertada depois aparece nas duas listas —
-- de propósito, porque já ter errado indica ponto fraco.
create or replace function obter_pagina_questoes(
  p_banca text default null,
  p_cargo text default null,
  p_orgao text default null,
  p_materia text default null,
  p_topico text default null,
  p_ano text default null,
  p_formato text default null,
  p_periodo text default null,
  p_situacao text default 'todas',
  p_ordem text default 'id',
  p_limite integer default 15,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_where text := ' true';
  v_ordem text;
  v_total integer;
  v_itens jsonb;
  v_limite integer := least(greatest(coalesce(p_limite, 15), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  -- Filtros de igualdade
  if p_banca is not null and p_banca <> '' then
    v_where := v_where || format(' and trim(banca) = %L', p_banca);
  end if;
  if p_cargo is not null and p_cargo <> '' then
    v_where := v_where || format(' and trim(cargo) = %L', p_cargo);
  end if;
  if p_orgao is not null and p_orgao <> '' then
    v_where := v_where || format(' and trim(orgao) = %L', p_orgao);
  end if;
  if p_materia is not null and p_materia <> '' then
    v_where := v_where || format(' and trim(materia) = %L', p_materia);
  end if;
  if p_topico is not null and p_topico <> '' then
    v_where := v_where || format(' and trim(topico) = %L', p_topico);
  end if;
  if p_ano is not null and p_ano <> '' then
    v_where := v_where || format(' and ano::text = %L', p_ano);
  end if;
  if p_formato is not null and p_formato <> '' then
    v_where := v_where || format(' and trim(tipo_questao) = %L', p_formato);
  end if;

  -- Janela de inclusão no acervo
  if p_periodo = '7d' then
    v_where := v_where || ' and criado_em >= now() - interval ''7 days''';
  elsif p_periodo = '1m' then
    v_where := v_where || ' and criado_em >= now() - interval ''1 month''';
  elsif p_periodo = '3m' then
    v_where := v_where || ' and criado_em >= now() - interval ''3 months''';
  elsif p_periodo = '6m' then
    v_where := v_where || ' and criado_em >= now() - interval ''6 months''';
  end if;

  -- Situação do aluno. auth.uid() é lido aqui dentro: nenhum aluno consegue
  -- consultar o histórico de respostas de outro.
  if p_situacao = 'nao_respondidas' then
    v_where := v_where || format(
      ' and not exists (select 1 from public.respostas_alunos r where r.questao_id = q.id and r.aluno_id = %L and r.alternativa_marcada is not null)',
      v_uid);
  elsif p_situacao = 'erradas' then
    v_where := v_where || format(
      ' and exists (select 1 from public.respostas_alunos r where r.questao_id = q.id and r.aluno_id = %L and r.alternativa_marcada is not null and r.foi_correta = false)',
      v_uid);
  elsif p_situacao = 'acertadas' then
    v_where := v_where || format(
      ' and exists (select 1 from public.respostas_alunos r where r.questao_id = q.id and r.aluno_id = %L and r.alternativa_marcada is not null and r.foi_correta = true)',
      v_uid);
  end if;

  -- Ordenação
  if p_ordem = 'aleatorio' then
    v_ordem := ' order by random()';
  elsif p_ordem = 'recentes' then
    v_ordem := ' order by q.criado_em desc nulls last, q.id';
  elsif p_ordem = 'antigas' then
    v_ordem := ' order by q.criado_em asc nulls last, q.id';
  else
    v_ordem := ' order by q.id';
  end if;

  -- Total exato para o contador
  execute 'select count(*)::integer from public.questoes q where' || v_where into v_total;

  -- Lote da página. A ordenação fica no subselect para que o jsonb_agg preserve
  -- a ordem desejada.
  execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
           from (select q.* from public.questoes q where' || v_where || v_ordem ||
         ' limit ' || v_limite || ' offset ' || v_offset || ') t'
    into v_itens;

  return jsonb_build_object('itens', v_itens, 'total', v_total);
end $$;

grant execute on function obter_pagina_questoes(text, text, text, text, text, text, text, text, text, text, integer, integer) to anon, authenticated, service_role;