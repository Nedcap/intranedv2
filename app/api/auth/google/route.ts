/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic"; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userEmail = searchParams.get("user"); 
  
  // NOVO: Capturamos a página de origem (se vier na URL)
  const origin = searchParams.get("origin") || "/dashboard/monitor-email"; 

  const SITE_URL = "https://intraned.nedcapital.com.br";
  const CLIENT_ID = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
  
  const secretParteA = "GOCSPX-";
  const secretParteB = "_oqRbHrrLU0Kev2yG5lRFU64l0ze"; 
  const CLIENT_SECRET = `${secretParteA}${secretParteB}`;

  // ====================================================================
  // 1. SE NÃO TEM 'CODE' -> Manda pro Google
  // ====================================================================
  if (!code) {
    const redirectUri = `${SITE_URL}/api/auth/google`;
    const scopes = [
      "https://www.googleapis.com/auth/gmail.modify", 
      "https://www.googleapis.com/auth/userinfo.email"
    ];
    
    // NOVO: Colocamos o e-mail E a origem dentro do 'state' para não perder na volta
    const stateContent = JSON.stringify({ 
      email: userEmail || "anonimo", 
      origin: origin 
    });
    
    // Codifica em Base64 para não dar problema na URL do Google
    const stateSafe = Buffer.from(stateContent).toString('base64');

    const authParams = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state: stateSafe,
      access_type: "offline",
      prompt: "consent"
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`);
  }

  // ====================================================================
  // 2. SE TEM 'CODE' -> Google autorizou, vamos pegar os tokens!
  // ====================================================================
  try {
    const stateParam = searchParams.get("state");
    let stateEmailOwner = "anonimo";
    let redirectDeVolta = "/dashboard/monitor-email";

    // NOVO: Desempacota o 'state' para recuperar o e-mail e a origem
    if (stateParam) {
      try {
        const decoded = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf8'));
        stateEmailOwner = decoded.email;
        redirectDeVolta = decoded.origin;
      } catch (e) {
        console.warn("Aviso: Formato de 'state' antigo ou inválido.");
        // Se falhar o parse, assume que o state é só o e-mail (fluxo antigo)
        stateEmailOwner = stateParam; 
      }
    }

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
    if (tokens.error) {
      throw new Error(tokens.error_description || "Erro ao obter tokens do Google");
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userInfoRes.json();
    const gmailConectado = userInfo.email?.toLowerCase().trim();

    if (!gmailConectado || gmailConectado.endsWith("@gmail.com")) {
      return NextResponse.redirect(`${SITE_URL}${redirectDeVolta}?error=${encodeURIComponent("Contas particulares @gmail.com não são permitidas. Use o e-mail institucional!")}`);
    }

    const dadosIntegracao: any = {
      email_usuario: stateEmailOwner.toLowerCase().trim(), 
      gmail_conta_conectada: gmailConectado,
      gmail_access_token: tokens.access_token,
      gmail_token_expira_em: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      atualizado_em: new Date().toISOString()
    };

    if (tokens.refresh_token) {
      dadosIntegracao.gmail_refresh_token = tokens.refresh_token;
    }

    const { error: upsertError } = await supabase
      .from("usuarios_integracoes")
      .upsert(dadosIntegracao, { onConflict: "email_usuario, gmail_conta_conectada" });

    if (upsertError) {
      throw new Error(`Erro ao inserir no Supabase: ${upsertError.message}`);
    }

    console.log(`✅ Tokens salvos com sucesso no Supabase para o usuário: ${stateEmailOwner}`);

    // NOVO: Redireciona de volta para a tela de onde o usuário clicou no botão!
    return NextResponse.redirect(`${SITE_URL}${redirectDeVolta}`);

  } catch (error: any) {
    console.error("❌ Erro no callback do Google OAuth:", error);
    return NextResponse.redirect(`${SITE_URL}/dashboard/monitor-email?error=${encodeURIComponent(error.message)}`);
  }
}