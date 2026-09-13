// Enriquecimento em lote de Cargo/Órgão das questões (executa LOCALMENTE).
// Como roda na sua máquina (IP residencial), consegue acessar o Gran Cursos Questões
// diretamente e não sofre os limites de rate-limit do DuckDuckGo.
//
// Uso:
//   npm run enriquecer-metadados           # processa todas as questões faltantes
//   npm run enriquecer-metadados -- --dry-run   # só mostra o que encontraria, não grava
//
// Funcionamento por questão:
//   1. Monta trecho citado do enunciado → busca exata no DuckDuckGo
//   2. Localiza a URL da questão em questoes.grancursosonline.com.br
//   3. Lê a página (fetch direto e, se falhar, via leitor r.jina.ai)
//   4. Extrai "Prova:" e divide em Órgão + Cargo
//   5. Atualiza a linha no Supabase (service role key de .env.local)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VALORES_FALTANTES = new Set([
  'sem cargo definido',
  'sem banca definida',
  'sem órgão definido',
  'sem matéria definida',
  'sem tópico definido',
  'nd',
  'n/d',
  'não identificado',
  'nao identificado',
  'não informado',
  'nao informado',
  'acervo geral',
  'diversos',
  ''
]);

const ehFaltante = (v) => v === null || v === undefined || VALORES_FALTANTES.has(String(v).trim().toLowerCase());

const extrairTrecho = (enunciado, maxLen = 100) => {
  const limpo = (enunciado || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (limpo.length <= maxLen) return limpo;
  const corte = limpo.lastIndexOf(' ', maxLen);
  return corte > 40 ? limpo.slice(0, corte) : limpo.slice(0, maxLen);
};

const limparMarkdown = (texto) => texto.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

const extrairCamposGran = (markdown) => {
  const limpo = limparMarkdown(markdown);
  const banca = limpo.match(/Banca\s*[:|]\s*([^\n]+)/i)?.[1]?.trim() ?? '';
  const prova = limpo.match(/Prova\s*[:|]\s*([^\n]+)/i)?.[1]?.trim() ?? '';
  return { banca, prova };
};

const dividirProva = (prova) => {
  const semAno = prova.replace(/\s*[-–]\s*\d{4}\s*$/i, '').trim();
  const partes = semAno.split(/\s*[-–]\s*/).map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return { orgao: '', cargo: '' };
  return {
    orgao: partes.length > 1 ? partes[1] : '',
    cargo: partes.length > 2 ? partes.slice(2).join(' - ') : ''
  };
};

const extrairUrlsDDG = (html) => {
  const urls = [];
  const re = /href="([^"]*uddg=[^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const uddg = m[1].match(/uddg=([^&"']+)/);
      if (!uddg) continue;
      let d = uddg[1];
      if (d.includes('%253D')) d = decodeURIComponent(d);
      d = decodeURIComponent(d);
      if (d.startsWith('http')) urls.push(d);
    } catch { /* ignora */ }
  }
  return [...new Set(urls)];
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function buscarNoDDG(trecho) {
  const q = encodeURIComponent(`"${trecho}"`);
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5' }
  });
  if (!res.ok) return { urls: [], bloqueado: false };
  const html = await res.text();
  if (html.includes('No results found')) return { urls: [], bloqueado: false };
  if (html.includes('anomaly')) return { urls: [], bloqueado: true };
  return {
    urls: extrairUrlsDDG(html).filter(u => u.includes('questoes.grancursosonline.com.br/questoes-de-concursos/')).slice(0, 3),
    bloqueado: false
  };
}

async function lerPagina(url) {
  const tentativas = [
    async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5' }, signal: ctrl.signal });
        return { ok: res.ok, texto: res.ok ? await res.text() : '' };
      } finally {
        clearTimeout(t);
      }
    },
    async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' }, signal: ctrl.signal });
        return { ok: res.ok, texto: res.ok ? await res.text() : '' };
      } finally {
        clearTimeout(t);
      }
    }
  ];

  for (const tentativa of tentativas) {
    try {
      const r = await tentativa();
      if (!r.ok) continue;
      if (r.texto.includes('Just a moment') || r.texto.includes('CAPTCHA')) continue;
      if (r.texto.trim().length > 300) return r.texto;
    } catch { /* tenta a próxima */ }
  }
  return '';
}

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

