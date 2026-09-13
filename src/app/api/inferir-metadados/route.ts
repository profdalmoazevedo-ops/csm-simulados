import { NextResponse } from "next/server";
import { ehCampoFaltante, extrairTrechoBusca, limparLinksMarkdown, dividirProvaParaOrgaoCargo } from "@/lib/metadados";

export const maxDuration = 60;

type QuestaoEntrada = {
  id: string;
  banca?: string | null;
  materia?: string | null;
  topico?: string | null;
  ano?: number | null;
  enunciado?: string | null;
  alternativa_a?: string | null;
};

type Inferencia = {
  id: string;
  orgao: string;
  cargo: string;
  fonte: string;
  url: string;
  status: "verificado" | "estimado" | "nao_encontrado";
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function extrairUrlsDDG(html: string): string[] {
  const urls: string[] = [];
  const re = /href="([^"]*uddg=[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const uddg = m[1].match(/uddg=([^&"']+)/);
      if (!uddg) continue;
      let decoded = uddg[1];
      if (decoded.includes('%253D')) decoded = decodeURIComponent(decoded);
      decoded = decodeURIComponent(decoded);
      if (decoded.startsWith('http')) urls.push(decoded);
    } catch {
      // ignora resultados malformados
    }
  }
  return [...new Set(urls)];
}

async function buscarNoDDG(trecho: string): Promise<{ urls: string[]; bloqueado: boolean }> {
  const urlBase = 'https://html.duckduckgo.com/html/?q=' +
    encodeURIComponent(`"${trecho}"`);

  try {
    const resposta = await fetch(urlBase, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }
    });

    if (!resposta.ok) return { urls: [], bloqueado: false };
    const html = await resposta.text();
    if (html.includes('No results found')) return { urls: [], bloqueado: false };
    if (html.includes('anomaly')) return { urls: [], bloqueado: true };

    return {
      urls: extrairUrlsDDG(html)
        .filter(u => u.includes('questoes.grancursosonline.com.br/questoes-de-concursos/'))
        .slice(0, 3),
      bloqueado: false
    };
  } catch {
    return { urls: [], bloqueado: false };
  }
}

async function lerPagina(url: string): Promise<string> {
  const tentativas: Array<() => Promise<Response>> = [
    () => fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' } }),
    () => fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5' }
    })
  ];

  for (const tentativa of tentativas) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resposta = await tentativa();
      clearTimeout(timer);
      if (!resposta.ok) continue;
      const texto = await resposta.text();
      if (texto.includes('Just a moment') || texto.includes('CAPTCHA')) continue;
      if (texto.trim().length > 300) return texto;
    } catch {
      // tenta a próxima estratégia
    }
  }
  return '';
}

