import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // <-- Certifique-se de que o caminho do seu supabase está correto

// Formatador de Moeda para o E-mail
const fM = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export async function POST(request: Request) {
  try {
    // 🎯 Puxa a credencial de forma segura e invisível direto do ambiente do servidor
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("❌ ERRO: A variável RESEND_API_KEY não foi configurada no servidor.");
      return NextResponse.json({ error: "Configuração de servidor pendente." }, { status: 500 });
    }

    const body = await request.json();

    // Variáveis que serão passadas para o disparo final
    let to = body.to;
    let subject = body.subject;
    let html = body.html;

    // ========================================================================
    // 🔍 LÓGICA EXCLUSIVA: DISPARO DO MONITORE
    // ========================================================================
    if (body.tipo === "monitore" && body.resumoGlobalDisparo) {
      // 1. Busca os e-mails ativos direto do Supabase no lado do servidor
      const { data: emailsDB, error: dbError } = await supabase
        .from("emails_monitore")
        .select("email")
        .eq("ativo", true);

      if (dbError) throw new Error("Erro ao buscar e-mails no Supabase: " + dbError.message);

      const listaEmails = emailsDB?.map((e: any) => e.email) || [];
      
      if (listaEmails.length === 0) {
        return NextResponse.json({ success: true, message: "Nenhum e-mail ativo encontrado para disparo do Monitore." });
      }

      // 2. Separa os dados em Pioras e Melhoras para os KPIs
      const resumoData = body.resumoGlobalDisparo;
      const pioras = resumoData.filter((i: any) => i.evolucao > 0);
      const melhoras = resumoData.filter((i: any) => i.evolucao < 0);

      // 3. Monta o HTML PREMIUM do corpo do e-mail
      let textoHtml = `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
          <div style="max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- HEADER -->
            <div style="background-color: #0f172a; padding: 25px; text-align: left;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase;">🔍 Relatório de Monitoramento Serasa</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Resumo diário de oscilações na carteira de cedentes. Processado em: ${new Date().toLocaleDateString("pt-BR")}</p>
            </div>

            <!-- RESUMO KPI -->
            <div style="padding: 20px; display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
               <div style="flex: 1; padding: 15px; border-left: 4px solid #ef4444; background: #fff; border-radius: 6px;">
                  <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">🚨 Pioras (Risco Subiu)</p>
                  <h2 style="margin: 5px 0 0 0; color: #0f172a; font-size: 24px;">${pioras.length}</h2>
               </div>
               <div style="flex: 1; padding: 15px; border-left: 4px solid #10b981; background: #fff; border-radius: 6px;">
                  <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">✅ Melhoras (Risco Caiu)</p>
                  <h2 style="margin: 5px 0 0 0; color: #0f172a; font-size: 24px;">${melhoras.length}</h2>
               </div>
            </div>

            <!-- TABELA DE DETALHAMENTO -->
            <div style="padding: 20px;">
              <h3 style="margin-top: 0; color: #0f172a; text-transform: uppercase; font-size: 16px;">Detalhamento de Movimentações</h3>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 12px; color: #475569; text-transform: uppercase;">Cedente / CNPJ</th>
                    <th style="padding: 12px; color: #475569; text-transform: uppercase; text-align: right;">Saldo Anterior</th>
                    <th style="padding: 12px; color: #475569; text-transform: uppercase; text-align: center;">Evolução</th>
                    <th style="padding: 12px; color: #475569; text-transform: uppercase; text-align: right;">Saldo Atual</th>
                    <th style="padding: 12px; color: #475569; text-transform: uppercase;">Resumo Detalhado</th>
                  </tr>
                </thead>
                <tbody>
                  ${resumoData.map((item: any) => {
                    const isPiora = item.evolucao > 0;
                    const corEvolucao = isPiora ? "#b91c1c" : "#047857";
                    const bgEvolucao = isPiora ? "#fef2f2" : "#ecfdf5";
                    const seta = isPiora ? "▲" : "▼";

                    return `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px;">
                          <div style="font-weight: bold; color: #0f172a;">${item.cedente}</div>
                          <div style="color: #64748b; font-size: 10px; font-family: monospace;">${item.cnpj}</div>
                        </td>
                        <td style="padding: 12px; text-align: right; color: #64748b; font-family: monospace;">${fM(item.saldo_anterior || 0)}</td>
                        <td style="padding: 12px; text-align: center;">
                          <span style="background-color: ${bgEvolucao}; color: ${corEvolucao}; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-family: monospace;">
                            ${seta} ${fM(Math.abs(item.evolucao))}
                          </span>
                        </td>
                        <td style="padding: 12px; text-align: right; font-weight: bold; color: #0f172a; font-family: monospace;">${fM(item.saldo_atual || 0)}</td>
                        <td style="padding: 12px; color: #475569;">
                          <div style="font-weight: bold;">${item.resumo}</div>
                          ${item.detalhes ? `
                            <div style="margin-top: 4px; font-size: 9px; color: #94a3b8; text-transform: uppercase;">
                              PEFIN: ${fM(item.detalhes.pefin || 0)} | REFIN: ${fM(item.detalhes.refin || 0)} | PROT: ${fM(item.detalhes.protesto || 0)}
                            </div>
                          ` : ''}
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>

            <!-- FOOTER -->
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #94a3b8; font-size: 11px;">
              Este é um e-mail automático gerado pelo sistema Ned Control.<br>
              Acesse o sistema para ver o dossiê detalhado completo.
            </div>
          </div>
        </div>
      `;

      // 4. Substitui as variáveis padrão pelos dados recém-processados
      to = listaEmails;
      subject = `🚨 Alerta Monitore - ${pioras.length} pioras detectadas (${new Date().toLocaleDateString("pt-BR")})`;
      html = textoHtml;
    }

    // ========================================================================
    // 📤 DISPARO GENÉRICO (Ou continuação do Monitore)
    // ========================================================================
    
    // Validação básica do payload antes de gastar cota de envio
    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Payload incompleto. Preencha to, subject e html (ou envie tipo: 'monitore' com os dados adequados)." }, { status: 400 });
    }
    
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Entity-Ref-ID": Math.random().toString(36).substring(7) // Evita cache de requisição idêntica
      },
      body: JSON.stringify({
        from: body.from || "Sistema Ned <sistema@nedcapital.com.br>",
        to: Array.isArray(to) ? to : [to],
        cc: Array.isArray(body.cc) ? body.cc : body.cc ? [body.cc] : undefined,
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Erro retornado pela API do Resend:", data);
      return NextResponse.json({ error: data.message || "Falha ao processar disparo no Resend" }, { status: res.status });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    console.error("💥 Erro crítico na rota de email:", error);
    return NextResponse.json({ error: "Erro interno ao disparar e-mail", details: error.message }, { status: 500 });
  }
}