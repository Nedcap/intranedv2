import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const RESEND_API_KEY = "re_WmeXNjdd_97NXwjjkUJc5prK4KfNF3xvA";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("iniciar_recuperacao_senha", {
      p_email: email.trim()
    });

    if (error || !data || data.length === 0 || !data[0].encontrado) {
      return NextResponse.json({ enviado: true });
    }

    const { token_gerado, nome_usuario } = data[0];
    const linkReset = `https://intraned.nedcapital.com.br/reset-senha?token=${token_gerado}`;

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

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${RESEND_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        from: "Segurança Ned <sistema@nedcapital.com.br>",
        to: [email.trim()],
        subject: "🔐 Recuperação de Senha - Intraned",
        html: htmlEmail,
      }),
    });

    return NextResponse.json({ enviado: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}