import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "CPF ou CNPJ é obrigatório" }, { status: 400 });
    }

    // Limpa a pontuação, deixando apenas os números para a busca no CNJ
    const docLimpo = String(documento).replace(/\D/g, "");

    // 🎯 Endpoint Oficial da API Pública do DataJud
    const urlDatajud = "https://api-publica.datajud.cnj.jus.br/api_v1/busca";

    // O DataJud usa ElasticSearch por baixo dos panos, então o payload tem essa estrutura
    const payloadQuery = {
      query: {
        match: {
          "prazos.partes.documento": docLimpo
        }
      },
      size: 50 // Limite de 50 processos para a pré-análise ser rápida
    };

    const response = await fetch(urlDatajud, {
      method: "POST",
      headers: {
        // A chave pública que você conseguiu da documentação do CNJ
        "Authorization": "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payloadQuery)
    });

    if (!response.ok) {
      const errorLog = await response.text();
      console.error("❌ Erro na API do DataJud:", errorLog);
      throw new Error("Falha de comunicação com o Tribunal (CNJ)");
    }

    const data = await response.json();
    
    // O retorno do ElasticSearch é bem sujo (hits.hits._source), vamos limpar isso:
    const processosFormatados = data.hits?.hits?.map((hit: any) => {
      const proc = hit._source;
      return {
        numero: proc.numeroProcesso,
        classe: proc.classe?.nome || "Não informada",
        tribunal: proc.tribunal || "Tribunal Desconhecido",
        dataPublicacao: proc.dataPublicacao || null,
        grau: proc.grau || "1º Grau"
      };
    }) || [];

    return NextResponse.json({ processos: processosFormatados });

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de processos:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}