async function resolverQuestao(q) {
  const trecho = extrairTrecho(q.enunciado);
  if (!trecho) return null;

  let busca = await buscarNoDDG(trecho);
  if (busca.urls.length === 0 && busca.bloqueado) {
    console.log(`   → DDG bloqueou; aguardando 20s e tentando de novo...`);
    await sleep(20000);
    busca = await buscarNoDDG(trecho);
  }

  for (const url of busca.urls) {
    const markdown = await lerPagina(url);
    if (!markdown) continue;
    const { prova, banca } = extrairCamposGran(markdown);
    if (!prova) continue;
    const { orgao, cargo } = dividirProva(prova);
    if (!orgao && !cargo) continue;
    const fonteBanca = banca.split(' - ').pop()?.trim() || banca;
    return { orgao, cargo, fonte: fonteBanca, url };
  }

  return null;
}

const dryRun = process.argv.includes('--dry-run');
const idxLimite = process.argv.indexOf('--limite');
const limite = idxLimite > 0 ? parseInt(process.argv[idxLimite + 1], 10) : 0;
carregarEnvLocal();

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveService = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!urlSupabase || !chaveService) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const supabase = createClient(urlSupabase, chaveService, { auth: { persistSession: false } });

console.log(dryRun ? '⚙️  MODO DRY-RUN — nada será gravado no banco\n' : '');

const { data, error } = await supabase
  .from('questoes')
  .select('id, banca, orgao, cargo, materia, topico, ano, enunciado')
  .order('id');

if (error) {
  console.error('❌ Erro ao consultar questoes:', error.message);
  process.exit(1);
}

const faltantes = (data || []).filter(q => ehFaltante(q.orgao) || ehFaltante(q.cargo));
const alvo = limite > 0 ? faltantes.slice(0, limite) : faltantes;
console.log(`📋 ${data.length} questões no total · ${faltantes.length} sem Cargo/Órgão${limite > 0 ? ` · processando só as ${limite} primeiras` : ''}\n`);

let encontrados = 0;
let naoEncontrados = 0;
let gravados = 0;
const falhas = [];

for (let i = 0; i < alvo.length; i++) {
  const q = alvo[i];
  console.log(`[${i + 1}/${alvo.length}] ${q.id} — ${q.banca || 'sem banca'} · ${q.materia || ''} · ${q.ano ?? ''}`);

  const achado = await resolverQuestao(q);
  if (!achado) {
    naoEncontrados++;
    console.log(`   ✗ Não encontrada na web`);
    falhas.push(q.id);
    await sleep(2500);
    continue;
  }

  encontrados++;
  console.log(`   ✓ ${achado.orgao} | ${achado.cargo}  (fonte: ${achado.fonte})`);
  if (!dryRun) {
    const { error: erroUpdate } = await supabase
      .from('questoes')
      .update({ orgao: achado.orgao, cargo: achado.cargo })
      .eq('id', q.id);
    if (erroUpdate) {
      console.error(`   ⚠ Falha ao gravar: ${erroUpdate.message}`);
      falhas.push(q.id);
    } else {
      gravados++;
    }
  }

  await sleep(3000);
}

console.log('\n────────────────────────────────────');
console.log(`✅ Encontradas na web: ${encontrados}`);
console.log(`❌ Não encontradas:    ${naoEncontrados}`);
if (dryRun) console.log(`💾 Gravação:          desativada (dry-run)`);
else console.log(`💾 Gravadas no banco: ${gravados}`);
if (falhas.length) console.log(`IDs sem preenchimento: ${falhas.join(', ')}`);
console.log('\nPara as não encontradas, rode de novo depois ou preencha manualmente em /admin/questoes/metadados.');