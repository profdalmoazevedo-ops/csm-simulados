-- =============================================================================
-- csm-simulados · Higienização de espaços e unificação pontual de órgão
-- Data: 2026-09-18
-- Como aplicar: cole o arquivo inteiro no SQL Editor do Supabase e execute.
-- Idempotente: pode rodar novamente sem erro (rodar depois de 20260916).
-- =============================================================================
--
-- Por que este arquivo existe: 20260916_normalizar_classificacoes.sql só troca
-- uma variante pela canônica quando duas grafias colidem na mesma chave. Duas
-- coisas escaparam dele no acervo real:
--
--   1. Empate de frequência. "Prefeitura de Flores da Cunha - RS" e
--      "Prefeitura de Flores da Cunha  - RS" tinham 1 questão cada; o desempate
--      alfabeto-adotou a variante com espaço duplo (espaço ordena antes de "-")
--      e sobrescreveu o rótulo limpo. O desempate foi corrigido em 20260916, mas
--      isso não desfaz o que já foi aplicado — daí a limpeza abaixo.
--
--   2. Espaço anômalo sem colisão. Se um rótulo é o único do seu grupo, ele já é
--      "canônico" e nunca era aparado. Restaram 4 registros com espaço no início,
--      no fim ou duplicado.
--
-- Registros corrigidos por este arquivo (596 questões no acervo):
--   cargo: " Auditor Municipal de Controle Interno" (espaço no início)
--   orgao: "Prefeitura de Flores da Cunha  - RS" (espaço duplo) x2
--   orgao: "Prefeitura de São Paulo - SP " (espaço no fim)

-- -----------------------------------------------------------------------------
-- 1. COLAPSA DE ESPAÇOS (idempotente)
-- -----------------------------------------------------------------------------
-- trim + espaços internos colapsados, aplicados no lugar. A condição IS DISTINCT
-- FROM garante que a segunda execução não altera nada.

-- BANCA
UPDATE questoes
SET banca = btrim(regexp_replace(banca, '\s+', ' ', 'g'))
WHERE banca IS NOT NULL
  AND banca IS DISTINCT FROM btrim(regexp_replace(banca, '\s+', ' ', 'g'));

-- CARGO
UPDATE questoes
SET cargo = btrim(regexp_replace(cargo, '\s+', ' ', 'g'))
WHERE cargo IS NOT NULL
  AND cargo IS DISTINCT FROM btrim(regexp_replace(cargo, '\s+', ' ', 'g'));

-- MATÉRIA
UPDATE questoes
SET materia = btrim(regexp_replace(materia, '\s+', ' ', 'g'))
WHERE materia IS NOT NULL
  AND materia IS DISTINCT FROM btrim(regexp_replace(materia, '\s+', ' ', 'g'));

-- ÓRGÃO
UPDATE questoes
SET orgao = btrim(regexp_replace(orgao, '\s+', ' ', 'g'))
WHERE orgao IS NOT NULL
  AND orgao IS DISTINCT FROM btrim(regexp_replace(orgao, '\s+', ' ', 'g'));

-- TÓPICO
UPDATE questoes
SET topico = btrim(regexp_replace(topico, '\s+', ' ', 'g'))
WHERE topico IS NOT NULL
  AND topico IS DISTINCT FROM btrim(regexp_replace(topico, '\s+', ' ', 'g'));

-- -----------------------------------------------------------------------------
-- 2. UNIFICAÇÃO PONTUAL DE ÓRGÃO
-- -----------------------------------------------------------------------------
-- "Prefeitura de Flores da Cunha" e "Prefeitura de Flores da Cunha - RS" são o
-- mesmo município, registrados das duas formas. O rótulo com a UF sobrevive
-- (é o majoritário e é o que permite filtrar por estado).
--
-- IMPORTANTE: esta fusão é escrita caso a caso, e não por regra. Agrupar órgãos
-- por nome-base seria destrutivo neste acervo, porque prefixos idênticos
-- pertencem a órgãos distintos de estados diferentes:
--
--   PC-MG / PC-PI / PC-RJ          polícias civis de três estados
--   PGE-AC / PGE-RN               procurias de dois estados
--   SEFAZ-CE / SEFAZ-GO           secretarias de fazenda de dois estados
--   TJ-RS / TJ-SC                 tribunais de justiça de dois estados
--   AL-MS / AL-RO                 assemblys de dois estados
--
-- Qualquer fusão automática por nome-base destruiria a informação de estado e
-- criaria entradas que não existem. Se um dia outro órgão vier duplicado,
-- acrescente uma linha aqui em vez de generalizar a regra.
update questoes
set orgao = 'Prefeitura de Flores da Cunha - RS'
where btrim(regexp_replace(orgao, '\s+', ' ', 'g')) = 'Prefeitura de Flores da Cunha';