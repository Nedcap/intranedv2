import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const obterClienteBigQuery = () => {
  const jsonCredenciais = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!jsonCredenciais) throw new Error("A variável GOOGLE_APPLICATION_CREDENTIALS_JSON não está configurada.");
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
    throw new Error("Falha ao processar o JSON das credenciais: " + err.message);
  }
};

export async function POST(req: Request) {
  try {
    const { cnpj } = await req.json();

    if (!cnpj) {
      return NextResponse.json({ error: "O número do CNPJ é obrigatório." }, { status: 400 });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    const bigquery = obterClienteBigQuery();
    const TABELA_BIGQUERY = "`credito-489113.banco_receita_us.estabelecimentos_otimizado`";

    const sqlQuery = `
      SELECT 
        cnpj, razao_social, uf, municipio_rf, capital_social
      FROM ${TABELA_BIGQUERY}
      WHERE cnpj = '${cnpjLimpo}'
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query: sqlQuery });

    if (rows.length === 0) {
      return NextResponse.json({ found: false, message: "Empresa não localizada na base da Receita." });
    }

    const row = rows[0];
    let nomeCidadeReal = "Não localizada";

    // =========================================================================
    // 📖 PLUG DIRETO DA TABELA TOM LOCAL (Dicionário de Código -> Nome Extenso)
    // =========================================================================
    try {
      const filePath = path.join(process.cwd(), 'tabela_tom.json');
      if (fs.existsSync(filePath)) {
        const tabelaTomBase = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const codigoBuscado = String(row.municipio_rf).trim();

        // Inverte o dicionário para achar a chave (NOME-UF) pelo valor (CÓDIGO TOM)
        const chaveEncontrada = Object.keys(tabelaTomBase).find(
          (key) => String(tabelaTomBase[key]).trim() === codigoBuscado
        );

        if (chaveEncontrada) {
          // Remove a sigla do estado final para pegar só o nome limpo (Ex: "ABADIANIA-GO" -> "ABADIANIA")
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
        cnpj: row.cnpj,
        razao_social: row.razao_social || "Razão Social indisponível",
        uf: row.uf ? row.uf.toUpperCase() : "PR",
        cidadeExtenso: nomeCidadeReal, // Envia o nome traduzido bonitinho via JSON local
        capital_social: row.capital_social ? parseFloat(row.capital_social) : 0
      }
    });

  } catch (error: any) {
    console.error("Erro na rota de busca direta de CNPJ:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}