import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    // 🎯 Fix: Coleta a chave do Resend de forma segura direto do ambiente do servidor
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("❌ ERRO: A variável RESEND_API_KEY não foi configurada no servidor.");
      return NextResponse.json({ error: "Configuração de servidor pendente." }, { status: 500 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
    }

    const emailLimpo = email.trim().toLowerCase();

    // Invoca a procedure no banco de dados
    const { data, error } = await supabase.rpc("iniciar_recuperacao_senha", {
      p_email: emailLimpo
    });

    // Segurança: se o e-mail não existir, retornamos 'enviado: true' para evitar varredura maliciosa de contas existentes
    if (error || !data || data.length === 0 || !data[0].encontrado) {
      return NextResponse.json({ enviado: true });
    }

    const { token_gerado, nome_usuario } = data[0];

    // 🎯 Fix: Detecta dinamicamente o domínio atual (localhost, link da vercel ou produção)
    const host = request.headers.get("host") || "intraned.nedcapital.com.br";
    const protocolo = host.includes("localhost") ? "http" : "https";
    const linkReset = `${protocolo}://${host}/reset-senha?token=${token_gerado}`;

    const htmlEmail = `
      <html>
        <body style="font-family: sans-serif; color: #1e293b; background: #f8fafc; padding: 40px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h2 style="color: #0f172a; font-weight: 800; margin-bottom: 4px;">🔐 Recuperação de Senha</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">Ned Capital Control Center</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p>Olá, <b>${nome_usuario}</b>,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta de acesso à nossa Intranet.</p>
            <p style="margin: 25px 0;">
              <a href="${linkReset}" style="background: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Redefinir Minha Senha</a>
            </p>
            <p style="color: #ef4444; font-size: 12px; font-weight: bold;">⚠️ Este link é válido apenas por 1 hora.</p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 10px;">Se você não solicitou essa alteração, ignore este e-mail.</p>
          </div>
        </body>
      </html>
    `;

    const resEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        from: "Segurança Ned <sistema@nedcapital.com.br>",
        to: [emailLimpo],
        subject: "🔐 Recuperação de Senha - Intraned",
        html: htmlEmail,
      }),
    });

    if (!resEmail.ok) {
      const logErro = await resEmail.json();
      console.error("❌ Falha no envio através do Resend:", logErro);
      throw new Error("Falha no provedor de e-mail externo");
    }

    return NextResponse.json({ enviado: true });
  } catch (err: any) {
    console.error("💥 Erro crítico na rota de recuperação:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}