function extrairCamposGran(markdown: string): { banca: string; ano: string; prova: string } {
  const limpo = limparLinksMarkdown(markdown);
  const banca = limpo.match(/Banca\s*[:|]\s*([^\n]+)/i)?.[1]?.trim() ?? '';
  const anoLinha = limpo.match(/Ano\s*[:|]\s*(?:[\[])?\s*(\d{4})/i)?.[1];
  const ano = anoLinha ?? limpo.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '';
  const prova = limpo.match(/Prova\s*[:|]\s*([^\n]+)/i)?.[1]?.trim() ?? '';
  return { banca, ano, prova };
}

async function buscarNaWeb(q: QuestaoEntrada): Promise<Omit<Inferencia, 'id' | 'status'> | null> {
  const trecho = extrairTrechoBusca(q.enunciado);
  if (!trecho) return null;

  let busca = await buscarNoDDG(trecho);
  if (busca.urls.length === 0 && busca.bloqueado) {
    await sleep(8000);
    busca = await buscarNoDDG(trecho);
  }

  for (const url of busca.urls) {
    const markdown = await lerPagina(url);
    if (!markdown) continue;

    const { prova } = extrairCamposGran(markdown);
    if (!prova) continue;

    const { orgao, cargo } = dividirProvaParaOrgaoCargo(prova);
    if (!orgao && !cargo) continue;

    const bancaBruta = extrairCamposGran(markdown).banca;
    const fonteBanca = bancaBruta.split(' - ').pop()?.trim() || bancaBruta;

    return { orgao, cargo, fonte: fonteBanca || 'Gran Cursos Questões', url };
  }

  return null;
}

async function estimarComIA(questoes: QuestaoEntrada[]): Promise<Array<{ id: string; orgao: string; cargo: string }>> {
  const systemInstruction = `Você é um especialista em concursos públicos brasileiros. Para cada questão recebida, indique o ÓRGÃO e o CARGO da prova da qual ela foi retirada.

  REGRAS:
  1. Analise o enunciado, o atributo "banca", a matéria e as alternativas para inferir a origem da prova.
  2. SEMPRE responda com a opção MAIS PROVÁVEL, mesmo sem certeza absoluta — uma estimativa fundamentada é melhor que deixar vazio.
  3. NUNCA use placeholders como "ND", "Não Identificado", "Acervo Geral" ou "Diversos".
  4. Se absolutamente não houver pista alguma, retorne "Não identificado".
  5. Retorne o MESMO "id" enviado.

  MODELO DE SAÍDA OBRIGATÓRIO (JSON):
  {
    "questoes": [
      { "id": "id-original", "orgao": "TJ-RJ", "cargo": "Técnico Judiciário" }
    ]
  }`;

  const blocos = questoes
    .map((q, idx) => `
  --- QUESTÃO ${idx + 1}
  id: ${q.id}
  banca: ${q.banca || ''}
  matéria: ${q.materia || ''}
  tópico: ${q.topico || ''}
  ano: ${q.ano ?? ''}
  enunciado: ${(q.enunciado || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900)}
  alternativa a: ${q.alternativa_a || ''}
  `)
    .join('\n');

  let textoIAResposta = '';

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente.");

    const urlLite = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(urlLite, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nQUESTÕES:\n${blocos}` }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              questoes: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    orgao: { type: 'STRING' },
                    cargo: { type: 'STRING' }
                  },
                  required: ['id', 'orgao', 'cargo']
                }
              }
            },
            required: ['questoes']
          }
        }
      })
    });

    if (!geminiResponse.ok) throw new Error(`Google rejeitou a chamada (Status ${geminiResponse.status})`);

    const geminiData = await geminiResponse.json();
    textoIAResposta = geminiData.candidates[0].content.parts[0].text;

  } catch (erroGemini) {
    const mensagemGemini = erroGemini instanceof Error ? erroGemini.message : String(erroGemini);
    console.warn('⚠️ Acionando Groq para estimativa de metadados:', mensagemGemini);
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) throw new Error(`Falha Gemini: ${mensagemGemini} | GROQ_API_KEY ausente.`);

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqApiKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: blocos }
        ]
      })
    });

    if (!groqResponse.ok) throw new Error(`Gemini erro: [${mensagemGemini}] // Groq erro: [${await groqResponse.text()}]`);

    const groqData = await groqResponse.json();
    textoIAResposta = groqData.choices[0].message.content;
  }

  const textoLimpo = textoIAResposta.replace(/```json/gi, '').replace(/```/gi, '').trim();
  let jsonParseado: { questoes?: unknown };

  try {
    jsonParseado = JSON.parse(textoLimpo);
  } catch {
    return [];
  }

  const lista = Array.isArray(jsonParseado.questoes) ? jsonParseado.questoes : [];

  return lista
    .map((item: unknown) => {
      const obj = (item && typeof item === 'object') ? item as Record<string, unknown> : {} as Record<string, unknown>;
      return {
        id: String(obj.id ?? ''),
        orgao: typeof obj.orgao === 'string' ? obj.orgao.trim() : '',
        cargo: typeof obj.cargo === 'string' ? obj.cargo.trim() : ''
      };
    })
    .filter(item => item.id !== '')
    .map(item => ({
      ...item,
      orgao: ehCampoFaltante(item.orgao) ? '' : item.orgao,
      cargo: ehCampoFaltante(item.cargo) ? '' : item.cargo
    }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const questoes = Array.isArray(body?.questoes) ? (body.questoes as QuestaoEntrada[]).slice(0, 3) : [];

    if (questoes.length === 0) {
      return NextResponse.json({ error: 'Envie ao menos uma questão no payload.' }, { status: 400 });
    }

    if (!questoes.every(q => q.id && q.enunciado)) {
      return NextResponse.json({ error: 'Cada questão precisa de id e enunciado.' }, { status: 400 });
    }

    const inferencias: Inferencia[] = [];
    const paraIA: QuestaoEntrada[] = [];

    for (const q of questoes) {
      const achado = await buscarNaWeb(q);
      if (achado) {
        inferencias.push({ id: q.id, ...achado, status: 'verificado' });
      } else {
        paraIA.push(q);
      }
      await sleep(4000);
    }

    if (paraIA.length > 0) {
      const estimados = await estimarComIA(paraIA);
      inferencias.push(...estimados.map(item => ({
        id: item.id,
        orgao: item.orgao,
        cargo: item.cargo,
        fonte: 'Estimativa IA',
        url: '',
        status: (item.orgao || item.cargo) ? 'estimado' as const : 'nao_encontrado' as const
      })));
    }

    const porId = new Map<string, Inferencia>();
    for (const inf of inferencias) porId.set(inf.id, inf);

    const resultado = questoes.map(q => {
      const encontrada = porId.get(q.id);
      return encontrada ?? { id: q.id, orgao: '', cargo: '', fonte: '', url: '', status: 'nao_encontrado' as const };
    });

    return NextResponse.json({ sucesso: true, inferencias: resultado });

  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro inesperado na inferência de metadados.';
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}