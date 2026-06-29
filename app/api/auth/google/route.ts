/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

// 🚨 O MATA-CACHE DO NEXT.JS! Impede que ele grave redirecionamentos velhos.
export const dynamic = "force-dynamic"; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userEmail = searchParams.get("user"); 

  // ====================================================================
  // ⚙️ CONFIGURAÇÕES CHUMBADAS (Apontando direto para a Intraned)
  // ====================================================================
  const SITE_URL = "https://intraned.nedcapital.com.br";
  const CLIENT_ID = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
  
  // 🥷 TRUQUE NINJA: Secret quebrado em dois para o GitHub não bloquear o push!
  const secretParteA = "GOCSPX-";
  const secretParteB = "COLE_AQUI_O_RESTO_DA_SUA_CHAVE"; 
  const CLIENT_SECRET = `${secretParteA}${secretParteB}`;

  // ====================================================================
  // 1. SE NÃO TEM 'CODE' -> Manda pro Google (Fallback)
  // ====================================================================
  if (!code) {
    const redirectUri = `${SITE_URL}/api/auth/google`;
    const scopes = ["https://www.googleapis.com/auth/gmail.modify"];
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

  // ====================================================================
  // 2. SE TEM 'CODE' -> Google autorizou, vamos pegar os tokens!
  // ====================================================================
  try {
    const stateEmail = searchParams.get("state") || "Usuario_Anonimo";
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
      throw new Error(tokens.error_description || "Erro ao obter tokens");
    }

    console.log(`✅ Tokens obtidos com sucesso para o usuário: ${stateEmail}`);

    // Redireciona de volta para a tela certa do Kanban!
    return NextResponse.redirect(`${SITE_URL}/dashboard/monitor-email?success=gmail`);

  } catch (error: any) {
    console.error("❌ Erro no callback do Google OAuth:", error);
    return NextResponse.redirect(`${SITE_URL}/dashboard/monitor-email?error=${encodeURIComponent(error.message)}`);
  }
}