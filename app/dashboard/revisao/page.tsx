"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext"; // 🛡️ O Crachá Global

// ==========================================================================
// 🎨 TIPAGENS E INTERFACES (Fim do "any"!)
// ==========================================================================
interface RevisaoCedente {
  cedente: string;
  comercial: string | null;
  data_ultima_renovacao: string | null;
  data_proxima_renovacao: string | null;
  pendencias: string | null;
  ultimo_email_enviado: string | null;
  renovado: boolean | null;
  _isEditado?: boolean; // Controle local da UI
}

export default function RevisaoPage() {
  // 🛡️ Integrado com o AuthContext Unificado
  const { user, verApenasCarteira } = useAuth();

  const [revisoes, setRevisoes] = useState<RevisaoCedente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "EM_DIA" | "ALERTA" | "VENCIDO">("TODOS");
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});

  // ==========================================================================
  // 📥 BUSCA DE DADOS
  // ==========================================================================
  const carregarRevisoes = useCallback(async () => {
    try {
      setCarregando(true);

      let query = supabase.from("revisao_cedentes").select("*");

      // 🔐 Isolamento de Carteira Automático (Regra de Negócio Centralizada)
      if (verApenasCarteira && user?.nome) {
        query = query.ilike("comercial", `%${user.nome}%`);
      }

      const { data, error } = await query.order("data_proxima_renovacao", { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        setRevisoes(data.map(item => ({ ...item, _isEditado: false })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [user, verApenasCarteira]);

  useEffect(() => {
    carregarRevisoes();
  }, [carregarRevisoes]);

  // ==========================================================================
  // ⚙️ LÓGICA DE ATUALIZAÇÃO E UI
  // ==========================================================================
  const toggleExpandirLinha = (cedente: string) => {
    setLinhasExpandidas(prev => ({ ...prev, [cedente]: !prev[cedente] }));
  };

  const handleInputChange = (index: number, campo: keyof RevisaoCedente, valor: any) => {
    const novos = [...revisoes];
    novos[index] = { ...novos[index], [campo]: valor, _isEditado: true };
    setRevisoes(novos);
  };

  const calcularDatasRenovacao = () => {
    const hoje = new Date();
    const dataUltima = hoje.toISOString().split("T")[0];
    const dataProxima = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { dataUltima, dataProxima };
  };

  const renovarRapido = async (item: RevisaoCedente) => {
    if (!confirm(`🚀 Confirmar a renovação automática de ${item.cedente} por +180 dias?`)) return;
    
    try {
      setSalvando(true);
      const { dataUltima, dataProxima } = calcularDatasRenovacao();
      
      // 🎯 Correção: PK é "cedente", não "id"
      const { error } = await supabase
        .from("revisao_cedentes")
        .update({ 
          data_ultima_renovacao: dataUltima, 
          data_proxima_renovacao: dataProxima, 
          ultimo_email_enviado: null,
          pendencias: null, // Limpa pendências na renovação
          renovado: true
        })
        .eq("cedente", item.cedente);

      if (error) throw error;

      alert(`✅ Limite de ${item.cedente} renovado com sucesso!`); 
      await carregarRevisoes();
    } catch (err: any) {
      alert(`❌ Erro ao renovar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const salvarLinha = async (item: RevisaoCedente) => {
    try {
      setSalvando(true);
      const payload = {
        data_ultima_renovacao: item.data_ultima_renovacao,
        data_proxima_renovacao: item.data_proxima_renovacao,
        pendencias: item.pendencias,
        renovado: item.renovado
      };

      const { error } = await supabase
        .from("revisao_cedentes")
        .update(payload)
        .eq("cedente", item.cedente);

      if (error) throw error;
      
      alert(`✅ Alterações de ${item.cedente} salvas!`);
      await carregarRevisoes();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const salvarTodasAlteracoes = async () => {
    const editados = revisoes.filter(r => r._isEditado);
    if (editados.length === 0) return alert("💡 Nenhuma alteração pendente para salvar.");

    try {
      setSalvando(true);
      for (const item of editados) {
        await supabase
          .from("revisao_cedentes")
          .update({
            data_ultima_renovacao: item.data_ultima_renovacao,
            data_proxima_renovacao: item.data_proxima_renovacao,
            pendencias: item.pendencias,
            renovado: item.renovado
          })
          .eq("cedente", item.cedente);
      }
      alert("🎉 Todas as alterações foram gravadas!");
      setLinhasExpandidas({});
      await carregarRevisoes();
    } catch (err: any) {
      alert(`❌ Erro no salvamento em lote: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // ==========================================================================
  // 🎨 UTILS DE FORMATAÇÃO E REGRAS DE NEGÓCIO
  // ==========================================================================
  const fData = (str: string | null) => str ? str.split("-").reverse().join("/") : "Não definida";

  const analiseVencimento = (dataStr: string | null) => {
    if (!dataStr) return { status: "SEM_DATA", cor: "bg-slate-100 text-slate-600 border-slate-200", icone: "⚪", diffDias: 0, percent: 0 };
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(dataStr + "T12:00:00");
    const diffDias = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calcula % consumido dos 180 dias
    let percent = ((180 - diffDias) / 180) * 100;
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;

    if (diffDias < 0) return { status: "VENCIDO", cor: "bg-rose-50 text-rose-700 border-rose-200", icone: "🔴", diffDias, percent };
    if (diffDias <= 30) return { status: "ALERTA", cor: "bg-amber-50 text-amber-700 border-amber-200", icone: "🟡", diffDias, percent };
    return { status: "EM_DIA", cor: "bg-emerald-50 text-emerald-700 border-emerald-200", icone: "🟢", diffDias, percent };
  };

  // ==========================================================================
  // 📊 PROCESSAMENTO DE FILTROS E KPIS
  // ==========================================================================
  const kpis = useMemo(() => {
    let emDia = 0, alerta = 0, vencido = 0;
    revisoes.forEach(r => {
      const { status } = analiseVencimento(r.data_proxima_renovacao);
      if (status === "EM_DIA") emDia++;
      if (status === "ALERTA") alerta++;
      if (status === "VENCIDO") vencido++;
    });
    return { total: revisoes.length, emDia, alerta, vencido };
  }, [revisoes]);

  const revisoesFiltradas = useMemo(() => {
    return revisoes.filter(r => {
      if (busca && !r.cedente.toLowerCase().includes(busca.toLowerCase())) return false;
      const { status } = analiseVencimento(r.data_proxima_renovacao);
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "EM_DIA" && status === "EM_DIA") return true;
      if (filtroStatus === "ALERTA" && status === "ALERTA") return true;
      if (filtroStatus === "VENCIDO" && status === "VENCIDO") return true;
      return false;
    });
  }, [revisoes, busca, filtroStatus]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER MODERNO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Revisão de Cedentes</h2>
            </div>
            <span className="text-sm text-slate-500 font-medium ml-12">Painel de controle de vencimentos e pendências documentais.</span>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button onClick={carregarRevisoes} disabled={carregando || salvando} className="flex-1 md:flex-none px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              🔄 Atualizar
            </button>
            <button onClick={salvarTodasAlteracoes} disabled={salvando || carregando} className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {salvando ? "Salvando..." : "💾 Salvar Tudo"}
            </button>
          </div>
        </div>

        {/* PAINEL DE KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <button onClick={() => setFiltroStatus("TODOS")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "TODOS" ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}>
            <span className={`text-[11px] font-bold uppercase tracking-widest block mb-2 ${filtroStatus === "TODOS" ? "text-slate-400" : "text-slate-500"}`}>Carteira Total</span>
            <span className="text-4xl font-black">{kpis.total}</span>
          </button>
          
          <button onClick={() => setFiltroStatus("VENCIDO")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "VENCIDO" ? "bg-rose-50 border-rose-200 shadow-md shadow-rose-100" : "bg-white border-slate-200 hover:border-rose-200 shadow-sm"}`}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Limites Vencidos</span>
            <span className="text-4xl font-black text-slate-800">{kpis.vencido}</span>
          </button>

          <button onClick={() => setFiltroStatus("ALERTA")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "ALERTA" ? "bg-amber-50 border-amber-200 shadow-md shadow-amber-100" : "bg-white border-slate-200 hover:border-amber-200 shadow-sm"}`}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Vence em {'<'} 30 dias</span>
            <span className="text-4xl font-black text-slate-800">{kpis.alerta}</span>
          </button>

          <button onClick={() => setFiltroStatus("EM_DIA")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "EM_DIA" ? "bg-emerald-50 border-emerald-200 shadow-md shadow-emerald-100" : "bg-white border-slate-200 hover:border-emerald-200 shadow-sm"}`}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Limites em Dia</span>
            <span className="text-4xl font-black text-slate-800">{kpis.emDia}</span>
          </button>
        </div>

        {/* BARRA DE BUSCA */}
        <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <svg className="w-5 h-5 text-slate-400 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Buscar por nome do Cedente..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-slate-700 font-medium p-2"
          />
        </div>

        {/* ÁREA DA TABELA */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="w-14 px-4 text-center">Ação</th>
                  <th className="px-4 w-72">Cedente</th>
                  {user?.cargo?.toLowerCase() !== "comercial" && <th className="px-4 w-32">Comercial</th>}
                  <th className="px-4 text-center w-40">Última Renovação</th>
                  <th className="px-4 w-52">Cronograma (180 dias)</th>
                  <th className="px-4 flex-1 min-w-[250px]">Status / Pendências</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {carregando && revisoes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-medium animate-pulse">Carregando cronograma...</td></tr>
                ) : revisoesFiltradas.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-medium">Nenhum cedente encontrado para este filtro. 🎉</td></tr>
                ) : revisoesFiltradas.map((item, mapIndex) => {
                  
                  const index = revisoes.findIndex(r => r.cedente === item.cedente);
                  const isOpen = !!linhasExpandidas[item.cedente];
                  const infoData = analiseVencimento(item.data_proxima_renovacao);
                  const temPendencia = item.pendencias && item.pendencias.trim().length > 0;

                  return (
                    <React.Fragment key={item.cedente}>
                      <tr className={`group transition-all duration-200 ${isOpen ? "bg-indigo-50/30" : "hover:bg-slate-50"} ${item._isEditado ? "bg-amber-50/30" : ""}`}>
                        
                        {/* Botão Expandir */}
                        <td className="px-4 py-4 text-center align-top">
                          <button 
                            onClick={() => toggleExpandirLinha(item.cedente)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-all border cursor-pointer ${isOpen ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30" : "bg-white text-slate-400 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 shadow-sm"}`}
                          >
                            <svg className={`w-4 h-4 transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </td>

                        {/* Cedente */}
                        <td className="px-4 py-4 align-top">
                          <span className="font-extrabold text-slate-800 tracking-tight block truncate" title={item.cedente}>{item.cedente}</span>
                          {item.renovado && <span className="mt-1 inline-block bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Ciclo Ativo</span>}
                        </td>

                        {/* Comercial */}
                        {user?.cargo?.toLowerCase() !== "comercial" && (
                          <td className="px-4 py-4 align-top">
                            <span className="text-slate-500 text-xs font-bold uppercase block mt-0.5">{item.comercial || "-"}</span>
                          </td>
                        )}

                        {/* Última Renovação */}
                        <td className="px-4 py-4 align-top text-center">
                          <span className="text-slate-500 font-mono text-xs font-semibold block mt-0.5">{fData(item.data_ultima_renovacao)}</span>
                        </td>

                        {/* Cronograma Barra de Progresso */}
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-1.5 mt-0.5">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                              <span className={infoData.status === "VENCIDO" ? "text-rose-600" : "text-slate-500"}>
                                {infoData.status === "VENCIDO" ? `Vencido há ${Math.abs(infoData.diffDias)}d` : `Expira em ${infoData.diffDias}d`}
                              </span>
                              <span className="text-slate-500 font-mono">{fData(item.data_proxima_renovacao)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${infoData.status === 'VENCIDO' ? 'bg-rose-500' : infoData.status === 'ALERTA' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                style={{ width: `${infoData.percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Resumo Pendências */}
                        <td className="px-4 py-4 align-top">
                          {temPendencia ? (
                            <div className="flex gap-2 items-start text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 shadow-sm text-xs font-medium cursor-pointer" onClick={() => !isOpen && toggleExpandirLinha(item.cedente)}>
                              <span>⚠️</span>
                              <span className="truncate max-w-[200px]" title={item.pendencias || ""}>{item.pendencias}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-600/70 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 w-max">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                              Sem pendências
                            </span>
                          )}
                        </td>

                      </tr>

                      {/* AREA EXPANDIDA (Detalhes e Edição) */}
                      {isOpen && (
                        <tr>
                          <td colSpan={user?.cargo?.toLowerCase() !== "comercial" ? 6 : 5} className="bg-slate-50 border-b-2 border-indigo-100 p-6 shadow-inner">
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                              
                              {/* Lado Esquerdo: Controle de Datas */}
                              <div className="xl:col-span-4 space-y-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">Controle de Ciclo</span>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[10px] text-slate-500 font-bold uppercase">Última Renovação (Início)</label>
                                      <input type="date" value={item.data_ultima_renovacao || ""} onChange={(e) => handleInputChange(index, "data_ultima_renovacao", e.target.value)} 
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 hover:bg-white" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[10px] text-slate-500 font-bold uppercase">Próxima Expiração (Teto +180d)</label>
                                      <input type="date" value={item.data_proxima_renovacao || ""} onChange={(e) => handleInputChange(index, "data_proxima_renovacao", e.target.value)} 
                                        className={`w-full p-2.5 border rounded-lg text-sm font-mono font-bold outline-none transition-all focus:ring-2 ${infoData.status === 'VENCIDO' ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300 text-slate-700 bg-slate-50 hover:bg-white focus:border-indigo-500 focus:ring-indigo-100'}`} />
                                    </div>
                                    
                                    <button onClick={() => renovarRapido(item)} disabled={salvando} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                                      🚀 Renovar Automático (+180 Dias)
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Lado Direito: Pendências */}
                              <div className="xl:col-span-8">
                                <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100 shadow-sm h-full flex flex-col">
                                  <label className="flex items-center gap-2 mb-3 text-xs text-amber-900 font-bold uppercase tracking-wider">
                                    <span className="text-base">⚠️</span> Registro de Pendências (Docs/Comitê)
                                  </label>
                                  <textarea 
                                    value={item.pendencias || ""} 
                                    onChange={(e) => handleInputChange(index, "pendencias", e.target.value)} 
                                    className="flex-1 w-full p-4 border border-amber-200 rounded-xl text-sm resize-none outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 bg-white hover:border-amber-300 transition-all text-slate-700 font-medium" 
                                    placeholder="Descreva aqui os documentos faltando, certidões pendentes ou restrições de comitê..." 
                                  />
                                </div>
                              </div>

                              {/* Ações / Salvar Linha */}
                              <div className="xl:col-span-12 flex justify-end mt-2 pt-4 border-t border-slate-200/60">
                                <button 
                                  onClick={() => salvarLinha(item)} 
                                  disabled={salvando || !item._isEditado} 
                                  className={`px-6 py-2.5 font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer
                                    ${salvando || !item._isEditado 
                                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30"
                                    }`}
                                >
                                  {salvando ? "Processando..." : (item._isEditado ? "Salvar Alterações desta Linha" : "Nenhuma alteração")}
                                </button>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}