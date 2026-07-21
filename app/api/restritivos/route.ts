import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    
    const rawApiKey = process.env.CREDITHUB_API_KEY; 
    const apiKey = rawApiKey ? rawApiKey.trim() : null;

    if (!apiKey) {
      throw new Error("Chave do CreditHub não localizada no process.env do servidor.");
    }

    const apiKeyTratada = encodeURIComponent(apiKey);
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKeyTratada}/${docLimpo}?serasa=true`;

    console.log("🔗 Disparando consulta estruturada para o CreditHub...");

    const response = await fetch(urlCreditHub, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store" 
    });

    const textData = await response.text();

    if (textData.trim().startsWith("<")) {
      const match = textData.match(/<exception[^>]*>(.*?)<\/exception>/);
      const erroReal = match ? match[1] : "Erro de autenticação/parâmetros no CreditHub.";
      console.error("❌ Resposta de Erro XML do CreditHub:", textData);
      
      return NextResponse.json({ 
        error: "Erro de Autenticação", 
        details: `CreditHub respondeu: "${erroReal}"` 
      }, { status: 400 });
    }

    const json = JSON.parse(textData);

    if (!response.ok || json.status === "erro") {
      throw new Error(json.msg || json.message || "Falha ao consultar restritivos financeiros.");
    }

    const data = json.data || {};
    
    // =========================================================================
    // 1. EXTRAÇÃO DE RESTRIÇÕES (Mapeando o nó REFIN/SPC real do JSON)
    // =========================================================================
    const refin = data.refin || {};
    const spc = refin.spc?.[0] || []; 
    
    let qtdDividas = 0;
    let valorTotal = 0;

    // Varre o array de dívidas para somar os valores corretamente
    const credores = spc.map((divida: any) => {
      qtdDividas++;
      // Transforma "57298,94" em float numérico
      const valorNumerico = parseFloat(String(divida.Valor).replace(/\./g, "").replace(",", "."));
      valorTotal += isNaN(valorNumerico) ? 0 : valorNumerico;

      return {
        credor: divida.NomeAssociado,
        valor: divida.Valor,
        vencimento: divida.DataDoVencimento
      };
    });

    const resumoRestritivos = {
      possui_apontamento: qtdDividas > 0,
      quantidade_dividas: qtdDividas,
      valor_total_dividas: valorTotal,
      ccf: data.ccf || null,
      pefin_serasa: credores, // Repassa a lista de credores
    };

    // =========================================================================
    // 2. DEVOLVE TUDO
    // =========================================================================
    return NextResponse.json({ 
      resumo: resumoRestritivos,
      ficha_cadastral: data.rfb || {}, // Passa os dados da Receita (Socios, Enderecos) isolados
      raw_completo: json
    });

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}