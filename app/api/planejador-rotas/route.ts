import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const { origem, destino, atividade, limitePorCidade = 50 } = await req.json();

    if (!origem || !destino || !atividade) {
      return NextResponse.json({ error: "Origem, destino e atividade são obrigatórios." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. Chamar a IA para traçar a rota lógica de rodovia e mapear os códigos TOM das cidades no caminho
    const promptSistema = `
      Você é um especialista em logística rodoviária brasileira e inteligência de mercado da Receita Federal.
      O usuário fará uma viagem de uma cidade de origem até uma cidade de destino.
      Sua missão é identificar as principais cidades polo que ficam DIRETAMENTE na rota ou rota alternativa viável de carro entre a origem e o destino.
      Além disso, para cada cidade mapeada (incluindo a origem e o destino se fizerem sentido no contexto comercial), você deve retornar o CÓDIGO DO MUNICÍPIO DA RECEITA FEDERAL (Tabela TOM de 4 dígitos).
      Também extraia as famílias CNAE (2 dígitos) que fazem sentido para a "atividade" comercial descrita.

      Retorne ESTRITAMENTE um objeto JSON válido neste formato:
      {
        "familias_cnae": ["array de strings com 2 dígitos numéricos"],
        "paradas_sugeridas": [
          {
            "cidade_nome": "Nome da Cidade 1",
            "uf": "UF",
            "codigo_municipio": "4 dígitos TOM",
            "ordem": 1,
            "justificativa_comercial": "Breve motivo do porquê parar aqui comercialmente"
          }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: `Viagem de: ${origem} até: ${destino}. Objetivo comercial buscar por: ${atividade}` },
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