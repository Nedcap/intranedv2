import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    
    // Pega a chave limpa (remove espaços em branco acidentais do início/fim)
    const rawApiKey = process.env.CREDITHUB_API_KEY; 
    const apiKey = rawApiKey ? rawApiKey.trim() : null;

    if (!apiKey) {
      throw new Error("Chave do CreditHub não localizada no process.env do servidor.");
    }

    // 🔥 O PULO DO GATO PARA CHAVES GIGANTESCAS:
    // Protege a chave contra caracteres especiais que quebram a URL do GET
    const apiKeyTratada = encodeURIComponent(apiKey);

    // URL oficial apenas com o Serasa (para não cobrar Boa Vista)
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKeyTratada}/${docLimpo}?serasa=true`;

    console.log("🔗 Disparando consulta estruturada para o CreditHub...");

    const response = await fetch(urlCreditHub, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store" // Garante que o Next.js não cacheie erros de credenciais
    });

    const textData = await response.text();

    // 🛡️ Captura o erro em XML (<BPQL>)
    if (textData.trim().startsWith("<")) {
      // Tenta cuspir o erro exato que está dentro da tag <exception> no terminal do seu servidor para você ler
      const match = textData.match(/<exception[^>]*>(.*?)<\/exception>/);
      const erroReal = match ? match[1] : "Erro de autenticação/parâmetros no CreditHub.";
      
      console.error("❌ Resposta de Erro XML do CreditHub:", textData);
      
      return NextResponse.json({ 
        error: "Erro de Autenticação", 
        details: `CreditHub respondeu: "${erroReal}". Verifique se o Token no Vercel está correto.` 
      }, { status: 400 });
    }

    const json = JSON.parse(textData);

    if (!response.ok || json.status === "erro") {
      throw new Error(json.msg || json.message || "Falha ao consultar restritivos financeiros.");
    }

    const data = json.data || {};
    const infoSerasa = json.informacoes?.[0] || data.pefin?.[0] || {};

    const qtdDividas = data.quantidade_dividas || infoSerasa.total || infoSerasa.totalPendenciasFinanceiras || 0;
    const valorTotal = parseFloat(data.valor_total_dividas || infoSerasa.valorTotalPendencias || infoSerasa.valorTotalPendenciasFinanceiras || 0);
    const possuiApontamento = qtdDividas > 0;

    const resumoRestritivos = {
      possui_apontamento: possuiApontamento,
      quantidade_dividas: qtdDividas,
      valor_total_dividas: valorTotal,
      ccf: data.ccf || null,
      protestos: data.protestos || null,
      pefin_serasa: infoSerasa.bello || null,
    };

    return NextResponse.json(resumoRestritivos);

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}