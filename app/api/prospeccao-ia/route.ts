import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from 'fs';
import path from 'path';
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

// 1. Puxa a string da variável de ambiente da Vercel
const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let credentials: any = {};

if (credentialsEnv) {
  try {
    credentials = JSON.parse(credentialsEnv);
  } catch (err) {
    console.error("Erro ao fazer parse do GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
  }
}

// 2. Inicializa o cliente do BigQuery blindado para produção
const bigquery = new BigQuery({
  projectId: 'credito-489113',
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key, 
  }
});

export async function POST(req: Request) {
  try {
    const { promptUsuario, limite = 200 } = await req.json();
    if (!promptUsuario) return NextResponse.json({ error: "Texto de busca obrigatório." }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const promptSistema = `
      Você é um analista especialista em prospecção B2B. Extraia os critérios do texto.
      cidade_nome: Nome da cidade em MAIÚSCULAS e sem acentos, ou null.
      uf: Sigla de 2 letras do estado. Deduza se a cidade for conhecida.
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
        codigoRealDaReceita = tabelaTomBase[chaveBusca] || null;
      } catch (err) { console.error("Erro ao ler tabela_tom.json:", err); }
    }

    const queryParams: Record<string, any> = {
      estadoAlvo,
      codigoRealDaReceita,
      limiteSeguro: Math.min(limite, 1000)
    };

    let filtroCnaeClausula = "";
    let filtroNegativacaoConsultoria = "";
    const temNichoEspecifico = Array.isArray(perfilMercado.codigos_cnae) && perfilMercado.codigos_cnae.length > 0;

    if (temNichoEspecifico) {
      const cnaesLimpos = perfilMercado.codigos_cnae
        .map((c: any) => String(c).replace(/\D/g, ''))
        .filter((c: string) => c.length >= 2);

      if (cnaesLimpos.length > 0) {
        const cnaeConditions: string[] = [];
        cnaesLimpos.forEach((c: string, index: number) => {
          queryParams[`cnae_prefix_${index}`] = `${c}%`;
          queryParams[`cnae_regex_${index}`] = `(^|[^0-9])${c}`;
          cnaeConditions.push(`(cnae_principal LIKE @cnae_prefix_${index} OR REGEXP_CONTAINS(cnaes_secundarios, @cnae_regex_${index}))`);
        });

        filtroCnaeClausula = `AND (${cnaeConditions.join(' OR ')})`;

        const buscaMinusculo = (perfilMercado.atividade || "").toLowerCase();
        if (buscaMinusculo.includes("industria") || buscaMinusculo.includes("fabrica") || buscaMinusculo.includes("metalurgica")) {
          filtroNegativacaoConsultoria = `
            AND NOT REGEXP_CONTAINS(UPPER(COALESCE(razao_social, '')), r'(CONSULTORIA|ASSESSORIA|SERVICOS ADM|HOLDING|PARTICIPACOES)')
            AND NOT REGEXP_CONTAINS(UPPER(COALESCE(nome_fantasia, '')), r'(CONSULTORIA|ASSESSORIA)')
          `;
        }
      } else {
        return NextResponse.json({ error: "CNAEs inválidos." }, { status: 400 });
      }
    }

    // ⚡ GAMBIARRA SUPREMA: Ordenação penalizando MEIs (CPFs na razão social)
    let ordenacaoEstrategica = temNichoEspecifico 
      ? `CASE WHEN nome_fantasia IS NOT NULL AND nome_fantasia != '' THEN 0 ELSE 1 END, data_abertura ASC`
      : `
         CASE WHEN REGEXP_CONTAINS(razao_social, r'\\d{11}$') THEN 1 ELSE 0 END ASC, -- Empurra MEIs para o fim da lista
         CASE WHEN REGEXP_CONTAINS(COALESCE(cnae_principal, ''), r'^(46|33|49|50|51|52|77|25|1[0-9]|2[0-9]|3[0-2])') THEN 0 
              WHEN SUBSTR(cnae_principal, 1, 2) = '47' THEN 2 ELSE 1 END ASC,
         data_abertura ASC`;

    // ⚡ Query do BigQuery criando a coluna "natureza_juridica" dinamicamente via Regex
    const sqlQuery = `
      SELECT 
        cnpj, cnpj_basico, data_abertura, cnae_principal, cnaes_secundarios, 
        bairro, cep, uf, municipio_rf, razao_social, nome_fantasia, capital_social,
        CASE 
          WHEN REGEXP_CONTAINS(razao_social, r'\\d{11}$') THEN '2135' -- MEI / Empresário Individual
          WHEN REGEXP_CONTAINS(UPPER(razao_social), r'\\bLTDA\\.?$|\\bLIMITADA$') THEN '2062' -- LTDA
          WHEN REGEXP_CONTAINS(UPPER(razao_social), r'\\bS/?A\\.?$|\\bSOCIEDADE ANONIMA$') THEN '2046' -- S.A.
          WHEN REGEXP_CONTAINS(UPPER(razao_social), r'\\bEIRELI$') THEN '2305' -- EIRELI
          WHEN REGEXP_CONTAINS(UPPER(razao_social), r'\\bS/?S\\.?$') THEN '2240' -- Sociedade Simples
          ELSE '0000' -- Outros
        END AS natureza_juridica
      FROM \`credito-489113.dados_receita.empresas_master\`
      WHERE uf = @estadoAlvo
        AND (@codigoRealDaReceita IS NULL OR municipio_rf = @codigoRealDaReceita)
        ${filtroCnaeClausula}
        ${filtroNegativacaoConsultoria}
      ORDER BY ${ordenacaoEstrategica}
      LIMIT @limiteSeguro
    `;

    const [rows] = await bigquery.query({
      query: sqlQuery,
      params: queryParams
    });

    const leads = rows.map((row: any) => ({
      cnpj: row.cnpj,
      cnpj_raiz: row.cnpj_basico,
      matriz_filial: null,
      situacao: "02",
      data_abertura: row.data_abertura?.value || row.data_abertura,
      cnae_principal: row.cnae_principal,
      cnaes_secundarios: row.cnaes_secundarios,
      bairro: row.bairro,
      cep: row.cep,
      uf: row.uf,
      municipio_rf: row.municipio_rf,
      razao_social: row.razao_social || "Razão Social indisponível",
      nome_fantasia: row.nome_fantasia && row.nome_fantasia.trim() !== "" ? row.nome_fantasia : row.razao_social,
      // O front-end agora recebe a natureza jurídica normalmente
      natureza_juridica: row.natureza_juridica, 
      capital_social: row.capital_social ? parseFloat(String(row.capital_social).replace(',', '.')) : 0,
      google_categoria: null, google_endereco: null, website: null, lat: null, lng: null,
      cidadeExtenso: nomeCidadeReal || undefined
    }));

    return NextResponse.json({ perfilAI: { ...perfilMercado, codigo_municipio: codigoRealDaReceita }, leads });
  } catch (error: any) {
    console.error("Erro na busca de leads:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}