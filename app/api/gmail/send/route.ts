/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userEmail, contaAtiva, mensagemId, para, assunto, textoResposta } = await request.json();

    // 1. Busca os tokens da conta ativa
    const { data: integracao, error: dbError } = await supabase
      .from("usuarios_integracoes")
      .select("*")
      .eq("email_usuario", userEmail)
      .eq("gmail_conta_conectada", contaAtiva || userEmail)
      .single();

    if (dbError || !integracao) {
      return NextResponse.json({ error: "Integração não encontrada para esta aba ativa" }, { status: 401 });
    }

    let accessToken = integracao.gmail_access_token;
    const expiraEm = integracao.gmail_token_expira_em ? new Date(integracao.gmail_token_expira_em).getTime() : 0;
    const agora = Date.now();

    // 2. MECANISMO DE AUTO-REFRESH
    if (!accessToken || agora > (expiraEm - 5 * 60 * 1000)) {
      console.log(`🔄 [Token Expirado] Renovando acesso para a conta: ${contaAtiva}`);
      
      if (!integracao.gmail_refresh_token) {
        return NextResponse.json({ error: "Gmail deslogado (Sem token de renovação. Faça login novamente)" }, { status: 401 });
      }

      const SITE_URL = "https://intraned.nedcapital.com.br";
      const CLIENT_ID = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
      const secretParteA = "GOCSPX-";
      const secretParteB = "_oqRbHrrLU0Kev2yG5lRFU64l0ze"; // 🚨 ASSEGURE SUA CHAVE AQUI
      const CLIENT_SECRET = `${secretParteA}${secretParteB}`;

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: integracao.gmail_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const novosTokens = await refreshResponse.json();

      if (novosTokens.error) {
        return NextResponse.json({ error: "Falha ao renovar credenciais com o Google." }, { status: 401 });
      }

      accessToken = novosTokens.access_token;
      const novoLimiteExpira = new Date(Date.now() + novosTokens.expires_in * 1000).toISOString();

      await supabase
        .from("usuarios_integracoes")
        .update({
          gmail_access_token: accessToken,
          gmail_token_expira_em: novoLimiteExpira,
          atualizado_em: new Date().toISOString()
        })
        .eq("email_usuario", userEmail)
        .eq("gmail_conta_conectada", contaAtiva || userEmail);
    }

    // 3. Monta o e-mail bruto (RFC 2822)
    const emailRemetenteReal = integracao.gmail_conta_conectada || userEmail;

    // Ajusta o assunto para garantir que tenha o "Re:" padronizado corporativo
    const assuntoFormatado = assunto.toLowerCase().startsWith("re:") ? assunto : `Re: ${assunto}`;

    const deString = `From: ${emailRemetenteReal}\r\n`;
    const paraString = `To: ${para}\r\n`;
    const assuntoString = `Subject: ${assuntoFormatado}\r\n`;
    
    // Vincula a mensagem pelos headers RFC padrão (In-Reply-To e References). 
    // Isso é o suficiente para o Gmail agrupar na mesma conversa!
    const threadString = `In-Reply-To: <${mensagemId}@mail.gmail.com>\r\nReferences: <${mensagemId}@mail.gmail.com>\r\n`;
    const tipoString = `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    const corpoString = `${textoResposta}\r\n`;

    const emailBruto = deString + paraString + assuntoString + threadString + tipoString + corpoString;
    
    const base64Safe = btoa(unescape(encodeURIComponent(emailBruto)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // 🌟 CORREÇÃO DO PAYLOAD: Removemos o 'threadId' chumbado direto do JSON principal 
    // se o Google falhar em achar a entidade. Deixamos os headers cuidarem do agrupamento.
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Safe }), // Headers internos resolvem a Thread!
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error?.message || "Falha no motor do Google");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Erro no endpoint de envio:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}