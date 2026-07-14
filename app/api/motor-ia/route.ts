import { NextResponse } from "next/server";

export const maxDuration = 60; 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 🔥 CORREÇÃO: Extraindo o modo_atualizacao do body
    const { analise_id, urls_documentos, modo_atualizacao } = body;

    if (!analise_id || !urls_documentos || urls_documentos.length === 0) {
      return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 });
    }

    console.log(`[VERCEL API] Encaminhando análise ${analise_id} para o Motor V8 no Render... (Merge/Update: ${!!modo_atualizacao})`);

    const urlRender = "https://motor-ia-mmlv.onrender.com/api/motor-ia"; 

    const respostaRender = await fetch(urlRender, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        analise_id,
        urls_documentos,
        modo_atualizacao: modo_atualizacao || false // 🔥 Repassando para o Python
      }),
    });

    if (!respostaRender.ok) {
      const textoErro = await respostaRender.text();
      throw new Error(`O Motor V8 no Render retornou um erro: ${textoErro}`);
    }

    const dadosSucesso = await respostaRender.json();

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: "Documentos enviados com sucesso para o Motor V8 no Render.",
      dados: dadosSucesso
    });

  } catch (error: any) {
    console.error("[ERRO VERCEL GATEWAY]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}