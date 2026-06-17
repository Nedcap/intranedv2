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

  // 2. BUSCA AUTOMÁTICA DIRETO DA TABELA crm_leads (Mapeando com strings reais do banco)
  const buscarCardsComercial = useCallback(async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("crm_leads") 
        .select("*")
        // 🔥 Ajustado para incluir as strings reais com underlines e minúsculas geradas pelo sistema
        .in("estagio", [
          "visita_agendada", "visita_realizada", "visita_efetuada", "finalizado", "ganhou", "perdido",
          "Visita Agendada", "Visita Realizada", "Visita Efetuada", "Finalizado", "Ganhou", "Perdido"
        ]);

      if (error) throw error;

      if (data) {
        const sdrsEncontrados = new Set<string>();
        
        const dadosMapeados: VisitaRow[] = data.map((item: any) => {
          // Fallback seguro caso o nome amarrado não exista direto
          const sdrNome = item.responsavel_nome || item.responsavel_id || "Sem SDR Mapeado";
          sdrsEncontrados.add(sdrNome);

          // Lógica inicial baseada na etapa do CRM
          let statusComiteInicial: any = "Em Análise";
          const estagioLower = item.estagio?.toLowerCase() || "";

          if (estagioLower === "perdido" || estagioLower === "nao_convertida") {
            statusComiteInicial = "Reprovado";
          } else if (estagioLower === "ganhou" || estagioLower === "finalizado" || estagioLower === "convertida_aprovada") {
            statusComiteInicial = "Aprovado";
          }

          // Pegando dados dos campos customizados ou das colunas diretas
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
  }, []);

  // 3. PERSISTÊNCIA REVERSA: Salva os status dentro do objeto jsonb (campos_customizados) do crm_leads
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
      
      // Se aprovou a comissão, atualiza automaticamente o estágio do lead mantendo consistência do padrão do banco
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700 p-4">
      
      {/* HEADER BAR */}
      <div className="border-b border-slate-200 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">🎯 Esteira Comercial Automatizada (Visitas e Finalizados)</h2>
          <span className="text-xs text-slate-400 font-medium">Sincronizado com a tabela crm_leads em tempo real.</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={buscarCardsComercial} 
            disabled={carregando}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black rounded-lg shadow-sm border border-blue-700 cursor-pointer transition-all flex items-center gap-2 text-[11px]"
          >
            {carregando ? "🔄 Sincronizando..." : "🔄 Sincronizar Nedhub"}
          </button>
        </div>
      </div>

      {carregando && <div className="p-8 font-bold text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">⏳ Carregando dados da API do Supabase...</div>}

      {visitas.length === 0 && !carregando ? (
        <div className="p-12 border border-dashed border-slate-300 bg-white rounded-xl text-center space-y-2">
          <div className="text-2xl">🗂️</div>
          <h3 className="font-bold text-slate-700 text-xs">Nenhum card comercial encontrado</h3>
          <p className="text-slate-400 max-w-sm mx-auto text-[11px]">Verifique se os leads foram movidos para "Visita Agendada" no painel principal.</p>
        </div>
      ) : (
        <>
          {/* MATRIZ DE PREÇO SDR */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">⚙️ Ajustar Tabelas de Preço Variáveis por SDR</span>
            <div className="flex flex-wrap gap-3">
              {listasSDRsUnicos.map(nome => {
                const cfg = configsSDR[nome] || { nome, valorAgendamento: 50, valorComite: 80 };
                return (
                  <div key={nome} className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex items-center gap-3">
                    <span className="font-black text-slate-800 px-1 truncate max-w-[120px] uppercase">{nome.substring(0, 15)}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold">Agendamento:</span>
                      <input type="number" value={cfg.valorAgendamento} onChange={(e) => atualizarValorComissaoSDR(nome, "valorAgendamento", parseFloat(e.target.value) || 0)} className="w-12 p-0.5 text-center bg-white border border-slate-200 rounded font-bold" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold">Comitê:</span>
                      <input type="number" value={cfg.valorComite} onChange={(e) => atualizarValorComissaoSDR(nome, "valorComite", parseFloat(e.target.value) || 0)} className="w-12 p-0.5 text-center bg-white border border-slate-200 rounded font-bold" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Leads Comercial Ativos</span>
              <div className="text-2xl font-black mt-1 font-mono">{visitasFiltradas.length}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl border-l-4 border-blue-600 shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Agendamentos Pendentes</span>
              <div className="text-2xl font-black mt-1 font-mono text-blue-900">{formatarMoeda(kpisGlobais.totalAgendamentosGanhos)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl border-l-4 border-emerald-600 shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Comitê Aprovado / Finalizado</span>
              <div className="text-2xl font-black mt-1 font-mono text-emerald-700">{formatarMoeda(kpisGlobais.totalComiteGanhos)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl border-l-4 border-amber-500 shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Diferidos Em Análise</span>
              <div className="text-2xl font-black mt-1 font-mono text-amber-700">{formatarMoeda(kpisGlobais.totalPendenteAnalise)}</div>
            </div>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <input type="text" placeholder="Filtrar por nome do lead..." value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 w-64 font-medium" />
            <select value={filtroSDR} onChange={(e) => setFiltroSDR(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white">
              <option value="">SDR (Todos)</option>
              {listasSDRsUnicos.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={filtroStatusComite} onChange={(e) => setFiltroStatusComite(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white">
              <option value="">Status Comitê (Todos)</option>
              <option value="Em Análise">⏳ Em Análise</option>
              <option value="Aprovado">🟢 Aprovado</option>
              <option value="Reprovado">🔴 Reprovado / Perda</option>
              <option value="Enviado p/ Análise">🚀 Enviado p/ Análise</option>
              <option value="Pago">🏁 Confirmado Pago</option>
            </select>
          </div>

          {/* TABELA */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white font-black uppercase text-[11px] border-b border-slate-900">
                  <th className="p-3">Lead Comercial</th>
                  <th className="p-3">SDR Responsável</th>
                  <th className="p-3 text-center">Estágio Atual</th>
                  <th className="p-3 text-center bg-blue-950/40">Gatilho 1: Visita</th>
                  <th className="p-3 text-center bg-slate-900">Gatilho 2: Comitê</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                {visitasFiltradas.map((v) => {
                  const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
                  const estaEnviando = enviandoLeadId === v.id;
                  const jaFoiEnviado = v.statusComissaoComite === "Enviado p/ Análise";

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 truncate max-w-[240px] uppercase">{v.nome}</div>
                        <span className="text-[10px] text-slate-400 font-normal truncate block font-mono">{v.email || v.telefone || "Sem contatos"}</span>
                      </td>
                      <td className="p-3 text-slate-500 font-bold uppercase truncate max-w-[150px]">{v.responsavelSDR}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-800">
                          {v.etapa.replace("_", " ")}
                        </span>
                      </td>
                      
                      {/* GATILHO 1 */}
                      <td className="p-3 bg-blue-50/10 text-center space-y-1">
                        <div className="font-black text-blue-900 font-mono">{formatarMoeda(cfg.valorAgendamento)}</div>
                        <select value={v.statusComissaoAgendamento} onChange={(e) => mudarStatusAgendamento(v.id, e.target.value as any)} className={`p-0.5 border rounded text-[10px] font-black outline-none ${
                          v.statusComissaoAgendamento === "Pago" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"
                        }`}>
                          <option value="Pendente">⏳ Pendente</option>
                          <option value="Pago">✅ Pago</option>
                        </select>
                      </td>

                      {/* GATILHO 2 */}
                      <td className="p-3 bg-slate-50/50 text-center space-y-1">
                        <div className="font-black text-slate-700 font-mono">
                          {v.statusComissaoComite === "Reprovado" ? formatarMoeda(0) : formatarMoeda(cfg.valorComite)}
                        </div>
                        <select value={v.statusComissaoComite} onChange={(e) => mudarStatusComite(v.id, e.target.value as any)} className={`p-0.5 border rounded text-[10px] font-black outline-none ${
                          v.statusComissaoComite === "Pago" || v.statusComissaoComite === "Aprovado" 
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                            : v.statusComissaoComite === "Reprovado" 
                            ? "bg-rose-100 text-rose-700 border-rose-200" 
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}>
                          <option value="Em Análise">⏳ Em Análise</option>
                          <option value="Aprovado">🟢 Aprovado (Comitê)</option>
                          <option value="Reprovado">🔴 Reprovado (Perda)</option>
                          <option value="Enviado p/ Análise">🚀 Enviado p/ Análise</option>
                          <option value="Pago">🏁 Confirmado Pago</option>
                        </select>
                      </td>

                      {/* AÇÕES */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => moverLeadParaEsteiraAnalise(v)}
                          disabled={estaEnviando || jaFoiEnviado}
                          className={`px-3 py-1 font-black rounded-lg text-[10px] uppercase shadow-2xs transition-all cursor-pointer ${
                            jaFoiEnviado
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-not-allowed"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          {estaEnviando ? "⏳ Gravando..." : jaFoiEnviado ? "🚀 Na Esteira" : "🔍 Enviar p/ Análise"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}