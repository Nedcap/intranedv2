// C:\Users\Alyson\intranet-webv2\app\api\planejador-rotas\route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

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

    // 1. Consultar o Google Directions para obter a malha rodoviária real e tempo/distância
    const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&alternatives=true&key=${googleApiKey}&region=br&language=pt-BR`;
    const mapsResponse = await fetch(googleUrl);
    const mapsData = await mapsResponse.json();

    if (mapsData.status !== "OK") {
      return NextResponse.json({ error: `Erro no Google Maps: ${mapsData.status}` }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 2. Processar cada rota alternativa retornada pelo Google
    const rotasProcessadas = await Promise.all(
      mapsData.routes.map(async (route: any, index: number) => {
        const percurso = route.legs[0];
        const nomeRodoviaGeral = route.summary || "Rodovia Principal";
        
        // Formata as cidades de partida e chegada normalizadas pelo Google
        const cidadeOrigemGoogle = percurso.start_address.split("-")[0]?.trim() || origem;
        const cidadeDestinoGoogle = percurso.end_address.split("-")[0]?.trim() || destino;

        // Extrai fragmentos de texto do Google para dar contexto geográfico exato para a IA
        const dicasDoGoogle = percurso.steps
          .map((s: any) => s.html_instructions || "")
          .join(" | ")
          .replace(/<[^>]*>/g, ""); // Remove tags HTML

        // Prompt Geográfico para o GPT-4o expandir a rota e incluir as cidades pequenas omitidas pelo Maps
        const promptSistema = `
          Você é um geógrafo especialista em logística rodoviária brasileira e malhas de trânsito comercial intercidades.
          O Google Maps calculou um trajeto, mas omitiu cidades pequenas no meio do caminho porque o motorista segue reto na rodovia.
          
          SUA TAREFA: Expandir a rota fornecida adicionando TODAS as cidades intermediárias reais (grandes, médias e pequenas) que o motorista obrigatoriamente cruza por dentro ou passa ao lado trafegando pela rodovia informada.
          
          DADOS DA ROTA:
          - Ponto de Partida: "${cidadeOrigemGoogle}"
          - Ponto de Destino: "${cidadeDestinoGoogle}"
          - Rodovia Principal / Resumo do Trajeto: "${nomeRodoviaGeral}"
          - Instruções do Google: "${dicasDoGoogle.substring(0, 1000)}"

          REGRAS DE OURO CRÍTICAS:
          1. Retorne as cidades estritamente na ordem geográfica sequencial da viagem (da partida até o destino).
          2. Não pule nenhuma cidade pequena intercidades que fique na rota da pista. Queremos fazer uma buscona geral de CNPJs na estrada.
          3. Garanta que o primeiro item do array seja a cidade de Origem e o último seja a de Destino.
          
          Retorne ESTRITAMENTE um objeto JSON válido neste exato formato:
          {
            "cidades_itinerario": [
              { "nome": "Nome da Cidade", "uf": "UF" }
            ]
          }
        `;

        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Forçado o modelo bruto GPT-4o conforme solicitado
            temperature: 0.1,
            messages: [
              { role: "system", content: promptSistema },
              { role: "user", content: `Liste detalhadamente todas as cidades da rota entre ${cidadeOrigemGoogle} e ${cidadeDestinoGoogle} usando a rodovia ${nomeRodoviaGeral}.` }
            ],
            response_format: { type: "json_object" }
          });

          const resultadoIA = JSON.parse(completion.choices[0].message.content || "{}");
          const listaCidadesExpanded = resultadoIA.cidades_itinerario || [];

          // Tipifica e insere a ordem sequencial correta
          const cidadesDetalhadas = listaCidadesExpanded.map((c: any, cIdx: number) => ({
            nome: c.nome?.trim(),
            uf: c.uf?.trim()?.toUpperCase(),
            ordem: cIdx + 1
          }));

          return {
            id_rota: index + 1,
            nome_rota: nomeRodoviaGeral,
            distancia: percurso.distance?.text,
            duracao: percurso.duration?.text,
            polyline_geral: route.overview_polyline?.points,
            cidades: cidadesDetalhadas.length > 0 ? cidadesDetalhadas : [{ nome: cidadeOrigemGoogle, uf: "", ordem: 1 }, { nome: cidadeDestinoGoogle, uf: "", ordem: 2 }]
          };

        } catch (aiErr) {
          console.error("Falha na expansão de cidades via IA para a rota", index, aiErr);
          // Fallback seguro caso a OpenAI falhe
          return {
            id_rota: index + 1,
            nome_rota: nomeRodoviaGeral,
            distancia: percurso.distance?.text,
            duracao: percurso.duration?.text,
            polyline_geral: route.overview_polyline?.points,
            cidades: [
              { nome: cidadeOrigemGoogle, uf: "", ordem: 1 },
              { nome: cidadeDestinoGoogle, uf: "", ordem: 2 }
            ]
          };
        }
      })
    );

    return NextResponse.json({ rotas: rotasProcessadas });

  } catch (error: any) {
    console.error("Erro no back-end do planejador de rotas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}