import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const { origem, destino, atividade } = await req.json();

    if (!origem || !destino || !atividade) {
      return NextResponse.json({ error: "Origem, destino e atividade são obrigatórios." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // O prompt foi tunado para FORÇAR a IA a não ser preguiçosa e trazer o trajeto completo
    const promptSistema = `
      Você é um especialista em logística rodoviária brasileira e inteligência de mercado da Receita Federal.
      O usuário fará uma viagem de carro de: "${origem}" até "${destino}".
      
      REGRA CRÍTICA E OBRIGATÓRIA: 
      Você NÃO DEVE retornar apenas a cidade de destino. Você deve traçar o trajeto rodoviário real e mapear:
      1. A cidade de Origem (ordem 1).
      2. No MÍNIMO 2 e no MÁXIMO 5 cidades polo intermediárias que ficam DIRETAMENTE na rota.
      3. A cidade de Destino (última ordem).

      Para cada cidade, descubra o CÓDIGO DO MUNICÍPIO DA RECEITA FEDERAL (Tabela TOM de 4 dígitos). Ex: São Paulo é 7107.
      Também extraia as famílias CNAE (2 dígitos numéricos) para a atividade: "${atividade}".

      Retorne ESTRITAMENTE um objeto JSON válido neste formato:
      {
        "familias_cnae": ["array com 2 dígitos numéricos"],
        "paradas_sugeridas": [
          {
            "cidade_nome": "Nome da Cidade",
            "uf": "UF",
            "codigo_municipio": "4 dígitos TOM",
            "ordem": 1,
            "justificativa_comercial": "Por que parar aqui?"
          }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1, // Reduzimos a temperatura para ele focar nos fatos geográficos
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: "Trace a rota comercial rigorosamente conforme instruído." },
      ],
      response_format: { type: "json_object" }
    });

    const planoRotaAI = JSON.parse(completion.choices[0].message.content || "{}");

    return NextResponse.json({ planoRotaAI });

  } catch (error: any) {
    console.error("Erro no planejador de rotas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}