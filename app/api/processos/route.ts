import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    
    // ⚠️ Chave da API Pública do CNJ (DataJud)
    // Você precisa gerar essa chave no portal do CNJ e adicionar no Vercel
    const cnjApiKey = process.env.CNJ_API_KEY; 

    if (!cnjApiKey) {
      return NextResponse.json({ error: "Chave do CNJ ausente nas variáveis de ambiente." }, { status: 500 });
    }

    // 🎯 Endpoint oficial do DataJud (CNJ)
    const urlCNJ = `https://api-publica.datajud.cnj.jus.br/api_publica_ws/v1/processos/_search`;

    // O CNJ usa ElasticSearch. Aqui fazemos a busca por CPF/CNPJ
    const bodyQuery = {
      "query": {
        "match": {
          "pessoa.numeroDocumentoPrincipal": docLimpo
        }
      },
      "size": 50 // Limitamos a 50 processos para a pré-análise não demorar muito
    };

    const response = await fetch(urlCNJ, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `APIKey ${cnjApiKey}` // Padrão de autenticação do CNJ
      },
      body: JSON.stringify(bodyQuery)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Erro na API do CNJ:", errText);
      throw new Error("Falha ao consultar a base pública do DataJud.");
    }

    const json = await response.json();

    // 🧹 Mapeamento dos dados do CNJ para o formato exato que seu Frontend espera
    const hits = json.hits?.hits || [];
    
    const processosFormatados = hits.map((hit: any) => {
      const proc = hit._source;
      return {
        numero: proc.numeroProcesso || "Sem Número",
        // A classe processual no CNJ geralmente vem dentro de um objeto
        classe: proc.classe?.nome || proc.classeProcessual || "Classe Não Informada",
        tribunal: proc.siglaTribunal || proc.tribunal || "N/A",
      };
    });

    // Retorna no formato { processos: [...] } que o page.tsx está esperando
    return NextResponse.json({ processos: processosFormatados });

  } catch (err: any) {
    console.error("💥 Erro crítico no motor de processos:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}