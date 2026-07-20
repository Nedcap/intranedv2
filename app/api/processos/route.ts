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
      return NextResponse.json({ error: "Chave do CreditHub ausente nas variáveis de ambiente." }, { status: 500 });
    }

    // 🎯 URL com os parâmetros exatos da doc (boavista=true e serasa=true)
    const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKey}/${docLimpo}?serasa=true&boavista=true`;

    const response = await fetch(urlCreditHub, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    const textData = await response.text();

    // 🚨 O PULO DO GATO: Lendo o erro em XML que a documentação citou
    if (textData.trim().startsWith("<")) {
      // Usa regex para extrair a mensagem dentro da tag <exception>
      const match = textData.match(/<exception[^>]*>(.*?)<\/exception>/);
      const erroReal = match ? match[1] : "Erro estrutural da API (XML Recebido)";
      console.error("❌ Erro XML do CreditHub:", erroReal);
      
      // Devolvemos status 400 mandando a mensagem exata do erro!
      return NextResponse.json({ error: erroReal }, { status: 400 });
    }

    const json = JSON.parse(textData);

    // Se o status HTTP falhou, mas veio JSON:
    if (!response.ok) {
      return NextResponse.json({ error: json.message || "Falha na consulta" }, { status: 400 });
    }

    const data = json.data || {};

    // 🧹 Mapeamento fiel aos campos da documentação
    const resumoRestritivos = {
      possui_apontamento: (data.quantidade_dividas > 0 || (data.pefin && data.pefin.length > 0) || (data.spc && data.spc.length > 0)),
      quantidade_dividas: data.quantidade_dividas || 0,
      valor_total_dividas: parseFloat(data.valor_total_dividas || 0),
      ccf: data.ccf || null,
      completed: data.completed !== false // A doc cita que se for assíncrono, pode vir false
    };

    return NextResponse.json(resumoRestritivos);

  } catch (err: any) {
    console.error("💥 Erro crítico:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}