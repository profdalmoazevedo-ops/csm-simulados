-- Normaliza campos de classificação vazios/null para rótulos amigáveis.
-- Corrige a exibição de "null (N)" e "(N)" nos dropdowns do /gerador e /pratica
-- e torna o filtro de "sem cargo/matéria/etc." funcional.
-- Idempotente: re-executar não altera nada.
update public.questoes set banca   = 'Sem banca definida'   where banca is null or trim(banca) = '';
update public.questoes set orgao   = 'Sem órgão definido'   where orgao is null or trim(orgao) = '';
update public.questoes set cargo   = 'Sem cargo definido'   where cargo is null or trim(cargo) = '';
update public.questoes set materia = 'Sem matéria definida' where materia is null or trim(materia) = '';
update public.questoes set topico  = 'Sem tópico definido'  where topico is null or trim(topico) = '';