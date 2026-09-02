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

    // 1. Cria o Prompt para Extração de Dados em Lote
    const systemInstruction = `Você é um extrator de dados de alta precisão focado em questões de concursos públicos do Qconcursos. 
Sua única função é ler os enunciados fornecidos e extrair duas entidades: Órgão e Cargo.
Devolva ESTRITAMENTE um objeto JSON no formato: { "resultados": [ { "id": "id_da_questao", "orgao": "Nome do Orgao ou N/A", "cargo": "Nome do Cargo ou N/A" } ] }.
Não adicione explicações, blocos de código markdown ou texto extra. Apenas o JSON puro.`;

    const questoesFormatadas = questoes.map(q => `ID: ${q.id} | ENUNCIADO: "${q.enunciado}"`).join('\n\n');
    const prompt = `Extraia o orgao e o cargo das seguintes questões:\n\n${questoesFormatadas}`;

    let responseText = "";

    // =========================================================================
    // 2️⃣ OPERAÇÃO PRINCIPAL: Gemini
    // =========================================================================
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente.");

      // Mantido o modelo solicitado
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;

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
      console.warn("⚠️ Gemini falhou na extração. Acionando contingência Groq:", erroGemini.message);

      // =========================================================================
      // 3️⃣ CONTINGÊNCIA: Groq 
      // =========================================================================
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
          model: "openai/gpt-oss-120b", // Mantido o modelo solicitado
          temperature: 0.1,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!groqResponse.ok) {
        throw new Error("Falha crítica: Ambos os motores (Gemini e Groq) rejeitaram a requisição.");
      }

      const groqData = await groqResponse.json();
      responseText = groqData.choices[0].message.content;
    }

    // 4. Tratamento do JSON de Retorno com Vacina
    let extracoes = [];
    try {
      // Remove possíveis resquícios de formatação markdown caso a IA desobedeça a instrução do system
      const cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsedData = JSON.parse(cleanJsonStr);
      extracoes = parsedData.resultados || [];
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON retornado pela IA:", responseText);
      throw new Error("A IA retornou um formato inválido que não pôde ser convertido para JSON.");
    }

    return NextResponse.json({ 
      sucesso: true, 
      dados: extracoes 
    });

  } catch (error: any) {
    console.error("[API Extrair Metadados] Erro Crítico:", error);
    
    if (error.message.includes("429") || error.message.includes("Quota") || error.message.includes("Too Many Requests")) {
      return NextResponse.json(
        { error: "Limite de requisições atingido em todas as IAs. Aguarde alguns segundos." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Falha na IA: ${error.message}` },
      { status: 500 }
    );
  }
}