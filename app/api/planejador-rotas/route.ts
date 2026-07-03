import { NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const { origem, destino, atividade } = await req.json();

    if (!origem || !destino || !atividade) {
      return NextResponse.json({ error: "Origem, destino e atividade são obrigatórios." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 🔥 PROMPT "SARGENTO": Obriga a IA a pensar na estrada e proíbe arrays menores que 3 itens.
    const promptSistema = `
      Você é um especialista em logística rodoviária brasileira e inteligência de mercado da Receita Federal.
      
      TAREFA: O usuário fará uma viagem de carro de: "${origem}" até "${destino}".
      
      PASSO A PASSO OBRIGATÓRIO:
      1. Identifique qual é a rodovia principal (BR ou rodovia estadual) que liga essas duas cidades.
      2. Liste as cidades que o motorista é OBRIGADO a passar por dentro ou cruzar no meio do caminho.
      3. Escolha de 2 a 5 dessas cidades intermediárias que sejam bons "polos comerciais" para a atividade solicitada.
      4. Descubra o CÓDIGO TOM (Tabela de Municípios da Receita, 4 dígitos) para cada uma delas.
      5. Descubra os códigos CNAE de 2 dígitos referentes à atividade solicitada.

      REGRA DE OURO CRÍTICA: 
      O seu array "paradas_sugeridas" DEVE OBRIGATORIAMENTE ter no mínimo 3 itens (A Origem + No mínimo 1 ou mais paradas no meio do caminho + O Destino). 
      SE VOCÊ RETORNAR APENAS ORIGEM E DESTINO (2 itens), O SISTEMA VAI FALHAR.

      Retorne ESTRITAMENTE um objeto JSON válido neste exato formato:
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
      temperature: 0.2, // Um leve aumento para dar "criatividade" geográfica à IA
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: `Trace a rota de ${origem} para ${destino} buscando por ${atividade}. NÃO pule as cidades do meio do caminho!` },
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