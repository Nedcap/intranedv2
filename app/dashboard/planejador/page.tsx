/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

interface ParadaSugerida {
  cidade_nome: string;
  uf: string;
  codigo_municipio: string;
  ordem: number;
  justificativa_comercial: string;
  selecionada?: boolean;
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
}

export default function PlanejadorRotasPage() {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [atividade, setAtividade] = useState("");
  const [limiteCidade, setLimiteCidade] = useState(30);
  
  const [calculandoRota, setCalculandoRota] = useState(false);
  const [minerandoLeads, setMinerandoLeads] = useState(false);
  
  const [paradas, setParadas] = useState<ParadaSugerida[]>([]);
  const [familiasCnae, setFamiliasCnae] = useState<string[]>([]);
  const [leadsDaRota, setLeadsDaRota] = useState<Lead[]>([]);
  const [cidadeAtivaFiltro, setCidadeAtivaFiltro] = useState<string>("TODAS");

  const calcularItinerario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origem || !destino || !atividade) return;

    setCalculandoRota(true);
    setParadas([]);
    setLeadsDaRota([]);

    try {
      const res = await fetch("/api/planejador-rotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem, destino, atividade })
      });
      
      const textoPuro = await res.text();
      let dados;
      
      try {
        dados = JSON.parse(textoPuro);
      } catch (jsonErr) {
        throw new Error("A rota de itinerário retornou um erro interno (HTML).");
      }

      if (dados.error) throw new Error(dados.error);

      const listaParadas = (dados.planoRotaAI?.paradas_sugeridas || []).map((p: any) => ({
        ...p,
        selecionada: true
      }));

      // Garante a ordenação geográfica correta
      listaParadas.sort((a: any, b: any) => a.ordem - b.ordem);

      setParadas(listaParadas);
      setFamiliasCnae(dados.planoRotaAI?.familias_cnae || []);
    } catch (err: any) {
      alert("❌ Erro ao traçar rota: " + err.message);
    } finally {
      setCalculandoRota(false);
    }
  };

  const gerarAgendaProspeccao = async () => {
    const cidadesAlvo = paradas.filter(p => p.selecionada);
    if (cidadesAlvo.length === 0) {
      alert("Selecione pelo menos uma cidade para a parada!");
      return;
    }

    setMinerandoLeads(true);
    setLeadsDaRota([]);

    try {
      let acumuladorLeads: Lead[] = [];

      for (const city of cidadesAlvo) {
        const promptSimulado = `Buscar empresas do segmento '${atividade}' em ${city.cidade_nome} ${city.uf}`;
        
        const res = await fetch("/api/prospeccao-ia", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptUsuario: promptSimulado, limite: limiteCidade })
        });
        
        const textoPuro = await res.text();
        let dados;
        
        try {
          dados = JSON.parse(textoPuro);
        } catch (jsonErr) {
          throw new Error(`A mineração para a cidade ${city.cidade_nome} falhou no servidor.`);
        }

        if (dados.error) throw new Error(`Erro em ${city.cidade_nome}: ${dados.error}`);
        
        if (dados.leads && dados.leads.length > 0) {
          const tratados = dados.leads.map((l: any) => ({
            ...l,
            cidadeExtenso: city.cidade_nome,
            parada_origem: city.cidade_nome
          }));
          acumuladorLeads = [...acumuladorLeads, ...tratados];
        }
      }

      setLeadsDaRota(acumuladorLeads);
      setCidadeAtivaFiltro("TODAS");
    } catch (err: any) {
      alert("❌ Erro na mineração da rota: " + err.message);
    } finally {
      setMinerandoLeads(false);
    }
  };

  const toggleParada = (index: number) => {
    setParadas(prev => prev.map((p, i) => i === index ? { ...p, selecionada: !p.selecionada } : p));
  };

  const exportarParaCSV = () => {
    if (leadsFiltrados.length === 0) return;
    const headers = ["Parada Origem", "CNPJ", "Razão Social", "Nome Comercial", "Bairro", "CNAE", "Situação", "Pesquisa Rápida"];
    const rows = leadsFiltrados.map(lead => [
      `"${lead.parada_origem || ""}"`, `"${lead.cnpj || ""}"`, `"${(lead.razao_social || "").replace(/"/g, '""')}"`,
      `"${(lead.nome_fantasia || "").replace(/"/g, '""')}"`, `"${(lead.bairro || "").replace(/"/g, '""')}"`,
      `"${lead.cnae_principal || ""}"`, `"${lead.situacao || ""}"`,
      `"https://www.google.com/search?q=${encodeURIComponent(lead.razao_social + " " + lead.cidadeExtenso)}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Leads_${cidadeAtivaFiltro}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const leadsFiltrados = cidadeAtivaFiltro === "TODAS" ? leadsDaRota : leadsDaRota.filter(l => l.parada_origem === cidadeAtivaFiltro);

  // Mágica para abrir o Google Maps Real com a Rota Completa
  const abrirGoogleMaps = () => {
    const waypoints = paradas.filter(p => p.selecionada).map(p => `${p.cidade_nome}, ${p.uf}`);
    if (waypoints.length === 0) return;
    const urlMaps = `https://www.google.com/maps/dir/${waypoints.map(w => encodeURIComponent(w)).join("/")}`;
    window.open(urlMaps, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        <div className="border-b border-slate-200 pb-4">
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
            Módulo Estratégico de Viagens
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-1.5">
            🗺️ Planejador Logístico de Rotas Comerciais B2B
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <form onSubmit={calcularItinerario} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Origem</label>
              <input type="text" value={origem} onChange={e => setOrigem(e.target.value)} placeholder="Ex: São Paulo / SP" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Destino</label>
              <input type="text" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex: Maringá / PR" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Nicho / O que buscar?</label>
              <input type="text" value={atividade} onChange={e => setAtividade(e.target.value)} placeholder="Ex: Autopeças" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" />
            </div>
            <button type="submit" disabled={calculandoRota || !origem || !destino || !atividade} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-md">
              {calculandoRota ? "🧠 Mapeando Rota..." : "🎯 Mapear Itinerário"}
            </button>
          </form>
        </div>

        {paradas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase">🗺️ Mapa do Itinerário</h2>
                <p className="text-slate-400 text-xs">Cidades intermediárias encontradas na rota geográfica.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={abrirGoogleMaps} className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-black rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer">
                  📍 Abrir Mapa Real
                </button>
                <div className="h-6 w-px bg-slate-200 mx-1"></div>
                <span className="font-bold text-slate-500 text-[11px] uppercase">Leads/parada:</span>
                <select value={limiteCidade} onChange={e => setLimiteCidade(Number(e.target.value))} className="p-1.5 bg-white border border-slate-300 rounded text-xs font-bold">
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
                <button onClick={gerarAgendaProspeccao} disabled={minerandoLeads} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-wider shadow-md transition-colors cursor-pointer">
                  {minerandoLeads ? "⚡ Minerando Nuvem..." : "🚀 Gerar Agenda"}
                </button>
              </div>
            </div>

            {/* MAPA VISUAL COM LINHA CONECTANDO OS PONTOS */}
            <div className="relative border-l-2 border-slate-200 ml-4 md:ml-6 pl-6 space-y-8">
              {paradas.map((parada, idx) => (
                <div key={parada.codigo_municipio || idx} className="relative group">
                  {/* Ponto na linha */}
                  <div 
                    className={`absolute -left-[31px] md:-left-[33px] top-1 h-5 w-5 rounded-full border-4 ring-4 ring-white transition-colors cursor-pointer ${
                      parada.selecionada ? "bg-indigo-600 border-indigo-200" : "bg-slate-300 border-slate-100"
                    }`}
                    onClick={() => toggleParada(idx)}
                  ></div>

                  {/* Card da Cidade */}
                  <div 
                    onClick={() => toggleParada(idx)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all shadow-sm ${
                      parada.selecionada ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={parada.selecionada} readOnly className="accent-indigo-600 cursor-pointer" />
                          <h3 className="font-black text-slate-900 uppercase text-sm">
                            {idx === 0 ? "🚀 " : idx === paradas.length - 1 ? "🏁 " : ""}
                            {parada.cidade_nome} <span className="text-slate-400 font-bold">/ {parada.uf}</span>
                          </h3>
                        </div>
                        <p className="text-slate-500 text-xs mt-1.5 font-medium ml-5">{parada.justificativa_comercial}</p>
                      </div>
                      <span className="bg-white border border-slate-200 text-slate-400 font-mono px-2 py-0.5 rounded text-[10px]">
                        TOM: {parada.codigo_municipio || "---"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABELA E EXPORTAÇÃO */}
        {leadsDaRota.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setCidadeAtivaFiltro("TODAS")} className={`px-3 py-1.5 rounded font-black uppercase text-[11px] transition-colors cursor-pointer ${cidadeAtivaFiltro === "TODAS" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  🌍 Ver Tudo ({leadsDaRota.length})
                </button>
                {paradas.filter(p => p.selecionada).map(parada => {
                  const count = leadsDaRota.filter(l => l.parada_origem === parada.cidade_nome).length;
                  if (count === 0) return null;
                  return (
                    <button key={parada.cidade_nome} onClick={() => setCidadeAtivaFiltro(parada.cidade_nome)} className={`px-3 py-1.5 rounded font-black uppercase text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 ${cidadeAtivaFiltro === parada.cidade_nome ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      📍 {parada.cidade_nome} <span className="bg-slate-200 text-slate-800 rounded px-1 text-[9px] font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={exportarParaCSV} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-[11px] uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2 cursor-pointer">
                📊 Exportar Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                    <th className="p-3.5">Parada Itinerário</th>
                    <th className="p-3.5">CNPJ</th>
                    <th className="p-3.5">Razão Social Oficial</th>
                    <th className="p-3.5">Nome Comercial</th>
                    <th className="p-3.5">Bairro</th>
                    <th className="p-3.5">Ações SDR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-xs">
                  {leadsFiltrados.map((lead) => (
                    <tr key={lead.cnpj} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5"><span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-black px-2 py-0.5 rounded text-[10px] uppercase">{lead.parada_origem}</span></td>
                      <td className="p-3.5 font-mono font-bold text-slate-500">{lead.cnpj}</td>
                      <td className="p-3.5 font-black text-slate-900 uppercase truncate max-w-[250px]">{lead.razao_social}</td>
                      <td className="p-3.5 text-indigo-600 font-bold uppercase truncate max-w-[200px]">{lead.nome_fantasia || "—"}</td>
                      <td className="p-3.5 text-slate-500 uppercase">{lead.bairro || "Centro"}</td>
                      <td className="p-3.5"><button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social + " " + lead.cidadeExtenso)}`, "_blank")} className="bg-white border border-slate-300 font-bold px-2 py-1 rounded text-[11px] hover:bg-slate-50 cursor-pointer shadow-sm">🔍 Buscar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}