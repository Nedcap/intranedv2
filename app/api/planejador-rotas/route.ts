import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Criamos um seletor de ação para o mesmo endpoint fazer coisas diferentes
    const { action } = body;

    // =========================================================================
    // AÇÃO 1: APENAS PARSEAR E MONTAR A ROTA INICIAL (Sua lógica atual)
    // =========================================================================
    if (action === "GERAR_ROTA") {
      const { origem, destino } = body;

      if (!origem || !destino) {
        return NextResponse.json({ error: "Origem e destino são obrigatórios." }, { status: 400 });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY; 
      if (!googleApiKey) {
        return NextResponse.json({ error: "Chave do Google Maps não configurada." }, { status: 500 });
      }

      const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&alternatives=true&key=${googleApiKey}&region=br&language=pt-BR`;
      const mapsResponse = await fetch(googleUrl);
      const mapsData = await mapsResponse.json();

      if (mapsData.status !== "OK") {
        return NextResponse.json({ error: `Erro no Google Maps: ${mapsData.status}` }, { status: 400 });
      }

      const rotasProcessadas = mapsData.routes.map((route: any, index: number) => {
        const cidadesSet = new Set<string>();
        const cidadesDetalhadas: Array<{ nome: string; uf: string; ordem: number }> = [];
        const percurso = route.legs[0];
        let ordemContador = 1;

        // Origem
        const splitPartida = percurso.start_address.split("-");
        const cidadePartidaNome = splitPartida[0]?.trim();
        const ufPartida = splitPartida[1]?.split(",")?.[0]?.trim() || "";
        if (cidadePartidaNome) {
          cidadesSet.add(`${cidadePartidaNome}-${ufPartida}`);
          cidadesDetalhadas.push({ nome: cidadePartidaNome, uf: ufPartida, ordem: ordemContador++ });
        }

        // Steps (Meio do caminho)
        if (percurso.steps && percurso.steps.length > 0) {
          percurso.steps.forEach((step: any) => {
            const htmlText = step.html_instructions || "";
            const matchDirecao = htmlText.match(/direção a\s+<b>([^<]+)<\/b>/i);
            if (matchDirecao && matchDirecao[1]) {
              const candidato = matchDirecao[1].split("-");
              const nomeCidade = candidato[0]?.trim();
              const ufCidade = candidato[1]?.trim() || "";
              const ehRodovia = nomeCidade.includes("Rodovia") || nomeCidade.includes("BR-") || nomeCidade.includes("SP-") || nomeCidade.includes("PR-") || nomeCidade.match(/^[A-Z]{2}-\d{3}$/);

              if (nomeCidade && nomeCidade.length > 2 && !ehRodovia) {
                const chaveUnica = `${nomeCidade}-${ufCidade}`;
                if (!cidadesSet.has(chaveUnica)) {
                  cidadesSet.add(chaveUnica);
                  cidadesDetalhadas.push({ nome: nomeCidade, uf: ufCidade || ufPartida, ordem: ordemContador++ });
                }
              }
            }
          });
        }

        // Destino
        const splitChegada = percurso.end_address.split("-");
        const cidadeChegadaNome = splitChegada[0]?.trim();
        const ufChegada = splitChegada[1]?.split(",")?.[0]?.trim() || "";
        if (cidadeChegadaNome) {
          const chaveDestino = `${cidadeChegadaNome}-${ufChegada}`;
          if (!cidadesSet.has(chaveDestino)) {
            cidadesDetalhadas.push({ nome: cidadeChegadaNome, uf: ufChegada, ordem: ordemContador++ });
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
    }

    // =========================================================================
    // AÇÃO 2: SOLICITAÇÃO INDIVIDUAL POR ETAPA (O clique de buscar na aba da cidade)
    // =========================================================================
    if (action === "PROSPECTAR_CIDADE") {
      const { nomeCidade, uf, atividade } = body;

      if (!nomeCidade) {
        return NextResponse.json({ error: "Nome da cidade é obrigatório para prospecção." }, { status: 400 });
      }

      // Aqui o back-end do planejador faz a ponte individual com o seu motor de IA
      // Você pode fazer um fetch interno ou chamar a função da prospeccao-ia direta
      const urlProspeccao = `${req.url.split('/api/')[0]}/api/prospeccao-ia`; // Pega a base URL dinamicamente
      
      const respostaIA = await fetch(urlProspeccao, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cidade: nomeCidade, uf, atividade })
      });

      const dadosEmpresas = await respostaIA.json();

      return NextResponse.json({
        cidade: nomeCidade,
        empresas: dadosEmpresas.empresas || []
      });
    }

    return NextResponse.json({ error: "Ação inválida ou não informada." }, { status: 400 });

  } catch (error: any) {
    console.error("Erro no back-end do planejador de rotas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}