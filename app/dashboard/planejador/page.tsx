/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
// import { supabase } from "@/lib/supabase"; // Descomente se for usar depois

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

  // Passo 1: Calcular o Itinerário Geográfico com a IA
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
      const dados = await res.json();
      if (dados.error) throw new Error(dados.error);

      const listaParadas = (dados.planoRotaAI.paradas_sugeridas || []).map((p: any) => ({
        ...p,
        selecionada: true
      }));

      setParadas(listaParadas);
      setFamiliasCnae(dados.planoRotaAI.familias_cnae || []);
    } catch (err: any) {
      alert("❌ Erro ao traçar rota: " + err.message);
    } finally {
      setCalculandoRota(false);
    }
  };

  // Passo 2: Disparar a mineração em lote no BigQuery
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

      for (const cidade of cidadesAlvo) {
        const promptSimulado = `Buscar empresas do segmento '${atividade}' em ${cidade.cidade_nome} ${cidade.uf}`;
        
        // 🔥 ATENÇÃO: Verifique se o nome da sua rota de extração é esse mesmo
        const res = await fetch("/api/prospeccao", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptUsuario: promptSimulado, limite: limiteCidade })
        });
        
        const dados = await res.json();
        
        if (dados.leads && dados.leads.length > 0) {
          const tratados = dados.leads.map((l: any) => ({
            ...l,
            cidadeExtenso: cidade.cidade_nome,
            parada_origem: cidade.cidade_nome
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

  const leadsFiltrados = cidadeAtivaFiltro === "TODAS" 
    ? leadsDaRota 
    : leadsDaRota.filter(l => l.parada_origem === cidadeAtivaFiltro);

  // =========================================================================
  // 🚀 NOVO: Função para Exportar para Excel (CSV)
  // =========================================================================
  const exportarParaCSV = () => {
    if (leadsFiltrados.length === 0) return;

    // Cabeçalhos do Excel
    const headers = ["Parada Origem", "CNPJ", "Razão Social", "Nome Comercial", "Bairro", "CNAE", "Situação", "Pesquisa Rápida"];
    
    // Mapeamento das linhas tratando vírgulas e aspas para não quebrar o Excel
    const rows = leadsFiltrados.map(lead => [
      `"${lead.parada_origem || ""}"`,
      `"${lead.cnpj || ""}"`,
      `"${(lead.razao_social || "").replace(/"/g, '""')}"`,
      `"${(lead.nome_fantasia || "").replace(/"/g, '""')}"`,
      `"${(lead.bairro || "").replace(/"/g, '""')}"`,
      `"${lead.cnae_principal || ""}"`,
      `"${lead.situacao || ""}"`,
      `"https://www.google.com/search?q=${encodeURIComponent(lead.razao_social + " " + lead.cidadeExtenso)}"`
    ]);

    // Montagem do arquivo (BOM para garantir acentuação correta no Excel)
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    
    // Nome dinâmico do arquivo
    const nomeArquivo = cidadeAtivaFiltro === "TODAS" 
      ? `Rota_${origem.split('/')[0].trim()}_a_${destino.split('/')[0].trim()}.csv`
      : `Leads_${cidadeAtivaFiltro}.csv`;
      
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="border-b border-slate-200 pb-4">
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
            Módulo Estratégico de Viagens
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-1.5">
            🗺️ Planejador Logístico de Rotas Comerciais B2B
          </h1>
        </div>

        {/* INPUT DE ROTA */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <form onSubmit={calcularItinerario} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Origem</label>
              <input 
                type="text" value={origem} onChange={e => setOrigem(e.target.value)}
                placeholder="Ex: São Paulo / SP" 
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Cidade de Destino</label>
              <input 
                type="text" value={destino} onChange={e => setDestino(e.target.value)}
                placeholder="Ex: Maringá / PR" 
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1.5">Nicho / O que buscar?</label>
              <input 
                type="text" value={atividade} onChange={e => setAtividade(e.target.value)}
                placeholder="Ex: Distribuidores de Medicamentos" 
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit" disabled={calculandoRota || !origem || !destino || !atividade}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-md"
            >
              {calculandoRota ? "🧠 Mapeando Rodovias..." : "🎯 Mapear Itinerário"}
            </button>
          </form>
        </div>

        {/* PASSO 2: CHECKLIST DE PARADAS ENCONTRADAS */}
        {paradas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase">📍 Rota Mapeada pelo GPS Inteligente</h2>
                <p className="text-slate-400 text-[11px]">Marque ou desmarque as cidades onde deseja que o comercial faça paradas.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-500 text-[11px] uppercase">Leads por parada:</span>
                <select value={limiteCidade} onChange={e => setLimiteCidade(Number(e.target.value))} className="p-1.5 bg-white border border-slate-300 rounded text-xs font-bold shadow-sm">
                  <option value={15}>15 leads</option>
                  <option value={30}>30 leads</option>
                  <option value={50}>50 leads</option>
                </select>
                <button
                  onClick={gerarAgendaProspeccao} disabled={minerandoLeads}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-wider shadow-md transition-colors cursor-pointer"
                >
                  {minerandoLeads ? "⚡ Minerando Nuvem BigQuery..." : "🚀 Gerar Agenda de Prospecção"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paradas.map((parada, idx) => (
                <div 
                  key={parada.codigo_municipio || idx} 
                  onClick={() => toggleParada(idx)}
                  className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-all shadow-sm select-none ${
                    parada.selecionada ? "border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200" : "border-slate-200 bg-white opacity-60"
                  }`}
                >
                  <input type="checkbox" checked={parada.selecionada} readOnly className="mt-0.5 accent-indigo-600 cursor-pointer" />
                  <div>
                    <div className="font-black text-slate-900 uppercase text-xs flex items-center gap-1.5">
                      <span className="bg-slate-900 text-white font-mono rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{parada.ordem}</span>
                      {parada.cidade_nome} / {parada.uf}
                    </div>
                    <p className="text-slate-500 text-[11px] mt-1 font-medium leading-tight">{parada.justificativa_comercial}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PASSO 3: TABELA E EXPORTAÇÃO */}
        {leadsDaRota.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            
            {/* CABEÇALHO DA TABELA - ABAS E EXPORTAÇÃO */}
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCidadeAtivaFiltro("TODAS")}
                  className={`px-3 py-1.5 rounded font-black uppercase text-[11px] transition-colors cursor-pointer ${
                    cidadeAtivaFiltro === "TODAS" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🌍 Ver Tudo ({leadsDaRota.length})
                </button>
                {paradas.filter(p => p.selecionada).map(parada => {
                  const count = leadsDaRota.filter(l => l.parada_origem === parada.cidade_nome).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={parada.cidade_nome}
                      onClick={() => setCidadeAtivaFiltro(parada.cidade_nome)}
                      className={`px-3 py-1.5 rounded font-black uppercase text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                        cidadeAtivaFiltro === p.cidade_nome ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      📍 {parada.cidade_nome} <span className="bg-slate-200 text-slate-800 rounded px-1 text-[9px] font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* BOTÃO MÁGICO DE EXPORTAR EXCEL */}
              <button
                onClick={exportarParaCSV}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-[11px] uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
              >
                📊 Exportar Excel
              </button>
            </div>

            {/* TABELA DE DISPARO SDR */}
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
                      <td className="p-3.5">
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-black px-2 py-0.5 rounded text-[10px] uppercase">
                          {lead.parada_origem}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-500">{lead.cnpj}</td>
                      <td className="p-3.5 font-black text-slate-900 uppercase truncate max-w-[250px]">{lead.razao_social}</td>
                      <td className="p-3.5 text-indigo-600 font-bold uppercase truncate max-w-[200px]">{lead.nome_fantasia || "—"}</td>
                      <td className="p-3.5 text-slate-500 uppercase">{lead.bairro || "Centro"}</td>
                      <td className="p-3.5 flex items-center gap-1.5">
                        <button
                          onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social + " " + lead.cidadeExtenso)}`, "_blank")}
                          className="bg-white border border-slate-300 font-bold px-2 py-1 rounded text-[11px] hover:bg-slate-50 cursor-pointer shadow-sm"
                        >
                          🔍 Pesquisar 
                        </button>
                      </td>
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