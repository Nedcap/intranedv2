// C:\Users\Alyson\intranet-webv2\app\api\planejador-rotas\route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";

// Instanciação no top-level para reaproveitamento de conexão e performance do Next.js
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

    // 1. Consultar o Google Directions para obter a malha rodoviária real, polylines e metadados de tempo
    const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&alternatives=true&key=${googleApiKey}&region=br&language=pt-BR`;
    const mapsResponse = await fetch(googleUrl);
    const mapsData = await mapsResponse.json();

    if (mapsData.status !== "OK") {
      return NextResponse.json({ error: `Erro no Google Maps: ${mapsData.status}` }, { status: 400 });
    }

    // 2. Processar em paralelo cada rota alternativa retornada pelo motor do Google Maps
    const rotasProcessadas = await Promise.all(
      mapsData.routes.map(async (route: any, index: number) => {
        const percurso = route.legs[0];
        const nomeRodoviaGeral = route.summary || "Rodovia Principal";
        
        // Mantemos os endereços brutos e completos do Google para que a IA faça a extração perfeita da cidade
        const enderecoOrigemCompleto = percurso.start_address || origem;
        const enderecoDestinoCompleto = percurso.end_address || destino;

        // Extrai fragmentos de texto das manobras para dar o gabarito das rodovias exatas para a IA
        const dicasDoGoogle = percurso.steps
          .map((s: any) => s.html_instructions || "")
          .join(" | ")
          .replace(/<[^>]*>/g, ""); // Remove tags HTML de formatação do Maps

        // Prompt Geo-Logístico mestre para expansão cirúrgica de microrregiões e municípios omitidos
        const promptSistema = `
          Você é um geógrafo especialista em logística rodoviária brasileira e malhas de trânsito comercial intercidades.
          O Google Maps calculou um trajeto rodoviário baseado em instruções de direção, mas omitiu cidades menores (e até médias) no meio do caminho porque o motorista apenas segue reto na rodovia principal.
          
          SUA TAREFA: Analisar o trajeto fornecido e expandir a rota adicionando TODAS as cidades intermediárias reais (grandes, médias e pequenas) que o motorista obrigatoriamente cruza por dentro, passa pela avenida perimetral ou intersecta ao lado trafegando pela rodovia informada.
          
          DADOS REAIS DA ROTA DA ESTRADA:
          - Endereço de Partida (Google): "${enderecoOrigemCompleto}"
          - Endereço de Destino (Google): "${enderecoDestinoCompleto}"
          - Rodovia Principal / Resumo do Trajeto: "${nomeRodoviaGeral}"
          - Linha de Instruções de Manobra: "${dicasDoGoogle.substring(0, 1200)}"

          REGRAS DE OURO CRÍTICAS:
          1. Retorne as cidades estritamente na ordem geográfica sequencial da viagem (da partida real até o destino final).
          2. Não pule nenhuma cidade intercidades que fique às margens da pista. O time comercial precisa desse mapeamento para fazer buscas de CNPJs na estrada.
          3. Garanta obrigatoriamente que a primeira cidade do array seja a Cidade de Origem correta e a última seja a Cidade de Destino correta (extraídas dos endereços fornecidos).
          
          Retorne ESTRITAMENTE um objeto JSON válido neste exato formato:
          {
            "cidades_itinerario": [
              { "nome": "Nome da Cidade", "uf": "UF" }
            ]
          }
        `;

        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.1, // Baixa temperatura para manter o rigor geográfico real e evitar alucinações
            messages: [
              { role: "system", content: promptSistema },
              { role: "user", content: `Mapeie detalhadamente todas as cidades limítrofes e intermediárias no trajeto de ${origem} para ${destino} trafegando pela ${nomeRodoviaGeral}.` }
            ],
            response_format: { type: "json_object" }
          });

          const resultadoIA = JSON.parse(completion.choices[0].message.content || "{}");
          const listaCidadesExpanded = resultadoIA.cidades_itinerario || [];

          // Tipifica, limpa espaços e insere o index sequencial ordenado esperado pelo page.tsx
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
            cidades: cidadesDetalhadas.length > 0 
              ? cidadesDetalhadas 
              : [{ nome: origem, uf: "", ordem: 1 }, { nome: destino, uf: "", ordem: 2 }]
          };

        } catch (aiErr) {
          console.error(`[Aviso] Falha na expansão via IA para a rota alternativa ${index + 1}:`, aiErr);
          
          // Fallback seguro de contingência caso a OpenAI atinja rate limit ou falhe
          return {
            id_rota: index + 1,
            nome_rota: nomeRodoviaGeral,
            distancia: percurso.distance?.text,
            duracao: percurso.duration?.text,
            polyline_geral: route.overview_polyline?.points,
            cidades: [
              { nome: origem.split("/")[0].trim(), uf: "", ordem: 1 },
              { nome: destino.split("/")[0].trim(), uf: "", ordem: 2 }
            ]
          };
        }
      })
    );

    return NextResponse.json({ rotas: rotasProcessadas });

  } catch (error: any) {
    console.error("Erro crítico no back-end do planejador de rotas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}