import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let credentials: any = {};

if (credentialsEnv) {
  try {
    credentials = JSON.parse(credentialsEnv);
  } catch (err) {
    console.error("Erro ao fazer parse do GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  }
}

const bigquery = new BigQuery({
  projectId: 'credito-489113',
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key, 
  }
});

export async function POST(req: Request) {
  try {
    const { cnpj } = await req.json();
    if (!cnpj) return NextResponse.json({ error: "CNPJ obrigatório." }, { status: 400 });

    const cnpjLimpo = String(cnpj).replace(/\D/g, "");

    // ⚡ QUERY TURBINADA FIDC: Trazendo toda a inteligência que consolidamos no novo banco
    const sqlQuery = `
      SELECT 
        cnpj, 
        razao_social, 
        uf, 
        municipio_rf, 
        capital_social,
        natureza_juridica,
        cnae_principal,
        situacao,
        data_abertura,
        bairro,
        cep,
        opcao_pelo_simples,
        opcao_mei
      FROM \`credito-489113.dados_receita.empresas_master\`
      WHERE cnpj = @cnpj
      LIMIT 1
    `;

    const options = {
      query: sqlQuery,
      params: { cnpj: cnpjLimpo }, 
    };

    const [rows] = await bigquery.query(options);

    if (rows.length === 0) {
      return NextResponse.json({ found: false, message: "Empresa não localizada." });
    }

    const row = rows[0];
    let nomeCidadeReal = "Não localizada";

    // 🗺️ Mantive o seu mapeamento local da tabela_tom intacto!
    try {
      const filePath = path.join(process.cwd(), 'tabela_tom.json');
      if (fs.existsSync(filePath)) {
        const tabelaTomBase = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const codigoBuscado = String(row.municipio_rf).trim();
        const chaveEncontrada = Object.keys(tabelaTomBase).find(
          key => String(tabelaTomBase[key]).trim() === codigoBuscado
        );
        if (chaveEncontrada) nomeCidadeReal = chaveEncontrada.split("-")[0].trim();
      }
    } catch (err) {
      console.error("Erro ao ler tabela_tom.json:", err);
    }

    // Retorna o perfil completo de crédito da empresa
    return NextResponse.json({
      found: true,
      empresa: {
        cnpj: row.cnpj,
        razao_social: row.razao_social || "Razão Social indisponível",
        uf: row.uf ? String(row.uf).toUpperCase() : "NI",
        cidadeExtenso: nomeCidadeReal,
        bairro: row.bairro || "NI",
        cep: row.cep || "NI",
        capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0,
        situacao_cadastral: row.situacao || "NI",
        data_abertura: row.data_abertura || "NI",
        cnae: row.cnae_principal || "NI",
        natureza_juridica: row.natureza_juridica || "NI",
        simples_nacional: row.opcao_pelo_simples === 'S',
        mei: row.opcao_mei === 'S'
      }
    });
  } catch (error: any) {
    console.error("Erro no servidor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}