import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { BigQuery } from "@google-cloud/bigquery";
import { GoogleAuth } from "google-auth-library";

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
    // 🔥 3. CONEXÃO DIRETA COM O BIGQUERY (Workload Identity Federation Manual)
    // =========================================================================
    
    // Captura o token OIDC que a Vercel gera dinamicamente para a sua função
    const vercelOidcToken = process.env.VERCEL_OIDC_TOKEN;

    let authConfig: any = {};

    if (vercelOidcToken) {
      // Se estiver em produção na Vercel, monta a credencial federada programaticamente
      const auth = new GoogleAuth({
        credentials: {
          type: "external_account",
          audience: `//iam.googleapis.com/${process.env.GCP_WORKLOAD_IDENTITY_PROVIDER}`,
          subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
          token_url: "https://sts.googleapis.com/v1/token",
          service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${process.env.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
          credential_source: {
            // Passa o token da Vercel direto para o validador do Google
            url: "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", // placeholder exigido pela tipagem
            headers: {
              Authorization: `Bearer ${vercelOidcToken}`
            }
          }
        }
      });
      authConfig.authClient = auth;
    } else {
      // Fallback local se você estiver testando na sua máquina (exige gcloud auth application-default login)
      authConfig.projectId = process.env.GCP_PROJECT_ID;
    }

    // Instancia o BigQuery passando o cliente de autenticação federada criado
    const bigquery = new BigQuery(authConfig);

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

    parametrosQuery.limite = Math.min(limite, 1000);

    const options = {
      query: sqlQuery,
      location: 'us-east1', 
      params: parametrosQuery,
    };

    // Executa a busca na nuvem do Google usando a sessão federada
    const [leads] = await bigquery.query(options);

    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via BigQuery:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}