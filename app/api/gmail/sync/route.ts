/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: "Usuário não identificado" }, { status: 400 });
    }

    // 1. Busca as credenciais de acesso do Gmail salvas no banco
    const { data: integracao, error: dbError } = await supabase
      .from("usuarios_integracoes")
      .select("*")
      .eq("email_usuario", userEmail)
      .single();

    if (dbError || !integracao || !integracao.gmail_access_token) {
      return NextResponse.json({ error: "Gmail não conectado ou credenciais ausentes" }, { status: 404 });
    }

    // 2. Busca a lista das últimas 10 mensagens não lidas na Caixa de Entrada do Gmail
    const gmailListRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread in:inbox&maxResults=10",
      {
        headers: { Authorization: `Bearer ${integracao.gmail_access_token}` },
      }
    );

    const gmailListData = await gmailListRes.json();

    if (!gmailListData.messages || gmailListData.messages.length === 0) {
      return NextResponse.json({ message: "Nenhum e-mail novo encontrado." });
    }

    // 3. Varre as mensagens para pegar os detalhes (Remetente, Assunto, Corpo)
    for (const msg of gmailListData.messages) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: { Authorization: `Bearer ${integracao.gmail_access_token}` },
        }
      );
      const detail = await detailRes.json();

      // Parsear cabeçalhos (Remetente e Assunto)
      const headers = detail.payload?.headers || [];
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");

      const assunto = subjectHeader ? subjectHeader.value : "(Sem Assunto)";
      const remetenteBruto = fromHeader ? fromHeader.value : "Desconhecido";

      // Limpar o remetente ex: "Elon Musk <elon@tesla.com>" -> Nome: Elon Musk, E-mail: elon@tesla.com
      const matchEmail = remetenteBruto.match(/<([^>]+)>/);
      const remetente_email = matchEmail ? matchEmail[1] : remetenteBruto;
      const remetente_nome = remetenteBruto.replace(/<[^>]+>/, "").trim() || remetente_email;

      // Verificar se possui anexos
      const tem_anexo = !!detail.payload?.parts?.some((part: any) => part.filename && part.filename.length > 0);

      // 4. Salva (Upsert) na tabela caixa_inteligente ignorando duplicados pelo mensagem_id
      await supabase.from("caixa_inteligente").upsert({
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
      }, { onConflict: "mensagem_id" });
    }

    return NextResponse.json({ success: true, message: "E-mails sincronizados com sucesso!" });

  } catch (error: any) {
    console.error("Erro na sincronização do Gmail:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}