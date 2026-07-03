import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // O front-end ainda vai mandar a 'atividade', mas para o desenho da rota, usaremos só origem e destino.
    const { origem, destino } = await req.json();

    if (!origem || !destino) {
      return NextResponse.json(
        { error: "Origem e destino são obrigatórios." },
        { status: 400 }
      );
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY; 
    
    if (!googleApiKey) {
      return NextResponse.json(
        { error: "Chave da API do Google Maps não configurada no servidor (.env)." },
        { status: 500 }
      );
    }

    // Chamando a Directions API do Google com alternativas ativadas para mapear de 1 a 3 rotas
    const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      origem
    )}&destination=${encodeURIComponent(
      destino
    )}&alternatives=true&key=${googleApiKey}&region=br&language=pt-BR`;

    const mapsResponse = await fetch(googleUrl);
    const mapsData = await mapsResponse.json();

    if (mapsData.status !== "OK") {
      return NextResponse.json(
        { error: `Erro no Google Maps: ${mapsData.status} - ${mapsData.error_message || ""}` },
        { status: 400 }
      );
    }

    // Processando as rotas encontradas pelo Google
    const rotasProcessadas = mapsData.routes.map((route: any, index: number) => {
      const cidadesSet = new Set<string>();
      const cidadesDetalhadas: Array<{ nome: string; uf: string; ordem: number }> = [];

      // A primeira 'leg' contém o percurso principal
      const percurso = route.legs[0];
      let ordemContador = 1;

      // 1. Extrair a Origem oficial
      const splitPartida = percurso.start_address.split("-");
      const cidadePartidaNome = splitPartida[0]?.trim();
      const ufPartida = splitPartida[1]?.split(",")?.[0]?.trim() || "";
      
      if (cidadePartidaNome) {
        cidadesSet.add(`${cidadePartidaNome}-${ufPartida}`);
        cidadesDetalhadas.push({
          nome: cidadePartidaNome,
          uf: ufPartida,
          ordem: ordemContador++
        });
      }

      // 2. Extrair as cidades do meio do caminho analisando os passos (steps)
      if (percurso.steps && percurso.steps.length > 0) {
        percurso.steps.forEach((step: any) => {
          const htmlText = step.html_instructions || "";
          
          // O Google geralmente formata destinos de rodovias assim em PT-BR
          const matchDirecao = htmlText.match(/direção a\s+<b>([^<]+)<\/b>/i);
          
          if (matchDirecao && matchDirecao[1]) {
            const candidato = matchDirecao[1].split("-");
            const nomeCidade = candidato[0]?.trim();
            const ufCidade = candidato[1]?.trim() || "";

            // Filtro básico para ignorar nomes de rodovias (BR-116, SP-280, etc) e pegar apenas municípios
            const ehRodovia = nomeCidade.includes("Rodovia") || nomeCidade.includes("BR-") || nomeCidade.includes("SP-") || nomeCidade.includes("PR-") || nomeCidade.match(/^[A-Z]{2}-\d{3}$/);

            if (nomeCidade && nomeCidade.length > 2 && !ehRodovia) {
              const chaveUnica = `${nomeCidade}-${ufCidade}`;
              
              if (!cidadesSet.has(chaveUnica)) {
                cidadesSet.add(chaveUnica);
                cidadesDetalhadas.push({
                  nome: nomeCidade,
                  uf: ufCidade || ufPartida, 
                  ordem: ordemContador++
                });
              }
            }
          }
        });
      }

      // 3. Extrair o Destino oficial
      const splitChegada = percurso.end_address.split("-");
      const cidadeChegadaNome = splitChegada[0]?.trim();
      const ufChegada = splitChegada[1]?.split(",")?.[0]?.trim() || "";

      if (cidadeChegadaNome) {
        const chaveDestino = `${cidadeChegadaNome}-${ufChegada}`;
        if (!cidadesSet.has(chaveDestino)) {
          cidadesDetalhadas.push({
            nome: cidadeChegadaNome,
            uf: ufChegada,
            ordem: ordemContador++
          });
        }
      }

      return {
        id_rota: index + 1,
        nome_rota: route.summary || `Rota Alternativa ${index + 1}`,
        distancia: percurso.distance?.text,
        duracao: percurso.duration?.text,
        polyline_geral: route.overview_polyline?.points,
        cidades: cidadesDetalhadas
      };
    });

    return NextResponse.json({ rotas: rotasProcessadas });

  } catch (error: any) {
    console.error("Erro no back-end do planejador de rotas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}