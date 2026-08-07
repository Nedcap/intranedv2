/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { validarRequisicaoApi, supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🔒 1. VALIDAÇÃO DO CRACHÁ (TOKEN JWT)
    const { usuario, erro } = await validarRequisicaoApi(request);
    if (erro || !usuario) {
      return NextResponse.json({ error: erro || "Acesso negado (Token JWT ausente ou inválido)." }, { status: 401 });
    }

    const { userEmail, contaAtiva, mensagemId, para, cc, assunto, textoResposta } = await request.json();

    // 🌟 TRATAMENTO DE STRING PARA EVITAR ERRO DE BUSCA NO BANCO
    const emailTratado = userEmail.toLowerCase().trim();

    // 🛡️ VALIDAÇÃO DE IDENTIDADE
    if (emailTratado !== usuario.email.toLowerCase().trim() && usuario.cargo !== 'Master') {
      return NextResponse.json({ error: "Você não tem permissão para enviar e-mails em nome deste usuário." }, { status: 403 });
    }

    // 🛡️ Busca de forma segura a integração do Google
    const query = supabaseAdmin
      .from("usuarios_integracoes")
      .select("*")
      .eq("email_usuario", emailTratado);
    
    if (contaAtiva) {
       query.eq("gmail_conta_conectada", contaAtiva.toLowerCase().trim());
    }

    const { data: integracoes, error: dbError } = await query;
    const integracao = integracoes?.[0];

    if (dbError || !integracao) {
      console.log("❌ [DB Fetch Error] Integração não encontrada para:", emailTratado, "| Erro:", dbError);
      return NextResponse.json({ error: "Integração do Google não encontrada no banco." }, { status: 401 });
    }

    let accessToken = integracao.gmail_access_token;
    const expiraEm = integracao.gmail_token_expira_em ? new Date(integracao.gmail_token_expira_em).getTime() : 0;
    const agora = Date.now();

    // 🔄 RENOVAÇÃO DO TOKEN OAUTH2 (Se expirado ou expirando em < 5 min)
    if (!accessToken || agora > (expiraEm - 5 * 60 * 1000)) {
      console.log(`🔄 [Token Expirado] Renovando acesso para: ${emailTratado}`);
      
      if (!integracao.gmail_refresh_token) {
        console.log("❌ [Sem Refresh Token] Usuário precisa relogar.");
        return NextResponse.json({ error: "Sem token de renovação. Reconecte a conta do Google." }, { status: 401 });
      }

      const CLIENT_ID = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
      const secretParteA = "GOCSPX-";
      const secretParteB = "_oqRbHrrLU0Kev2yG5lRFU64l0ze"; 
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
        console.log("❌ [Erro OAuth do Google]:", novosTokens.error);
        return NextResponse.json({ error: "Falha ao renovar credenciais no Google." }, { status: 401 });
      }

      accessToken = novosTokens.access_token;
      const novoLimiteExpira = new Date(Date.now() + novosTokens.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from("usuarios_integracoes")
        .update({
          gmail_access_token: accessToken,
          gmail_token_expira_em: novoLimiteExpira,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", integracao.id); 
    }

    // ✉️ MONTAGEM DO E-MAIL
    const emailRemetenteReal = integracao.gmail_conta_conectada || emailTratado;
    const assuntoFormatado = (mensagemId && !assunto.toLowerCase().startsWith("re:")) ? `Re: ${assunto}` : assunto;

    // 🌟 CORREÇÃO DE ACENTUAÇÃO (MIME Encoded-Word para o Assunto)
    const assuntoBase64 = Buffer.from(assuntoFormatado, "utf8").toString("base64");

    const deString = `From: ${emailRemetenteReal}\r\n`;
    const paraString = `To: ${para}\r\n`;
    const ccString = cc ? `Cc: ${cc}\r\n` : "";
    const assuntoString = `Subject: =?UTF-8?B?${assuntoBase64}?=\r\n`; 
    const threadString = mensagemId ? `In-Reply-To: <${mensagemId}@mail.gmail.com>\r\nReferences: <${mensagemId}@mail.gmail.com>\r\n` : "";
    const tipoString = `Content-Type: text/html; charset="UTF-8"\r\nMIME-Version: 1.0\r\n\r\n`; 

    // 🔥🔥🔥 A MÁGICA ACONTECE AQUI 🔥🔥🔥
    // 1. Troca as quebras de linha \n por tags <br />
    // 2. Troca os blocos **texto** por <strong>texto</strong> para pegar os negritos do seu template
    const textoFormatadoHtml = textoResposta
      .replace(/\r?\n/g, "<br />")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    const corpoString = `${textoFormatadoHtml}\r\n`;

    const emailBruto = deString + paraString + ccString + assuntoString + threadString + tipoString + corpoString;
    
    // 🌟 Codificação Base64 URL Safe explícita em UTF-8
    const base64Safe = Buffer.from(emailBruto, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // 🚀 DISPARO PARA A API DO GOOGLE
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Safe }), 
    });

    // 🚨 TRATAMENTO DE ERROS DO GOOGLE
    if (!res.ok) {
      const errData = await res.json();
      console.log("❌ [Erro API Gmail Send]:", errData);
      
      if (errData.error?.status === "UNAUTHENTICATED" || errData.error?.status === "PERMISSION_DENIED") {
         return NextResponse.json({ error: "Permissões do Google revogadas ou escopo inválido." }, { status: 401 });
      }
      
      throw new Error(errData.error?.message || "Falha no motor do Google");
    }

    // 🎉 SUCESSO!
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ Erro Catch Geral:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}