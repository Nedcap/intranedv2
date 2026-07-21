import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    const cguKey = process.env.CGU_API_KEY;

    if (!cguKey) {
      console.warn("⚠️ Chave CGU_API_KEY não configurada. Simulando retorno limpo.");
      return NextResponse.json({ sancionado: false, ocorrencias: 0, detalhes: [] });
    }

    const headers = {
      "Accept": "application/json",
      "chave-api-dados": cguKey
    };

    // O Portal da Transparência tem vários endpoints, vamos bater nos 3 piores para crédito:
    // CEIS: Cadastro de Empresas Inidôneas e Suspensas
    // CNEP: Cadastro Nacional de Empresas Punidas
    // CEPIM: Entidades Impedidas
    const [reqCeis, reqCnep, reqCepim] = await Promise.all([
      fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/sancoes/ceis?codigoSancionado=${docLimpo}`, { headers }),
      fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/sancoes/cnep?codigoSancionado=${docLimpo}`, { headers }),
      fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/sancoes/cepim?codigoSancionado=${docLimpo}`, { headers })
    ]);

    const resCeis = reqCeis.ok ? await reqCeis.json() : [];
    const resCnep = reqCnep.ok ? await reqCnep.json() : [];
    const resCepim = reqCepim.ok ? await reqCepim.json() : [];

    // Junta todas as sanções num array só
    const todasSancoes = [...resCeis, ...resCnep, ...resCepim];

    const detalhes = todasSancoes.map((sancao: any) => ({
      tipo: sancao.tipoOcorrencia || sancao.tipoSancao?.descricaoMacrocategoria || "Sanção Governamental",
      orgao: sancao.orgaoSancionador?.nome || "Órgão Público",
      data_inicio: sancao.dataInicioSancao || sancao.dataPublicacaoSancao || "N/D",
      data_fim: sancao.dataFimSancao || "N/D",
      fundamentacao: sancao.fundamentacao || "Violação de conduta/contrato público."
    }));

    return NextResponse.json({
      sancionado: detalhes.length > 0,
      ocorrencias: detalhes.length,
      detalhes: detalhes
    });

  } catch (err: any) {
    console.error("💥 Erro na API da CGU:", err);
    return NextResponse.json({ error: "Erro interno", details: err.message }, { status: 500 });
  }
}