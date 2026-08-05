import { NextResponse } from "next/server";
import { validarRequisicaoApi } from "@/lib/supabase-server"; // 🛡️ Importando a blindagem

// ⏱️ Define o tempo máximo de execução na Vercel (Hobby = max 60s, Pro = max 300s)
export const maxDuration = 60; 

export async function POST(request: Request) {
  try {
    // 🐛 DEBUG 1: Vamos descobrir se o token está chegando de fato do frontend!
    const authHeader = request.headers.get("authorization");
    console.log("[DEBUG API] Header Authorization recebido na Vercel:", authHeader ? "✅ SIM (Token presente)" : "❌ NÃO (Token ausente)");

    // 🔒 BLINDAGEM DA ROTA: Protegendo o Gateway de Inteligência Artificial
    const { usuario, erro } = await validarRequisicaoApi(request);
    
    // Se a validação falhar, travamos a execução e enviamos exatamente o porquê
    if (erro || !usuario) {
      console.error("[ERRO AUTENTICAÇÃO API]:", erro || "Usuário não localizado no banco/token.");
      return NextResponse.json({ 
        error: erro || "Acesso negado. Token JWT ausente ou inválido.",
        dica: "Verifique se a função validarRequisicaoApi está lendo o Header Authorization ou se depende de Cookies."
      }, { status: 401 });
    }

    const body = await request.json();
    
    // 🔥 CORREÇÃO: Extraindo os dados corretamente do payload
    const { analise_id, urls_documentos, modo_atualizacao } = body;

    // 🛑 Validação de segurança dos parâmetros
    if (!analise_id || !urls_documentos || !Array.isArray(urls_documentos) || urls_documentos.length === 0) {
      return NextResponse.json({ error: "Faltam parâmetros obrigatórios ou array de documentos vazio." }, { status: 400 });
    }

    // 🛡️ Log aprimorado com o nome do operador para auditoria
    console.log(`[VERCEL API] Encaminhando análise ${analise_id} para o Motor V8 no Render... (Merge/Update: ${!!modo_atualizacao}) - Solicitado por: ${usuario.nome || 'Desconhecido'}`);

    const urlRender = "https://motor-ia-mmlv.onrender.com/api/motor-ia"; 

    // 🚀 Fazendo o disparo para o servidor Python
    const respostaRender = await fetch(urlRender, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 💡 NOTA: Se o seu backend Python no Render precisar de autenticação, você precisará repassar o token aqui:
        // "Authorization": authHeader || ""
      },
      body: JSON.stringify({
        analise_id,
        urls_documentos,
        modo_atualizacao: modo_atualizacao || false // 🔥 Repassando para o Python
      }),
    });

    if (!respostaRender.ok) {
      const textoErro = await respostaRender.text();
      console.error(`[ERRO RENDER] Resposta não-ok (${respostaRender.status}): ${textoErro}`);
      throw new Error(`O Motor V8 no Render retornou um erro: ${textoErro}`);
    }

    const dadosSucesso = await respostaRender.json();

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: "Documentos enviados com sucesso para o Motor V8 no Render.",
      dados: dadosSucesso
    });

  } catch (error: any) {
    console.error("[ERRO FATAL VERCEL GATEWAY]", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}