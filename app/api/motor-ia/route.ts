import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdfParse from "pdf-parse";

// ⚠️ ESTICA O TEMPO DO VERCEL (60s no plano Free, até 300s no plano Pro)
export const maxDuration = 60; 

// Inicializa os clientes com as chaves do seu .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Aqui o ideal é usar a SERVICE_ROLE_KEY se tiver, para ignorar RLS no backend. 
// Mas vamos usar a ANON por enquanto para manter compatibilidade com seu .env
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { analise_id, urls_documentos } = body;

    if (!analise_id || !urls_documentos || urls_documentos.length === 0) {
      return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 });
    }

    console.log(`[MOTOR V8] Iniciando processamento da análise: ${analise_id}`);

    // 1. Busca os dados atuais da empresa no banco
    const { data: analiseAtual, error: erroBusca } = await supabase
      .from("analises_credito")
      .select("dados_consolidados")
      .eq("id", analise_id)
      .single();

    if (erroBusca || !analiseAtual) {
      throw new Error("Análise não encontrada no banco de dados.");
    }

    let dadosConsolidados = analiseAtual.dados_consolidados || {};

    // 2. Loop baixando e lendo cada PDF enviado
    for (const url of urls_documentos) {
      console.log(`[MOTOR V8] Baixando documento: ${url}`);
      
      const respostaDocs = await fetch(url);
      const arrayBuffer = await respostaDocs.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extrai o texto do PDF usando a biblioteca Node
      const dadosPdf = await pdfParse(buffer);
      const textoExtraido = dadosPdf.text;

      console.log(`[MOTOR V8] Texto extraído (${textoExtraido.length} caracteres). Enviando para GPT-4o...`);

      // 3. O super prompt de classificação e extração em JSON
      const prompt = `
        Você é um analista de crédito sênior. Analise o texto extraído deste documento e retorne APENAS um objeto JSON válido.
        
        Regras:
        1. Identifique o tipo do documento (faturamento, endividamento, contrato, outros).
        2. Se for faturamento, retorne os dados no formato: {"tipo": "faturamento", "dados": {"2024": {"jan": 10000, "fev": 15000}}}
        3. Se for endividamento, retorne: {"tipo": "endividamento", "dados": [{"instituicao": "Banco X", "saldo": 50000, "prazo": "Curto Prazo", "modalidade": "Giro", "tipo": "Banco"}]}
        4. NÃO invente dados. Se não achar, retorne vazio.
        
        Texto extraído do documento:
        """${textoExtraido.substring(0, 30000)}""" 
      `;

      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }, // Força saída em JSON
      });

      const resultadoJson = JSON.parse(gptResponse.choices[0].message.content || "{}");
      console.log(`[MOTOR V8] Classificado como: ${resultadoJson.tipo}`);

      // 4. Mescla o que a IA achou com o que já existe no banco
      if (resultadoJson.tipo === "faturamento" && resultadoJson.dados) {
        dadosConsolidados.dados_faturamento = {
          ...dadosConsolidados.dados_faturamento,
          ...resultadoJson.dados
        };
      } else if (resultadoJson.tipo === "endividamento" && resultadoJson.dados) {
        const divAntigas = dadosConsolidados.dados_endividamento || [];
        dadosConsolidados.dados_endividamento = [...divAntigas, ...resultadoJson.dados];
      }
    }

    // 5. Salva tudo no Supabase e joga pra mesa do Analista!
    console.log(`[MOTOR V8] Salvando dados e movendo para a mesa do analista...`);
    const { error: erroUpdate } = await supabase
      .from("analises_credito")
      .update({
        dados_consolidados: dadosConsolidados,
        status: "em_revisao_humana" // Sai do robô e vai pra mesa!
      })
      .eq("id", analise_id);

    if (erroUpdate) throw erroUpdate;

    return NextResponse.json({ 
      sucesso: true, 
      mensagem: "Análise processada e enviada para a mesa humana." 
    });

  } catch (error: any) {
    console.error("[ERRO MOTOR V8]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}