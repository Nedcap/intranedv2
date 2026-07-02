import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { neon } from "@neondatabase/serverless";

// Função para remover acentos e padronizar textos (Idêntica ao motor original do bot)
function normalizarTexto(texto: string): string {
  if (!texto) return "";
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { promptUsuario, limite = 200 } = await req.json();

    if (!promptUsuario) {
      return NextResponse.json({ error: "O texto de busca é obrigatório." }, { status: 400 });
    }

    // 1. Inicializa o client do Neon usando a variável de ambiente segura (.env.local)
    if (!process.env.NEON_DATABASE_URL) {
      throw new Error("A variável NEON_DATABASE_URL não está configurada no seu .env.local");
    }
    const sqlNeon = neon(process.env.NEON_DATABASE_URL);
    
    // 2. Inicializa a OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 3. Chamar a IA para estruturar os filtros a partir do prompt solto do usuário
    const promptSistema = `
      Você é um analista especialista em prospecção B2B. Analise o texto enviado pelo usuário e extraia os critérios estruturados.
      Retorne ESTRITAMENTE um objeto JSON válido:
      {
        "atividade": "descrição curta do segmento",
        "cidade": "Nome da cidade por extenso ou null se não citada",
        "uf": "Duas letras maiúsculas do Estado (ex: SP, PR)",
        "familias_cnae": ["array de strings com os 2 primeiros digitos das familias CNAE alvo"],
        "termos_fortes": ["palavras-chave específicas do nicho"],
        "termos_fracos": ["palavras genéricas"]
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: promptUsuario },
      ],
      response_format: { type: "json_object" }
    });

    const perfilMercado = JSON.parse(completion.choices[0].message.content || "{}");

    if (!perfilMercado.uf) {
      return NextResponse.json({ error: "Não consegui identificar o Estado (UF) no seu pedido. Por favor, especifique a região (ex: SP, PR)." }, { status: 400 });
    }

    // 4. Montar a cláusula WHERE dinâmica para buscar direto no Neon (PostgreSQL)
    let queryFiltros = "WHERE e.uf = $1 AND e.situacao = '02'";
    const parametrosQuery: any[] = [perfilMercado.uf.toUpperCase().trim()];
    let contadorParametros = 2;

    if (perfilMercado.cidade) {
      queryFiltros += ` AND m.nome ILIKE $${contadorParametros}`;
      parametrosQuery.push(perfilMercado.cidade.trim());
      contadorParametros++;
    }

    if (perfilMercado.familias_cnae && perfilMercado.familias_cnae.length > 0) {
      const placeholders = perfilMercado.familias_cnae.map((_: any, idx: number) => `$${contadorParametros + idx}`).join(",");
      queryFiltros += ` AND SUBSTRING(e.cnae_principal FROM 1 FOR 2) IN (${placeholders})`;
      parametrosQuery.push(...perfilMercado.familias_cnae);
    }

    // Executa a busca bruta indexada no Neon de São Paulo (Limitado a 5000 para refinar o Score em RAM)
    const queryCompleta = `
      SELECT
        e.cnpj,
        em.razao_social,
        e.bairro,
        e.situacao,
        m.nome AS cidade_nome,
        e.uf,
        e.cnae_principal,
        cp.descricao AS cnae_descricao,
        e.cnaes_secundarios
      FROM estabelecimentos e
      JOIN empresas em ON em.cnpj_raiz = e.cnpj_raiz
      JOIN municipios_rf m ON m.codigo_rf = e.municipio_rf
      LEFT JOIN cnaes cp ON cp.codigo = e.cnae_principal
      ${queryFiltros}
      LIMIT 5000
    `;

    const rows = await sqlNeon(queryCompleta, parametrosQuery);

    // 5. Motor de Score e Relevância em Memória RAM (Idêntico ao bot original)
    const SCORE_MINIMO = 4;
    const leadsMapeados: any[] = [];
    
    const tFortes = (perfilMercado.termos_fortes || []).map((t: string) => normalizarTexto(t));
    const tFracos = (perfilMercado.termos_fracos || []).map((t: string) => normalizarTexto(t));
    const famCnaes = perfilMercado.familias_cnae || [];

    for (const row of rows) {
      let score = 0;
      const cnaePrinc = row.cnae_principal || "";
      const cnaesSec = row.cnaes_secundarios || "";
      const famPrincipal = cnaePrinc.substring(0, 2);

      if (famCnaes.includes(famPrincipal)) score += 3;

      for (const fam of famCnaes) {
        if (cnaesSec.includes(fam)) {
          score += 2;
          break;
        }
      }

      const textoEmpresaNorm = normalizarTexto(`${row.razao_social} ${row.cnae_descricao} ${cnaesSec}`);

      tFortes.forEach((t: string) => {
        if (textoEmpresaNorm.includes(t)) score += 2;
      });

      tFracos.forEach((t: string) => {
        if (textoEmpresaNorm.includes(t)) score += 1;
      });

      if (score >= SCORE_MINIMO) {
        leadsMapeados.push({
          cnpj: row.cnpj,
          razaoSocial: row.razao_social,
          cnae_principal: row.cnae_principal,
          ramo: row.cnae_descricao || 'N/A',
          bairro: row.bairro || 'N/A',
          cidade: row.cidade_nome,
          uf: row.uf,
          score: score
        });
      }
    }

    // Ordenação de relevância decrescente e corte no limite da tela
    const resultadoFinal = leadsMapeados
      .sort((a, b) => b.score - a.score)
      .slice(0, limite);

    return NextResponse.json({
      perfilAI: perfilMercado,
      leads: resultadoFinal
    });

  } catch (error: any) {
    console.error("Erro na rota de prospecção com IA via Neon:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}