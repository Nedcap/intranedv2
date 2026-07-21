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
    // 1. EXTRAÇÃO DE RESTRIÇÕES (SERASA)
    // =========================================================================
    const refin = data.refin || {};
    const spc = refin.spc?.[0] || []; 
    
    let qtdDividas = 0;
    let valorTotal = 0;

    const credores = spc.map((divida: any) => {
      qtdDividas++;
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
      pefin_serasa: credores,
    };

    // =========================================================================
    // 2. EXTRAÇÃO DE PROCESSOS JURÍDICOS (DATAJUD)
    // =========================================================================
    const dadosProcessos = data.processos || [];
    
    const processosLimpos = dadosProcessos.map((proc: any) => {
      const tramitacao = proc.tramitacoes?.[0] || {};
      
      let classeDesc = tramitacao.classe?.[0]?.descricao;
      // Se a classe vier inválida (como no TJSP às vezes), pega o Assunto
      if (!classeDesc || classeDesc.includes("inválido")) {
        classeDesc = tramitacao.assunto?.[0]?.descricao || "Não Informada";
      }

      return {
        numero: proc.numeroProcesso || "S/N",
        classe: classeDesc,
        tribunal: proc.siglaTribunal || tramitacao.tribunal?.sigla || "N/D"
      };
    });

    // =========================================================================
    // 3. DEVOLVE TUDO (ECONOMIA: 1 CHAMADA RESOLVE TUDO)
    // =========================================================================
    return NextResponse.json({ 
      resumo: resumoRestritivos,
      processos: processosLimpos,
      ficha_cadastral: data.rfb || {}, 
      raw_completo: json
    });

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}