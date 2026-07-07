import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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
        console.log("[DuckDB] Configurando pastas temporárias do Vercel e HTTPFS...");
        await run(`SET home_directory='/tmp';`);
        await run(`SET extension_directory='/tmp';`);
        
        await run(`INSTALL httpfs;`);
        await run(`LOAD httpfs;`);

        console.log("[DuckDB] Autenticando com Cloudflare R2...");
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
    const { cnpj } = await req.json();

    if (!cnpj) {
      return NextResponse.json({ error: "O número do CNPJ é obrigatório." }, { status: 400 });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");
    
    if (cnpjLimpo.length !== 14) {
      return NextResponse.json({ error: "O CNPJ deve conter exatamente 14 dígitos." }, { status: 400 });
    }

    const cnpjBasico = cnpjLimpo.substring(0, 8);
    const cnpjOrdem = cnpjLimpo.substring(8, 12);
    const cnpjDv = cnpjLimpo.substring(12, 14);

    const bucketName = process.env.R2_BUCKET_NAME;

    // =========================================================================
    // ⚡ QUERY DIRECIONADA NO DATA LAKE (Tratamento de CONCAT contra valores NULL)
    // =========================================================================
    const sqlQuery = `
      SELECT 
        CONCAT(
          COALESCE(e.cnpj_basico, ''), 
          COALESCE(e.cnpj_ordem, ''), 
          COALESCE(e.cnpj_dv, '')
        ) AS cnpj, 
        emp.razao_social, 
        e.uf, 
        e.municipio AS municipio_rf, 
        emp.capital_social
      FROM read_parquet('s3://${bucketName}/dados_convertidos_parquet/Estabelecimentos/**/*.parquet', hive_partitioning=1) e
      LEFT JOIN read_parquet('s3://${bucketName}/dados_convertidos_parquet/Empresas/**/*.parquet') emp
        ON e.cnpj_basico = emp.cnpj_basico
      WHERE e.cnpj_basico = '${cnpjBasico}' 
        AND e.cnpj_ordem = '${cnpjOrdem}' 
        AND e.cnpj_dv = '${cnpjDv}'
      LIMIT 1
    `;

    const rows = await queryDB(sqlQuery);

    if (rows.length === 0) {
      return NextResponse.json({ found: false, message: "Empresa não localizada na base da Receita." });
    }

    const row = rows[0];
    let nomeCidadeReal = "Não localizada";

    // =========================================================================
    // 📖 PLUG DIRETO DA TABELA TOM LOCAL
    // =========================================================================
    try {
      const filePath = path.join(process.cwd(), 'tabela_tom.json');
      if (fs.existsSync(filePath)) {
        const tabelaTomBase = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const codigoBuscado = String(row.municipio_rf).trim();

        const chaveEncontrada = Object.keys(tabelaTomBase).find(
          (key) => String(tabelaTomBase[key]).trim() === codigoBuscado
        );

        if (chaveEncontrada) {
          nomeCidadeReal = chaveEncontrada.split("-")[0].trim();
        } else {
          console.warn(`[Aviso] Código de município '${codigoBuscado}' não encontrado no dicionário local.`);
          nomeCidadeReal = `CÓDIGO ${codigoBuscado}`;
        }
      }
    } catch (err) {
      console.error("Erro ao ler ou processar tabela_tom.json local:", err);
      nomeCidadeReal = `CÓDIGO ${row.municipio_rf}`;
    }

    return NextResponse.json({
      found: true,
      empresa: {
        cnpj: row.cnpj || cnpjLimpo, // Fallback de segurança para o input do usuário
        razao_social: row.razao_social || "Razão Social indisponível",
        uf: row.uf ? String(row.uf).toUpperCase() : "NI",
        cidadeExtenso: nomeCidadeReal,
        capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0
      }
    });

  } catch (error: any) {
    console.error("Erro na rota de busca do DuckDB (R2):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}