import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from 'fs';
import path from 'path';
import duckdb from "duckdb";

export const dynamic = 'force-dynamic';

// =========================================================================
// 🦆 GERENCIADOR DE CONEXÃO DUCKDB (SINGLETON OTIMIZADO PARA VERCEL)
// =========================================================================
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
        console.log("[DuckDB - Prospecção] Configurando ambiente...");
        await run(`SET home_directory='/tmp';`);
        await run(`SET extension_directory='/tmp';`);
        
        await run(`INSTALL httpfs;`);
        await run(`LOAD httpfs;`);

        console.log("[DuckDB - Prospecção] Autenticando com Cloudflare R2...");
        await run(`SET s3_endpoint='${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com';`);
        await run(`SET s3_access_key_id='${process.env.R2_ACCESS_KEY_ID}';`);
        await run(`SET s3_secret_access_key='${process.env.R2_SECRET_ACCESS_KEY}';`);
        await run(`SET s3_region='auto';`);
        await run(`SET s3_url_style='path';`);
        
        cachedDb = db;
        resolve(db);
      } catch (error) {
        reject(error);
      }
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

    if (!promptUsuario) {
      return NextResponse.json({ error: "O texto de busca é obrigatório." }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // =========================================================================
    // 🧠 1. IA EXTRATORA DE CIDADE / CNAE
    // =========================================================================
    const promptSistema = `
      Você é um analista especialista em prospecção B2B.
      Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      
      ATENÇÃO PARA A CIDADE: Na propriedade "cidade_nome", retorne apenas o nome da cidade solicitada, EM LETRAS MAIÚSCULAS e SEM ACENTOS. Exemplo: "SAO PAULO", "CURITIBA", "MARINGA". Se não pedir cidade específica, retorne null.
      (NÃO INVENTE CÓDIGOS TOM. Apenas retorne o nome limpo).

      ATENÇÃO PARA A LOCALIZAÇÃO:
      - Na propriedade "uf", você DEVE OBRIGATORIAMENTE retornar a sigla do estado com 2 letras (ex: "SP", "PR"). 
      - REGRA DE OURO: Se o usuário citar apenas o nome de uma cidade conhecida, DEDUZA a qual estado ela pertence e preencha a "uf" corretamente. Se não houver indicativo de local de forma alguma, retorne null.

      ATENÇÃO PARA O CNAE:
      - Se o usuário pedir um nicho, retorne um array APENAS COM NÚMEROS (prefixos CNAE de 2 a 5 dígitos) na propriedade "codigos_cnae". 
      - Exemplo: Para metalúrgicas use ["24", "25"], para plástico use ["222"], para TI use ["620"].
      - Se for busca aberta/geral (sem nicho específico), retorne o array VAZIO [].
      
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
    // 📖 2. DICIONÁRIO TOM LOCAL (Garante match perfeito)
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
    // 🚀 3. DUCKDB: CONSULTA BLINDADA (Lendo Data Lake no R2)
    // =========================================================================
    const bucketName = process.env.R2_BUCKET_NAME;

    let filtroCnaeClausula = "";
    let filtroNegativacaoConsultoria = "";
    const temNichoEspecifico = Array.isArray(perfilMercado.codigos_cnae) && perfilMercado.codigos_cnae.length > 0;

    if (temNichoEspecifico) {
      const cnaesLimpos = perfilMercado.codigos_cnae
        .map((c: any) => String(c).replace(/\D/g, ''))
        .filter((c: string) => c.length >= 2);

      if (cnaesLimpos.length > 0) {
        const cnaesPrecisos = cnaesLimpos.map((c: string) => 
          `(e.cnae_fiscal_principal LIKE '${c}%' OR regexp_matches(COALESCE(e.cnae_fiscal_secundaria, ''), '${c}'))`
        ).join(' OR ');
        
        filtroCnaeClausula = `AND (${cnaesPrecisos})`;

        const buscaMinusculo = (perfilMercado.atividade || "").toLowerCase();
        if (buscaMinusculo.includes("industria") || buscaMinusculo.includes("fabrica") || buscaMinusculo.includes("metalurgica")) {
          // Ajustado dialeto de negação booleana para DuckDB
          filtroNegativacaoConsultoria = `
            AND regexp_matches(UPPER(COALESCE(emp.razao_social, '')), '(CONSULTORIA|ASSESSORIA|SERVICOS ADM|HOLDING|PARTICIPACOES)') = false
            AND regexp_matches(UPPER(COALESCE(e.nome_fantasia, '')), '(CONSULTORIA|ASSESSORIA)') = false
          `;
        }
      } else {
        return NextResponse.json({ error: "Erro na IA: Os códigos CNAE gerados foram inválidos. Tente detalhar mais o setor." }, { status: 400 });
      }
    }

    const limiteSeguro = Math.min(limite, 1000);

    let ordenacaoEstrategica = temNichoEspecifico 
      ? `CASE WHEN e.nome_fantasia IS NOT NULL AND e.nome_fantasia != '' THEN 0 ELSE 1 END, e.data_inicio_atividade ASC`
      : `CASE WHEN emp.natureza_juridica = '2135' THEN 1 ELSE 0 END ASC,
         CASE WHEN regexp_matches(COALESCE(e.cnae_fiscal_principal, ''), '^(46|33|49|50|51|52|77|25|1[0-9]|2[0-9]|3[0-2])') THEN 0 
              WHEN SUBSTR(e.cnae_fiscal_principal, 1, 2) = '47' THEN 2 ELSE 1 END ASC,
         e.data_inicio_atividade ASC`;

    const sqlQuery = `
      SELECT 
        e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv AS cnpj, 
        e.identificador_matriz_filial AS matriz_filial, 
        e.situacao_cadastral AS situacao, 
        e.data_inicio_atividade AS data_abertura, 
        e.cnae_fiscal_principal AS cnae_principal, 
        e.cnae_fiscal_secundaria AS cnaes_secundarios, 
        e.bairro, e.cep, e.uf, e.municipio AS municipio_rf,
        emp.razao_social, 
        emp.natureza_juridica, 
        emp.capital_social,
        e.nome_fantasia AS google_nome
      FROM read_parquet('s3://${bucketName}/dados_convertidos_parquet/Estabelecimentos/**/*.parquet', hive_partitioning=1) e
      LEFT JOIN read_parquet('s3://${bucketName}/dados_convertidos_parquet/Empresas/**/*.parquet') emp
        ON e.cnpj_basico = emp.cnpj_basico
      WHERE e.uf = '${perfilMercado.uf.toUpperCase()}'
        AND e.situacao_cadastral = '02'
        AND ('${codigoRealDaReceita || "NULL"}' = 'NULL' OR e.municipio = '${codigoRealDaReceita}')
        ${filtroCnaeClausula}
        ${filtroNegativacaoConsultoria}
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
        cnpj_raiz: row.cnpj ? String(row.cnpj).substring(0, 8) : "",
        matriz_filial: row.matriz_filial,
        situacao: row.situacao,
        data_abertura: dataAberturaStr,
        cnae_principal: row.cnae_principal,
        cnaes_secundarios: row.cnaes_secundarios,
        bairro: row.bairro,
        cep: row.cep,
        uf: row.uf ? String(row.uf).toUpperCase() : "",
        municipio_rf: row.municipio_rf,
        razao_social: row.razao_social || "Razão Social indisponível",
        nome_fantasia: row.google_nome && row.google_nome.trim() !== "" ? row.google_nome : row.razao_social,
        natureza_juridica: row.natureza_juridica,
        capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0,
        google_categoria: null,
        google_endereco: null,
        website: null,
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
    console.error("Erro na rota de prospecção via DuckDB (R2):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}