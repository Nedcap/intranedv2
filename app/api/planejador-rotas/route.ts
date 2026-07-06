import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, origem, destino } = body;

    if (action !== "GERAR_ROTA") {
      return NextResponse.json({ error: "Ação inválida ou não informada." }, { status: 400 });
    }

    if (!origem || !destino) {
      return NextResponse.json({ error: "Origem e destino são obrigatórios." }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY; 
    if (!googleApiKey) {
      return NextResponse.json({ error: "Chave do Google Maps não configurada (.env)." }, { status: 500 });
    }

    // 1. Google Directions 
    const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&alternatives=true&key=${googleApiKey}&region=br&language=pt-BR`;
    const mapsResponse = await fetch(googleUrl);
    const mapsData = await mapsResponse.json();

    if (mapsData.status !== "OK") {
      return NextResponse.json({ error: `Erro no Google Maps: ${mapsData.status}` }, { status: 400 });
    }

    // 🔥 CORREÇÃO: Vamos analisar apenas a ROTA PRINCIPAL (rota 0) para evitar o Timeout das Serverless Functions.
    // Assim chamamos a IA uma única vez em vez de 4 vezes em paralelo!
    const route = mapsData.routes[0];
    const percurso = route.legs[0];
    const nomeRodoviaGeral = route.summary || "Rodovia Principal";
    
    const enderecoOrigemCompleto = percurso.start_address || origem;
    const enderecoDestinoCompleto = percurso.end_address || destino;

    // 🔥 CORREÇÃO 2: Passamos o texto completo da rota sem o ".substring(0, 1200)"
    const dicasDoGoogle = percurso.steps
      .map((s: any) => s.html_instructions || "")
      .join(" | ")
      .replace(/<[^>]*>/g, ""); // Remove tags HTML 

    const promptSistema = `
      Você é um geógrafo especialista em logística rodoviária brasileira.
      O Google Maps calculou um trajeto. Expanda a rota adicionando TODAS as cidades intermediárias reais na ordem sequencial da viagem.
      
      DADOS REAIS DA ROTA:
      - Partida: "${enderecoOrigemCompleto}"
      - Destino: "${enderecoDestinoCompleto}"
      - Instruções: "${dicasDoGoogle}"

      Retorne ESTRITAMENTE um JSON neste formato:
      {
        "cidades_itinerario": [
          { "nome": "Nome da Cidade", "uf": "UF" }
        ]
      }
    `;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.1, 
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: `Mapeie detalhadamente todas as cidades intermediárias de ${origem} para ${destino}.` }
        ],
        response_format: { type: "json_object" }
      });

      const resultadoIA = JSON.parse(completion.choices[0].message.content || "{}");
      const listaCidadesExpanded = resultadoIA.cidades_itinerario || [];

      const cidadesDetalhadas = listaCidadesExpanded.map((c: any, cIdx: number) => ({
        nome: c.nome?.trim(),
        uf: c.uf?.trim()?.toUpperCase(),
        ordem: cIdx + 1
      }));

      // Retornamos a rota principal mapeada pela IA, mais as alternativas "cruas" do Google sem acionar IA
      const rotaProcessadaPrincipal = {
        id_rota: 1,
        nome_rota: nomeRodoviaGeral,
        distancia: percurso.distance?.text,
        duracao: percurso.duration?.text,
        polyline_geral: route.overview_polyline?.points,
        cidades: cidadesDetalhadas.length > 0 ? cidadesDetalhadas : [{ nome: origem, uf: "", ordem: 1 }, { nome: destino, uf: "", ordem: 2 }]
      };

      return NextResponse.json({ rotas: [rotaProcessadaPrincipal] }); // Enviamos apenas a principal para ganhar velocidade

    } catch (aiErr) {
      console.error(`[Aviso] Falha na IA:`, aiErr);
      
      return NextResponse.json({ 
        rotas: [{
          id_rota: 1,
          nome_rota: nomeRodoviaGeral,
          distancia: percurso.distance?.text,
          duracao: percurso.duration?.text,
          polyline_geral: route.overview_polyline?.points,
          cidades: [
            { nome: origem.split("/")[0].trim(), uf: "", ordem: 1 },
            { nome: destino.split("/")[0].trim(), uf: "", ordem: 2 }
          ]
        }]
      });
    }

  } catch (error: any) {
    console.error("Erro crítico no back-end do planejador:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}