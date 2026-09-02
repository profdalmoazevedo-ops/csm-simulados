import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questoes } = body; 

    if (!questoes || !Array.isArray(questoes) || questoes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma questão fornecida para processamento." },
        { status: 400 }
      );
    }

    // 1. Prompt especializado no padrão exato do Qconcursos (Print 2)
    const systemInstruction = `Você é um extrator de metadados cirúrgico para questões do Qconcursos. 
Analise o cabeçalho do enunciado de cada questão seguindo estritamente estas regras de localização:
1. ÓRGÃO: Busque o texto localizado logo após a tag "Órgão:" (Exemplo: se o texto diz "Órgão: CRECI - 11ª Região (SC)", o órgão é "CRECI - 11ª Região (SC)").
2. CARGO: O cargo costuma vir na última parte da string rotulada como "Prova:", geralmente após o último hífen (Exemplo: em "Prova: Ibest - 2025 - CRECI - 11ª Região (SC) - Analista de TI", o cargo é "Analista de TI"). Se não houver menção explícita a um cargo no final da prova, extraia o cargo pelo contexto ou retorne "N/A".

REGRAS CRÍTICAS:
- O array "resultados" no JSON DEVE conter EXATAMENTE ${questoes.length} objetos, correspondendo um a um aos IDs enviados.
- Se não encontrar de forma alguma, retorne "N/A".
- Responda ESTRITAMENTE em JSON puro: { "resultados": [ { "id": "id_da_questao", "orgao": "...", "cargo": "..." } ] }`;

    const questoesFormatadas = questoes.map(q => `ID: ${q.id}\nENUNCIADO: "${q.enunciado}"`).join('\n\n---\n\n');
    const prompt = `Extraia o orgao e o cargo das seguintes questões:\n\n${questoesFormatadas}`;

    let responseText = "";

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente.");

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: {
            temperature: 0.1, 
          }
        })
      });

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        throw new Error(`HTTP ${geminiResponse.status}: ${errText}`);
      }

      const geminiData = await geminiResponse.json();
      responseText = geminiData.candidates[0].content.parts[0].text;

    } catch (erroGemini: any) {
      console.warn("⚠️ Gemini falhou. Acionando contingência Groq:", erroGemini.message);

      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new Error(`O Gemini falhou (${erroGemini.message}) e a Groq não está configurada.`);
      }

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!groqResponse.ok) {
        throw new Error("Falha crítica: Ambos os motores rejeitaram a requisição.");
      }

      const groqData = await groqResponse.json();
      responseText = groqData.choices[0].message.content;
    }

    let extracoes = [];
    try {
      const cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsedData = JSON.parse(cleanJsonStr);
      extracoes = parsedData.resultados || [];
    } catch (parseError) {
      throw new Error("A IA retornou um formato inválido que não pôde ser convertido para JSON.");
    }

    return NextResponse.json({ 
      sucesso: true, 
      dados: extracoes 
    });

  } catch (error: any) {
    if (error.message.includes("429") || error.message.includes("503")) {
      return NextResponse.json(
        { error: "Alta demanda ou limite de requisições atingido. Aguarde alguns segundos." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Falha na IA: ${error.message}` },
      { status: 500 }
    );
  }
}