import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // <-- Certifique-se de que o caminho do seu supabase está correto

export async function POST(request: Request) {
  try {
    // 🎯 Puxa a credencial de forma segura e invisível direto do ambiente do servidor
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("❌ ERRO: A variável RESEND_API_KEY não foi configurada no servidor.");
      return NextResponse.json({ error: "Configuração de servidor pendente." }, { status: 500 });
    }

    const body = await request.json();

    // Variáveis que serão passadas para o disparo final
    let to = body.to;
    let subject = body.subject;
    let html = body.html;

    // ========================================================================
    // 🔍 LÓGICA EXCLUSIVA: DISPARO DO MONITORE
    // ========================================================================
    if (body.tipo === "monitore" && body.resumoGlobalDisparo) {
      // 1. Busca os e-mails ativos direto do Supabase no lado do servidor
      const { data: emailsDB, error: dbError } = await supabase
        .from("emails_monitore")
        .select("email")
        .eq("ativo", true);

      if (dbError) throw new Error("Erro ao buscar e-mails no Supabase: " + dbError.message);

      const listaEmails = emailsDB?.map((e: any) => e.email) || [];
      
      if (listaEmails.length === 0) {
        return NextResponse.json({ success: true, message: "Nenhum e-mail ativo encontrado para disparo do Monitore." });
      }

      // 2. Monta o HTML do corpo do e-mail
      let textoHtml = "<h3>Resumo de Movimentações - Monitore Serasa</h3><ul>";
      body.resumoGlobalDisparo.forEach((item: any) => {
        const cor = item.evolucao > 0 ? "#ef4444" : "#059669";
        textoHtml += `<li><b>${item.cedente} (CNPJ: ${item.cnpj})</b>: <span style='color:${cor}'><b>R$ ${item.evolucao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></span> <br><i>Motivo: ${item.resumo}</i></li><br>`;
      });
      textoHtml += "</ul><p>Acesse o sistema Ned Control para mais detalhes.</p>";

      // 3. Substitui as variáveis padrão pelos dados recém-processados
      to = listaEmails;
      subject = `Alerta Monitore - ${new Date().toLocaleDateString("pt-BR")}`;
      html = textoHtml;
    }

    // ========================================================================
    // 📤 DISPARO GENÉRICO (Ou continuação do Monitore)
    // ========================================================================
    
    // Validação básica do payload antes de gastar cota de envio
    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Payload incompleto. Preencha to, subject e html (ou envie tipo: 'monitore' com os dados adequados)." }, { status: 400 });
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
        to: Array.isArray(to) ? to : [to],
        cc: Array.isArray(body.cc) ? body.cc : body.cc ? [body.cc] : undefined,
        subject: subject,
        html: html,
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