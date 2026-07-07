import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from 'fs';
import path from 'path';
import duckdb from "duckdb";

export const dynamic = 'force-dynamic';

// 🦆 Inicialização do DuckDB em Memória
const db = new duckdb.Database(':memory:');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

// 🛠️ Correção Crítica para o Ambiente Serverless (Vercel)
db.run(`SET home_directory='/tmp';`);
db.run(`SET extension_directory='/tmp';`);

// Instalação do módulo HTTP/S3
db.run(`INSTALL httpfs;`);
db.run(`LOAD httpfs;`);

// Configuração de credenciais do Cloudflare R2
db.run(`SET s3_endpoint='${accountId}.r2.cloudflarestorage.com';`);
db.run(`SET s3_access_key_id='${accessKey}';`);
db.run(`SET s3_secret_access_key='${secretKey}';`);
db.run(`SET s3_region='auto';`);
db.run(`SET s3_url_style='path';`);

const queryDB = (query: string): Promise<any[]> => {
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

    // =========================================================================
    // 🧠 1. IA EXTRATORA DE CIDADE / CNAE (Com Dedução Inteligente de UF)
    // =========================================================================
    const promptSistema = `
      Você é um analista especialista em prospecção B2B.
      Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      
      ATENÇÃO PARA A LOCALIZAÇÃO (CRÍTICO):
      - Na propriedade "cidade_nome", retorne apenas o nome da cidade, EM LETRAS MAIÚSCULAS e SEM ACENTOS. Exemplo: "SAO PAULO", "CURITIBA". Se não pedir cidade, retorne null.
      - Na propriedade "uf", você DEVE OBRIGATORIAMENTE retornar a sigla do estado com 2 letras (ex: "SP", "PR"). 
      - REGRA DE OURO: Se o usuário citar apenas o nome de uma cidade conhecida, DEDUZA a qual estado ela pertence e preencha a "uf" corretamente. Se não houver indicativo de local de forma alguma, retorne null.

      ATENÇÃO PARA O CNAE:
      - Se o usuário pedir um nicho, retorne os prefixos CNAE correspondentes de 3 a 5 dígitos na propriedade "codigos_cnae".
      - Se for busca aberta/geral, retorne o array VAZIO [].
      
      Retorne ESTRITAMENTE um JSON:
      {
        "atividade": "descrição",
        "cidade_nome": "NOME DA CIDADE",
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
    // 📖 2. DICIONÁRIO TOM LOCAL (Garante match perfeito de Cidade)
    // =========================================================================
    let codigoRealDaReceita = null;
    let nomeCidadeReal = perfilMercado.cidade_nome;

    if (nomeCidadeReal) {
      try {
        const filePath = path.join(process.cwd(), 'tabela_tom.json');
        const tabelaTomBase = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const cidadeSanitizada = nomeCidadeReal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const chaveBusca = `${cidadeSanitizada}-${perfilMercado.uf.toUpperCase()}`;
        
        codigoRealDaReceita = tabelaTomBase[chaveBusca];

        if (!codigoRealDaReceita) {
          console.warn(`[Aviso] Cidade '${cidadeSanitizada}' não encontrada no dicionário local.`);
        }
      } catch (err) {
        console.error("Erro ao ler tabela_tom.json local, prosseguindo com busca estadual ampla", err);
      }
    }

    // =========================================================================
    // 🚀 3. DUCKDB: CONSULTA ESTRATÉGICA NO CLOUDFLARE R2
    // =========================================================================
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

    // Adaptado para o dialeto DuckDB ('regexp_matches' ao invés de 'REGEXP_CONTAINS')
    let ordenacaoEstrategica = temNichoEspecifico 
      ? `CASE WHEN google_nome IS NOT NULL AND google_nome != '' THEN 0 ELSE 1 END, data_abertura ASC`
      : `CASE WHEN natureza_juridica = '213-5' THEN 1 ELSE 0 END ASC,
         CASE WHEN regexp_matches(cnae_principal, '^(46|33|49|50|51|52|77|25|1[0-9]|2[0-9]|3[0-2])') THEN 0 
              WHEN SUBSTR(cnae_principal, 1, 2) = '47' THEN 2 ELSE 1 END ASC,
         data_abertura ASC`;

    const sqlQuery = `
      SELECT 
        cnpj, cnpj_raiz, matriz_filial, situacao, data_abertura, 
        cnae_principal, cnaes_secundarios, bairro, cep, uf, municipio_rf,
        razao_social, natureza_juridica, capital_social,
        google_nome, google_categoria, google_endereco, google_website
      FROM read_parquet('s3://${bucketName}/estabelecimentos_completo.parquet')
      WHERE uf = '${perfilMercado.uf.toUpperCase()}'
        AND situacao = '02'
        AND ('${codigoRealDaReceita || "NULL"}' = 'NULL' OR municipio_rf = '${codigoRealDaReceita}')
        ${filtroCnaeClausula}
      ORDER BY ${ordenacaoEstrategica}
      LIMIT ${limiteSeguro}
    `;

    const rows = await queryDB(sqlQuery);

    const leads = rows.map((row: any) => {
      let dataAberturaStr = row.data_abertura;
      if (row.data_abertura && row.data_abertura.value) {
        dataAberturaStr = row.data_abertura.value; 
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
        capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0,
        google_categoria: row.google_categoria,
        google_endereco: row.google_endereco,
        website: row.google_website,
        lat: null, 
        lng: null, 
        cidadeExtenso: nomeCidadeReal || undefined 
      };
    });

    return NextResponse.json({
      perfilAI: { ...perfilMercado, codigo_municipio: codigoRealDaReceita },
      leads: leads
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção via DuckDB:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}