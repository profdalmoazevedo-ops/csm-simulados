import { NextResponse } from "next/server";
import { ehCampoFaltante } from "@/lib/metadados";

export const maxDuration = 60;

type QuestaoEntrada = {
  id: string;
  banca?: string | null;
  materia?: string | null;
  topico?: string | null;
  ano?: number | null;
  enunciado?: string | null;
};

const limparHtml = (texto: string | null) =>
  (texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const questoes = Array.isArray(body?.questoes) ? body.questoes : [];

    if (questoes.length === 0) {
      return NextResponse.json({ error: "Envie ao menos uma questão no payload." }, { status: 400 });
    }

    if (questoes.length > 10) {
      return NextResponse.json({ error: "Máximo de 10 questões por chamada." }, { status: 400 });
    }

    const systemInstruction = `Você é um especialista em concursos públicos brasileiros. Sua missão é inferir o ÓRGÃO (ex: TRT-2, TJ-RJ, MPE-SP, INSS, Câmara Municipal) e o CARGO (ex: Analista Judiciário, Técnico, Promotor) de cada questão.

    REGRAS:
    1. Leia o enunciado e os metadados (banca, matéria, tópico, ano) para detectar a origem da prova.
    2. Se houver pistas suficientes, retorne o órgão e/ou cargo mais provável.
    3. Se NÃO houver como saber com confiança razoável, retorne string vazia ("") no campo incerto.
    4. NUNCA retorne placeholders como "ND", "Não Identificado", "Acervo Geral" ou "Diversos".
    5. Retorne o MESMO "id" da questão que foi enviada.

    MODELO DE SAÍDA OBRIGATÓRIO (JSON):
    {
      "questoes": [
        { "id": "id-original", "orgao": "TRT-2", "cargo": "Analista Judiciário" }
      ]
    }`;

    const blocos = questoes
      .map((q: QuestaoEntrada, idx: number) => `
    --- QUESTÃO ${idx + 1}
    id: ${q.id}
    banca: ${q.banca || ''}
    matéria: ${q.materia || ''}
    tópico: ${q.topico || ''}
    ano: ${q.ano || ''}
    enunciado: ${limparHtml(q.enunciado || '').slice(0, 800)}
    `)
      .join('\n');

    const payloadTexto = `${systemInstruction}\n\nQUESTÕES PARA ANÁLISE:\n${blocos}`;

    let textoIAResposta = '';

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente.");

      const urlLite = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(urlLite, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: payloadTexto }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                questoes: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      orgao: { type: "STRING" },
                      cargo: { type: "STRING" }
                    },
                    required: ["id", "orgao", "cargo"]
                  }
                }
              },
              required: ["questoes"]
            }
          }
        })
      });

      if (!geminiResponse.ok) {
        throw new Error(`Google rejeitou a chamada (Status ${geminiResponse.status})`);
      }

      const geminiData = await geminiResponse.json();
      textoIAResposta = geminiData.candidates[0].content.parts[0].text;

    } catch (erroGemini) {
      const mensagemGemini = erroGemini instanceof Error ? erroGemini.message : String(erroGemini);
      console.warn("⚠️ Acionando Groq para inferência de metadados:", mensagemGemini);
      const groqApiKey = process.env.GROQ_API_KEY;

      if (!groqApiKey) {
        throw new Error(`Falha Gemini: ${mensagemGemini} | GROQ_API_KEY ausente.`);
      }

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0,
          max_tokens: 4000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: blocos }
          ]
        })
      });

      if (!groqResponse.ok) {
        const erroRealGroq = await groqResponse.text();
        throw new Error(`Gemini erro: [${mensagemGemini}] // Groq erro: [${erroRealGroq}]`);
      }

      const groqData = await groqResponse.json();
      textoIAResposta = groqData.choices[0].message.content;
    }

    const textoLimpo = textoIAResposta.replace(/```json/gi, '').replace(/```/gi, '').trim();

    let jsonParseado: { questoes?: unknown };
    try {
      jsonParseado = JSON.parse(textoLimpo);
    } catch {
      return NextResponse.json({ error: "A IA gerou um formato inválido de resposta." }, { status: 422 });
    }

    const lista = Array.isArray(jsonParseado.questoes) ? jsonParseado.questoes : [];

    const inferencias = lista
      .map((item: unknown) => {
        const obj = (item && typeof item === "object") ? item as Record<string, unknown> : {} as Record<string, unknown>;
        return {
          id: String(obj.id ?? ''),
          orgao: typeof obj.orgao === "string" ? obj.orgao.trim() : '',
          cargo: typeof obj.cargo === "string" ? obj.cargo.trim() : ''
        };
      })
      .filter((item) => item.id !== '')
      .map((item) => ({
        ...item,
        orgao: ehCampoFaltante(item.orgao) ? '' : item.orgao,
        cargo: ehCampoFaltante(item.cargo) ? '' : item.cargo
      }));

    return NextResponse.json({ sucesso: true, inferencias });

  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro inesperado na inferência de metadados.";
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}