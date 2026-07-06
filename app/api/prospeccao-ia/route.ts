// C:\Users\Alyson\intranet-webv2\app\api\prospeccao-ia\route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import duckdb from "duckdb";

// Inicializa o motor do DuckDB em memória de forma estática para máxima performance
const db = new duckdb.Database(":memory:");

// Função auxiliar para rodar queries no DuckDB usando Promises (Async/Await)
const rodarQuery = (query: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
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
    // ☁️ CONFIGURAÇÃO DA URL DO CLOUDFLARE R2
    // =========================================================================
    // TODO: Assim que o upload terminar no Cloudflare, ative a URL pública ou domínio personalizado do bucket
    // e cole o link direto para o seu arquivo .parquet aqui embaixo:
    const URL_PARQUET_R2 = "https://pub-SUA-URL-DO-R2.r2.dev/estabelecimentos_completo.parquet";

    // =========================================================================
    // 🧠 CONSTRUÇÃO DA QUERY COM INTELIGÊNCIA DE PULVERIZAÇÃO NO DUCKDB
    // =========================================================================
    let filtroCnaeClausula = "";
    const temNichoEspecifico = perfilMercado.codigos_cnae && perfilMercado.codigos_cnae.length > 0;

    if (temNichoEspecifico) {
      // Limpa e garante strings limpas para os CNAEs
      const cnaesLimpos = perfilMercado.codigos_cnae
        .map((c: string) => c.replace(/\D/g, ''))
        .filter((c: string) => c.length >= 3);

      if (cnaesLimpos.length > 0) {
        const cnaesPrecisos = cnaesLimpos.map((c: string) => `cnae_principal LIKE '${c}%'`).join(' OR ');
        filtroCnaeClausula = `AND (${cnaesPrecisos})`;
      }
    }

    const limiteSeguro = Math.min(limite, 1000);

    // Inteligência de Ordenação Condicional (A mesma do BigQuery, adaptada perfeitamente para DuckDB)
    let ordenacaoEstrategica = temNichoEspecifico 
      ? `CASE WHEN google_nome IS NOT NULL AND google_nome != '' THEN 0 ELSE 1 END, data_abertura ASC`
      : `CASE WHEN natureza_juridica = '213-5' THEN 1 ELSE 0 END ASC,
         CASE WHEN REGEXP_MATCHES(cnae_principal, '^(46|33|49|50|51|52|77|25|1[0-9]|2[0-9]|3[0-2])') THEN 0 
              WHEN SUBSTR(cnae_principal, 1, 2) = '47' THEN 2 ELSE 1 END ASC,
         data_abertura ASC`;

    // A mágica: a função read_parquet do DuckDB lê os blocos HTTP sob demanda direto do seu Cloudflare R2!
    const sqlQuery = `
      SELECT 
        cnpj, cnpj_raiz, matriz_filial, situacao, data_abertura, 
        cnae_principal, cnaes_secundarios, bairro, cep, uf, municipio_rf,
        razao_social, natureza_juridica, capital_social,
        google_nome, google_categoria, google_endereco, google_website
      FROM read_parquet('${URL_PARQUET_R2}')
      WHERE uf = '${perfilMercado.uf.toUpperCase()}'
        AND situacao = '02'
        AND ('${perfilMercado.codigo_municipio || "NULL"}' = 'NULL' OR municipio_rf = '${perfilMercado.codigo_municipio}')
        ${filtroCnaeClausula}
      ORDER BY ${ordenacaoEstrategica}
      LIMIT ${limiteSeguro}
    `;

    // Executa a consulta no motor colunar ultra-rápido do DuckDB
    const rows = await rodarQuery(sqlQuery);

    // =========================================================================
    // 🗺️ MAPEAMENTO DOS RESULTADOS PARA O FRONTEND
    // =========================================================================
    const leads = rows.map((row: any) => {
      // Garante a conversão correta de datas caso o DuckDB retorne como objeto Date
      const dataAberturaStr = row.data_abertura instanceof Date 
        ? row.data_abertura.toISOString().split('T')[0] 
        : row.data_abertura;

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
    console.error("Erro crítico na rota de prospecção via DuckDB/Parquet:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}