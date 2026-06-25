/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface VisitaRow {
  id: string; 
  nome: string;
  responsavelSDR: string;
  etapa: string;
  email?: string;
  telefone?: string;
  statusComissaoAgendamento: "Pendente" | "Pago";
  statusComissaoComite: "Em Análise" | "Aprovado" | "Reprovado" | "Pago" | "Enviado p/ Análise";
}

interface SDRConfig {
  nome: string;
  valorAgendamento: number;
  valorComite: number;
}

export default function ControleComercialVisitasPage() {
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [configsSDR, setConfigsSDR] = useState<Record<string, SDRConfig>>({});
  const [carregando, setCarregando] = useState(false);
  const [enviandoLeadId, setEnviandoLeadId] = useState<string | null>(null);

  // Filtros
  const [filtroSDR, setFiltroSDR] = useState("");
  const [filtroStatusComite, setFiltroStatusComite] = useState("");
  const [buscaTexto, setBuscaTexto] = useState("");

  // 1. Carrega as configurações de SDR salvas localmente
  useEffect(() => {
    try {
      const salvasConfigs = localStorage.getItem("ned_comercial_sdr_configs");
      if (salvasConfigs) setConfigsSDR(JSON.parse(salvasConfigs));
    } catch (e) {
      console.error("Erro ao ler cache de configs:", e);
    }
  }, []);

  const persistirConfigs = (novasConfigs: Record<string, SDRConfig>) => {
    setConfigsSDR(novasConfigs);
    localStorage.setItem("ned_comercial_sdr_configs", JSON.stringify(novasConfigs));
  };

  // 2. BUSCA AUTOMÁTICA DIRETO DA TABELA crm_leads
  const buscarCardsComercial = useCallback(async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("crm_leads") 
        .select("*")
        .in("estagio", [
          "visita_agendada", "visita_realizada", "visita_efetuada", "finalizado", "ganhou", "perdido",
          "Visita Agendada", "Visita Realizada", "Visita Efetuada", "Finalizado", "Ganhou", "Perdido"
        ]);

      if (error) throw error;

      if (data) {
        const sdrsEncontrados = new Set<string>();
        
        const dadosMapeados: VisitaRow[] = data.map((item: any) => {
          const sdrNome = item.responsavel_nome || item.responsavel_id || "Sem SDR Mapeado";
          sdrsEncontrados.add(sdrNome);

          let statusComiteInicial: any = "Em Análise";
          const estagioLower = item.estagio?.toLowerCase() || "";

          if (estagioLower === "perdido" || estagioLower === "nao_convertida") {
            statusComiteInicial = "Reprovado";
          } else if (estagioLower === "ganhou" || estagioLower === "finalizado" || estagioLower === "convertida_aprovada") {
            statusComiteInicial = "Aprovado";
          }

          const statusAgendamentoSalvo = item.campos_customizados?.status_comissao_agendamento || "Pendente";
          const statusComiteSalvo = item.campos_customizados?.status_comissao_comite || statusComiteInicial;

          return {
            id: item.id.toString(),
            nome: item.razaoSocial || item.razaosocial || item.nomeContato || "Empresa sem Nome",
            responsavelSDR: sdrNome,
            etapa: item.estagio || "",
            email: item.email || "",
            telefone: item.telefone || "",
            statusComissaoAgendamento: statusAgendamentoSalvo,
            statusComissaoComite: statusComiteSalvo,
          };
        });

        const novasConfigs = { ...configsSDR };
        sdrsEncontrados.forEach((nomeSdr) => {
          if (!novasConfigs[nomeSdr]) {
            novasConfigs[nomeSdr] = { nome: nomeSdr, valorAgendamento: 50, valorComite: 80 };
          }
        });

        setVisitas(dadosMapeados);
        persistirConfigs(novasConfigs);
      }
    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro ao ler dados: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  }, [configsSDR]);

  useEffect(() => {
    buscarCardsComercial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. PERSISTÊNCIA REVERSA
  const mudarStatusAgendamento = async (id: string, novoStatus: "Pendente" | "Pago") => {
    try {
      const { data: currentLead } = await supabase.from("crm_leads").select("campos_customizados").eq("id", id).single();
      
      const novosCampos = {
        ...(currentLead?.campos_customizados || {}),
        status_comissao_agendamento: novoStatus
      };

      const { error } = await supabase
        .from("crm_leads")
        .update({ campos_customizados: novosCampos })
        .eq("id", id);

      if (error) throw error;
      
      setVisitas(prev => prev.map(v => v.id === id ? { ...v, statusComissaoAgendamento: novoStatus } : v));
    } catch (err: any) {
      alert(`❌ Erro ao atualizar agendamento: ${err.message}`);
    }
  };

  const mudarStatusComite = async (id: string, novoStatus: any) => {
    try {
      const { data: currentLead } = await supabase.from("crm_leads").select("campos_customizados").eq("id", id).single();
      
      const novosCampos = {
        ...(currentLead?.campos_customizados || {}),
        status_comissao_comite: novoStatus
      };

      const updatePayload: any = { campos_customizados: novosCampos };
      
      if (novoStatus === "Aprovado") {
        updatePayload.estagio = "convertida_aprovada";
      }

      const { error } = await supabase
        .from("crm_leads")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      setVisitas(prev => prev.map(v => v.id === id ? { 
        ...v, 
        statusComissaoComite: novoStatus,
        etapa: novoStatus === "Aprovado" ? "convertida_aprovada" : v.etapa 
      } : v));
    } catch (err: any) {
      alert(`❌ Erro ao atualizar comitê: ${err.message}`);
    }
  };

  // 4. ENVIA PARA A TABELA DE ANALISES
  const moverLeadParaEsteiraAnalise = async (lead: VisitaRow) => {
    const confirmar = confirm(`🔍 Deseja enviar a empresa "${lead.nome}" diretamente para a lista de Análises Pendentes?`);
    if (!confirmar) return;

    try {
      setEnviandoLeadId(lead.id);

      const { error } = await supabase.from("analises").insert({
        empresa_nome: lead.nome.trim().toUpperCase(),
        comercial: lead.responsavelSDR || "Comercial Ned",
        status: "Pendente",
        caminho_local: "Enviado via Esteira Comercial Automatizada"
      });

      if (error) throw error;

      await mudarStatusComite(lead.id, "Enviado p/ Análise");
      alert("🚀 Sucesso! Empresa integrada na tabela de Análises.");
    } catch (err: any) {
      alert(`❌ Erro de Integração: ${err.message}`);
    } finally {
      setEnviandoLeadId(null);
    }
  };

  const atualizarValorComissaoSDR = (nomeSdr: string, campo: "valorAgendamento" | "valorComite", valor: number) => {
    const novasConfigs = { ...configsSDR };
    novasConfigs[nomeSdr] = { ...novasConfigs[nomeSdr], [campo]: valor };
    persistirConfigs(novasConfigs);
  };

  const listasSDRsUnicos = useMemo(() => Object.keys(configsSDR).sort(), [configsSDR]);

  const visitasFiltradas = useMemo(() => {
    return visitas.filter(v => {
      const bateSdr = !filtroSDR || v.responsavelSDR === filtroSDR;
      const bateComite = !filtroStatusComite || v.statusComissaoComite === filtroStatusComite;
      const bateTexto = !buscaTexto || v.nome.toLowerCase().includes(buscaTexto.toLowerCase());
      return bateSdr && bateComite && bateTexto;
    });
  }, [visitas, filtroSDR, filtroStatusComite, buscaTexto]);

  const kpisGlobais = useMemo(() => {
    let totalAgendamentosGanhos = 0;
    let totalComiteGanhos = 0;
    let totalPendenteAnalise = 0;

    visitasFiltradas.forEach(v => {
      const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
      if (v.statusComissaoAgendamento !== "Pago") totalAgendamentosGanhos += cfg.valorAgendamento;
      if (v.statusComissaoComite === "Aprovado") totalComiteGanhos += cfg.valorComite;
      else if (v.statusComissaoComite === "Em Análise") totalPendenteAnalise += cfg.valorComite;
    });

    return { totalAgendamentosGanhos, totalComiteGanhos, totalPendenteAnalise };
  }, [visitasFiltradas, configsSDR]);

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER BAR */}
      <div className="border-b border-slate-200 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">🎯 Esteira Comercial Automatizada</h2>
          <span className="text-xs text-slate-500 font-medium">Controle de Visitas e Comissões Sincronizado com NedHub CRM.</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={buscarCardsComercial} 
            disabled={carregando}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black rounded-lg shadow-md transition-all flex items-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
          >
            {carregando ? "🔄 Sincronizando..." : "🔄 Sincronizar Nedhub"}
          </button>
        </div>
      </div>

      {carregando && (
        <div className="p-8 font-bold text-center text-xs tracking-widest uppercase text-slate-500 bg-slate-50 border border-slate-200 rounded-xl animate-pulse shadow-inner">
          ⏳ Carregando fluxo de leads do CRM...
        </div>
      )}

      {!carregando && (
        <>
          {/* MATRIZ DE PREÇO SDR */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl shadow-xs">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-3">⚙️ Tabela de Preço Variável por SDR</span>
            <div className="flex flex-wrap gap-4">
              {listasSDRsUnicos.length === 0 ? (
                <span className="text-slate-400 italic font-bold text-xs p-2">Nenhum SDR mapeado na base.</span>
              ) : (
                listasSDRsUnicos.map(nome => {
                  const cfg = configsSDR[nome] || { nome, valorAgendamento: 50, valorComite: 80 };
                  return (
                    <div key={nome} className="bg-white p-3 border border-slate-200 rounded-lg flex flex-col gap-2 shadow-sm min-w-[220px]">
                      <span className="font-black text-slate-800 text-[11px] uppercase tracking-wide border-b border-slate-100 pb-1.5 truncate" title={nome}>{nome}</span>
                      
                      <div className="flex justify-between items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Agendamento:</span>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                          <span className="text-slate-400 text-[10px] pl-2 font-bold">R$</span>
                          <input 
                            type="number" 
                            value={cfg.valorAgendamento} 
                            onChange={(e) => atualizarValorComissaoSDR(nome, "valorAgendamento", parseFloat(e.target.value) || 0)} 
                            className="w-16 p-1.5 text-right bg-transparent outline-none font-mono font-black text-slate-700 text-xs" 
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Comitê:</span>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                          <span className="text-slate-400 text-[10px] pl-2 font-bold">R$</span>
                          <input 
                            type="number" 
                            value={cfg.valorComite} 
                            onChange={(e) => atualizarValorComissaoSDR(nome, "valorComite", parseFloat(e.target.value) || 0)} 
                            className="w-16 p-1.5 text-right bg-transparent outline-none font-mono font-black text-slate-700 text-xs" 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Leads Comercial Ativos</span>
              <div className="text-3xl font-black mt-1 font-mono">{visitasFiltradas.length}</div>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-xl border-l-4 border-l-blue-600 shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Agendamentos Pendentes</span>
              <div className="text-2xl font-black mt-1 font-mono text-blue-800">{formatarMoeda(kpisGlobais.totalAgendamentosGanhos)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-xl border-l-4 border-l-emerald-500 shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Comitê Aprovado (Ganhos)</span>
              <div className="text-2xl font-black mt-1 font-mono text-emerald-700">{formatarMoeda(kpisGlobais.totalComiteGanhos)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-xl border-l-4 border-l-amber-500 shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Diferidos Em Análise</span>
              <div className="text-2xl font-black mt-1 font-mono text-amber-700">{formatarMoeda(kpisGlobais.totalPendenteAnalise)}</div>
            </div>
          </div>

          {/* FILTROS */}
          <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full md:flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔎</span>
              <input 
                type="text" 
                placeholder="Filtrar por nome do lead..." 
                value={buscaTexto} 
                onChange={(e) => setBuscaTexto(e.target.value)} 
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-xs outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold transition-all" 
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <select value={filtroSDR} onChange={(e) => setFiltroSDR(e.target.value)} className="w-full md:w-48 p-2.5 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white cursor-pointer focus:ring-2 focus:ring-blue-100">
                <option value="">SDR (Todos)</option>
                {listasSDRsUnicos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={filtroStatusComite} onChange={(e) => setFiltroStatusComite(e.target.value)} className="w-full md:w-56 p-2.5 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white cursor-pointer focus:ring-2 focus:ring-blue-100">
                <option value="">Status Comitê (Todos)</option>
                <option value="Em Análise">⏳ Em Análise</option>
                <option value="Aprovado">🟢 Aprovado</option>
                <option value="Reprovado">🔴 Reprovado / Perda</option>
                <option value="Enviado p/ Análise">🚀 Enviado p/ Análise</option>
                <option value="Pago">🏁 Confirmado Pago</option>
              </select>
            </div>
          </div>

          {/* TABELA CONDICIONAL */}
          {visitasFiltradas.length === 0 ? (
            <div className="p-16 border-2 border-dashed border-slate-200 bg-white rounded-2xl text-center space-y-3 shadow-xs">
              <div className="text-4xl opacity-80">🗂️</div>
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-wider">Nenhum Lead Encontrado</h3>
              <p className="text-slate-400 max-w-sm mx-auto text-xs font-medium">Não há cards que correspondam aos filtros ou não existem "Visitas Agendadas" ativas no CRM.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                      <th className="p-4 w-72">Lead Comercial</th>
                      <th className="p-4 w-40">SDR Responsável</th>
                      <th className="p-4 text-center w-40">Estágio Atual (CRM)</th>
                      <th className="p-4 text-center w-40 bg-blue-50/50 border-x border-slate-100">Gatilho 1: Visita</th>
                      <th className="p-4 text-center w-48">Gatilho 2: Comitê</th>
                      <th className="p-4 text-center w-40">Integração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {visitasFiltradas.map((v) => {
                      const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
                      const estaEnviando = enviandoLeadId === v.id;
                      const jaFoiEnviado = v.statusComissaoComite === "Enviado p/ Análise";

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4">
                            <div className="font-black text-slate-900 truncate max-w-[260px] uppercase" title={v.nome}>{v.nome}</div>
                            <span className="text-[10px] text-slate-400 font-bold truncate max-w-[260px] block font-mono mt-0.5">{v.email || v.telefone || "Sem contatos"}</span>
                          </td>
                          <td className="p-4 text-slate-600 font-bold uppercase text-xs truncate max-w-[150px]" title={v.responsavelSDR}>
                            {v.responsavelSDR}
                          </td>
                          <td className="p-4 text-center">
                            <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 shadow-xs">
                              {v.etapa.replace(/_/g, " ")}
                            </span>
                          </td>
                          
                          {/* GATILHO 1 */}
                          <td className="p-4 bg-blue-50/20 border-x border-slate-50 text-center flex flex-col items-center gap-1.5 h-full">
                            <div className="font-black text-blue-900 font-mono text-xs bg-white px-2 py-0.5 rounded shadow-xs border border-blue-100">{formatarMoeda(cfg.valorAgendamento)}</div>
                            <select 
                              value={v.statusComissaoAgendamento} 
                              onChange={(e) => mudarStatusAgendamento(v.id, e.target.value as any)} 
                              className={`w-full max-w-[120px] p-1.5 border rounded-md text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer text-center shadow-xs transition-colors appearance-none ${
                                v.statusComissaoAgendamento === "Pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white hover:bg-slate-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              <option value="Pendente">⏳ Pendente</option>
                              <option value="Pago">✅ Pago</option>
                            </select>
                          </td>

                          {/* GATILHO 2 */}
                          <td className="p-4 text-center flex flex-col items-center gap-1.5 h-full">
                            <div className="font-black text-slate-700 font-mono text-xs bg-slate-50 px-2 py-0.5 rounded shadow-xs border border-slate-200">
                              {v.statusComissaoComite === "Reprovado" ? formatarMoeda(0) : formatarMoeda(cfg.valorComite)}
                            </div>
                            <select 
                              value={v.statusComissaoComite} 
                              onChange={(e) => mudarStatusComite(v.id, e.target.value as any)} 
                              className={`w-full max-w-[150px] p-1.5 border rounded-md text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer text-center shadow-xs transition-colors appearance-none ${
                                v.statusComissaoComite === "Pago" || v.statusComissaoComite === "Aprovado" 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                  : v.statusComissaoComite === "Reprovado" 
                                  ? "bg-rose-50 text-rose-700 border-rose-200" 
                                  : "bg-white hover:bg-slate-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              <option value="Em Análise">⏳ Em Análise</option>
                              <option value="Aprovado">🟢 Aprovado</option>
                              <option value="Reprovado">🔴 Reprovado</option>
                              <option value="Enviado p/ Análise">🚀 Em Esteira</option>
                              <option value="Pago">🏁 Confirmado Pago</option>
                            </select>
                          </td>

                          {/* AÇÕES */}
                          <td className="p-4 text-center">
                            <button
                              onClick={() => moverLeadParaEsteiraAnalise(v)}
                              disabled={estaEnviando || jaFoiEnviado}
                              className={`px-3 py-2 font-black rounded-lg text-[9px] uppercase tracking-wider shadow-sm transition-all cursor-pointer w-full flex items-center justify-center gap-1.5 ${
                                jaFoiEnviado
                                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                  : "bg-slate-900 hover:bg-blue-600 text-white"
                              }`}
                            >
                              {estaEnviando ? "⏳..." : jaFoiEnviado ? "✓ Na Esteira" : "🔍 Enviar p/ Comitê"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}