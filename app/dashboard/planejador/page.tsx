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
  razao_social: string;
  nome_fantasia?: string;
  cidadeExtenso: string;
  uf: string;
  bairro: string;
  cnae_principal: string;
  situacao: string;
  website?: string;
  parada_origem?: string;
  observacaoCommercial?: string; // Observação inserida pelo vendedor
}

export default function PlanejadorRotasPage() {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [atividade, setAtividade] = useState("");
  const [limiteCidade, setLimiteCidade] = useState(30);

  const [calculandoRota, setCalculandoRota] = useState(false);
  const [carregandoCidadeId, setCarregandoCidadeId] = useState<string | null>(null);

  // Estados das Rotas calculadas
  const [todasAsRotas, setTodasAsRotas] = useState<RotaAlternativa[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaAlternativa | null>(null);

  // Mapeamento de Leads por Cidade: { "Sorocaba": [Leads...] } -> Evita requests duplicados
  const [bancoLeadsPorCidade, setBancoLeadsPorCidade] = useState<Record<string, Lead[]>>({});
  const [cidadeAbAtiva, setCidadeAbAtiva] = useState<string>("");

  // O Carrinho / Roteiro Final do Comercial
  const [roteiroFinal, setRoteiroFinal] = useState<Lead[]>([]);
  const [abaPrincipalVisualizacao, setAbaPrincipalVisualizacao] = useState<"PROSPECCAO" | "MEU_ROTEIRO">("PROSPECCAO");

  // 1. Chamar o back-end para cruzar as rotas no Google Maps
  const mapearMalhaRodoviaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origem || !destino || !atividade) return;

    setCalculandoRota(true);
    setTodasAsRotas([]);
    setRotaSelecionada(null);
    setBancoLeadsPorCidade({});
    setCidadeAbAtiva("");

    try {
      const res = await fetch("/api/planejador-rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem, destino }),
      });

      const dados = await res.json();
      if (dados.error) throw new Error(dados.error);

      if (dados.rotas && dados.rotas.length > 0) {
        setTodasAsRotas(dados.rotas);
        // Seleciona a primeira rota por padrão
        setRotaSelecionada(dados.rotas[0]);
        setCidadeAbAtiva(dados.rotas[0].cidades[0]?.nome || "");
      } else {
        alert("Nenhuma rota encontrada para o trecho.");
      }
    } catch (err: any) {
      alert("❌ Erro ao cruzar malha logística: " + err.message);
    } finally {
      setCalculandoRota(false);
    }
  };

  // 2. LAZY LOADING: Buscar leads da cidade apenas ao clicar nela, se não existir na memória
  const ativarAbaEBuscarLeads = async (nomeCidade: string, ufCidade: string) => {
    setCidadeAbAtiva(nomeCidade);

    // Se já foi alimentada antes, não faz requisição de novo. Protege tokens e banco!
    if (bancoLeadsPorCidade[nomeCidade]) return;

    setCarregandoCidadeId(nomeCidade);

    try {
      const promptSimulado = `Buscar empresas do segmento '${atividade}' em ${nomeCidade} ${ufCidade}`;

      const res = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptUsuario: promptSimulado, limite: limiteCidade }),
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
      }));

      // Alimenta apenas a caixinha dessa cidade específica no estado do React
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

  // 3. Gerenciamento do Roteiro Final (O Carrinho B2B)
  const adicionarAoRoteiro = (lead: Lead) => {
    if (roteiroFinal.some((item) => item.cnpj === lead.cnpj)) {
      alert("Esta empresa já está no seu roteiro comercial.");
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

    const headers = ["Cidade Origem", "CNPJ", "Razão Social", "Nome Fantasia", "Bairro", "CNAE", "Situação", "Obs Vendedor"];
    const rows = listaAlvo.map((lead) => [
      `"${lead.parada_origem || ""}"`,
      `"${lead.cnpj || ""}"`,
      `"${(lead.razao_social || "").replace(/"/g, '""')}"`,
      `"${(lead.nome_fantasia || "").replace(/"/g, '""')}"`,
      `"${(lead.bairro || "").replace(/"/g, '""')}"`,
      `"${lead.cnae_principal || ""}"`,
      `"${lead.situacao || ""}"`,
      `"${(lead.observacaoCommercial || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${abaPrincipalVisualizacao === "MEU_ROTEIRO" ? "Roteiro_Final_Comercial" : `Leads_${cidadeAbAtiva}`}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const leadsExibicaoAba = bancoLeadsPorCidade[cidadeAbAtiva] || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="border-b border-slate-200 pb-4">
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
            Módulo Estratégico Comercial - Enterprise v2
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-1.5">
            🗺️ Planejador Geográfico de Rotas & Prospecção Parcelada
          </h1>
        </div>

        {/* FORMULÁRIO DE ENTRADA BRUTA */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <form onSubmit={mapearMalhaRodoviaria} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Origem</label>
              <input type="text" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: São Paulo / SP" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Destino</label>
              <input type="text" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex: Maringá / PR" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Nicho / O que buscar por Cidade?</label>
              <input type="text" value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Ex: Autopeças" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" />
            </div>
            <button type="submit" disabled={calculandoRota || !origem || !destino || !atividade} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-md">
              {calculandoRota ? "🧠 Cruzando Malha Rodoviária..." : "🎯 Mapear Rotas Alternativas"}
            </button>
          </form>
        </div>

        {/* SELETOR DE ROTAS ALTERNATIVAS DO GOOGLE MAPS */}
        {todasAsRotas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <span className="block font-black text-slate-400 uppercase text-[10px] tracking-widest">Rotas Reais Encontradas (Selecione uma para trabalhar):</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todasAsRotas.map((rota) => (
                <div
                  key={rota.id_rota}
                  onClick={() => {
                    setRotaSelecionada(rota);
                    ativarAbaEBuscarLeads(rota.cidades[0]?.nome, rota.cidades[0]?.uf);
                  }}
                  className={`p-3 border rounded-xl cursor-pointer transition-all ${
                    rotaSelecionada?.id_rota === rota.id_rota
                      ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-xs text-slate-900 uppercase">🛣️ {rota.nome_rota}</span>
                    <span className="bg-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold">{rota.distancia}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1">Tempo estimado de rodagem: {rota.duracao}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTROLADOR DE MODOS DA PÁGINA (PROSPECÇÃO EM MASSA VS MEU ROTEIRO COMERCIAL) */}
        {rotaSelecionada && (
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setAbaPrincipalVisualizacao("PROSPECCAO")}
              className={`px-4 py-2 font-black text-xs uppercase rounded-t-lg transition-colors ${
                abaPrincipalVisualizacao === "PROSPECCAO" ? "bg-slate-900 text-white" : "bg-slate-200/60 text-slate-600 hover:bg-slate-200"
              }`}
            >
              🚀 Prospecção por Cidade ({rotaSelecionada.cidades.length} mapeadas)
            </button>
            <button
              onClick={() => setAbaPrincipalVisualizacao("MEU_ROTEIRO")}
              className={`px-4 py-2 font-black text-xs uppercase rounded-t-lg transition-colors flex items-center gap-2 ${
                abaPrincipalVisualizacao === "MEU_ROTEIRO" ? "bg-indigo-600 text-white" : "bg-slate-200/60 text-indigo-600 hover:bg-slate-200"
              }`}
            >
              💼 Meu Roteiro Selecionado
              <span className="bg-white text-slate-900 px-1.5 py-0.2 rounded text-[10px] font-mono font-black">{roteiroFinal.length}</span>
            </button>
          </div>
        )}

        {/* VISÃO 1: PROSPECÇÃO PARCELADA POR ABAS */}
        {rotaSelecionada && abaPrincipalVisualizacao === "PROSPECCAO" && (
          <div className="space-y-4">
            
            {/* MINI MAPA DIGITAL / FLUXO DE ABAS GEOGRÁFICAS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="block font-black text-slate-400 uppercase text-[10px] tracking-widest mb-3">Trajeto da Viagem (Clique na Cidade para Minerar e abrir Aba):</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {rotaSelecionada.cidades.map((cidade, idx) => {
                  const jaTemLeads = !!bancoLeadsPorCidade[cidade.nome];
                  const estaAtiva = cidadeAbAtiva === cityKey(cidade.nome);
                  const estaCarregando = carregandoCidadeId === cidade.nome;

                  return (
                    <div key={idx} className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => ativarAbaEBuscarLeads(cidade.nome, cidade.uf)}
                        className={`px-3 py-2 rounded-lg font-black text-[11px] uppercase transition-all flex items-center gap-2 shadow-sm ${
                          estaAtiva
                            ? "bg-indigo-600 text-white ring-2 ring-indigo-200"
                            : jaTemLeads
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {estaCarregando ? "⏳" : jaTemLeads ? "✅" : "📍"} {cidade.nome} / {cidade.uf}
                        {jaTemLeads && (
                          <span className="bg-emerald-600 text-white font-mono px-1 rounded text-[9px]">
                            {bancoLeadsPorCidade[cidade.nome].length}
                          </span>
                        )}
                      </button>
                      {idx < rotaSelecionada.cidades.length - 1 && <span className="text-slate-300 font-black px-1">➔</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABELÃO BRUTO DA CIDADE SELECIONADA */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-black text-slate-900 uppercase text-xs flex items-center gap-2">
                  🏬 Empresas Disponíveis em: <span className="text-indigo-600">{cidadeAbAtiva || "Nenhuma Selecionada"}</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500 text-[11px] uppercase">Leads por request:</span>
                  <select value={limiteCidade} onChange={(e) => setLimiteCidade(Number(e.target.value))} className="p-1 bg-white border border-slate-300 rounded text-xs font-bold">
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
                  <button onClick={exportarParaCSV} disabled={leadsExibicaoAba.length === 0} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50">
                    📊 Exportar Aba
                  </button>
                </div>
              </div>

              {carregandoCidadeId === cidadeAbAtiva ? (
                <div className="p-12 text-center space-y-2">
                  <div className="animate-spin text-xl inline-block">⚡</div>
                  <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Minerando nuvem e alimentando painel de {cidadeAbAtiva}...</p>
                </div>
              ) : leadsExibicaoAba.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-slate-400 font-medium">Nenhum lead carregado para esta parada. Clique nela acima para disparar o cruzamento parcelado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                        <th className="p-3.5">Ações Comercial</th>
                        <th className="p-3.5">CNPJ</th>
                        <th className="p-3.5">Razão Social Oficial</th>
                        <th className="p-3.5">Nome Fantasia</th>
                        <th className="p-3.5">Bairro</th>
                        <th className="p-3.5">SDR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-xs">
                      {leadsExibicaoAba.map((lead) => {
                        const jaEstaNoRoteiro = roteiroFinal.some((r) => r.cnpj === lead.cnpj);
                        return (
                          <tr key={lead.cnpj} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5">
                              <button
                                onClick={() => adicionarAoRoteiro(lead)}
                                className={`px-2 py-1 rounded font-black text-[10px] uppercase transition-all cursor-pointer shadow-sm ${
                                  jaEstaNoRoteiro
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                }`}
                              >
                                {jaEstaNoRoteiro ? "✓ Adicionado" : "➕ Roteiro"}
                              </button>
                            </td>
                            <td className="p-3.5 font-mono font-bold text-slate-500">{lead.cnpj}</td>
                            <td className="p-3.5 font-black text-slate-900 uppercase truncate max-w-[280px]">{lead.razao_social}</td>
                            <td className="p-3.5 text-indigo-600 font-bold uppercase truncate max-w-[200px]">{lead.nome_fantasia || "—"}</td>
                            <td className="p-3.5 text-slate-500 uppercase">{lead.bairro || "Centro"}</td>
                            <td className="p-3.5">
                              <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social + " " + lead.cidadeExtenso)}`, "_blank")} className="bg-white border border-slate-300 font-bold px-2 py-1 rounded text-[11px] hover:bg-slate-50 shadow-sm">
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
        )}

        {/* VISÃO 2: MEU ROTEIRO COMERCIAL SELECIONADO À DEDO */}
        {abaPrincipalVisualizacao === "MEU_ROTEIRO" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-indigo-900 p-4 text-white flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider">💼 Roteiro de Viagem Fechado</h2>
                <p className="text-indigo-200 text-xs mt-0.5">Visão consolidada para o vendedor viajar com todas as anotações estratégicas em campo.</p>
              </div>
              <button onClick={exportarParaCSV} disabled={roteiroFinal.length === 0} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-xs uppercase tracking-wider transition-colors disabled:opacity-50">
                📊 Exportar Roteiro Excel
              </button>
            </div>

            {roteiroFinal.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">
                Nenhuma empresa foi adicionada ao roteiro até o momento. Volte na aba de prospecção e monte sua carteira logística.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                      <th className="p-3.5">Cidade Parada</th>
                      <th className="p-3.5">Empresa</th>
                      <th className="p-3.5">Bairro</th>
                      <th className="p-3.5 text-indigo-700">✍ Obs Estratégica do Vendedor (Salva na hora)</th>
                      <th className="p-3.5 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-xs">
                    {roteiroFinal.map((lead) => (
                      <tr key={lead.cnpj} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-black px-2 py-0.5 rounded text-[10px] uppercase">
                            📍 {lead.parada_origem}
                          </span>
                        </td>
                        <td className="p-3.5 space-y-0.5">
                          <div className="font-black text-slate-900 uppercase truncate max-w-[300px]">{lead.razao_social}</div>
                          <div className="text-[11px] font-mono text-slate-400">{lead.cnpj}</div>
                        </td>
                        <td className="p-3.5 text-slate-500 uppercase">{lead.bairro}</td>
                        <td className="p-3.5 w-[40%]">
                          <input
                            type="text"
                            value={lead.observacaoCommercial || ""}
                            onChange={(e) => atualizarObservacao(lead.cnpj, e.target.value)}
                            placeholder="Ex: Agendado com Diretor Carlos às 14h / Levar catálogo..."
                            className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => removerDoRoteiro(lead.cnpj)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded text-[10px] font-black uppercase transition-colors"
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

// Função auxiliar simples para tratar a chave do dicionário
function cityKey(name: string): string {
  return name ? name.trim() : "";
}