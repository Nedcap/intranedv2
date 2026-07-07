import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from 'fs';
import path from 'path';
import duckdb from "duckdb";

export const dynamic = 'force-dynamic';

let cachedDb: duckdb.Database | null = null;
async function getDuckDB() {
  if (cachedDb) return cachedDb;
  return new Promise<duckdb.Database>((resolve, reject) => {
    const db = new duckdb.Database(':memory:');
    const run = (query: string) => new Promise<void>((res, rej) => {
      db.run(query, (err) => err ? rej(err) : res());
    });
    const setupDB = async () => {
      try {
        await run(`SET home_directory='/tmp';`);
        await run(`SET extension_directory='/tmp';`);
        await run(`INSTALL httpfs;`);
        await run(`LOAD httpfs;`);
        await run(`SET s3_endpoint='${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com';`);
        await run(`SET s3_access_key_id='${process.env.R2_ACCESS_KEY_ID}';`);
        await run(`SET s3_secret_access_key='${process.env.R2_SECRET_ACCESS_KEY}';`);
        await run(`SET s3_region='auto';`);
        await run(`SET s3_url_style='path';`);
        cachedDb = db;
        resolve(db);
      } catch (error) { reject(error); }
    };
    setupDB();
  });
}

const queryDB = async (query: string): Promise<any[]> => {
  const db = await getDuckDB();
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
    if (!promptUsuario) return NextResponse.json({ error: "Texto de busca obrigatório." }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const promptSistema = `
      Você é um analista especialista em prospecção B2B. Extraia os critérios do texto.
      cidade_nome: Nome da cidade em MAIÚSCULAS e sem acentos, ou null.
      uf: Sigla de 2 letras do estado. Deduza se a cidade for óbvia.
      codigos_cnae: Array de strings com prefixos numéricos de CNAE.
      Retorne ESTRITAMENTE um JSON:
      {"atividade": "descrição", "cidade_nome": "CIDADE", "uf": "UF", "codigos_cnae": []}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [{ role: "system", content: promptSistema }, { role: "user", content: promptUsuario }],
      response_format: { type: "json_object" }
    });

    const perfilMercado = JSON.parse(completion.choices[0].message.content || "{}");
    if (!perfilMercado.uf) return NextResponse.json({ error: "Não identifiquei o Estado (UF)." }, { status: 400 });

    const estadoAlvo = perfilMercado.uf.toUpperCase();
    let codigoRealDaReceita = null;
    let nomeCidadeReal = perfilMercado.cidade_nome;

    if (nomeCidadeReal) {
      try {
        const filePath = path.join(process.cwd(), 'tabela_tom.json');
        const tabelaTomBase = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cidadeSanitizada = nomeCidadeReal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const chaveBusca = `${cidadeSanitizada}-${estadoAlvo}`;
        codigoRealDaReceita = tabelaTomBase[chaveBusca];
      } catch (err) { console.error(err); }
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    let filtroCnaeClausula = "";
    let filtroNegativacaoConsultoria = "";
    const temNichoEspecifico = Array.isArray(perfilMercado.codigos_cnae) && perfilMercado.codigos_cnae.length > 0;

    if (temNichoEspecifico) {
      const cnaesLimpos = perfilMercado.codigos_cnae.map((c: any) => String(c).replace(/\D/g, '')).filter((c: string) => c.length >= 2);
      if (cnaesLimpos.length > 0) {
        const cnaesPrecisos = cnaesLimpos.map((c: string) => `(cnae_principal LIKE '${c}%' OR regexp_matches(cnaes_secundarios, '(^|[^0-9])' || '${c}'))`).join(' OR ');
        filtroCnaeClausula = `AND (${cnaesPrecisos})`;

        const buscaMinusculo = (perfilMercado.atividade || "").toLowerCase();
        if (buscaMinusculo.includes("industria") || buscaMinusculo.includes("fabrica") || buscaMinusculo.includes("metalurgica")) {
          filtroNegativacaoConsultoria = `
            AND regexp_matches(UPPER(COALESCE(razao_social, '')), '(CONSULTORIA|ASSESSORIA|SERVICOS ADM|HOLDING|PARTICIPACOES)') = false
            AND regexp_matches(UPPER(COALESCE(nome_fantasia, '')), '(CONSULTORIA|ASSESSORIA)') = false
          `;
        }
      } else {
        return NextResponse.json({ error: "CNAEs inválidos." }, { status: 400 });
      }
    }

    const limiteSeguro = Math.min(limite, 1000);

    let ordenacaoEstrategica = temNichoEspecifico 
      ? `CASE WHEN nome_fantasia IS NOT NULL AND nome_fantasia != '' THEN 0 ELSE 1 END, data_abertura ASC`
      : `CASE WHEN natureza_juridica = '2135' THEN 1 ELSE 0 END ASC,
         CASE WHEN regexp_matches(COALESCE(cnae_principal, ''), '^(46|33|49|50|51|52|77|25|1[0-9]|2[0-9]|3[0-2])') THEN 0 
              WHEN SUBSTR(cnae_principal, 1, 2) = '47' THEN 2 ELSE 1 END ASC,
         data_abertura ASC`;

    // 🔥 OTIMIZAÇÃO HISTÓRICA: O DuckDB bate direto no arquivo flat sem JOIN nenhum na nuvem!
    const sqlQuery = `
      SELECT 
        cnpj, '02' AS situacao, data_abertura, cnae_principal, cnaes_secundarios, 
        bairro, cep, uf, municipio_rf, razao_social, nome_fantasia, natureza_juridica, capital_social
      FROM read_parquet('s3://${bucketName}/dados_convertidos_parquet/receita_federal_master.parquet')
      WHERE uf = '${estadoAlvo}'
        AND ('${codigoRealDaReceita || "NULL"}' = 'NULL' OR municipio_rf = '${codigoRealDaReceita}')
        ${filtroCnaeClausula}
        ${filtroNegativacaoConsultoria}
      ORDER BY ${ordenacaoEstrategica}
      LIMIT ${limiteSeguro}
    `;

    const rows = await queryDB(sqlQuery);
    const leads = rows.map((row: any) => ({
      cnpj: row.cnpj,
      cnpj_raiz: row.cnpj_basico,
      matriz_filial: null,
      situacao: "02",
      data_abertura: row.data_abertura,
      cnae_principal: row.cnae_principal,
      cnaes_secundarios: row.cnaes_secundarios,
      bairro: row.bairro,
      cep: row.cep,
      uf: row.uf,
      municipio_rf: row.municipio_rf,
      razao_social: row.razao_social || "Razão Social indisponível",
      nome_fantasia: row.nome_fantasia && row.nome_fantasia.trim() !== "" ? row.nome_fantasia : row.razao_social,
      natureza_juridica: row.natureza_juridica,
      capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0,
      google_categoria: null, google_endereco: null, website: null, lat: null, lng: null,
      cidadeExtenso: nomeCidadeReal || undefined
    }));

    return NextResponse.json({ perfilAI: { ...perfilMercado, codigo_municipio: codigoRealDaReceita }, leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}