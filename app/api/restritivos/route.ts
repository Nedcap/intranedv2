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

    // Protege a chave contra caracteres especiais que quebram a URL do GET
    const apiKeyTratada = encodeURIComponent(apiKey);

    // URL oficial com o Serasa
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKeyTratada}/${docLimpo}?serasa=true`;

    console.log("🔗 Disparando consulta estruturada para o CreditHub...");

    const response = await fetch(urlCreditHub, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store" 
    });

    const textData = await response.text();

    // 🛡️ Captura o erro em XML (<BPQL>)
    if (textData.trim().startsWith("<")) {
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
    
    // =========================================================================
    // 1. EXTRAÇÃO DE RESTRIÇÕES (SERASA)
    // =========================================================================
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

    // =========================================================================
    // 2. EXTRAÇÃO DOS PROCESSOS (DATAJUD/CNJ)
    // A documentação diz que vem num formato: { total: X, content: [...] }
    // =========================================================================
    const dadosProcessos = data.processos || {};
    const processosArray = dadosProcessos.content || [];
    
    // Mapeamento simples para garantir que o front-end receba sempre o mesmo formato
    const processosLimpos = processosArray.map((proc: any) => ({
      numero: proc.numero_processo || proc.numero || "S/N",
      classe: proc.classe_judicial || proc.classe || "Não Informada",
      tribunal: proc.tribunal || proc.orgao || "N/D",
    }));

    // =========================================================================
    // 3. DEVOLVE TUDO DE UMA SÓ VEZ
    // =========================================================================
    return NextResponse.json({ 
      resumo: resumoRestritivos,
      processos: processosLimpos,
      ficha_cadastral: data, // Manda o resto (CNAE, Endereço, etc)
      raw_completo: json
    });

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}