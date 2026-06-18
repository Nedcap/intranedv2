/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Pagamento {
  id: string;
  isNovo?: boolean;
  empresa: string;
  mes_ano: string;
  data_vencimento: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: "Pago" | "A Vencer" | "Atrasado";
  dados_customizados: Record<string, string>;
}

const EMPRESAS = [
  { id: "SEC", nome: "Ned Capital Securitizadora", cnpj: "45.490.426/0001-09" },
  { id: "FIDC", nome: "Ned Fidc (Consultoria)", cnpj: "34.768.252/0001-87" }
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function FinanceiroCalendarioPage() {
  const [empresaAtiva, setEmpresaAtiva] = useState("SEC");
  const [mesAtivo, setMesAtivo] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [colunasDinamicas, setColunasDinamicas] = useState<string[]>([]);
  
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // 🗓️ CONTROLE DO MODAL DE DIA ESPECÍFICO
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  // ==========================================================================
  // 📥 CARREGAMENTO DE DADOS
  // ==========================================================================
  const carregarPlanilha = async () => {
    setCarregando(true);
    try {
      const { data: cols } = await supabase
        .from("financeiro_colunas")
        .select("nome_coluna")
        .eq("empresa", empresaAtiva);
      
      if (cols) setColunasDinamicas(cols.map(c => c.nome_coluna));

      const { data: pags } = await supabase
        .from("financeiro_pagamentos")
        .select("*")
        .eq("empresa", empresaAtiva)
        .eq("mes_ano", mesAtivo)
        .order("data_vencimento", { ascending: true });

      if (pags) {
        setPagamentos(pags.map(p => ({
          ...p,
          dados_customizados: p.dados_customizados || {}
        })));
      } else {
        setPagamentos([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPlanilha();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva, mesAtivo]);

  // ==========================================================================
  // 🧮 KPI'S E CÁLCULOS DO MÊS
  // ==========================================================================
  const kpis = useMemo(() => {
    let totalMes = 0;
    let totalPago = 0;
    let totalAberto = 0;

    pagamentos.forEach(p => {
      const v = Number(p.valor) || 0;
      totalMes += v;
      if (p.status === "Pago") totalPago += v;
      else totalAberto += v;
    });

    return { totalMes, totalPago, totalAberto };
  }, [pagamentos]);

  const fM = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // ==========================================================================
  // 🗓️ GERADOR DO CALENDÁRIO
  // ==========================================================================
  const { diasBrancos, diasMes } = useMemo(() => {
    const [ano, mes] = mesAtivo.split("-").map(Number);
    const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
    const totalDias = new Date(ano, mes, 0).getDate();
    
    return {
      diasBrancos: Array.from({ length: primeiroDiaSemana }),
      diasMes: Array.from({ length: totalDias }, (_, i) => i + 1)
    };
  }, [mesAtivo]);

  // ==========================================================================
  // ✏️ MANIPULAÇÃO DO GRID NO MODAL (EXCEL-LIKE)
  // ==========================================================================
  const pagamentosDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return pagamentos.filter(p => p.data_vencimento === diaSelecionado);
  }, [pagamentos, diaSelecionado]);

  const adicionarLinhaNoDia = () => {
    if (!diaSelecionado) return;
    const novaLinha: Pagamento = {
      id: crypto.randomUUID(),
      isNovo: true,
      empresa: empresaAtiva,
      mes_ano: mesAtivo,
      data_vencimento: diaSelecionado,
      descricao: "",
      categoria: "",
      valor: 0,
      status: "A Vencer",
      dados_customizados: {}
    };
    setPagamentos([...pagamentos, novaLinha]);
  };

  const atualizarCelula = (id: string, campo: keyof Pagamento, valor: any) => {
    setPagamentos(prev => prev.map(p => {
      if (p.id === id) {
        const pModificado = { ...p, [campo]: valor };
        // Se mudar a data de vencimento, ajusta o mes_ano automaticamente
        if (campo === "data_vencimento") {
          pModificado.mes_ano = String(valor).substring(0, 7);
        }
        return pModificado as Pagamento;
      }
      return p;
    }));
  };

  const atualizarCelulaCustomizada = (id: string, coluna: string, valor: string) => {
    setPagamentos(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, dados_customizados: { ...p.dados_customizados, [coluna]: valor } };
      }
      return p;
    }));
  };

  const removerLinha = async (id: string, isNovo?: boolean) => {
    if (isNovo) {
      setPagamentos(prev => prev.filter(p => p.id !== id));
      return;
    }
    if (!confirm("Deletar esta conta definitivamente?")) return;
    
    setPagamentos(prev => prev.filter(p => p.id !== id));
    await supabase.from("financeiro_pagamentos").delete().eq("id", id);
  };

  const adicionarColunaCustomizada = async () => {
    const nome = prompt("Digite o nome da nova coluna (Ex: NF, Código de Barras):");
    if (!nome || nome.trim() === "") return;
    const nomeLimpo = nome.trim().toUpperCase();

    if (colunasDinamicas.includes(nomeLimpo)) {
      alert("Esta coluna já existe!");
      return;
    }

    setColunasDinamicas([...colunasDinamicas, nomeLimpo]);
    await supabase.from("financeiro_colunas").insert({ empresa: empresaAtiva, nome_coluna: nomeLimpo });
  };

  const salvarPlanilha = async () => {
    setSalvando(true);
    try {
      // Pega apenas as linhas que estão na tela do modal para salvar
      const payload = pagamentosDoDia.map(p => {
        const { isNovo, ...rest } = p;
        return rest;
      });

      if (payload.length > 0) {
        const { error } = await supabase.from("financeiro_pagamentos").upsert(payload, { onConflict: "id" });
        if (error) throw error;
      }
      
      alert(`✅ Salvo! Dados do dia ${diaSelecionado?.split('-').reverse().join('/')} atualizados com sucesso.`);
      carregarPlanilha(); 
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* 🚀 HEADER & TOGGLE DE EMPRESA */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">💰 Calendário Financeiro</h2>
          <span className="text-xs text-slate-500 font-medium">Controle visual de Fluxo de Caixa e Contas a Pagar.</span>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {EMPRESAS.map(emp => (
            <button
              key={emp.id}
              onClick={() => setEmpresaAtiva(emp.id)}
              className={`px-4 py-2 rounded-md font-bold text-xs transition-all flex flex-col items-center ${
                empresaAtiva === emp.id 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "text-slate-500 hover:bg-slate-200"
              }`}
            >
              <span className="uppercase">{emp.nome}</span>
              <span className={`text-[9px] font-mono ${empresaAtiva === emp.id ? "text-blue-200" : "text-slate-400"}`}>
                {emp.cnpj}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 📅 CONTROLES DE MÊS E KPI'S */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md w-full md:w-64 shrink-0 flex flex-col justify-center gap-3 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-slate-800 opacity-20 text-7xl font-black">🗓️</div>
          <span className="text-[11px] font-black uppercase text-blue-400 tracking-wider relative z-10">Mês de Referência</span>
          <input 
            type="month" 
            value={mesAtivo}
            onChange={(e) => setMesAtivo(e.target.value)}
            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg font-bold outline-none text-sm focus:border-blue-500 transition-colors relative z-10"
          />
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Projetado (Mês)</span>
            <span className="text-2xl font-black text-slate-800 font-mono mt-1">{fM(kpis.totalMes)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-xl shadow-xs flex flex-col justify-center">
            <span className="text-[11px] font-black uppercase text-emerald-700 tracking-wider">Total Baixado (Pago)</span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-1">{fM(kpis.totalPago)}</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl shadow-xs flex flex-col justify-center">
            <span className="text-[11px] font-black uppercase text-amber-700 tracking-wider">Em Aberto / Atrasado</span>
            <span className="text-2xl font-black text-amber-700 font-mono mt-1">{fM(kpis.totalAberto)}</span>
          </div>
        </div>
      </div>

      {/* 🗓️ CALENDÁRIO VISUAL */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4">
        {carregando ? (
          <div className="h-64 flex items-center justify-center text-slate-400 font-bold animate-pulse">Sincronizando calendário...</div>
        ) : (
          <>
            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-center font-black text-slate-400 text-[10px] uppercase tracking-wider py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid de Dias */}
            <div className="grid grid-cols-7 gap-2">
              {/* Espaços em branco do início do mês */}
              {diasBrancos.map((_, i) => <div key={`b-${i}`} className="min-h-[120px] bg-slate-50/50 rounded-xl border border-transparent"></div>)}

              {/* Dias Reais */}
              {diasMes.map(dia => {
                const dataString = `${mesAtivo}-${String(dia).padStart(2, "0")}`;
                const pagsNoDia = pagamentos.filter(p => p.data_vencimento === dataString);
                
                const valorDia = pagsNoDia.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
                const hojeStr = new Date().toISOString().split("T")[0];
                const isHoje = dataString === hojeStr;

                return (
                  <div 
                    key={dia} 
                    onClick={() => setDiaSelecionado(dataString)}
                    className={`min-h-[120px] border rounded-xl p-2 flex flex-col gap-1 cursor-pointer transition-all ${isHoje ? "border-blue-400 ring-1 ring-blue-100 bg-blue-50/20 shadow-sm" : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-xs font-black ${isHoje ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-xs" : "text-slate-500"}`}>
                        {dia}
                      </span>
                      {valorDia > 0 && (
                        <span className="text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {fM(valorDia)}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-col gap-1 overflow-y-auto max-h-[80px] custom-scrollbar pr-1">
                      {pagsNoDia.map(p => (
                        <div key={p.id} className={`text-[9px] font-bold px-1.5 py-1 rounded truncate border ${
                          p.status === "Pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          p.status === "Atrasado" ? "bg-rose-50 text-rose-700 border-rose-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`} title={`${p.descricao} - ${fM(p.valor)}`}>
                          {p.status === "Pago" ? "✅ " : p.status === "Atrasado" ? "🚨 " : "⏳ "}
                          {p.descricao || "Nova Conta"}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 🔍 MODAL DO DIA ESPECÍFICO (O TABELÃO DE CONTROLE) */}
      {diaSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-7xl max-h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            
            {/* Header do Modal */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black uppercase tracking-wider flex items-center gap-2">
                  <span className="text-2xl">🗓️</span> 
                  Detalhes do Dia: <span className="text-blue-400">{diaSelecionado.split("-").reverse().join("/")}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Contas e pagamentos vinculados a esta data.</p>
              </div>
              <button onClick={() => setDiaSelecionado(null)} className="text-xl font-black text-slate-400 hover:text-white px-2">✕</button>
            </div>

            {/* Barra de Ferramentas */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center shrink-0">
              <div className="flex gap-2">
                <button onClick={adicionarLinhaNoDia} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm">
                  ➕ Nova Conta a Pagar
                </button>
                <button onClick={adicionarColunaCustomizada} className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-600 hover:text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm">
                  ➕ Add Coluna
                </button>
              </div>
              <button 
                onClick={salvarPlanilha} 
                disabled={salvando}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-lg text-[11px] shadow-md transition-all disabled:opacity-50"
              >
                {salvando ? "⏳ Salvando..." : "💾 Salvar Alterações deste Dia"}
              </button>
            </div>

            {/* Grid Tabelão */}
            <div className="flex-1 overflow-auto bg-slate-100/50 p-4">
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-wider select-none border-b border-slate-200">
                      <th className="p-2 border-r border-slate-200 w-10 text-center">Excluir</th>
                      <th className="p-2 border-r border-slate-200 w-36">Vencimento</th>
                      <th className="p-2 border-r border-slate-200 min-w-[200px]">Beneficiário / Descrição</th>
                      <th className="p-2 border-r border-slate-200 w-40">Categoria</th>
                      <th className="p-2 border-r border-slate-200 w-36 text-right">Valor (R$)</th>
                      <th className="p-2 border-r border-slate-200 w-36 text-center">Status</th>
                      {colunasDinamicas.map(col => (
                        <th key={col} className="p-2 border-r border-slate-200 w-40 bg-purple-50 text-purple-700 truncate" title={col}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pagamentosDoDia.length === 0 ? (
                      <tr><td colSpan={6 + colunasDinamicas.length} className="p-12 text-center text-slate-400 italic">Nenhum pagamento registrado para o dia {diaSelecionado.split("-").reverse().join("/")}.</td></tr>
                    ) : (
                      pagamentosDoDia.map((pag) => (
                        <tr key={pag.id} className={`hover:bg-blue-50/30 transition-colors ${pag.isNovo ? 'bg-emerald-50/30' : ''}`}>
                          <td className="p-1.5 border-r border-slate-200 text-center">
                            <button onClick={() => removerLinha(pag.id, pag.isNovo)} className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white font-bold flex items-center justify-center transition-colors shadow-xs">
                              ✕
                            </button>
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input 
                              type="date" 
                              value={pag.data_vencimento} 
                              onChange={(e) => atualizarCelula(pag.id, "data_vencimento", e.target.value)}
                              className="w-full p-2 text-xs outline-none bg-transparent font-medium text-slate-700 focus:bg-white focus:ring-1 ring-blue-500 rounded border border-transparent hover:border-slate-300"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input 
                              type="text" 
                              placeholder="Ex: Aluguel..."
                              value={pag.descricao} 
                              onChange={(e) => atualizarCelula(pag.id, "descricao", e.target.value)}
                              className="w-full p-2 text-xs outline-none bg-transparent font-bold text-slate-800 focus:bg-white focus:ring-1 ring-blue-500 rounded border border-transparent hover:border-slate-300 uppercase"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input 
                              type="text" 
                              placeholder="Ex: Fixos"
                              value={pag.categoria} 
                              onChange={(e) => atualizarCelula(pag.id, "categoria", e.target.value)}
                              className="w-full p-2 text-xs outline-none bg-transparent font-medium text-slate-600 focus:bg-white focus:ring-1 ring-blue-500 rounded border border-transparent hover:border-slate-300"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 bg-slate-50/30">
                            <input 
                              type="number" 
                              step="0.01"
                              value={pag.valor || ""} 
                              onChange={(e) => atualizarCelula(pag.id, "valor", parseFloat(e.target.value) || 0)}
                              className="w-full p-2 text-sm outline-none bg-transparent font-mono font-bold text-right text-slate-900 focus:bg-white focus:ring-1 ring-blue-500 rounded border border-transparent hover:border-slate-300"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-center">
                            <select 
                              value={pag.status} 
                              onChange={(e) => atualizarCelula(pag.id, "status", e.target.value)}
                              className={`w-full p-2 text-xs outline-none font-bold rounded border border-transparent hover:border-slate-300 cursor-pointer appearance-none text-center shadow-xs ${
                                pag.status === "Pago" ? "bg-emerald-100 text-emerald-800" :
                                pag.status === "Atrasado" ? "bg-rose-100 text-rose-800" :
                                "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <option value="A Vencer">⏳ A Vencer</option>
                              <option value="Pago">✅ Pago</option>
                              <option value="Atrasado">🚨 Atrasado</option>
                            </select>
                          </td>
                          {/* Renderiza Células Dinâmicas */}
                          {colunasDinamicas.map(col => (
                            <td key={col} className="p-1.5 border-r border-slate-200 bg-purple-50/20">
                              <input 
                                type="text" 
                                value={pag.dados_customizados[col] || ""} 
                                onChange={(e) => atualizarCelulaCustomizada(pag.id, col, e.target.value)}
                                className="w-full p-2 text-xs outline-none bg-transparent font-medium text-slate-600 focus:bg-white focus:ring-1 ring-purple-500 rounded border border-transparent hover:border-purple-300"
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STYLES PARA SCROLLBAR FINA */}
      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}