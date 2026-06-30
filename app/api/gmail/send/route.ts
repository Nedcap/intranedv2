/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userEmail, mensagemId, para, assunto, textoResposta } = await request.json();

    const { data: integracao } = await supabase
      .from("usuarios_integracoes")
      .select("*")
      .eq("email_usuario", userEmail)
      .single();

    if (!integracao || !integracao.gmail_access_token) {
      return NextResponse.json({ error: "Gmail deslogado" }, { status: 401 });
    }

    // Monta a estrutura bruta do e-mail (RFC 2822) exigida pelo Google
    const deString = `From: ${userEmail}\r\n`;
    const paraString = `To: ${para}\r\n`;
    const assuntoString = `Subject: Re: ${assunto}\r\n`;
    const threadString = `In-Reply-To: ${mensagemId}\r\nReferences: ${mensagemId}\r\n`;
    const tipoString = `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    const corpoString = `${textoResposta}\r\n`;

    const emailBruto = deString + paraString + assuntoString + threadString + tipoString + corpoString;
    
    // Converte para Base64 no formato URL Safe que o Gmail pede
    const base64Safe = btoa(unescape(encodeURIComponent(emailBruto)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integracao.gmail_access_token}`,
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
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}