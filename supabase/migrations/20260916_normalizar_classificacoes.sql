-- Normaliza variantes de caixa e espaços nas colunas classificatórias de questoes:
-- banca, cargo, materia, orgao e topico.
--
-- Idempotente e seguro: para cada valor normalizado (trim + espaços colapsados +
-- minúsculas), adota como canônico o rótulo mais frequente e atualiza apenas as
-- variantes minoritárias. Rodar várias vezes não altera nada.
--
-- Desempate: quando duas grafias têm a MESMA frequência, vence a mais limpa
-- (menor comprimento depois de colapsar os espaços) e não a primeira
-- alfabeticamente. Sem isso, "Prefeitura de Flores da Cunha  - RS" (espaço
-- duplo) vencia de "Prefeitura de Flores da Cunha - RS", porque espaço ordena
-- antes de "-", e o rótulo sujo sobrescrevia o limpo. Ver também
-- 20260918_higienizar_espacos.sql, que limpa o que já ficou gravado.
--
-- Contexto: importações colam o mesmo rótulo com grafias diferentes, o que
-- duplica opções nos filtros e fragmenta o agrupamento do Acervo. Exemplos reais
-- encontrados: "Fontes Do Direito Administrativo" x "Fontes do Direito
-- Administrativo", "Prefeitura de Flores da Cunha  - RS" (espaço duplo) x
-- "Prefeitura de Flores da Cunha - RS", "Auditor Fiscal Da Receita Estadual" x
-- "Auditor Fiscal da Receita Estadual".
--
-- Rode no SQL Editor do Supabase.

-- BANCA
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(banca, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(banca ORDER BY qtd DESC, length(btrim(regexp_replace(banca, '\s+', ' ', 'g'))), banca))[1] AS valor_canonico
  FROM (
    SELECT banca, COUNT(*) AS qtd
    FROM questoes
    WHERE banca IS NOT NULL
    GROUP BY banca
  ) t
  GROUP BY 1
)
UPDATE questoes q
SET banca = c.valor_canonico
FROM canonico c
WHERE q.banca IS NOT NULL
  AND lower(btrim(regexp_replace(q.banca, '\s+', ' ', 'g'))) = c.chave
  AND q.banca <> c.valor_canonico;

-- CARGO
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(cargo, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(cargo ORDER BY qtd DESC, length(btrim(regexp_replace(cargo, '\s+', ' ', 'g'))), cargo))[1] AS valor_canonico
  FROM (
    SELECT cargo, COUNT(*) AS qtd
    FROM questoes
    WHERE cargo IS NOT NULL
    GROUP BY cargo
  ) t
  GROUP BY 1
)
UPDATE questoes q
SET cargo = c.valor_canonico
FROM canonico c
WHERE q.cargo IS NOT NULL
  AND lower(btrim(regexp_replace(q.cargo, '\s+', ' ', 'g'))) = c.chave
  AND q.cargo <> c.valor_canonico;

-- MATÉRIA
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(materia, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(materia ORDER BY qtd DESC, length(btrim(regexp_replace(materia, '\s+', ' ', 'g'))), materia))[1] AS valor_canonico
  FROM (
    SELECT materia, COUNT(*) AS qtd
    FROM questoes
    WHERE materia IS NOT NULL
    GROUP BY materia
  ) t
  GROUP BY 1
)
UPDATE questoes q
SET materia = c.valor_canonico
FROM canonico c
WHERE q.materia IS NOT NULL
  AND lower(btrim(regexp_replace(q.materia, '\s+', ' ', 'g'))) = c.chave
  AND q.materia <> c.valor_canonico;

-- ÓRGÃO
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(orgao, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(orgao ORDER BY qtd DESC, length(btrim(regexp_replace(orgao, '\s+', ' ', 'g'))), orgao))[1] AS valor_canonico
  FROM (
    SELECT orgao, COUNT(*) AS qtd
    FROM questoes
    WHERE orgao IS NOT NULL
    GROUP BY orgao
  ) t
  GROUP BY 1
)
UPDATE questoes q
SET orgao = c.valor_canonico
FROM canonico c
WHERE q.orgao IS NOT NULL
  AND lower(btrim(regexp_replace(q.orgao, '\s+', ' ', 'g'))) = c.chave
  AND q.orgao <> c.valor_canonico;

-- TÓPICO
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(topico, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(topico ORDER BY qtd DESC, length(btrim(regexp_replace(topico, '\s+', ' ', 'g'))), topico))[1] AS valor_canonico
  FROM (
    SELECT topico, COUNT(*) AS qtd
    FROM questoes
    WHERE topico IS NOT NULL
    GROUP BY topico
  ) t
  GROUP BY 1
)
UPDATE questoes q
SET topico = c.valor_canonico
FROM canonico c
WHERE q.topico IS NOT NULL
  AND lower(btrim(regexp_replace(q.topico, '\s+', ' ', 'g'))) = c.chave
  AND q.topico <> c.valor_canonico;