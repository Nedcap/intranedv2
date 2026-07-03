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

    // 1. Chamar a IA para estruturar os filtros E traduzir a cidade para o código TOM da Receita Federal
    const promptSistema = `
      Você é um analista especialista em prospecção B2B e conhece a fundo as tabelas da Receita Federal do Brasil.
      Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      
      ATENÇÃO PARA A CIDADE: Na propriedade "codigo_municipio", você deve mapear o nome da cidade citada para o CÓDIGO DO MUNICÍPIO DA RECEITA FEDERAL (Tabela TOM de 4 dígitos utilizada no campo municipio_rf). Exemplo: Curitiba é "7535", São Paulo é "7107", Maringá é "7691". Se nenhuma cidade for citada, retorne null.

      Retorne ESTRITAMENTE um objeto JSON válido:
      {
        "atividade": "descrição curta do segmento",
        "cidade_nome": "Nome da cidade por extenso",
        "codigo_municipio": "String com o código de 4 dígitos TOM da Receita Federal ou null",
        "uf": "Duas letras maiúsculas do Estado (ex: SP, PR)",
        "familias_cnae": ["array de strings contendo APENAS OS 2 PRIMEIROS DÍGITOS numéricos das familias CNAE alvo, sem letras"],
        "termos_fortes": ["palavras-chave específicas"],
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

    // 2. Limpeza contra as alucinações da IA nos CNAEs
    if (perfilMercado.familias_cnae && Array.isArray(perfilMercado.familias_cnae)) {
      perfilMercado.familias_cnae = perfilMercado.familias_cnae
        .map((c: string) => c.replace(/\D/g, '').substring(0, 2))
        .filter((c: string) => c.length === 2);
    }

    // =========================================================================
    // 🔥 3. CONSULTA DIRETA VIA API REST DO BIGQUERY
    // =========================================================================
    
    // Monta as condições de filtragem do SQL usando a UF
    let queryCondicoes = `WHERE uf = '${perfilMercado.uf.toUpperCase()}'`;

    // AGORA O FILTRO SÓ BUSCA PELO CÓDIGO NUMÉRICO EXATO! 🚀
    if (perfilMercado.codigo_municipio) {
      queryCondicoes += ` AND municipio_rf = '${perfilMercado.codigo_municipio}'`;
    }

    if (perfilMercado.familias_cnae && perfilMercado.familias_cnae.length > 0) {
      const cnaesFormatados = perfilMercado.familias_cnae.map((c: string) => `'${c}'`).join(',');
      queryCondicoes += ` AND SUBSTR(cnae_principal, 1, 2) IN (${cnaesFormatados})`;
    }

    const limiteSeguro = Math.min(limite, 1000);

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
      LIMIT ${limiteSeguro}
    `;

    // Dispara a requisição HTTP pura para a API global do BigQuery do Google
    const urlBigQuery = `https://bigquery.googleapis.com/bigquery/v2/projects/${process.env.GCP_PROJECT_ID}/queries?key=${process.env.GCP_API_KEY}`;
    
    const bqResponse = await fetch(urlBigQuery, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: sqlQuery,
        useLegacySql: false
      })
    });

    const bqDados = await bqResponse.json();

    if (bqDados.error) {
      throw new Error(`Erro no BigQuery: ${bqDados.error.message}`);
    }

    // 4. Mapeia o retorno bruto para o formato do seu Front-end
    const leads = (bqDados.rows || []).map((row: any) => {
      return {
        cnpj: row.f[0].v,
        cnpj_raiz: row.f[1].v,
        matriz_filial: row.f[2].v,
        situacao: row.f[3].v,
        data_abertura: row.f[4].v,
        cnae_principal: row.f[5].v,
        bairro: row.f[6].v,
        cep: row.f[7].v,
        uf: row.f[8].v,
        municipio_rf: row.f[9].v // Retorna o código, o front pode exibir normalmente
      };
    });

    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via API Rest:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}