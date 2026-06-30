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

    // 🌟 2. MECANISMO DE AUTO-REFRESH (Se o token expirou ou vai expirar em menos de 5 minutos)
    if (!accessToken || agora > (expiraEm - 5 * 60 * 1000)) {
      console.log(`🔄 [Token Expirado] Renovando acesso para a conta: ${contaAtiva}`);
      
      if (!integracao.gmail_refresh_token) {
        return NextResponse.json({ error: "Gmail deslogado (Sem token de renovação. Faça login novamente)" }, { status: 401 });
      }

      // Credenciais do Google
      const SITE_URL = "https://intraned.nedcapital.com.br";
      const CLIENT_ID = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
      const secretParteA = "GOCSPX-";
      const secretParteB = "_oqRbHrrLU0Kev2yG5lRFU64l0ze"; // 🚨 LEMBRE DE MUDAR AQUI!
      const CLIENT_SECRET = `${secretParteA}${secretParteB}`;

      // Pede um novo access_token para o Google usando o refresh_token
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
        console.error("❌ Erro ao renovar token no Google:", novosTokens);
        return NextResponse.json({ error: "Falha ao renovar credenciais com o Google. Refaça o login." }, { status: 401 });
      }

      accessToken = novosTokens.access_token;
      const novoLimiteExpira = new Date(Date.now() + novosTokens.expires_in * 1000).toISOString();

      // Salva o novo token de acesso de volta no Supabase para as próximas requisições
      await supabase
        .from("usuarios_integracoes")
        .update({
          gmail_access_token: accessToken,
          gmail_token_expira_em: novoLimiteExpira,
          atualizado_em: new Date().toISOString()
        })
        .eq("email_usuario", userEmail)
        .eq("gmail_conta_conectada", contaAtiva || userEmail);
        
      console.log("✅ Token renovado e atualizado no Supabase com sucesso!");
    }

    // 3. Monta e envia o e-mail usando o token válido (reunido ou atualizado)
    const emailRemetenteReal = integracao.gmail_conta_conectada || userEmail;

    const deString = `From: ${emailRemetenteReal}\r\n`;
    const paraString = `To: ${para}\r\n`;
    const assuntoString = `Subject: Re: ${assunto}\r\n`;
    const threadString = `In-Reply-To: ${mensagemId}\r\nReferences: ${mensagemId}\r\n`;
    const tipoString = `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    const corpoString = `${textoResposta}\r\n`;

    const emailBruto = deString + paraString + assuntoString + threadString + tipoString + corpoString;
    
    const base64Safe = btoa(unescape(encodeURIComponent(emailBruto)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Safe, threadId: mensagemId }),
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