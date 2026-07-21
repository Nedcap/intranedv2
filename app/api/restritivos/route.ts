import { NextResponse } from "next/server";

// =========================================================================
// FUNÇÃO AUXILIAR: Faz a chamada na CreditHub e padroniza a resposta
// =========================================================================
async function consultarCreditHub(documentoLimpo: string, apiKeyTratada: string, nomeAlvo: string) {
  const urlCreditHub = `https://irql.credithub.com.br/simples/${apiKeyTratada}/${documentoLimpo}?serasa=true`;

  const response = await fetch(urlCreditHub, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store" 
  });

  const textData = await response.text();

  if (textData.trim().startsWith("<")) {
    const match = textData.match(/<exception[^>]*>(.*?)<\/exception>/);
    const erroReal = match ? match[1] : "Erro de autenticação/parâmetros no CreditHub.";
    throw new Error(`Erro XML: ${erroReal}`);
  }

  const json = JSON.parse(textData);

  if (!response.ok || json.status === "erro") {
    throw new Error(json.msg || json.message || "Falha ao consultar.");
  }

  const data = json.data || {};
  
  // 1. Extração Serasa/Restritivos
  const refin = data.refin || {};
  const spc = refin.spc?.[0] || []; 
  
  let qtdDividas = 0;
  let valorTotal = 0;

  const credores = spc.map((divida: any) => {
    qtdDividas++;
    const valorNumerico = parseFloat(String(divida.Valor).replace(/\./g, "").replace(",", "."));
    valorTotal += isNaN(valorNumerico) ? 0 : valorNumerico;

    return {
      credor: divida.NomeAssociado,
      valor: divida.Valor,
      vencimento: divida.DataDoVencimento
    };
  });

  const resumoRestritivos = {
    possui_apontamento: qtdDividas > 0,
    quantidade_dividas: qtdDividas,
    valor_total_dividas: valorTotal,
    ccf: data.ccf || null,
    pefin_serasa: credores,
  };

  // 2. Extração Processos
  const dadosProcessos = data.processos || [];
  const processosLimpos = dadosProcessos.map((proc: any) => {
    const tramitacao = proc.tramitacoes?.[0] || {};
    
    let classeDesc = tramitacao.classe?.[0]?.descricao;
    if (!classeDesc || classeDesc.includes("inválido")) {
      classeDesc = tramitacao.assunto?.[0]?.descricao || "Não Informada";
    }

    return {
      numero: proc.numeroProcesso || "S/N",
      classe: classeDesc,
      tribunal: proc.siglaTribunal || tramitacao.tribunal?.sigla || "N/D",
      alvo: nomeAlvo // 🔥 Identifica se o processo é da Empresa ou do Sócio
    };
  });

  return { 
    resumo: resumoRestritivos, 
    processos: processosLimpos, 
    ficha_cadastral: data.rfb || {},
    raw: json 
  };
}

// =========================================================================
// ROTA PRINCIPAL DA API
// =========================================================================
export async function POST(request: Request) {
  try {
    const { documento } = await request.json();

    if (!documento) {
      return NextResponse.json({ error: "Documento é obrigatório" }, { status: 400 });
    }

    const docLimpo = String(documento).replace(/\D/g, "");
    
    const rawApiKey = process.env.CREDITHUB_API_KEY; 
    const apiKey = rawApiKey ? rawApiKey.trim() : null;

    if (!apiKey) {
      throw new Error("Chave do CreditHub não localizada no process.env do servidor.");
    }

    const apiKeyTratada = encodeURIComponent(apiKey);

    console.log(`🔗 Disparando consulta estruturada para a Empresa: ${docLimpo}`);

    // =========================================================================
    // 1. CONSULTA A EMPRESA PRINCIPAL
    // =========================================================================
    const resultEmpresa = await consultarCreditHub(docLimpo, apiKeyTratada, "EMPRESA PRINCIPAL");

    // =========================================================================
    // 2. IDENTIFICA E CONSULTA OS SÓCIOS EM PARALELO
    // =========================================================================
    const socios = resultEmpresa.ficha_cadastral?.socios || [];
    
    // Filtra apenas os sócios que possuem documento (CPF/CNPJ) válido
    // A Receita Federal às vezes mascara o CPF (***.123.456-**). Só consultamos se for limpo.
    const cpfsValidos = socios
      .map((s: any) => ({
        nome: s.nome || "Sócio",
        doc: String(s.documento || s.cpf || "").replace(/\D/g, "")
      }))
      .filter((s: any) => s.doc.length === 11 || s.doc.length === 14);

    let processosGerais = [...resultEmpresa.processos];
    let resumoSocios: any[] = [];

    if (cpfsValidos.length > 0) {
      console.log(`👥 Foram encontrados ${cpfsValidos.length} sócio(s) com documento válido. Consultando em paralelo...`);
      
      const promessasSocios = cpfsValidos.map((socio: any) => 
        consultarCreditHub(socio.doc, apiKeyTratada, `SÓCIO: ${socio.nome}`)
          .then(res => ({ nome: socio.nome, documento: socio.doc, ...res }))
          .catch(err => {
            console.error(`Erro ao consultar o sócio ${socio.nome}:`, err.message);
            return null;
          })
      );

      const resultadosSocios = await Promise.all(promessasSocios);

      // Agrega os resultados dos sócios
      resultadosSocios.filter(Boolean).forEach((resSocio: any) => {
        // Junta os processos do sócio na lista geral de processos
        processosGerais = [...processosGerais, ...resSocio.processos];
        
        // Guarda o resumo de dívidas/cheques do sócio
        resumoSocios.push({
          nome: resSocio.nome,
          documento: resSocio.documento,
          restritivos: resSocio.resumo
        });
      });
    }

    // =========================================================================
    // 3. DEVOLVE O PACOTÃO COMPLETO (EMPRESA + SÓCIOS)
    // =========================================================================
    return NextResponse.json({ 
      resumo: resultEmpresa.resumo,
      resumo_socios: resumoSocios, // 🔥 Novo nó com o financeiro dos sócios
      processos: processosGerais,  // 🔥 Processos da empresa e dos sócios misturados e identificados
      ficha_cadastral: resultEmpresa.ficha_cadastral, 
      raw_completo: resultEmpresa.raw
    });

  } catch (err: any) {
    console.error("💥 Erro crítico na rota de restritivos:", err);
    return NextResponse.json({ error: "Erro interno no servidor", details: err.message }, { status: 500 });
  }
}