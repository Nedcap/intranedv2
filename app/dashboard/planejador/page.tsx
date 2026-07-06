/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

interface CidadeRota {
  nome: string;
  uf: string;
  ordem: number;
}

interface RotaAlternativa {
  id_rota: number;
  nome_rota: string;
  distancia: string;
  duracao: string;
  polyline_geral: string;
  cidades: CidadeRota[];
}

interface Lead {
  cnpj: string;
  cnpj_raiz?: string;
  matriz_filial?: string;
  situacao: string;
  data_abertura?: string;
  cnae_principal: string;
  cnaes_secundarios?: string;
  bairro: string;
  cep?: string;
  uf: string;
  municipio_rf?: string;
  razao_social: string;
  nome_fantasia?: string;
  natureza_juridica?: string;
  capital_social?: number;
  google_categoria?: string;
  google_endereco?: string;
  website?: string;
  lat?: number; 
  lng?: number; 
  parada_origem?: string;
  observacaoCommercial?: string; 
}

export default function PlanejadorRotasPage() {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [limiteCidade, setLimiteCidade] = useState(30);
  const [filtroNicho, setFiltroNicho] = useState("Empresas Gerais"); 

  const [calculandoRota, setCalculandoRota] = useState(false);
  const [carregandoCidadeId, setCarregandoCidadeId] = useState<string | null>(null);

  const [todasAsRotas, setTodasAsRotas] = useState<RotaAlternativa[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaAlternativa | null>(null);
  
  const [cidadesDaVisao, setCidadesDaVisao] = useState<CidadeRota[]>([]);
  const [bancoLeadsPorCidade, setBancoLeadsPorCidade] = useState<Record<string, Lead[]>>({});
  const [cidadeAbAtiva, setCidadeAbAtiva] = useState<string>("");

  const [roteiroFinal, setRoteiroFinal] = useState<Lead[]>([]);
  const [abaPrincipalVisualizacao, setAbaPrincipalVisualizacao] = useState<"PROSPECCAO" | "MEU_ROTEIRO">("PROSPECCAO");

  const mapearMalhaRodoviaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origem || !destino) return;

    setCalculandoRota(true);
    setTodasAsRotas([]);
    setRotaSelecionada(null);
    setCidadesDaVisao([]);
    setBancoLeadsPorCidade({});
    setCidadeAbAtiva("");

    try {
      const res = await fetch("/api/planejador-rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "GERAR_ROTA", 
          origem, 
          destino 
        }),
      });

      const dados = await res.json();
      if (dados.error) throw new Error(dados.error);

      if (dados.rotas && dados.rotas.length > 0) {
        setTodasAsRotas(dados.rotas);
        setRotaSelecionada(dados.rotas[0]);
        setCidadesDaVisao(dados.rotas[0].cidades);
        setCidadeAbAtiva(dados.rotas[0].cidades[0]?.nome || "");
      } else {
        alert("Nenhuma rota cadastrada ou encontrada para o trecho informado.");
      }
    } catch (err: any) {
      alert("❌ Erro ao cruzar malha logística: " + err.message);
    } finally {
      setCalculandoRota(false);
    }
  };

  const excluirCidadeDaRota = (nomeCidade: string) => {
    const filtradas = cidadesDaVisao.filter((c) => c.nome !== nomeCidade);
    setCidadesDaVisao(filtradas);
    
    if (cidadeAbAtiva === nomeCidade) {
      setCidadeAbAtiva(filtradas[0]?.nome || "");
    }
  };

  const processarProspeccaoCidadeAtiva = async (nomeCidade: string, ufCidade: string) => {
    if (bancoLeadsPorCidade[nomeCidade]) return; 

    setCarregandoCidadeId(nomeCidade);

    try {
      const promptConstruido = `${filtroNicho} em ${nomeCidade} - ${ufCidade}`;

      const res = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          promptUsuario: promptConstruido,
          limite: limiteCidade
        }),
      });

      const dados = await res.json();
      if (dados.error) throw new Error(dados.error);

      const obtidos = dados.leads || [];
      const tratados = obtidos.map((l: any) => ({
        ...l,
        cidadeExtenso: nomeCidade,
        uf: ufCidade,
        parada_origem: nomeCidade,
        observacaoCommercial: "",
        lat: l.lat || null, 
        lng: l.lng || null  
      }));

      setBancoLeadsPorCidade((prev) => ({
        ...prev,
        [nomeCidade]: tratados,
      }));
    } catch (err: any) {
      alert(`❌ Falha ao prospectar ${nomeCidade}: ` + err.message);
    } finally {
      setCarregandoCidadeId(null);
    }
  };

