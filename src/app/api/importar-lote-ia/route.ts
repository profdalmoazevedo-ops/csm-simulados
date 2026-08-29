import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { textoBruto } = await req.json();

    if (!textoBruto || textoBruto.trim() === "") {
      return NextResponse.json({ error: "O texto enviado está vazio." }, { status: 400 });
    }

    const systemInstruction = `Você é um motor de extração de dados ultrarrápido. Sua missão é ler um bloco com múltiplas questões de concurso e convertê-las em um array JSON estrito.
    
    PROIBIÇÃO ABSOLUTA: VOCÊ NÃO DEVE GERAR COMENTÁRIOS. Deixe o campo 'comentario_gabarito' sempre vazio (""). O foco é apenas extrair o texto estruturado.

    REGRAS DE EXTRAÇÃO:
    1. ENUNCIADO: Capture APENAS o texto base e o comando da questão. É ESTRITAMENTE PROIBIDO incluir o texto das alternativas dentro do enunciado. O enunciado deve terminar exatamente onde as opções de resposta começam.
    2. ALTERNATIVAS: Recorte o texto de cada alternativa e coloque-o EXCLUSIVAMENTE em seu respectivo campo (alternativa_a, alternativa_b, alternativa_c, etc.). Remova a letra inicial (ex: não inclua "A) ", apenas o texto da opção).
    3. DETECÇÃO INTELIGENTE DO TIPO DE QUESTÃO:
        - Se detectar 5 alternativas (A, B, C, D, E): Marque "tipo_questao" como "multipla_escolha".
        - Se detectar 4 alternativas (A, B, C, D): Marque "tipo_questao" como "multipla_escolha" e deixe a "alternativa_e" com valor null.
        - Se não houver alternativas, for apenas uma afirmação para julgar (Certo/Errado): Marque "tipo_questao" como "certo_errado" e force os campos de alternativa_a até alternativa_e para null.
    4. GABARITO: Capture a resposta. Se múltipla escolha, use a letra exata (A, B, C, D, E). Se Certo/Errado, use "C" ou "E".
    5. CLASSIFICAÇÃO: Extraia "banca", "orgao", "cargo", "materia" e "topico". Se não estiverem explícitos, infira pelo contexto ou deixe em branco.

    IMPORTANTE: PROCESSE TODAS AS QUESTÕES PRESENTES NO TEXTO, NÃO OMITE NENHUMA. NUNCA misture as alternativas dentro do campo do enunciado.

    MODELO DE SAÍDA: Retorne estritamente um JSON com o array "questoes".`;

    const jsonSchemaProperties = {
      banca: { type: "STRING" },
      orgao: { type: "STRING", nullable: true },
      cargo: { type: "STRING", nullable: true },
      tipo_questao: { type: "STRING" },
      materia: { type: "STRING" },
      topico: { type: "STRING" },
      enunciado: { type: "STRING" },
      alternativa_a: { type: "STRING", nullable: true },
      alternativa_b: { type: "STRING", nullable: true },
      alternativa_c: { type: "STRING", nullable: true },
      alternativa_d: { type: "STRING", nullable: true },
      alternativa_e: { type: "STRING", nullable: true },
      gabarito: { type: "STRING" },
      comentario_gabarito: { type: "STRING" }
    };

    let textoIAResposta = "";
    const textoFormatado = textoBruto.replace(/\n\s*\n/g, "\n").replace(/\t/g, " ");

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nTEXTO BRUTO:\n${textoFormatado}` }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            responseSchema: {
              type: "OBJECT",
              properties: {
                questoes: {
                  type: "ARRAY",
                  items: { type: "OBJECT", properties: jsonSchemaProperties, required: ["banca", "tipo_questao", "materia", "topico", "enunciado", "gabarito"] }
                }
              },
              required: ["questoes"]
            }
          }
        })
      });

      if (!geminiResponse.ok) {
         const errText = await geminiResponse.text();
         throw new Error(`Falha Gemini: ${errText}`);
      }
      
      const geminiData = await geminiResponse.json();
      const candidate = geminiData.candidates[0];

      if (candidate.finishReason === 'MAX_TOKENS') {
         return NextResponse.json({ error: "Resposta da IA cortada por excesso de tamanho." }, { status: 413 });
      }

      textoIAResposta = candidate.content.parts[0].text;

    } catch (erroGemini) {
      console.warn("Acionando Groq:", erroGemini);
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) throw new Error("Groq não configurada.");
      
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0,
          response_format: { type: "json_object" }, 
          messages: [
            { role: "system", content: `${systemInstruction}` },
            { role: "user", content: textoBruto }
          ]
        })
      });

      if (!groqResponse.ok) throw new Error("Falha Groq");
      const groqData = await groqResponse.json();
      textoIAResposta = groqData.choices[0].message.content;
    }

    const limparQuebrasDeLinha = (texto: string | null) => {
      if (!texto) return texto;
      return String(texto)
        .replace(/\\n/g, '<br/>') 
        .replace(/\n/g, '<br/>')  
        .trim();
    };

    let jsonParseado;
    try {
       jsonParseado = JSON.parse(textoIAResposta);
    } catch (parseError) {
       console.error("Falha JSON:", textoIAResposta);
       return NextResponse.json({ error: "A IA gerou um formato inválido. Tente processar um lote menor." }, { status: 422 });
    }

    const listaQuestoes = jsonParseado.questoes || jsonParseado;

    const questoesPreparadas = listaQuestoes.map((q: any) => ({
      banca: q.banca || "FGV",
      orgao: q.orgao || "",
      cargo: q.cargo || "",
      tipo_questao: q.tipo_questao,
      materia: q.materia || "Direito",
      topico: q.topico || "Assunto",
      enunciado: limparQuebrasDeLinha(q.enunciado) || "",
      alternativa_a: limparQuebrasDeLinha(q.alternativa_a) || null,
      alternativa_b: limparQuebrasDeLinha(q.alternativa_b) || null,
      alternativa_c: limparQuebrasDeLinha(q.alternativa_c) || null,
      alternativa_d: limparQuebrasDeLinha(q.alternativa_d) || null,
      alternativa_e: limparQuebrasDeLinha(q.alternativa_e) || null,
      gabarito: String(q.gabarito || "A").trim().toUpperCase(),
      comentario_gabarito: "" 
    }));

    const { data: questoesInseridas, error } = await supabaseAdmin
      .from('questoes')
      .insert(questoesPreparadas)
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      sucesso: true, 
      questoes_inseridas: questoesInseridas 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}