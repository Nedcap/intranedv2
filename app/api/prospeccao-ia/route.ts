import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { BigQuery } from "@google-cloud/bigquery";

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

    // 2. Limpeza contra as alucinações da IA
    if (perfilMercado.familias_cnae && Array.isArray(perfilMercado.familias_cnae)) {
      perfilMercado.familias_cnae = perfilMercado.familias_cnae
        .map((c: string) => c.replace(/\D/g, '').substring(0, 2))
        .filter((c: string) => c.length === 2);
    }

    // =========================================================================
    // 🔥 3. CONEXÃO DIRETA COM O BIGQUERY (Substituindo a ponte antiga do Cloudflare)
    // =========================================================================
    
    // Inicializa o BigQuery usando as variáveis seguras da Vercel (Workload Identity)
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
      },
    });

    // Construindo as condições dinamicamente baseadas no retorno da IA
    let queryCondicoes = `WHERE uf = @uf`;
    const parametrosQuery: any = { uf: perfilMercado.uf.toUpperCase() };

    // Filtro de Cidade (opcional)
    if (perfilMercado.cidade) {
      queryCondicoes += ` AND LOWER(municipio_rf) LIKE @cidade`;
      parametrosQuery.cidade = `%${perfilMercado.cidade.toLowerCase()}%`;
    }

    // Filtro de CNAE (opcional, verifica se os 2 primeiros dígitos batem)
    if (perfilMercado.familias_cnae && perfilMercado.familias_cnae.length > 0) {
      queryCondicoes += ` AND SUBSTR(cnae_principal, 1, 2) IN UNNEST(@cnaes)`;
      parametrosQuery.cnaes = perfilMercado.familias_cnae;
    }

    // Query otimizada para o BigQuery varrer o mínimo de dados possível
    const sqlQuery = `
      SELECT 
        cnpj,
        cnpj_raiz,
        matriz_filial,
        situacao,
        data_abertura,
        cnae_principal,
        bairro,
        cep,
        uf,
        municipio_rf
      FROM \`${process.env.GCP_PROJECT_ID}.dados_receita.estabelecimentos\`
      ${queryCondicoes}
      LIMIT @limite
    `;

    parametrosQuery.limite = Math.min(limite, 1000); // Trava um teto de segurança por query

    const options = {
      query: sqlQuery,
      location: 'us-east1', // Região onde criamos o dataset nos EUA
      params: parametrosQuery,
    };

    // Executa a busca na velocidade da luz na nuvem do Google
    const [leads] = await bigquery.query(options);

    // Retorna para o Front-end os dados limpos vindos direto do BigQuery!
    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via BigQuery:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}