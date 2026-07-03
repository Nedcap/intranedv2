// C:\Users\Alyson\intranet-webv2\app\api\prospeccao-ia\route.ts
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

    const promptSistema = `
      Você é um analista especialista em prospecção B2B e conhece a fundo a tabela de CNAEs e municípios da Receita Federal do Brasil.
      Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      
      ATENÇÃO PARA A CIDADE: Na propriedade "codigo_municipio", você deve mapear o nome da cidade citada para o CÓDIGO DO MUNICÍPIO DA RECEITA FEDERAL (Tabela TOM de 4 dígitos utilizada no campo municipio_rf). Exemplo: Curitiba é "7535", Maringá é "7691". Se nenhuma cidade for citada, retorne null.

      ATENÇÃO PARA O CNAE (MUITO IMPORTANTES):
      - Se o usuário pedir um nicho específico, retorne os prefixos CNAE correspondentes de 3 a 5 dígitos na propriedade "codigos_cnae".
      - Se o pedido do usuário for aberto, amplo ou pedir "principais empresas", "comércios" ou "indústrias" em geral sem um nicho restrito, retorne o array "codigos_cnae" VAZIO []. Não tente inventar filtros restritivos se o objetivo for uma varredura geral.

      Retorne ESTRITAMENTE um objeto JSON válido:
      {
        "atividade": "descrição curta do segmento ou 'Geral'",
        "cidade_nome": "Nome da cidade por extenso",
        "codigo_municipio": "String com o código de 4 dígitos TOM da Receita Federal ou null",
        "uf": "Duas letras maiúsculas do Estado (ex: SP, PR)",
        "codigos_cnae": ["array de strings contendo prefixos se houver nicho específico, ou [] se for busca geral"]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: promptUsuario },
      ],
      response_format: { type: "json_object" }
    });

    const perfilMercado = JSON.parse(completion.choices[0].message.content || "{}");

    if (!perfilMercado.uf) {
      return NextResponse.json({ error: "Não consegui identificar o Estado (UF) no seu pedido." }, { status: 400 });
    }

    // Limpa pontuações e garante os dígitos de precisão caso a IA tenha retornado algum CNAE
    if (perfilMercado.codigos_cnae && Array.isArray(perfilMercado.codigos_cnae)) {
      perfilMercado.codigos_cnae = perfilMercado.codigos_cnae
        .map((c: string) => c.replace(/\D/g, ''))
        .filter((c: string) => c.length >= 3); 
    }

    // =========================================================================
    // 🔥 2. AUTENTICAÇÃO OAUTH2 DINÂMICA VIA REFRESH TOKEN PROPRIO
    // =========================================================================
    if (!process.env.GCP_CLIENT_ID || !process.env.GCP_REFRESH_TOKEN) {
      throw new Error("Variáveis de ambiente do Google Cloud não foram carregadas corretamente.");
    }

    const oauthResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GCP_CLIENT_ID,
        client_secret: process.env.GCP_CLIENT_SECRET || "",
        refresh_token: process.env.GCP_REFRESH_TOKEN,
        grant_type: "refresh_token"
      })
    });

    const oauthDados = await oauthResponse.json();
    
    if (oauthDados.error) {
      throw new Error(`Falha na renovação do Token Google: ${oauthDados.error_description || oauthDados.error}`);
    }

    const accessTokenValido = oauthDados.access_token;

    // =========================================================================
    // 🧠 3. CONSTRUÇÃO DA QUERY INTELIGENTE NO DATASET (banco_receita_us)
    // =========================================================================
    // Filtro base: apenas estabelecimentos ativos na UF correspondente
    let queryCondicoes = `WHERE uf = '${perfilMercado.uf.toUpperCase()}' AND situacao = '02'`; // '02' costuma ser Ativa na RF

    if (perfilMercado.codigo_municipio) {
      queryCondicoes += ` AND municipio_rf = '${perfilMercado.codigo_municipio}'`;
    }

    // Se houver CNAEs específicos extraídos, aplica o sniper LIKE. Caso contrário, traz tudo da cidade!
    if (perfilMercado.codigos_cnae && perfilMercado.codigos_cnae.length > 0) {
      const cnaesPrecisos = perfilMercado.codigos_cnae.map((c: string) => `cnae_principal LIKE '${c}%'`).join(' OR ');
      queryCondicoes += ` AND (${cnaesPrecisos})`;
    }

    const limiteSeguro = Math.min(limite, 1000);

    // Adicionamos um ORDER BY para jogar empresas com nome e dados do Google para o topo na buscona geral
    const sqlQuery = `
      SELECT 
        cnpj, cnpj_raiz, matriz_filial, situacao, data_abertura, 
        cnae_principal, cnaes_secundarios, bairro, cep, uf, municipio_rf,
        razao_social, naturezas_juridica, capital_social,
        google_nome, google_categoria, google_endereco, google_website
      FROM \`${process.env.GCP_PROJECT_ID}.banco_receita_us.estabelecimentos\`
      ${queryCondicoes}
      ORDER BY CASE WHEN google_nome IS NOT NULL AND google_nome != '' THEN 0 ELSE 1 END, data_abertura DESC
      LIMIT ${limiteSeguro}
    `;

    const urlBigQuery = `https://bigquery.googleapis.com/bigquery/v2/projects/${process.env.GCP_PROJECT_ID}/queries`;
    
    const bqResponse = await fetch(urlBigQuery, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessTokenValido}`,
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

    // 4. Mapeia os dados devolvendo para a view do planejador
    const leads = (bqDados.rows || []).map((row: any) => {
      const rSocial = row.f[11].v || "Razão Social indisponível";
      const gNome = row.f[14].v;

      return {
        cnpj: row.f[0].v,
        cnpj_raiz: row.f[1].v,
        matriz_filial: row.f[2].v,
        situacao: row.f[3].v,
        data_abertura: row.f[4].v,
        cnae_principal: row.f[5].v,
        cnaes_secundarios: row.f[6].v,
        bairro: row.f[7].v,
        cep: row.f[8].v,
        uf: row.f[9].v,
        municipio_rf: row.f[10].v,
        razao_social: rSocial,
        nome_fantasia: gNome && gNome.trim() !== "" ? gNome : rSocial,
        natureza_juridica: row.f[12].v,
        capital_social: row.f[13].v ? parseFloat(row.f[13].v) : 0,
        google_categoria: row.f[15].v,
        google_endereco: row.f[16].v,
        website: row.f[17].v,
        lat: null,
        lng: null
      };
    });

    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via OAuth2:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}