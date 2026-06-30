/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic"; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userEmail = searchParams.get("user"); 

  const SITE_URL = "https://intraned.nedcapital.com.br";
  const CLIENT_ID = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
  
  const secretParteA = "GOCSPX-";
  const secretParteB = "_oqBOTA_O_RESTO_DA_SUA_CHAVE_AQUI"; 
  const CLIENT_SECRET = `${secretParteA}${secretParteB}`;

  if (!code) {
    const redirectUri = `${SITE_URL}/api/auth/google`;
    const scopes = ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/常规/userinfo.email"];
    const state = userEmail || "anonimo";

    const authParams = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state: state,
      access_type: "offline",
      prompt: "select_account"
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`);
  }

  try {
    const stateEmailOwner = searchParams.get("state") || "anonimo";
    const redirectUri = `${SITE_URL}/api/auth/google`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, 
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) throw new Error(tokens.error_description || "Erro ao obter tokens");

    // 🌟 EXTRAINDO O E-MAIL LOGADO DO GOOGLE
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userInfoRes.json();
    const gmailConectado = userInfo.email?.toLowerCase().trim();

    // 🛡️ BLOQUEIO SEVERO DE CONTA PARTICULAR
    if (gmailConectado.endsWith("@gmail.com")) {
      return NextResponse.redirect(`${SITE_URL}/dashboard/monitor-email?error=${encodeURIComponent("Contas particulares @gmail.com não são permitidas. Use o e-mail institucional!")}`);
    }

    // 🌟 SALVANDO A CONEXÃO MÚLTIPLA NO SUPABASE
    // Usamos um ID composto (email_usuario + gmail_conectado) para permitir que o MESMO usuário da intranet conecte VÁRIOS e-mails institucionais
    const { error: upsertError } = await supabase
      .from("usuarios_integracoes")
      .upsert({
        email_usuario: stateEmailOwner.toLowerCase().trim(), 
        gmail_conta_conectada: gmailConectado,
        gmail_access_token: tokens.access_token,
        gmail_refresh_token: tokens.refresh_token || null, 
        gmail_token_expira_em: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        atualizado_em: new Date().toISOString()
      }, { onConflict: "email_usuario, gmail_conta_conectada" });

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.redirect(`${SITE_URL}/dashboard/monitor-email?success=gmail&conta=${gmailConectado}`);

  } catch (error: any) {
    console.error(error);
    return NextResponse.redirect(`${SITE_URL}/dashboard/monitor-email?error=${encodeURIComponent(error.message)}`);
  }
}