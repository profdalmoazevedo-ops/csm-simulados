-- Normaliza variantes de caixa e espaços em questoes.materia / questoes.topico.
-- Idempotente e seguro: para cada valor normalizado (trim + espaços colapsados + minúsculas),
-- adota como canônico o rótulo mais frequente e atualiza apenas as variantes minoritárias.
-- Corrige o caso "Fontes Do Direito Administrativo" x "Fontes do Direito Administrativo"
-- e previne que importações futuras reintroduzam duplicatas de agrupamento/filtro.

-- MATÉRIA
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(materia, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(materia ORDER BY qtd DESC, materia))[1] AS valor_canonico
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

-- TÓPICO
WITH canonico AS (
  SELECT
    lower(btrim(regexp_replace(topico, '\s+', ' ', 'g'))) AS chave,
    (ARRAY_AGG(topico ORDER BY qtd DESC, topico))[1] AS valor_canonico
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
