import { NextResponse } from "next/server";

export const maxDuration = 60; 

export async function POST(req: Request) {
  try {
    const { textoBruto } = await req.json();

    if (!textoBruto || textoBruto.trim() === "") {
      return NextResponse.json({ error: "O texto enviado está vazio." }, { status: 400 });
    }

    // Instrução focada 100% em velocidade de extração (Zero geração de comentários)
    const systemInstruction = `Você é um motor de extração de dados ultrarrápido. Converta a questão em JSON.
    
    PROIBIÇÃO ABSOLUTA: NÃO GERE COMENTÁRIOS. Deixe "comentario_gabarito" vazio ("").
    
    REGRAS:
    1. ENUNCIADO: Todo o texto base, incluindo itens (I, II, III...), até chegar nas opções de resposta.
    2. ALTERNATIVAS: Recorte as alternativas (A, B, C, D, E) sem a letra inicial.
    3. TIPO: "multipla_escolha" ou "certo_errado".
    4. GABARITO: Apenas a letra exata ou C/E.
    5. METADADOS: Extraia Banca, Ano, Órgão, Cargo, Matéria e Tópico explícitos no cabeçalho.
    
    Saída ESTRITA em JSON: { "questoes": [ { ... } ] }`;

    let textoIAResposta = "";

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente.");

      // 🚀 Usando a versão LITE como principal para garantir que seja instantâneo (1 a 3 segundos)
      const urlLite = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(urlLite, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nTEXTO BRUTO:\n${textoBruto}` }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          }
        })
      });

      if (!geminiResponse.ok) {
         throw new Error(`Google rejeitou a chamada (Status ${geminiResponse.status})`);
      }
      
      const geminiData = await geminiResponse.json();
      textoIAResposta = geminiData.candidates[0].content.parts[0].text;

    } catch (erroGemini: any) {
      console.warn("⚠️ Acionando Groq para importação única:", erroGemini.message);
      const groqApiKey = process.env.GROQ_API_KEY;
      
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0,
          max_tokens: 2000,
          response_format: { type: "json_object" }, 
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: textoBruto }
          ]
        })
      });

      if (!groqResponse.ok) throw new Error("Ambos os motores falharam.");
      const groqData = await groqResponse.json();
      textoIAResposta = groqData.choices[0].message.content;
    }

    const jsonParseado = JSON.parse(textoIAResposta.replace(/```json/gi, '').replace(/```/gi, '').trim());
    const listaQuestoes = jsonParseado.questoes || [jsonParseado];

    return NextResponse.json({ 
      sucesso: true, 
      questoes: listaQuestoes 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}