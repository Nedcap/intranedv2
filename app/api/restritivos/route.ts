import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    
    // Busca a chave configurada no Vercel/Local
    const apiKey = process.env.CREDITHUB_API_KEY; 

    if (!apiKey) {
      throw new Error("Chave do CreditHub não configurada no servidor.");
    }

    // 🎯 URL oficial extraída da documentação: apenas SERASA (boavista removido para evitar cobrança extra)
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKey}/${docLimpo}?serasa=true`;

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

    if (!response.ok || json.status === "erro") {
      throw new Error(json.msg || json.message || "Falha ao consultar restritivos financeiros.");
    }

    // A estrutura pode vir dentro de 'data', ou direto na raiz com 'informacoes' dependendo do tipo da consulta
    const data = json.data || {};
    const infoSerasa = json.informacoes?.[0] || data.pefin?.[0] || {};

    // 🧹 Mapeamento de fallback: tenta pegar do padrão 'data', se não achar, tenta pegar do bloco do Serasa
    const qtdDividas = data.quantidade_dividas || infoSerasa.total || infoSerasa.totalPendenciasFinanceiras || 0;
    const valorTotal = parseFloat(data.valor_total_dividas || infoSerasa.valorTotalPendencias || infoSerasa.valorTotalPendenciasFinanceiras || 0);
    const possuiApontamento = qtdDividas > 0;

    const resumoRestritivos = {
      possui_apontamento: possuiApontamento,
      quantidade_dividas: qtdDividas,
      valor_total_dividas: valorTotal,
      ccf: data.ccf || null, // Cheques sem Fundo
      protestos: data.protestos || null,
      pefin_serasa: infoSerasa.bello || null, // 'bello' é onde o Serasa lista os detalhes das pendências
    };

    return NextResponse.json(resumoRestritivos);

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno", details: err.message }, { status: 500 });
  }
}