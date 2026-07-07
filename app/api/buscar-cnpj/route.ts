import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

// Inicializa o cliente do BigQuery.
// Ele vai puxar automaticamente o ID do projeto e as credenciais das variáveis de ambiente.
const bigquery = new BigQuery({
  projectId: 'credito-489113',
  // Se for rodar local, descomente a linha abaixo e aponte para o seu JSON de credenciais:
  // keyFilename: path.join(process.cwd(), 'credentials.json'), 
});

export async function POST(req: Request) {
  try {
    const { cnpj } = await req.json();
    if (!cnpj) return NextResponse.json({ error: "CNPJ obrigatório." }, { status: 400 });

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // ⚡ Aponta direto pra tabela nativa do BigQuery usando parâmetros de segurança (@cnpj)
    const sqlQuery = `
      SELECT cnpj, razao_social, uf, municipio_rf, capital_social
      FROM \`credito-489113.dados_receita.empresas_master\`
      WHERE cnpj = @cnpj
      LIMIT 1
    `;

    const options = {
      query: sqlQuery,
      // Passando o parâmetro limpo para evitar SQL Injection
      params: { cnpj: cnpjLimpo }, 
    };

    // Roda a query no BigQuery
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

    return NextResponse.json({
      found: true,
      empresa: {
        cnpj: row.cnpj,
        razao_social: row.razao_social || "Razão Social indisponível",
        uf: row.uf ? String(row.uf).toUpperCase() : "NI",
        cidadeExtenso: nomeCidadeReal,
        capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0
      }
    });
  } catch (error: any) {
    console.error("Erro no servidor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}