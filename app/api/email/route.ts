import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 🎯 Fix: Puxa a credencial de forma segura e invisível direto do ambiente do servidor
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("❌ ERRO: A variável RESEND_API_KEY não foi configurada no servidor.");
      return NextResponse.json({ error: "Configuração de servidor pendente." }, { status: 500 });
    }

    const body = await request.json();

    // Validação básica do payload antes de gastar cota de envio
    if (!body.to || !body.subject || !body.html) {
      return NextResponse.json({ error: "Payload incompleto. Preencha to, subject e html." }, { status: 400 });
    }
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Entity-Ref-ID": Math.random().toString(36).substring(7) // Evita cache de requisição idêntica
      },
      body: JSON.stringify({
        from: body.from || "Sistema Ned <sistema@nedcapital.com.br>",
        to: Array.isArray(body.to) ? body.to : [body.to],
        cc: Array.isArray(body.cc) ? body.cc : body.cc ? [body.cc] : undefined,
        subject: body.subject,
        html: body.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Erro retornado pela API do Resend:", data);
      return NextResponse.json({ error: data.message || "Falha ao processar disparo no Resend" }, { status: res.status });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    console.error("💥 Erro crítico na rota de email:", error);
    return NextResponse.json({ error: "Erro interno ao disparar e-mail", details: error.message }, { status: 500 });
  }
}