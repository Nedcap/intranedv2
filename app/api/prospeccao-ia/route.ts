import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const { promptUsuario, limite = 200 } = await req.json();

    if (!promptUsuario) {
      return NextResponse.json({ error: "O texto de busca é obrigatório." }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1. Chamar a IA para estruturar os filtros a partir do prompt solto do usuário
    const promptSistema = `
      Você é um analista especialista em prospecção B2B. Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      Retorne ESTRITAMENTE um objeto JSON válido:
      {
        "atividade": "descrição curta do segmento",
        "cidade": "Nome da cidade por extenso ou null se não citada",
        "uf": "Duas letras maiúsculas do Estado (ex: SP, PR)",
        "familias_cnae": ["array de strings contendo APENAS OS 2 PRIMEIROS DÍGITOS numéricos das familias CNAE alvo, sem letras, sem 'xx'"],
        "termos_fortes": ["palavras-chave específicas do nicho"],
        "termos_fracos": ["palavras genéricas"]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: promptUsuario },
      ],
      response_format: { type: "json_object" }
    });

    const perfilMercado = JSON.parse(completion.choices[0].message.content || "{}");

    if (!perfilMercado.uf) {
      return NextResponse.json({ error: "Não consegui identificar o Estado (UF) no seu pedido. Por favor, especifique a região (ex: SP, PR)." }, { status: 400 });
    }

    // 2. Limpeza contra as alucinações da IA ("22xx" vira "22" para não quebrar a sua query do SQLite)
    if (perfilMercado.familias_cnae && Array.isArray(perfilMercado.familias_cnae)) {
      perfilMercado.familias_cnae = perfilMercado.familias_cnae
        .map((c: string) => c.replace(/\D/g, '').substring(0, 2))
        .filter((c: string) => c.length === 2);
    }

    // 3. 🔥 COMUNICAÇÃO COM O SEU SERVER.JS (Onde está o banco de 16GB)
    const payloadPonte = {
      uf: perfilMercado.uf,
      cidade: perfilMercado.cidade,
      familias_cnae: perfilMercado.familias_cnae,
      termos_fortes: perfilMercado.termos_fortes,
      termos_fracos: perfilMercado.termos_fracos,
      limite: limite
    };

    const responsePonte = await fetch('https://api-nedhub-secreta.loca.lt/api/prospeccao/ia', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true' // 🚀 O crachá VIP que pula a tela de segurança do LocalTunnel
      },
      body: JSON.stringify(payloadPonte)
    });

    if (!responsePonte.ok) {
      const erroPonte = await responsePonte.json();
      throw new Error(erroPonte.error || "Erro ao consultar o servidor ponte do SQLite.");
    }

    const dadosPonte = await responsePonte.json();

    // Retorna para o Front-end os dados mastigados!
    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: dadosPonte.leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via Ponte Local:", error);
    
    // Aviso amigável caso você esqueça de ligar o server.js
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      return NextResponse.json({ error: "O servidor ponte (server.js) está desligado. Abra o terminal e rode 'node server.js'." }, { status: 500 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}