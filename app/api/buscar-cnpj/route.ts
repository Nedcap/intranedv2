import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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
    const { cnpj } = await req.json();

    if (!cnpj) {
      return NextResponse.json({ error: "O número do CNPJ é obrigatório." }, { status: 400 });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // ⚡ Query direta e ultra direcionada no Parquet do R2
    const sqlQuery = `
      SELECT 
        cnpj, razao_social, uf, municipio_rf, capital_social
      FROM read_parquet('s3://${bucketName}/estabelecimentos_completo.parquet')
      WHERE cnpj = '${cnpjLimpo}'
      LIMIT 1
    `;

    const rows = await queryDB(sqlQuery);

    if (rows.length === 0) {
      return NextResponse.json({ found: false, message: "Empresa não localizada na base da Receita." });
    }

    const row = rows[0];
    let nomeCidadeReal = "Não localizada";

    // 📖 Dicionário de Municípios Local (Tabela TOM)
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
          nomeCidadeReal = `CÓDIGO ${codigoBuscado}`;
        }
      }
    } catch (err) {
      console.error("Erro ao ler tabela_tom.json local:", err);
      nomeCidadeReal = `CÓDIGO ${row.municipio_rf}`;
    }

    return NextResponse.json({
      found: true,
      empresa: {
        cnpj: row.cnpj,
        razao_social: row.razao_social || "Razão Social indisponível",
        uf: row.uf ? row.uf.toUpperCase() : "PR",
        cidadeExtenso: nomeCidadeReal,
        capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0
      }
    });

  } catch (error: any) {
    console.error("Erro na rota de busca do R2:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}