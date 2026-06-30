/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userEmail, dataInicio, dataFim } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: "Usuário não identificado" }, { status: 400 });
    }

    const { data: integracao, error: dbError } = await supabase
      .from("usuarios_integracoes")
      .select("*")
      .eq("email_usuario", userEmail)
      .single();

    if (dbError || !integracao || !integracao.gmail_access_token) {
      return NextResponse.json({ error: "Gmail não conectado" }, { status: 404 });
    }

    // Monta a query do Gmail baseada em filtros de data se existirem
    let gmailQuery = "in:inbox";
    if (dataInicio) {
      const dataFormatadaIni = new Date(dataInicio).toISOString().split('T')[0].replace(/-/g, '/');
      gmailQuery += ` after:${dataFormatadaIni}`;
    } else {
      gmailQuery += " is:unread"; // Se não for busca de histórico, pega só os não lidos
    }
    
    if (dataFim) {
      const dataFormatadaFim = new Date(dataFim).toISOString().split('T')[0].replace(/-/g, '/');
      gmailQuery += ` before:${dataFormatadaFim}`;
    }

    const gmailListRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${integracao.gmail_access_token}` } }
    );

    const gmailListData = await gmailListRes.json();

    if (!gmailListData.messages || gmailListData.messages.length === 0) {
      return NextResponse.json({ messages: [], message: "Nenhum e-mail encontrado para este período." });
    }

    const emailsColetados = [];

    for (const msg of gmailListData.messages) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        { headers: { Authorization: `Bearer ${integracao.gmail_access_token}` } }
      );
      const detail = await detailRes.json();

      const headers = detail.payload?.headers || [];
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");

      const assunto = subjectHeader ? subjectHeader.value : "(Sem Assunto)";
      const remetenteBruto = fromHeader ? fromHeader.value : "Desconhecido";

      const matchEmail = remetenteBruto.match(/<([^>]+)>/);
      const remetente_email = matchEmail ? matchEmail[1] : remetenteBruto;
      const remetente_nome = remetenteBruto.replace(/<[^>]+>/, "").trim() || remetente_email;

      const tem_anexo = !!detail.payload?.parts?.some((part: any) => part.filename && part.filename.length > 0);

      emailsColetados.push({
        mensagem_id: msg.id,
        dono_da_caixa: userEmail,
        provedor: "GMAIL",
        remetente_nome,
        remetente_email,
        assunto,
        snippet: detail.snippet || "",
        tem_anexo,
        status: "PENDENTE",
        data_recebimento: new Date(parseInt(detail.internalDate)).toISOString(),
      });
    }

    // Se for uma busca de histórico pura por data, apenas devolvemos para a tela escolher o que importar
    if (dataInicio) {
      return NextResponse.json({ messages: emailsColetados });
    }

    // Se for sincronização padrão, faz o upsert direto
    for (const email of emailsColetados) {
      await supabase.from("caixa_inteligente").upsert(email, { onConflict: "mensagem_id" });
    }

    return NextResponse.json({ success: true, message: "Caixa atualizada!" });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}