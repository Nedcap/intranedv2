/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

const formatarHora = (data?: Date | null) => {
  if (!data) return "--:--";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

// Converte a string do banco YYYY-MM-DD local
const extrairDataLocal = (isoString: string) => {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatarDataBr = (dataLocal: string) => {
  const [y, m, d] = dataLocal.split("-");
  return `${d}/${m}/${y}`;
};

type DiaPonto = {
  data: string;
  registros: {
    ENTRADA?: any;
    SAIDA_ALMOCO?: any;
    RETORNO_ALMOCO?: any;
    SAIDA?: any;
  }
};

type FuncionarioAgrupado = {
  id: string;
  nome: string;
  dias: DiaPonto[];
};

export default function GestaoPontoPage() {
  const [funcionarios, setFuncionarios] = useState<FuncionarioAgrupado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});
  
  // 🔥 NOVO: Estado de Seleção Múltipla para Relatórios
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Estados do Modal de Edição (Por Dia Inteiro)
  const [diaEmEdicao, setDiaEmEdicao] = useState<{ funcId: string; nome: string; dataLocal: string; registros: any } | null>(null);
  const [formEdicao, setFormEdicao] = useState({ ENTRADA: "", SAIDA_ALMOCO: "", RETORNO_ALMOCO: "", SAIDA: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const carregarRegistros = async () => {
    try {
      setCarregando(true);

      const { data: usersData, error: errUsers } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("bate_ponto", true);

      if (errUsers) throw errUsers;
      if (!usersData) return;

      const { data: pontosData, error: errPonto } = await supabase
        .from("registro_ponto")
        .select("*")
        .order("data_hora", { ascending: false });

      if (errPonto) throw errPonto;

      const agrupados: FuncionarioAgrupado[] = usersData.map(u => {
        const pontosUsuario = (pontosData || []).filter(p => {
          if (p.usuario_id !== u.id) return false;
          const dataLocal = extrairDataLocal(p.data_hora);
          return dataLocal.startsWith(mesFiltro);
        });

        const mapDias: Record<string, DiaPonto> = {};
        pontosUsuario.forEach(p => {
          const dl = extrairDataLocal(p.data_hora);
          if (!mapDias[dl]) mapDias[dl] = { data: dl, registros: {} };
          mapDias[dl].registros[p.tipo as keyof typeof mapDias[string]["registros"]] = p;
        });

        const diasArray = Object.values(mapDias).sort((a, b) => b.data.localeCompare(a.data));

        return {
          id: u.id,
          nome: u.nome,
          dias: diasArray
        };
      });

      const funcionariosAtivos = agrupados.filter(f => f.dias.length > 0);
      setFuncionarios(funcionariosAtivos);
      
      // Auto-seleciona todos por padrão ao carregar um novo mês
      setSelecionados(new Set(funcionariosAtivos.map(f => f.id)));
      
    } catch (error: any) {
      alert(`❌ Erro ao carregar gestão: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarRegistros();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFiltro]);

  const toggleExpandirLinha = (id: string) => {
    setLinhasExpandidas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ==========================================================================
  // 🎯 LÓGICA DE SELEÇÃO MÚLTIPLA
  // ==========================================================================
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelecionados(new Set(funcionarios.map(f => f.id)));
    } else {
      setSelecionados(new Set());
    }
  };

  const handleToggleSelectFuncionario = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita expandir a sanfona ao clicar no checkbox
    const newSet = new Set(selecionados);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelecionados(newSet);
  };

  // ==========================================================================
  // 🖨️ LÓGICA DE IMPRESSÃO INTELIGENTE
  // ==========================================================================
  const handleImprimir = () => {
    if (selecionados.size === 0) {
      return alert("⚠️ Selecione pelo menos um funcionário para imprimir o relatório.");
    }

    // 1. Expande APENAS as linhas dos funcionários selecionados
    const estadoExpandido: Record<string, boolean> = { ...linhasExpandidas };
    funcionarios.forEach(f => {
      if (selecionados.has(f.id)) {
        estadoExpandido[f.id] = true;
      }
    });
    setLinhasExpandidas(estadoExpandido);

    // 2. Dá um pequeno tempo para o React renderizar o HTML antes de chamar a impressora
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // ==========================================================================
  // ✏️ LÓGICA DO MODAL DE EDIÇÃO DE DIA INTEIRO
  // ==========================================================================
  const abrirModalEdicaoDia = (funcId: string, nome: string, dia: DiaPonto) => {
    const fH = (reg: any) => reg ? new Date(reg.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    
    setFormEdicao({
      ENTRADA: fH(dia.registros.ENTRADA),
      SAIDA_ALMOCO: fH(dia.registros.SAIDA_ALMOCO),
      RETORNO_ALMOCO: fH(dia.registros.RETORNO_ALMOCO),
      SAIDA: fH(dia.registros.SAIDA)
    });

    setDiaEmEdicao({
      funcId,
      nome,
      dataLocal: dia.data,
      registros: dia.registros
    });
  };

  const salvarEdicaoDia = async () => {
    if (!diaEmEdicao) return;
    try {
      setSalvandoEdicao(true);
      const { funcId, dataLocal, registros } = diaEmEdicao;

      const [ano, mes, diaStr] = dataLocal.split("-").map(Number);
      const tipos = ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"];

      for (const tipo of tipos) {
        const novaHoraStr = formEdicao[tipo as keyof typeof formEdicao];
        const registroExistente = registros[tipo as keyof typeof registros];

        if (!novaHoraStr && registroExistente) {
          await supabase.from("registro_ponto").delete().eq("id", registroExistente.id);
        } else if (novaHoraStr) {
          const [h, m] = novaHoraStr.split(":").map(Number);
          const novaDataObj = new Date(ano, mes - 1, diaStr, h, m, 0);
          const isoAtualizado = novaDataObj.toISOString();

          if (registroExistente) {
            await supabase.from("registro_ponto").update({ data_hora: isoAtualizado }).eq("id", registroExistente.id);
          } else {
            await supabase.from("registro_ponto").insert({
              usuario_id: funcId,
              tipo: tipo,
              data_hora: isoAtualizado,
              ip_origem: "AJUSTE_MANUAL",
              user_agent: "Ajuste via Painel Gestão"
            });
          }
        }
      }

      alert("✅ Folha do dia atualizada com sucesso!");
      setDiaEmEdicao(null);
      await carregarRegistros();
    } catch (err: any) {
      alert(`❌ Erro ao salvar dia: ${err.message}`);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // ==========================================================================
  // 📊 CALCULADORA DE HORAS
  // ==========================================================================
  const calcularMetricasDia = (regs: DiaPonto["registros"]) => {
    const e = regs.ENTRADA ? new Date(regs.ENTRADA.data_hora) : null;
    const sa = regs.SAIDA_ALMOCO ? new Date(regs.SAIDA_ALMOCO.data_hora) : null;
    const ra = regs.RETORNO_ALMOCO ? new Date(regs.RETORNO_ALMOCO.data_hora) : null;
    const s = regs.SAIDA ? new Date(regs.SAIDA.data_hora) : null;

    let atrasoMinutos = 0;
    if (e) {
      const horasEntrada = e.getHours();
      const minEntrada = e.getMinutes();
      if (horasEntrada > 8 || (horasEntrada === 8 && minEntrada > 5)) { 
        atrasoMinutos = (horasEntrada - 8) * 60 + minEntrada;
      }
    }

    let horasTrabalhadas = "--:--";
    if (e && s) {
      let totalMs = s.getTime() - e.getTime();
      if (sa && ra) {
        const almocoMs = Math.max(0, ra.getTime() - sa.getTime());
        totalMs -= almocoMs;
      } else {
        totalMs -= (60 * 60 * 1000); // 1h padrão
      }
      
      const ht = Math.floor(totalMs / (1000 * 60 * 60));
      const mt = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
      horasTrabalhadas = `${String(ht).padStart(2, '0')}:${String(mt).padStart(2, '0')}`;
    }

    return { atrasoMinutos, horasTrabalhadas };
  };

  // ==========================================================================
  // 📈 EXPORTAÇÃO EXCEL (.CSV FORMATADO)
  // ==========================================================================
  const exportarCSVConsolidado = () => {
    if (funcionarios.length === 0) return alert("Nenhum registro para exportar nesse mês.");
    if (selecionados.size === 0) return alert("⚠️ Selecione pelo menos um funcionário para exportar.");

    // Filtra apenas os funcionários que o usuário marcou na tela
    const funcionariosSelecionados = funcionarios.filter(f => selecionados.has(f.id));
    const cabecalho = ["Data", "Funcionário", "Entrada", "Saída Almoço", "Volta Almoço", "Saída Final", "Atraso Entrada (Min)", "Horas Trabalhadas", "Bonificação"];
    const linhas: string[][] = [];

    funcionariosSelecionados.forEach(func => {
      func.dias.forEach(dia => {
        const e = dia.registros.ENTRADA ? new Date(dia.registros.ENTRADA.data_hora) : null;
        const sa = dia.registros.SAIDA_ALMOCO ? new Date(dia.registros.SAIDA_ALMOCO.data_hora) : null;
        const ra = dia.registros.RETORNO_ALMOCO ? new Date(dia.registros.RETORNO_ALMOCO.data_hora) : null;
        const s = dia.registros.SAIDA ? new Date(dia.registros.SAIDA.data_hora) : null;

        const fH = (data: Date | null) => data ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-";
        const { atrasoMinutos, horasTrabalhadas } = calcularMetricasDia(dia.registros);
        const bonificacao = "1 Hora (Saída antecipada 17h)";

        linhas.push([
          formatarDataBr(dia.data),
          func.nome,
          fH(e),
          fH(sa),
          fH(ra),
          fH(s),
          atrasoMinutos > 0 ? `${atrasoMinutos} min` : "0 min",
          horasTrabalhadas,
          bonificacao
        ]);
      });
    });

    const csvContent = [
      cabecalho.join(";"),
      ...linhas.map(linha => linha.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Folha_Ponto_Excel_${mesFiltro}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800" id="area-impressao">
      <div className="max-w-[1400px] mx-auto space-y-6 container-relatorio">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4 cabecalho-relatorio">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="text-3xl">📋</span> Gestão de Folha de Ponto
            </h2>
            <span className="text-sm text-slate-500 font-medium mt-1 block">
              Auditoria de jornada de trabalho (Mês-Base: <strong>{mesFiltro}</strong>)
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap print:hidden">
            <input 
              type="month" 
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="p-2 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all flex-1 md:flex-none"
            />
            <button 
              onClick={handleImprimir}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Imprimir Relatório
            </button>
            <button 
              onClick={exportarCSVConsolidado}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exportar p/ Excel
            </button>
          </div>
        </div>

        {/* TABELÃO EXPANSÍVEL */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden tabela-principal">
          <div className="overflow-x-auto pb-4 custom-overflow">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="w-12 px-4 text-center print:hidden border-r border-slate-200">
                    <input
                      type="checkbox"
                      checked={funcionarios.length > 0 && selecionados.size === funcionarios.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      title="Selecionar Todos"
                    />
                  </th>
                  <th className="w-16 px-4 text-center print:hidden"></th>
                  <th className="px-6">Funcionário</th>
                  <th className="px-6 text-center">Dias Trabalhados</th>
                  <th className="px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="text-center p-10 text-slate-400 font-bold animate-pulse">Calculando folhas de ponto...</td>
                  </tr>
                ) : funcionarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-10 text-slate-400 italic">Nenhum funcionário registrou ponto neste mês.</td>
                  </tr>
                ) : (
                  funcionarios.map((func) => {
                    const isSelected = selecionados.has(func.id);
                    const isOpen = !!linhasExpandidas[func.id];
                    // 🎯 O pulo do gato: A classe print:hidden oculta a linha inteira (e seus filhos) na hora da impressão se não estiver selecionada
                    const printClass = !isSelected ? "print:hidden" : "";

                    return (
                      <React.Fragment key={func.id}>
                        <tr 
                          className={`group transition-all duration-200 cursor-pointer ${isOpen ? "bg-indigo-50/40" : "hover:bg-slate-50"} ${printClass}`} 
                          onClick={() => toggleExpandirLinha(func.id)}
                        >
                          <td className="px-4 py-4 text-center print:hidden border-r border-slate-100" onClick={(e) => handleToggleSelectFuncionario(func.id, e)}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4 text-center print:hidden">
                            <button className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all border ${isOpen ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30" : "bg-white text-slate-400 border-slate-300 group-hover:border-indigo-400 group-hover:text-indigo-600 shadow-sm"}`}>
                              <svg className={`w-4 h-4 transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </td>
                          <td className="px-6 py-4 font-black text-indigo-800 text-base print-destaque">{func.nome}</td>
                          <td className="px-6 py-4 text-center font-bold text-slate-600">{func.dias.length} dias no mês</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border border-emerald-200 badge-status">Em Conformidade</span>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className={printClass}>
                            <td colSpan={5} className="bg-slate-50/50 border-b-4 border-indigo-100 p-0 shadow-inner print-no-bg">
                              <div className="p-6 pt-2 pl-14 print-no-padding">
                                <table className="w-full text-left bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden text-xs print-table-border">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-500 uppercase tracking-widest font-extrabold h-10 border-b border-slate-200 text-[10px]">
                                      <th className="px-4 text-center w-28 border-r border-slate-200">Data</th>
                                      <th className="px-4 text-center w-24">Entrada</th>
                                      <th className="px-4 text-center w-24">Saída Almoço</th>
                                      <th className="px-4 text-center w-24">Volta Almoço</th>
                                      <th className="px-4 text-center w-24 border-r border-slate-200">Saída Final</th>
                                      <th className="px-4 text-center w-28">Horas Liq.</th>
                                      <th className="px-4 text-center w-28">Atraso</th>
                                      <th className="px-4 text-right w-20 print:hidden">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {func.dias.map((dia, idx) => {
                                      const { atrasoMinutos, horasTrabalhadas } = calcularMetricasDia(dia.registros);
                                      const e = dia.registros.ENTRADA ? new Date(dia.registros.ENTRADA.data_hora) : null;
                                      const sa = dia.registros.SAIDA_ALMOCO ? new Date(dia.registros.SAIDA_ALMOCO.data_hora) : null;
                                      const ra = dia.registros.RETORNO_ALMOCO ? new Date(dia.registros.RETORNO_ALMOCO.data_hora) : null;
                                      const s = dia.registros.SAIDA ? new Date(dia.registros.SAIDA.data_hora) : null;

                                      return (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors font-semibold text-slate-700">
                                          <td className="px-4 py-3 text-center text-slate-800 border-r border-slate-100">{formatarDataBr(dia.data)}</td>
                                          <td className="px-4 py-3 text-center font-mono text-emerald-700">{formatarHora(e)}</td>
                                          <td className="px-4 py-3 text-center font-mono text-amber-700">{formatarHora(sa)}</td>
                                          <td className="px-4 py-3 text-center font-mono text-emerald-700">{formatarHora(ra)}</td>
                                          <td className="px-4 py-3 text-center font-mono text-rose-700 border-r border-slate-100">{formatarHora(s)}</td>
                                          <td className="px-4 py-3 text-center font-black text-indigo-700">{horasTrabalhadas}</td>
                                          <td className="px-4 py-3 text-center">
                                            {atrasoMinutos > 0 ? (
                                              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200 badge-atraso">{atrasoMinutos} min</span>
                                            ) : <span className="text-slate-300">-</span>}
                                          </td>
                                          <td className="px-4 py-3 text-right print:hidden">
                                            <button 
                                              onClick={(ev) => { ev.stopPropagation(); abrirModalEdicaoDia(func.id, func.nome, dia); }}
                                              className="bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 p-1.5 rounded transition-colors border border-slate-200"
                                              title="Editar Horários do Dia"
                                            >
                                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE EDIÇÃO DO DIA INTEIRO */}
        {diaEmEdicao && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
              <h3 className="text-xl font-black text-slate-800 mb-2">Editar Folha de Ponto</h3>
              <p className="text-sm text-slate-500 mb-6">
                Colaborador: <strong className="text-indigo-600">{diaEmEdicao.nome}</strong> <br/>
                Dia: <strong>{formatarDataBr(diaEmEdicao.dataLocal)}</strong>
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">📥 Entrada</label>
                  <input type="time" value={formEdicao.ENTRADA} onChange={(e) => setFormEdicao(prev => ({...prev, ENTRADA: e.target.value}))} className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono font-bold text-slate-700" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">🍔 Saída Almoço</label>
                  <input type="time" value={formEdicao.SAIDA_ALMOCO} onChange={(e) => setFormEdicao(prev => ({...prev, SAIDA_ALMOCO: e.target.value}))} className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-amber-500 font-mono font-bold text-slate-700" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">🔙 Retorno Almoço</label>
                  <input type="time" value={formEdicao.RETORNO_ALMOCO} onChange={(e) => setFormEdicao(prev => ({...prev, RETORNO_ALMOCO: e.target.value}))} className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono font-bold text-slate-700" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">🏠 Saída Final</label>
                  <input type="time" value={formEdicao.SAIDA} onChange={(e) => setFormEdicao(prev => ({...prev, SAIDA: e.target.value}))} className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-rose-500 font-mono font-bold text-slate-700" />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-6 text-xs text-amber-800 font-medium">
                💡 <strong>Dica:</strong> Para remover uma marcação que foi feita por engano, basta apagar o horário (deixar vazio) e salvar.
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setDiaEmEdicao(null)}
                  disabled={salvandoEdicao}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={salvarEdicaoDia}
                  disabled={salvandoEdicao}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"
                >
                  {salvandoEdicao ? "Salvando..." : "Gravar Ajuste"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 🖨️ CSS DE IMPRESSÃO GLOBAL (Injetado via style tag) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            margin: 1cm;
            size: landscape;
          }
          
          /* Esconde TUDO que for do Layout Geral (Sidebar, Header, Fundos) */
          body * {
            visibility: hidden;
          }
          
          /* Restaura APENAS a div de impressão e seus filhos */
          #area-impressao, #area-impressao * {
            visibility: visible;
          }
          
          /* Reposiciona a área de impressão pro topo esquerdo da página */
          #area-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            min-height: 0 !important;
            padding: 0 !important;
          }

          /* Remove sombras e bordas redondas para ficar clean no papel */
          .shadow-sm, .shadow-md, .shadow-inner, .shadow-2xl {
            box-shadow: none !important;
          }
          
          .rounded-2xl, .rounded-xl {
            border-radius: 4px !important;
          }

          /* Tira backgrounds acinzentados */
          .bg-slate-50\\/50, .bg-slate-50, .bg-slate-100 {
            background-color: white !important;
          }
          
          .print-no-bg {
            background-color: white !important;
          }

          /* Ajustes de Padding para Caber no Papel */
          .print-no-padding {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          /* Expande containers e tabelas para não quebrar layout */
          .container-relatorio {
            max-width: 100% !important;
            width: 100% !important;
          }
          .custom-overflow {
            overflow: visible !important;
          }
          .tabela-principal {
            border: none !important;
          }
          .print-table-border {
            border: 1px solid #ccc !important;
            margin-bottom: 20px !important;
          }

          /* Aumenta contraste da fonte no papel */
          .text-slate-500, .text-slate-400 { color: #555 !important; }
          .print-destaque { font-size: 16px !important; color: #000 !important; }
          
          /* Limpa badges com cor de fundo no papel */
          .badge-status { border: none !important; background: transparent !important; color: #000 !important; font-weight: bold; }
          .badge-atraso { border: none !important; background: transparent !important; color: #d00 !important; font-weight: bold; }

          /* Esconde tudo que tiver a classe nativa print:hidden do Tailwind */
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}