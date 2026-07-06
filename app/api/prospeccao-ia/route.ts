// C:\Users\Alyson\intranet-webv2\app\api\prospeccao-ia\route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

// Inicializa o BigQuery usando o JSON da variável de ambiente
const obterClienteBigQuery = () => {
  const jsonCredenciais = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!jsonCredenciais) {
    throw new Error("A variável GOOGLE_APPLICATION_CREDENTIALS_JSON não está configurada.");
  }

  try {
    const credenciais = JSON.parse(jsonCredenciais);
    return new BigQuery({
      projectId: credenciais.project_id,
      credentials: {
        client_email: credenciais.client_email,
        private_key: credenciais.private_key,
      },
    });
  } catch (err: any) {
    throw new Error("Falha ao processar o JSON das credenciais do Google: " + err.message);
  }
};

export async function POST(req: Request) {
  try {
    const { promptUsuario, limite = 200 } = await req.json();

    if (!promptUsuario) {
      return NextResponse.json({ error: "O texto de busca é obrigatório." }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // =========================================================================
    // 🧠 1. INTELIGÊNCIA ARTIFICIAL: EXTRAÇÃO DOS DADOS
    // =========================================================================
    const promptSistema = `
      Você é um analista especialista em prospecção B2B e conhece a fundo a tabela de CNAEs e municípios da Receita Federal do Brasil.
      Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      
      ATENÇÃO PARA A CIDADE: Na propriedade "codigo_municipio", você deve mapear o nome da cidade citada para o CÓDIGO DO MUNICÍPIO DA RECEITA FEDERAL (Tabela TOM de 4 dígitos utilizada no campo municipio_rf). Exemplo: Curitiba é "7535", Maringá é "7691". Se nenhuma cidade for citada, retorne null.

      ATENÇÃO PARA O CNAE:
      - Se o usuário pedir um nicho específico, retorne os prefixos CNAE correspondentes de 3 a 5 dígitos na propriedade "codigos_cnae".
      - Se for busca aberta/geral, retorne o array VAZIO [].
      
      Retorne ESTRITAMENTE um JSON:
      {
        "atividade": "descrição",
        "cidade_nome": "Nome extenso",
        "codigo_municipio": "TOM de 4 dígitos ou null",
        "uf": "UF",
        "codigos_cnae": []
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

    // =========================================================================
    // 🚀 2. BIGQUERY: CONSULTA DIRETA NA NUVEM DO GOOGLE
    // =========================================================================
    const bigquery = obterClienteBigQuery();

    let filtroCnaeClausula = "";
    const temNichoEspecifico = perfilMercado.codigos_cnae && perfilMercado.codigos_cnae.length > 0;

    if (temNichoEspecifico) {
      const cnaesLimpos = perfilMercado.codigos_cnae
        .map((c: string) => c.replace(/\D/g, ''))
        .filter((c: string) => c.length >= 3);

      if (cnaesLimpos.length > 0) {
        const cnaesPrecisos = cnaesLimpos.map((c: string) => `cnae_principal LIKE '${c}%'`).join(' OR ');
        filtroCnaeClausula = `AND (${cnaesPrecisos})`;
      }
    }

    const limiteSeguro = Math.min(limite, 1000);

    let ordenacaoEstrategica = temNichoEspecifico 
      ? `CASE WHEN google_nome IS NOT NULL AND google_nome != '' THEN 0 ELSE 1 END, data_abertura ASC`
      : `CASE WHEN natureza_juridica = '213-5' THEN 1 ELSE 0 END ASC,
         CASE WHEN REGEXP_CONTAINS(cnae_principal, r'^(46|33|49|50|51|52|77|25|1[0-9]|2[0-9]|3[0-2])') THEN 0 
              WHEN SUBSTR(cnae_principal, 1, 2) = '47' THEN 2 ELSE 1 END ASC,
         data_abertura ASC`;

    // ⚠️ AJUSTE AQUI: Substitua pelo caminho correto da sua tabela no BigQuery (projeto.dataset.tabela)
    const TABELA_BIGQUERY = "`seu_projeto_google.seu_dataset.sua_tabela`";

    const sqlQuery = `
      SELECT 
        cnpj, cnpj_raiz, matriz_filial, situacao, data_abertura, 
        cnae_principal, cnaes_secundarios, bairro, cep, uf, municipio_rf,
        razao_social, natureza_juridica, capital_social,
        google_nome, google_categoria, google_endereco, google_website
      FROM ${TABELA_BIGQUERY}
      WHERE uf = '${perfilMercado.uf.toUpperCase()}'
        AND situacao = '02'
        AND ('${perfilMercado.codigo_municipio || "NULL"}' = 'NULL' OR municipio_rf = '${perfilMercado.codigo_municipio}')
        ${filtroCnaeClausula}
      ORDER BY ${ordenacaoEstrategica}
      LIMIT ${limiteSeguro}
    `;

    const [rows] = await bigquery.query({ query: sqlQuery });

    // =========================================================================
    // 🗺️ 3. MAPEAMENTO E ENVIO PARA O FRONTEND
    // =========================================================================
    const leads = rows.map((row: any) => {
      let dataAberturaStr = row.data_abertura;
      if (row.data_abertura && row.data_abertura.value) {
        dataAberturaStr = row.data_abertura.value; // Ajuste para o formato de data do BigQuery
      }

      return {
        cnpj: row.cnpj,
        cnpj_raiz: row.cnpj_raiz,
        matriz_filial: row.matriz_filial,
        situacao: row.situacao,
        data_abertura: dataAberturaStr,
        cnae_principal: row.cnae_principal,
        cnaes_secundarios: row.cnaes_secundarios,
        bairro: row.bairro,
        cep: row.cep,
        uf: row.uf,
        municipio_rf: row.municipio_rf,
        razao_social: row.razao_social || "Razão Social indisponível",
        nome_fantasia: row.google_nome && row.google_nome.trim() !== "" ? row.google_nome : row.razao_social,
        natureza_juridica: row.natureza_juridica,
        capital_social: row.capital_social ? parseFloat(row.capital_social) : 0,
        google_categoria: row.google_categoria,
        google_endereco: row.google_endereco,
        website: row.google_website,
        lat: null,
        lng: null
      };
    });

    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via BigQuery:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}