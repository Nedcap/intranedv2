import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    const apiKey = process.env.CREDITHUB_API_KEY; 

    if (!apiKey) {
      throw new Error("Chave do CreditHub não configurada no servidor.");
    }

    // Consulta apenas SERASA para evitar cobrança extra
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKey}/${docLimpo}?serasa=true`;

    const response = await fetch(urlCreditHub, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    const textData = await response.text();

    if (textData.trim().startsWith("<")) {
      console.error("❌ Erro XML do CreditHub:", textData);
      throw new Error("A API parceira retornou um erro estrutural (Verifique a Chave de Acesso).");
    }

    const json = JSON.parse(textData);

    if (!response.ok || json.status === "erro") {
      throw new Error(json.msg || json.message || "Falha ao consultar restritivos financeiros.");
    }

    const data = json.data || {};
    const infoSerasa = json.informacoes?.[0] || data.pefin?.[0] || {};

    const qtdDividas = data.quantidade_dividas || infoSerasa.total || infoSerasa.totalPendenciasFinanceiras || 0;
    const valorTotal = parseFloat(data.valor_total_dividas || infoSerasa.valorTotalPendencias || infoSerasa.valorTotalPendenciasFinanceiras || 0);

    const resumoRestritivos = {
      possui_apontamento: qtdDividas > 0,
      quantidade_dividas: qtdDividas,
      valor_total_dividas: valorTotal,
      ccf: data.ccf || null,
      protestos: data.protestos || null,
      pefin_serasa: infoSerasa.bello || null,
    };

    // 🔥 A MÁGICA AQUI: Retornamos o resumo mastigado E a ficha cadastral completa!
    return NextResponse.json({
      resumo: resumoRestritivos,
      ficha_cadastral: data, // Todos os dados de CNPJ, sócios, telefones, capital social, etc.
      raw_completo: json // O JSON 100% bruto para debug
    });

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno", details: err.message }, { status: 500 });
  }
}