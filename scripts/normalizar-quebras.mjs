// Normaliza as quebras de linha do acervo: <br/> (e <br>, <BR />) viram "\n".
//
// Motivo: o projeto gravava <br/> no banco para simular parágrafos, mas nenhuma
// tela interpreta HTML (React escapa o texto), então os alunos e o admin viam a
// tag literal. O padrão agora é texto puro com quebras reais ("\n"), renderizado
// com "whitespace-pre-wrap".
//
// Uso:
//   npm run normalizar-quebras              # dry-run: só mostra o que mudaria
//   npm run normalizar-quebras -- --apply   # gera backup CSV e grava no banco
//
// O dry-run é o padrão de propósito: nada é gravado sem --apply explícito.

import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CAMPOS = [
  'enunciado',
  'comentario_gabarito',
  'alternativa_a',
  'alternativa_b',
  'alternativa_c',
  'alternativa_d',
  'alternativa_e'
];

const TAMANHO_PAGINA = 500;

function carregarEnvLocal() {
  const caminho = resolve(process.cwd(), '.env.local');
  const linhas = readFileSync(caminho, 'utf8').split('\n');
  for (const linha of linhas) {
    const semComentario = linha.trim();
    if (!semComentario || semComentario.startsWith('#')) continue;
    const idx = semComentario.indexOf('=');
    if (idx <= 0) continue;
    const chave = semComentario.slice(0, idx).trim();
    const valor = semComentario.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    process.env[chave] = valor;
  }
}

// Substitui qualquer variação de <br> por quebra real e uniformiza CRLF/CR.
export function normalizarQuebras(texto) {
  return String(texto)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n?/g, '\n');
}

const temQuebraHtml = (valor) => /<br\s*\/?>/i.test(valor) || /\r/.test(valor);

function celulaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function escreverBackup(linhas) {
  const pasta = resolve(process.cwd(), 'backups');
  mkdirSync(pasta, { recursive: true });
  const data = new Date();
  const carimbo = [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0'),
    '-',
    String(data.getHours()).padStart(2, '0'),
    String(data.getMinutes()).padStart(2, '0'),
    String(data.getSeconds()).padStart(2, '0')
  ].join('');
  const arquivo = resolve(pasta, `questoes-quebras-${carimbo}.csv`);
  const cabecalho = ['id', ...CAMPOS].join(',');
  const corpo = linhas.map(q => [celulaCsv(q.id), ...CAMPOS.map(c => celulaCsv(q[c]))].join(','));
  writeFileSync(arquivo, [cabecalho, ...corpo].join('\n'), 'utf8');
  return arquivo;
}

const aplicar = process.argv.includes('--apply');

carregarEnvLocal();

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveService = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!urlSupabase || !chaveService) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const supabase = createClient(urlSupabase, chaveService, { auth: { persistSession: false } });

console.log(aplicar ? '💾 MODO APPLY — as alterações serão gravadas\n' : '⚙️  MODO DRY-RUN — nada será gravado (use --apply para gravar)\n');

const { count, error: erroContagem } = await supabase
  .from('questoes')
  .select('id', { count: 'exact', head: true });

if (erroContagem) {
  console.error('❌ Erro ao contar questões:', erroContagem.message);
  process.exit(1);
}

console.log(`📋 ${count ?? 0} questões no acervo\n`);

const alteracoes = [];
let lidas = 0;

for (let inicio = 0; inicio < (count ?? 0); inicio += TAMANHO_PAGINA) {
  const { data, error } = await supabase
    .from('questoes')
    .select(['id', ...CAMPOS].join(','))
    .order('id')
    .range(inicio, inicio + TAMANHO_PAGINA - 1);

  if (error) {
    console.error('❌ Erro ao consultar questoes:', error.message);
    process.exit(1);
  }

  for (const q of data || []) {
    lidas++;
    const novo = {};
    for (const campo of CAMPOS) {
      const valor = q[campo];
      if (valor === null || valor === undefined) continue;
      if (!temQuebraHtml(valor)) continue;
      const normalizado = normalizarQuebras(valor);
      if (normalizado !== valor) novo[campo] = normalizado;
    }
    if (Object.keys(novo).length > 0) alteracoes.push({ id: q.id, original: q, novo });
  }
}

const porCampo = {};
for (const alt of alteracoes) {
  for (const campo of Object.keys(alt.novo)) {
    porCampo[campo] = (porCampo[campo] || 0) + 1;
  }
}

console.log(`🔎 ${lidas} questões verificadas · ${alteracoes.length} precisam de ajuste`);
for (const [campo, total] of Object.entries(porCampo).sort((a, b) => b[1] - a[1])) {
  console.log(`   • ${campo}: ${total}`);
}
console.log('');

for (const alt of alteracoes.slice(0, 10)) {
  const [campo, valorNovo] = Object.entries(alt.novo)[0];
  const original = String(alt.original[campo] ?? '');
  const indice = original.search(/<br\s*\/?>/i);
  const inicio = Math.max(0, indice - 40);
  const antes = original.slice(inicio, indice + 60).replace(/\n/g, '⏎');
  const depois = String(valorNovo).slice(inicio, indice + 60).replace(/\n/g, '⏎');
  console.log(`— ${alt.id} (${campo})`);
  console.log(`   antes:  …${antes}…`);
  console.log(`   depois: …${depois}…`);
}
if (alteracoes.length > 10) console.log(`… e mais ${alteracoes.length - 10} registros.\n`);

if (alteracoes.length === 0) {
  console.log('✅ Nada a fazer: o acervo já está normalizado.');
  process.exit(0);
}

if (!aplicar) {
  console.log('\nNada foi gravado. Revise a lista acima e rode com --apply para aplicar (um backup CSV será gerado antes).');
  process.exit(0);
}

const arquivoBackup = escreverBackup(
  alteracoes.map(alt => ({ id: alt.id, ...Object.fromEntries(CAMPOS.map(c => [c, alt.original[c]])) }))
);
console.log(`🗄️  Backup criado: ${arquivoBackup}\n`);

let gravadas = 0;
const falhas = [];

for (const alt of alteracoes) {
  const { error } = await supabase
    .from('questoes')
    .update(alt.novo)
    .eq('id', alt.id);

  if (error) {
    falhas.push({ id: alt.id, erro: error.message });
    console.error(`⚠ ${alt.id}: ${error.message}`);
    continue;
  }
  gravadas++;
  if (gravadas % 50 === 0) console.log(`   … ${gravadas}/${alteracoes.length} gravadas`);
}

console.log('\n────────────────────────────────────');
console.log(`✅ Questões atualizadas: ${gravadas}`);
if (falhas.length) {
  console.log(`❌ Falhas: ${falhas.length}`);
  for (const f of falhas) console.log(`   • ${f.id}: ${f.erro}`);
} else {
  console.log('❌ Falhas: 0');
}
console.log('\nRode de novo sem --apply para confirmar que sobrou 0 registro.');
