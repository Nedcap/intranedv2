/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { validarRequisicaoApi, supabaseAdmin } from "@/lib/supabase-server"; // 🛡️ Importando a blindagem

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🔒 BLINDAGEM DA ROTA: Verificando o crachá (Token JWT)
    const { usuario, erro } = await validarRequisicaoApi(request);
    if (erro || !usuario) {
      return NextResponse.json({ error: erro || "Acesso negado." }, { status: 401 });
    }

    const { userEmail, contaAtiva, dataInicio, dataFim } = await request.json();

    if (!userEmail || !contaAtiva) {
      return NextResponse.json({ error: "Parâmetros insuficientes" }, { status: 400 });
    }

    // 🛡️ VALIDAÇÃO DE IDENTIDADE: Impede que o usuário "A" sincronize e leia a caixa do usuário "B"
    if (userEmail.toLowerCase().trim() !== usuario.email.toLowerCase().trim() && usuario.cargo !== 'Master') {
      return NextResponse.json({ error: "Você não tem permissão para sincronizar a caixa deste usuário." }, { status: 403 });
    }

    // 🛡️ Busca as chaves usando o supabaseAdmin para não esbarrar no RLS
    const { data: integracao, error: dbError } = await supabaseAdmin
      .from("usuarios_integracoes")
      .select("*")
      .eq("email_usuario", userEmail)
      .eq("gmail_conta_conectada", contaAtiva)
      .single();

    if (dbError || !integracao || !integracao.gmail_access_token) {
      return NextResponse.json({ error: "Conta de e-mail não autenticada." }, { status: 404 });
    }

    let gmailQuery = "in:inbox";
    if (dataInicio) {
      const dataFormatadaIni = new Date(dataInicio).toISOString().split('T')[0].replace(/-/g, '/');
      gmailQuery += ` after:${dataFormatadaIni}`;
    } else {
      gmailQuery += " is:unread";
    }
    if (dataFim) {
      const dataFormatadaFim = new Date(dataFim).toISOString().split('T')[0].replace(/-/g, '/');
      gmailQuery += ` before:${dataFormatadaFim}`;
    }

    const gmailListRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=25`,
      { headers: { Authorization: `Bearer ${integracao.gmail_access_token}` } }
    );
    const gmailListData = await gmailListRes.json();

    if (!gmailListData.messages || gmailListData.messages.length === 0) {
      return NextResponse.json({ messages: [], message: "Nada novo." });
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
        caixa_origem: contaAtiva, // Vincula o card à aba da conta de origem
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

    if (dataInicio) {
      return NextResponse.json({ messages: emailsColetados });
    }

    // 🛡️ Grava as mensagens no banco usando supabaseAdmin
    for (const email of emailsColetados) {
      await supabaseAdmin.from("caixa_inteligente").upsert(email, { onConflict: "mensagem_id" });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}