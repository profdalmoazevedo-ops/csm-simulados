import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { enunciado, tipo_questao, gabarito, alternativas } = body;

    if (!enunciado || !gabarito) {
      return NextResponse.json(
        { error: "Enunciado e gabarito são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Monta o contexto das alternativas (se for múltipla escolha)
    let textoAlternativas = "";
    if (tipo_questao === "multipla_escolha" && alternativas) {
      textoAlternativas = `
        Alternativas:
        A) ${alternativas.A || "N/A"}
        B) ${alternativas.B || "N/A"}
        C) ${alternativas.C || "N/A"}
        D) ${alternativas.D || "N/A"}
        E) ${alternativas.E || "N/A"}
      `;
    }

    // 2. Cria o Prompt (A instrução cirúrgica para a IA)
    const systemInstruction = `Você é um professor de Direito altamente didático, especializado em concursos públicos e preparação de alto rendimento. Sua tarefa é escrever o comentário de resolução para uma questão de prova.`;

    const prompt = `
 DADOS DA QUESTÃO:
 - Tipo: ${tipo_questao === 'certo_errado' ? 'Certo ou Errado (Estilo Cebraspe)' : 'Múltipla Escolha'}
 - Enunciado: "${enunciado}"
 ${textoAlternativas}
 - GABARITO OFICIAL DEFINITIVO: ${gabarito}
 
 INSTRUÇÕES ESTRITAS DE FORMATAÇÃO E ESCRITA:
 1. GABARITO IMEDIATO: A primeiríssima linha do seu texto DEVE ser exclusivamente o gabarito. (Ex: "A alternativa correta é a Letra ${gabarito}.").
 2. LAYOUT DE PARÁGRAFOS BEM DEFINIDO: 
      - 1º Parágrafo: Apenas o gabarito imediato.
      - 2º Parágrafo: A explicação detalhada do porquê o gabarito está correto.
      - Parágrafos seguintes: Em caso de múltipla escolha, crie tópicos (bullet points) curtos explicando o erro das demais alternativas.
  3. ESTILO FGV (Direto e Focado): Vá direto ao ponto, explicando o instituto jurídico e o motivo do acerto de forma clara, objetiva e sem floreios.
  4. PROIBIÇÃO DE CITAÇÃO LEGAL NA ABERTURA: É terminantemente proibido iniciar a explicação citando números de artigos logo no começo (Ex: não comece com "Segundo o art. 5º..."). Inicie sempre pelo conceito, pela lógica ou pelo instituto jurídico. Cite os artigos apenas no meio ou no final do parágrafo como embasamento.
 5. LIMPEZA VISUAL (CRÍTICO): É ESTRITAMENTE PROIBIDO o uso de qualquer formatação em Markdown. NÃO use asteriscos (**) para negrito, não use hashtags (#) e não use traços soltos. Retorne apenas texto limpo e direto.  

 DIRETRIZ DE ABERTURA DA EXPLICAÇÃO (Após o Gabarito):
 Para evitar repetição, varie a forma como você começa a explicação do gabarito (o 2º parágrafo), alternando entre:
 - Abertura Conceitual: Comece definindo o instituto jurídico cobrado.
 - Abertura Analítica: Desconstrua a premissa da banca ou a "historinha" do caso concreto.
 - Abertura pelo Erro/Acerto (ideal para Certo/Errado): Aponte imediatamente a palavra ou trecho que torna o item falso ou verdadeiro.
`;

    let responseText = "";

    // =========================================================================
    // 3️⃣ OPERAÇÃO PRINCIPAL: Cascata Inteligente (Prioridade: Qualidade Didática)
    // =========================================================================
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente.");

      // 1ª Opção: O modelo PRO (Máxima inteligência e didática)
      const urlPro = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${geminiApiKey}`;
      
      // 2ª Opção (Fallback): O Flash mais atual da sua lista (Rápido, entra em ação se o PRO falhar)
      const urlFlash = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`;

      const fetchConfig = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: {
            temperature: 0.2, 
            maxOutputTokens: 2000,
          }
        })
      };

      // TENTATIVA 1: Bate no modelo PRO
      let geminiResponse = await fetch(urlPro, fetchConfig);

      // Se o PRO der erro de sobrecarga (503) ou cota (429), tenta o FLASH automaticamente
      if (!geminiResponse.ok && (geminiResponse.status === 503 || geminiResponse.status === 429)) {
         console.warn("⚠️ Modelo PRO sobrecarregado. Redirecionando para o 3.8 Flash...");
         geminiResponse = await fetch(urlFlash, fetchConfig);
      }

      // Se mesmo o Flash falhar, joga para o catch (que vai chamar a Groq)
      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        throw new Error(`Google rejeitou ambas as chamadas (Pro e Flash): ${errText}`);
      }

      const geminiData = await geminiResponse.json();
      const candidate = geminiData.candidates[0];

      if (candidate.finishReason === 'MAX_TOKENS') {
        throw new Error("O comentário gerado foi muito longo e cortado. Acionando contingência.");
      }

      responseText = candidate.content.parts[0].text;

    } catch (erroGemini: any) {
      console.warn("⚠️ Google falhou totalmente. Acionando contingência Groq (GPT-OSS-120b):", erroGemini.message);

      // =========================================================================
      // 4️⃣ CONTINGÊNCIA: Groq (Llama 3 / GPT-OSS)
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
          model: "openai/gpt-oss-120b",
          temperature: 0.2,
          max_tokens: 2000, // Limite de tokens adicionado aqui também por precaução
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

    // 🚀 A VACINA: Transforma as quebras de linha em HTML para o banco
    responseText = responseText.replace(/\n/g, '<br/>');

    // 5. Retorna para o Frontend
    return NextResponse.json({ 
      sucesso: true, 
      comentario: responseText.trim() 
    });

  } catch (error: any) {
    console.error("[API Gerar Comentário] Erro Crítico:", error);
    
    // Tratamento genérico de falha extrema para avisar o frontend
    if (error.message.includes("429") || error.message.includes("Quota") || error.message.includes("Too Many Requests") || error.message.includes("503")) {
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