// 🎯 Mágica para abrir o Google Maps Real com a Rota Completa contendo apenas as Cidades Ativas
  const abrirGoogleMapsComCidadesAtivas = () => {
    if (cidadesDaVisao.length === 0) return;
    
    const pontoA = cidadesDaVisao[0];
    const pontoB = cidadesDaVisao[cidadesDaVisao.length - 1];
    const intermediarias = cidadesDaVisao.slice(1, -1);
    
    // Padrão de busca estruturado para o motor do Maps não se perder
    const origemParam = encodeURIComponent(`${pontoA.nome}, ${pontoA.uf}, Brasil`);
    const destinoParam = encodeURIComponent(`${pontoB.nome}, ${pontoB.uf}, Brasil`);
    
    // No padrão moderno (dir), os waypoints são separados por barras '/' ou pipes '|' dependendo da API
    // Para links de navegação direta abertos no navegador/app, o parâmetro oficial é '&waypoints='
    const waypointsParam = intermediarias.length > 0 
      ? `&waypoints=${intermediarias.map(c => encodeURIComponent(`${c.nome}, ${c.uf}, Brasil`)).join('|')}`
      : "";
      
    // 🔥 URL ATUALIZADA: Usando o endpoint oficial moderno '/dir/?api=1' que força o modo de rotas com paradas
    const urlMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origemParam}&destination=${destinoParam}${waypointsParam}&travelmode=driving`;
    
    window.open(urlMapsUrl, "_blank");
  };

  const adicionarAoRoteiro = (lead: Lead) => {
    if (roteiroFinal.some((item) => item.cnpj === lead.cnpj)) {
      alert("Esta empresa já está integrada ao seu roteiro de viagem.");
      return;
    }
    setRoteiroFinal((prev) => [...prev, lead]);
  };

  const removerDoRoteiro = (cnpj: string) => {
    setRoteiroFinal((prev) => prev.filter((item) => item.cnpj !== cnpj));
  };

  const atualizarObservacao = (cnpj: string, texto: string) => {
    setRoteiroFinal((prev) =>
      prev.map((item) => (item.cnpj === cnpj ? { ...item, observacaoCommercial: texto } : item))
    );
  };

  const exportarParaCSV = () => {
    const listaAlvo = abaPrincipalVisualizacao === "MEU_ROTEIRO" ? roteiroFinal : bancoLeadsPorCidade[cidadeAbAtiva] || [];
    if (listaAlvo.length === 0) return;

    const headers = ["Cidade Parada", "CNPJ", "Razão Social", "Nome Fantasia", "Bairro", "CNAE Principal", "Situação RF", "Capital Social", "Website Google", "Lat", "Lng", "Obs Planejamento"];
    const rows = listaAlvo.map((lead) => [
      `"${lead.parada_origem || ""}"`,
      `"${lead.cnpj || ""}"`,
      `"${(lead.razao_social || "").replace(/"/g, '""')}"`,
      `"${(lead.nome_fantasia || "").replace(/"/g, '""')}"`,
      `"${(lead.bairro || "").replace(/"/g, '""')}"`,
      `"${lead.cnae_principal || ""}"`,
      `"${lead.situacao || ""}"`,
      `"${lead.capital_social || 0}"`,
      `"${lead.website || ""}"`,
      `"${lead.lat || ""}"`,
      `"${lead.lng || ""}"`,
      `"${(lead.observacaoCommercial || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${abaPrincipalVisualizacao === "MEU_ROTEIRO" ? "Roteiro_Final_FIDC" : `Leads_Otimizados_${cidadeAbAtiva}`}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const leadsExibicaoAba = bancoLeadsPorCidade[cidadeAbAtiva] || [];
  const objetoCidadeAtiva = cidadesDaVisao.find((c) => c.nome === cityKey(cidadeAbAtiva));

  const totalEmpresasMapeadasNoCache = Object.values(bancoLeadsPorCidade).reduce((acc, curr) => acc + curr.length, 0);
  const totalCapitalSocialRoteiroFinal = roteiroFinal.reduce((acc, curr) => acc + (curr.capital_social || 0), 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1750px] mx-auto space-y-6">
        
        {/* TOP BRANDING BAR */}
        <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded text-[10px] tracking-wider uppercase shadow-sm">
                Proprietary Core v2.5
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                BigQuery Spatially Clustered
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-2">
              GeoProspector AI — Inteligência de Campo & Roteirização FIDC
            </h1>
          </div>
        </div>

        {/* CONTROLE INPUT DE ROTAS */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <form onSubmit={mapearMalhaRodoviaria} className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Origem</label>
              <input type="text" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: São Paulo / SP" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-indigo-600 focus:shadow-sm transition-all" />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Destino</label>
              <input type="text" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex: Maringá / PR" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-indigo-600 focus:shadow-sm transition-all" />
            </div>
            <button type="submit" disabled={calculandoRota || !origem || !destino} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-all cursor-pointer shadow-sm disabled:opacity-40">
              {calculandoRota ? "🧠 Decodificando Malha e Rodovias..." : "🛣️ Construir Itinerário Inteligente"}
            </button>
          </form>
        </div>

        {/* LISTAGEM DE ROTAS ALTERNATIVAS DA API DO MAPS */}
        {todasAsRotas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <span className="block font-black text-slate-400 uppercase text-[10px] tracking-widest">Rotas Reais Encontradas (Selecione uma para trabalhar):</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todasAsRotas.map((rota) => (
                <div
                  key={rota.id_rota}
                  onClick={() => {
                    setRotaSelecionada(rota);
                    setCidadesDaVisao(rota.cidades);
                    setCidadeAbAtiva(rota.cidades[0]?.nome || "");
                  }}
                  className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                    rotaSelecionada?.id_rota === rota.id_rota
                      ? "border-indigo-600 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-xs text-slate-900 uppercase">🛣️ Via {rota.nome_rota}</span>
                    <span className="bg-slate-200 text-slate-800 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold shadow-sm">{rota.distancia}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1 font-medium">Tempo estimado de pista: <span className="text-slate-800 font-bold">{rota.duracao}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NAVEGAÇÃO DE MODOS FLUXO COMERCIAL */}
        {rotaSelecionada && (
          <div className="flex gap-2 border-b border-slate-200 pt-2">
            <button
              onClick={() => setAbaPrincipalVisualizacao("PROSPECCAO")}
              className={`px-5 py-2.5 font-black text-xs uppercase rounded-t-xl transition-all ${
                abaPrincipalVisualizacao === "PROSPECCAO" 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "bg-slate-200/50 text-slate-600 hover:bg-slate-200"
              }`}
            >
              🚀 Prospecção Territorial ({cidadesDaVisao.length} Cidades Otimizadas)
            </button>
            <button
              onClick={() => setAbaPrincipalVisualizacao("MEU_ROTEIRO")}
              className={`px-5 py-2.5 font-black text-xs uppercase rounded-t-xl transition-all flex items-center gap-2.5 ${
                abaPrincipalVisualizacao === "MEU_ROTEIRO" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "bg-slate-200/50 text-indigo-600 hover:bg-slate-200"
              }`}
            >
              💼 Roteiro de Campo Fechado
              <span className="bg-white text-slate-900 px-2 py-0.2 rounded font-mono font-black text-[10px] shadow-sm">
                {roteiroFinal.length}
              </span>
            </button>
          </div>
        )}

        {/* MÓDULO 1: SALA DE PROSPECÇÃO COM LAYOUT SPLIT */}
        {rotaSelecionada && abaPrincipalVisualizacao === "PROSPECCAO" && (
          <div className="grid grid-cols-1 xl:grid-cols-10 gap-6 items-start">
            
            {/* PAINEL ESQUERDO: MINERAÇÃO E TABELA */}
            <div className="xl:col-span-6 space-y-4">
              
              {/* COMPONENTE DE ABAS GEOGRÁFICAS DE FLUXO CONTÍNUO */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <span className="block font-black text-slate-400 uppercase text-[10px] tracking-widest">
                  Selecione uma parada logística na rodovia para trabalhar os leads:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {cidadesDaVisao.map((cidade, idx) => {
                    const jaTemLeads = !!bancoLeadsPorCidade[cidade.nome];
                    const estaAtiva = cidadeAbAtiva === cityKey(cidade.nome);

                    return (
                      <div key={idx} className={`flex items-center flex-shrink-0 border rounded-lg shadow-sm pl-1 pr-2 py-1 transition-all ${
                        estaAtiva ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200 bg-white"
                      }`}>
                        <button
                          type="button"
                          onClick={() => setCidadeAbAtiva(cidade.nome)}
                          className={`px-2 py-1 rounded font-black text-[11px] uppercase transition-all flex items-center gap-1.5 ${
                            estaAtiva ? "text-indigo-700" : "text-slate-600"
                          }`}
                        >
                          {jaTemLeads ? "✅" : "📍"} {cidade.nome}
                          {jaTemLeads && (
                            <span className="bg-emerald-600 text-white font-mono px-1.5 py-0.2 rounded text-[9px] font-black">
                              {bancoLeadsPorCidade[cidade.nome].length}
                            </span>
                          )}
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); excluirCidadeDaRota(cidade.nome); }} 
                          className="ml-1 text-slate-300 hover:text-red-600 font-black px-1 text-[11px] cursor-pointer transition-colors"
                          title="Excluir cidade deste planejamento de rota"
                        >
                          ✕
                        </button>
                        {idx < cidadesDaVisao.length - 1 && <span className="text-slate-300 font-bold ml-2.5">➔</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CONTEÚDO DINÂMICO DA TABELA DE CAPTAÇÃO */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="font-black text-slate-900 uppercase text-xs">
                      Parada Ativa: <span className="text-indigo-600">{cidadeAbAtiva || "Nenhuma"}</span>
                    </h3>
                  </div>

                  {/* MINERAÇÃO INTEGRADA DE NICHO E LIMITE */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-500 text-[10px] uppercase">Nicho Prospecção:</span>
                      <input 
                        type="text" 
                        value={filtroNicho} 
                        onChange={(e) => setFiltroNicho(e.target.value)} 
                        className="p-1 px-2 bg-white border border-slate-200 rounded text-xs font-bold w-[130px] outline-none focus:border-indigo-500 text-slate-800" 
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-500 text-[10px] uppercase">Leads/Req:</span>
                      <select value={limiteCidade} onChange={(e) => setLimiteCidade(Number(e.target.value))} className="p-1 bg-white border border-slate-200 rounded text-xs font-bold outline-none text-slate-800">
                        <option value={15}>15</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <button onClick={exportarParaCSV} disabled={leadsExibicaoAba.length === 0} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-[11px] uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer shadow-sm">
                      📊 Exportar Aba
                    </button>
                  </div>
                </div>

                {/* CONTROLE DE FLUXO DE ACIONAMENTO DO BIGQUERY */}
                {carregandoCidadeId === cidadeAbAtiva ? (
                  <div className="p-16 text-center space-y-3 bg-white">
                    <div className="animate-spin text-2xl inline-block text-indigo-600">⚡</div>
                    <p className="font-black text-slate-500 uppercase tracking-widest text-xs">
                      BigQuery varrendo o Cluster {cidadeAbAtiva} via IA Otimizada...
                    </p>
                  </div>
                ) : !cidadeAbAtiva ? (
                  <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-wider bg-slate-50/40">
                    Defina e mapeie um itinerário no formulário superior.
                  </div>
                ) : leadsExibicaoAba.length === 0 ? (
                  <div className="p-16 text-center bg-slate-50/30 space-y-4">
                    <div className="text-slate-400 font-black text-xs uppercase tracking-widest">Base de Dados Aguardando Comando</div>
                    <p className="text-slate-400 max-w-md mx-auto text-xs font-medium">
                      A partição do BigQuery para <span className="text-slate-700 font-bold">{cidadeAbAtiva}</span> ainda não sofreu o request por etapas. Dispare a extração via IA abaixo.
                    </p>
                    <button
                      type="button"
                      onClick={() => objetoCidadeAtiva && processarProspeccaoCidadeAtiva(objetoCidadeAtiva.nome, objetoCidadeAtiva.uf)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer"
                    >
                      🔍 Extrair CNPJs de {cidadeAbAtiva}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse relative">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200 sticky top-0 bg-opacity-100 backdrop-blur shadow-sm z-10">
                          <th className="p-3 bg-slate-50">Ação</th>
                          <th className="p-3 bg-slate-50">CNPJ / Situação</th>
                          <th className="p-3 bg-slate-50">Razão Social / Nome Fantasia</th>
                          <th className="p-3 bg-slate-50">Bairro</th>
                          <th className="p-3 bg-slate-50">Capital Social</th>
                          <th className="p-3 bg-slate-50">Pesquisa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-xs bg-white">
                        {leadsExibicaoAba.map((lead) => {
                          const jaEstaNoRoteiro = roteiroFinal.some((r) => r.cnpj === lead.cnpj);
                          return (
                            <tr key={lead.cnpj} className="hover:bg-indigo-50/20 transition-all">
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => adicionarAoRoteiro(lead)}
                                  className={`px-2.5 py-1 rounded font-black text-[10px] uppercase transition-all cursor-pointer shadow-sm border ${
                                    jaEstaNoRoteiro
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 cursor-not-allowed"
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700"
                                  }`}
                                  disabled={jaEstaNoRoteiro}
                                >
                                  {jaEstaNoRoteiro ? "✓ Selecionada" : "➕ Roteiro"}
                                </button>
                              </td>
                              <td className="p-3 space-y-0.5">
                                <div className="font-mono font-bold text-slate-600">{lead.cnpj}</div>
                                <span className="inline-block bg-emerald-50 text-emerald-700 font-extrabold px-1.5 rounded text-[9px] uppercase border border-emerald-200">
                                  Ativa
                                </span>
                              </td>
                              <td className="p-3 truncate max-w-[280px]">
                                <div className="font-black text-slate-900 uppercase truncate" title={lead.razao_social}>{lead.razao_social}</div>
                                <div className="text-indigo-600 font-bold uppercase text-[11px] truncate">{lead.nome_fantasia || "—"}</div>
                              </td>
                              <td className="p-3 text-slate-500 uppercase font-bold">{lead.bairro || "Centro"}</td>
                              <td className="p-3 text-slate-900 font-mono font-bold">
                                {lead.capital_social ? lead.capital_social.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
                              </td>
                              <td className="p-3">
                                <button 
                                  type="button"
                                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social + " " + lead.cidadeExtenso)}`, "_blank")} 
                                  className="bg-white border border-slate-300 font-black px-2 py-1 rounded text-[10px] uppercase hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
                                >
                                  🔍 Google
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* PAINEL DIREITO: CONTROLADOR DE INTELIGÊNCIA LOGÍSTICA */}
            <div className="xl:col-span-4 space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md border border-slate-800 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Painel de Campo</span>
                    <h2 className="text-base font-black text-white uppercase tracking-tight mt-1">Sala de Situação Logística</h2>
                  </div>
                  <button
                    type="button"
                    onClick={abrirGoogleMapsComCidadesAtivas}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 text-white font-black rounded-lg text-[11px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    📍 Abrir Rota no Google Maps
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/60 border border-slate-800 p-3 rounded-lg">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Leads em Memória</span>
                    <span className="text-xl font-mono font-black text-indigo-400 mt-1 block">{totalEmpresasMapeadasNoCache}</span>
                  </div>
                  <div className="bg-slate-800/60 border border-slate-800 p-3 rounded-lg">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinos Salvos</span>
                    <span className="text-xl font-mono font-black text-emerald-400 mt-1 block">{roteiroFinal.length}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Progresso Físico do Trajeto:</span>
                  <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                    {cidadesDaVisao.map((c, i) => {
                      const cidadeMinerada = !!bancoLeadsPorCidade[c.nome];
                      const cidadeAtivaNoMomento = cidadeAbAtiva === c.nome;
                      
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] font-black shadow-sm ${
                              cidadeAtivaNoMomento 
                                ? "bg-indigo-500 text-white ring-4 ring-indigo-500/30 animate-pulse" 
                                : cidadeMinerada ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"
                            }`}>
                              {i + 1}
                            </div>
                            {i < cidadesDaVisao.length - 1 && <div className="w-0.5 h-5 bg-slate-700 my-0.5" />}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-black uppercase ${cidadeAtivaNoMomento ? "text-indigo-400 font-extrabold" : "text-slate-300"}`}>
                              {c.nome} / {c.uf}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium font-mono">
                              {cidadeMinerada ? `✔ ${bancoLeadsPorCidade[c.nome].length} leads em cache` : "⏳ Aguardando leitura de banco"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULO 2: VISÃO COBRANÇA / CONSOLIDAÇÃO DO ROTEIRO FECHADO */}
        {abaPrincipalVisualizacao === "MEU_ROTEIRO" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-indigo-950 p-4.5 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-indigo-900">
              <div>
                <h2 className="text-base font-black uppercase tracking-wider">💼 Itinerário Consolidado e Carteira Logística Fechada</h2>
                <p className="text-indigo-200/80 text-xs mt-0.5 font-medium">
                  Visão executiva e higienizada pronta para o vendedor levar para a estrada com anotações estratégicas salvando em real-time.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-indigo-900/60 px-3 py-1.5 rounded-lg border border-indigo-800 text-right">
                  <span className="block text-[9px] font-black text-indigo-300 uppercase tracking-widest">Capital Social Global</span>
                  <span className="text-sm font-mono font-black text-emerald-400">
                    {totalCapitalSocialRoteiroFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <button onClick={exportarParaCSV} disabled={roteiroFinal.length === 0} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-colors disabled:opacity-40 cursor-pointer shadow-md">
                  📊 Exportar Planilha de Viagem (.CSV)
                </button>
              </div>
            </div>

            {roteiroFinal.length === 0 ? (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-wider bg-slate-50/40">
                Seu roteiro final está vazio. Navegue pelas abas da estrada e adicione empresas de interesse.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                      <th className="p-3.5">Parada / Cidade</th>
                      <th className="p-3.5">Identificação do Target</th>
                      <th className="p-3.5">Bairro</th>
                      <th className="p-3.5 text-indigo-700 bg-indigo-50/50">✍️ Observações Estratégicas e Agendamento (Salva em Cache Local)</th>
                      <th className="p-3.5 text-center">Gestão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-xs bg-white">
                    {roteiroFinal.map((lead) => (
                      <tr key={lead.cnpj} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-black px-2.5 py-1 rounded-md text-[10px] uppercase shadow-sm">
                            📍 {lead.parada_origem}
                          </span>
                        </td>
                        <td className="p-3.5 space-y-0.5">
                          <div className="font-black text-slate-900 uppercase truncate max-w-[320px]">{lead.razao_social}</div>
                          <div className="text-[11px] font-mono text-slate-400 font-bold">{lead.cnpj}</div>
                        </td>
                        <td className="p-3.5 text-slate-500 uppercase font-bold">{lead.bairro || "Centro"}</td>
                        <td className="p-3.5 w-[42%] bg-indigo-50/10">
                          <input
                            type="text"
                            value={lead.observacaoCommercial || ""}
                            onChange={(e) => atualizarObservacao(lead.cnpj, e.target.value)}
                            placeholder="Ex: Agendado com Diretor Carlos às 14h / Levar proposta de antecipação..."
                            className="w-full p-2.5 bg-white border border-slate-300 rounded font-bold text-slate-800 outline-none focus:border-indigo-600 focus:shadow-sm shadow-inner transition-all text-xs"
                          />
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => removerDoRoteiro(lead.cnpj)}
                            className="p-1.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded text-[10px] font-black uppercase transition-colors cursor-pointer shadow-sm"
                          >
                            ❌ Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function cityKey(name: string): string {
  return name ? name.trim() : "";
}