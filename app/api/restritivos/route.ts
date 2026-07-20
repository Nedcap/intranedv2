import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    
    // ⚠️ ATENÇÃO: Defina essa variável no seu arquivo .env local e na Vercel
    const apiKey = process.env.CREDITHUB_API_KEY; 

    if (!apiKey) {
      throw new Error("Chave do CreditHub não configurada no servidor.");
    }

    // 🎯 URL oficial extraída da documentação, forçando a busca nos birôs (Serasa/Boa Vista)
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKey}/${docLimpo}?serasa=true&boavista=true`;

    const response = await fetch(urlCreditHub, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const textData = await response.text();

    // 🛡️ O CreditHub retorna XML (<BPQL>) quando dá erro genérico ou de chave inválida
    if (textData.trim().startsWith("<")) {
      console.error("❌ Erro XML do CreditHub:", textData);
      throw new Error("A API parceira retornou um erro estrutural (Verifique a Chave de Acesso).");
    }

    const json = JSON.parse(textData);

    if (!response.ok) {
      throw new Error(json.message || "Falha ao consultar restritivos financeiros.");
    }

    const data = json.data || {};

    // 🧹 Limpeza e Padronização do JSON para o Frontend
    const resumoRestritivos = {
      possui_apontamento: (data.quantidade_dividas > 0 || (data.pefin && data.pefin.length > 0) || (data.spc && data.spc.length > 0)),
      quantidade_dividas: data.quantidade_dividas || 0,
      valor_total_dividas: parseFloat(data.valor_total_dividas || 0),
      ccf: data.ccf || null, // Cheques sem Fundo
      protestos: data.protestos || null,
      pefin_serasa: data.pefin || null,
      refin_boavista: data.spc || null
    };

    return NextResponse.json(resumoRestritivos);

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno", details: err.message }, { status: 500 });
  }
}