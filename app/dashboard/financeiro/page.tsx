/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Pagamento {
  id: string;
  isNovo?: boolean;
  isRecorrente?: boolean;
  dias_replicacao?: string; // 👈 NOVO CAMPO: Para replicar no mesmo mês
  empresa: string;
  mes_ano: string;
  data_vencimento: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: "PREVISTO" | "PROGRAMADO" | "PAGO";
  dados_customizados: Record<string, string>;
}

const EMPRESAS = [
  { id: "TODAS", nome: "Visão Consolidada", cnpj: "SEC + FIDC" },
  { id: "SEC", nome: "Ned Capital Securitizadora", cnpj: "45.490.426/0001-09" },
  { id: "FIDC", nome: "Ned Fidc (Consultoria)", cnpj: "34.768.252/0001-87" }
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CATEGORIAS_PADRAO = ["Aluguel", "Impostos", "Salários", "Software", "Serviços", "Marketing", "Administrativo"];

// ============================================================================
// 🧹 MOTOR DE NORMALIZAÇÃO DE TEXTO (CORRETOR) - Usado apenas ao SALVAR
// ============================================================================
const normalizarTexto = (texto: string) => {
  if (!texto) return "";
  // Tira espaços duplos e garante Capitalização Padrão (Primeira Maiúscula)
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

const adicionarMeses = (dataString: string, meses: number) => {
  const [a, m, d] = dataString.split("-").map(Number);
  const dt = new Date(a, m - 1 + meses, d, 12, 0, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export default function FinanceiroCalendarioPage() {
  const [empresaAtiva, setEmpresaAtiva] = useState("TODAS");
  const [mesAtivo, setMesAtivo] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [colunasDinamicas, setColunasDinamicas] = useState<string[]>([]);
  const [categoriasLocais, setCategoriasLocais] = useState<string[]>(CATEGORIAS_PADRAO);
  
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [normalizando, setNormalizando] = useState(false);

  // 🗓️ CONTROLE DO MODAL DE DIA ESPECÍFICO
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  // ==========================================================================
  // 📥 CARREGAMENTO DE DADOS
  // ==========================================================================
  const carregarPlanilha = async () => {
    setCarregando(true);
    try {
      let qCols = supabase.from("financeiro_colunas").select("nome_coluna");
      if (empresaAtiva !== "TODAS") qCols = qCols.eq("empresa", empresaAtiva);
      const { data: cols } = await qCols;
      if (cols) {
        const colunasUnicas = Array.from(new Set(cols.map(c => c.nome_coluna)));
        setColunasDinamicas(colunasUnicas);
      }

      let qPags = supabase.from("financeiro_pagamentos").select("*").eq("mes_ano", mesAtivo).order("data_vencimento", { ascending: true });
      if (empresaAtiva !== "TODAS") {
        qPags = qPags.eq("empresa", empresaAtiva);
      } else {
        qPags = qPags.in("empresa", ["SEC", "FIDC"]);
      }
      
      const { data: pags } = await qPags;

      if (pags) {
        const catsDoBanco = pags.map(p => normalizarTexto(p.categoria)).filter(Boolean);
        const todasCats = Array.from(new Set([...categoriasLocais, ...catsDoBanco]));
        setCategoriasLocais(todasCats);

        setPagamentos(pags.map(p => ({
          ...p,
          status: p.status === "A Vencer" || p.status === "Atrasado" ? "PREVISTO" : p.status, 
          dados_customizados: p.dados_customizados || {},
          dias_replicacao: "" // Inicializa limpo
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
      if (p.status === "PAGO") totalPago += v;
      else totalAberto += v;
    });

    return { totalMes, totalPago, totalAberto };
  }, [pagamentos]);

  const fM = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // ==========================================================================
  // 🗓️ GERADOR DO CALENDÁRIO E NOTIFICAÇÕES
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

  const hojeStr = new Date().toISOString().split("T")[0];
  const dataMais2 = new Date();
  dataMais2.setDate(dataMais2.getDate() + 2);
  const dataMais2Str = dataMais2.toISOString().split("T")[0];

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
      isRecorrente: false,
      dias_replicacao: "", // 👈 Inicializa o campo
      empresa: empresaAtiva === "TODAS" ? "SEC" : empresaAtiva, 
      mes_ano: mesAtivo,
      data_vencimento: diaSelecionado,
      descricao: "",
      categoria: categoriasLocais[0] || "",
      valor: 0,
      status: "PREVISTO",
      dados_customizados: {}
    };
    setPagamentos([...pagamentos, novaLinha]);
  };

  const atualizarCelula = (id: string, campo: keyof Pagamento, valor: any) => {
    setPagamentos(prev => prev.map(p => {
      if (p.id === id) {
        const pModificado = { ...p, [campo]: valor };
        if (campo === "data_vencimento") pModificado.mes_ano = String(valor).substring(0, 7);
        return pModificado as Pagamento;
      }
      return p;
    }));
  };

  const atualizarCelulaCustomizada = (id: string, coluna: string, valor: string) => {
    setPagamentos(prev => prev.map(p => {
      if (p.id === id) return { ...p, dados_customizados: { ...p.dados_customizados, [coluna]: valor } };
      return p;
    }));
  };

  const lidarMudancaCategoria = (id: string, valor: string) => {
    if (valor === "NOVA_CATEGORIA") {
      const nova = prompt("Digite o nome da nova categoria:");
      if (nova && nova.trim() !== "") {
        const novaLimpa = normalizarTexto(nova);
        if (!categoriasLocais.includes(novaLimpa)) setCategoriasLocais([...categoriasLocais, novaLimpa]);
        atualizarCelula(id, "categoria", novaLimpa);
      }
    } else {
      atualizarCelula(id, "categoria", valor);
    }
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
    if (colunasDinamicas.includes(nomeLimpo)) return alert("Esta coluna já existe!");

    setColunasDinamicas([...colunasDinamicas, nomeLimpo]);
    await supabase.from("financeiro_colunas").insert({ empresa: empresaAtiva === "TODAS" ? "SEC" : empresaAtiva, nome_coluna: nomeLimpo });
  };

  const limparSujeiraDoBanco = async () => {
    setNormalizando(true);
    try {
      const payloadLimpo = pagamentos.map(p => {
        const customLimpo: Record<string, string> = {};
        if (p.dados_customizados) {
          Object.keys(p.dados_customizados).forEach(key => {
            customLimpo[key] = normalizarTexto(p.dados_customizados[key]);
          });
        }

        return {
          ...p,
          descricao: normalizarTexto(p.descricao),
          categoria: normalizarTexto(p.categoria),
          dados_customizados: customLimpo
        };
      });

      setPagamentos(payloadLimpo);

      // 👈 SEGURANÇA: Remover dias_replicacao antes de ir pro banco no upsert
      const arrayUpdate = payloadLimpo.filter(p => !p.isNovo).map(({ isNovo, isRecorrente, dias_replicacao, ...rest }) => rest);
      
      if (arrayUpdate.length > 0) {
        await supabase.from("financeiro_pagamentos").upsert(arrayUpdate, { onConflict: "id" });
      }

      alert("✨ Pincel mágico passado! Todos os textos deste mês foram padronizados.");
    } catch (e: any) {
      alert(`Erro ao normalizar: ${e.message}`);
    } finally {
      setNormalizando(false);
    }
  };

  const salvarPlanilha = async () => {
    setSalvando(true);
    try {
      const payload = [];

      for (const p of pagamentosDoDia) {
        // 👈 Tira os campos temporários para não quebrar o insert do Supabase
        const { isNovo, isRecorrente, dias_replicacao, ...rest } = p;
        
        rest.descricao = normalizarTexto(rest.descricao);
        rest.categoria = normalizarTexto(rest.categoria);
        
        if (rest.dados_customizados) {
          Object.keys(rest.dados_customizados).forEach(key => {
            rest.dados_customizados[key] = normalizarTexto(rest.dados_customizados[key]);
          });
        }

        // 1. Salva a linha do dia atual
        payload.push(rest);

        // ==========================================
        // 🔄 NOVA LÓGICA: REPLICAR PARA DIAS DO MÊS
        // ==========================================
        if (dias_replicacao && dias_replicacao.trim() !== "") {
          const dias = dias_replicacao
            .split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= 1 && d <= 31);
          
          const diasUnicos = Array.from(new Set(dias));

          for (const diaNum of diasUnicos) {
            const novaData = `${rest.mes_ano}-${String(diaNum).padStart(2, '0')}`;
            
            // Só cria se for diferente do dia base
            if (novaData !== rest.data_vencimento) { 
              payload.push({
                ...rest,
                id: crypto.randomUUID(),
                data_vencimento: novaData,
                status: "PREVISTO" // Clones nascem previstos
              });
            }
          }
        }

        // ==========================================
        // 🔄 LÓGICA ANTIGA: REPLICAR MESES (RECORRENTE)
        // ==========================================
        if (isRecorrente) {
          for (let m = 1; m <= 11; m++) {
            const novaData = adicionarMeses(rest.data_vencimento, m);
            payload.push({
              ...rest,
              id: crypto.randomUUID(),
              data_vencimento: novaData,
              mes_ano: novaData.substring(0, 7),
              status: "PREVISTO" 
            });
          }
        }
      }

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-3 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">💰 Calendário Financeiro</h2>
          <span className="text-xs text-slate-500 font-medium">Controle interativo de Fluxo de Caixa e Contas a Pagar.</span>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner overflow-hidden">
          {EMPRESAS.map(emp => (
            <button
              key={emp.id}
              onClick={() => setEmpresaAtiva(emp.id)}
              className={`px-5 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex flex-col items-center gap-0.5 ${
                empresaAtiva === emp.id 
                  ? emp.id === "TODAS" ? "bg-slate-900 text-white shadow-md" : "bg-blue-600 text-white shadow-md" 
                  : "text-slate-500 hover:bg-slate-200/60"
              }`}
            >
              <span>{emp.nome}</span>
              <span className={`text-[9px] font-mono opacity-80 ${empresaAtiva === emp.id ? "text-slate-200" : "text-slate-400"}`}>
                {emp.cnpj}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 📅 CONTROLES DE MÊS E KPI'S */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md w-full md:w-64 shrink-0 flex flex-col justify-center gap-3 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-slate-800 opacity-20 text-7xl font-black select-none">🗓️</div>
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider relative z-10">Mês de Referência</span>
          <input 
            type="month" 
            value={mesAtivo}
            onChange={(e) => setMesAtivo(e.target.value)}
            className="w-full p-3 bg-slate-800/80 border border-slate-700 rounded-lg font-bold outline-none text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors relative z-10 shadow-inner"
          />
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-center transition-all hover:shadow-md">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Projetado (Mês)</span>
            <span className="text-3xl font-black text-slate-800 font-mono mt-1 truncate" title={fM(kpis.totalMes)}>{fM(kpis.totalMes)}</span>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl shadow-xs flex flex-col justify-center transition-all hover:shadow-md">
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Total Baixado (Pago)</span>
            <span className="text-3xl font-black text-emerald-700 font-mono mt-1 truncate" title={fM(kpis.totalPago)}>{fM(kpis.totalPago)}</span>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-2xl shadow-xs flex flex-col justify-center transition-all hover:shadow-md">
            <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Em Aberto (Prev. / Prog.)</span>
            <span className="text-3xl font-black text-amber-700 font-mono mt-1 truncate" title={fM(kpis.totalAberto)}>{fM(kpis.totalAberto)}</span>
          </div>
        </div>
      </div>

      {/* 🗓️ CALENDÁRIO VISUAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Cronograma de Contas</span>
          <button 
            onClick={limparSujeiraDoBanco} 
            disabled={carregando || normalizando || pagamentos.length === 0}
            className="text-[10px] uppercase font-black tracking-wider flex items-center gap-1.5 px-4 py-2 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors disabled:opacity-50 shadow-sm"
            title="Padroniza todas as descrições (Primeira Letra Maiúscula) e remove espaços duplos do banco."
          >
            {normalizando ? "⏳ Padronizando..." : "🧹 Normalizar Textos do Mês"}
          </button>
        </div>

        {carregando ? (
          <div className="h-64 flex items-center justify-center text-slate-400 font-bold animate-pulse text-xs uppercase tracking-wider">Sincronizando calendário...</div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-center font-black text-slate-400 text-[10px] uppercase tracking-widest py-1 bg-slate-50 rounded-md">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {diasBrancos.map((_, i) => <div key={`b-${i}`} className="h-[150px] bg-slate-50/30 rounded-xl border border-dashed border-slate-200/50"></div>)}

              {diasMes.map(dia => {
                const dataString = `${mesAtivo}-${String(dia).padStart(2, "0")}`;
                const pagsNoDia = pagamentos.filter(p => p.data_vencimento === dataString);
                
                const valorDia = pagsNoDia.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
                const isHoje = dataString === hojeStr;
                
                const hasAtraso = pagsNoDia.some(p => p.status !== "PAGO" && p.data_vencimento < hojeStr);
                const hasAlerta = pagsNoDia.some(p => p.status !== "PAGO" && p.data_vencimento >= hojeStr && p.data_vencimento <= dataMais2Str);

                const MAX_ITEMS = 3;
                const visiblePags = pagsNoDia.slice(0, MAX_ITEMS);
                const hiddenCount = pagsNoDia.length - MAX_ITEMS;

                return (
                  <div 
                    key={dia} 
                    onClick={() => setDiaSelecionado(dataString)}
                    className={`h-[150px] relative border rounded-xl p-3 flex flex-col gap-2.5 cursor-pointer transition-all ${
                      isHoje 
                        ? "border-blue-300 ring-2 ring-blue-100 bg-blue-50/20 shadow-sm" 
                        : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    {hasAtraso && <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-bounce z-10" title="Existem contas em atraso neste dia!"></div>}
                    {!hasAtraso && hasAlerta && <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white shadow-sm animate-bounce z-10" title="Vencimentos previstos para hoje/amanhã!"></div>}

                    <div className="flex justify-between items-start shrink-0">
                      <span className={`text-xs font-black ${isHoje ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md" : "text-slate-500"}`}>
                        {dia}
                      </span>
                      {valorDia > 0 && (
                        <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 shadow-xs">
                          {fM(valorDia)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
                      {visiblePags.map(p => (
                        <div key={p.id} className={`text-[9px] font-black uppercase tracking-wide px-2 py-1.5 rounded truncate border flex items-center gap-1.5 shadow-xs transition-colors ${
                          p.status === "PAGO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          p.status === "PROGRAMADO" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`} title={`${p.descricao} - ${fM(p.valor)}`}>
                          <span className="text-[10px] leading-none shrink-0">{p.status === "PAGO" ? "✅" : p.status === "PROGRAMADO" ? "🗓️" : "⏳"}</span>
                          <span className="truncate">{p.descricao || "Nova Conta"}</span>
                        </div>
                      ))}
                      
                      {hiddenCount > 0 && (
                        <div className="text-[9px] font-black text-slate-400 text-center mt-auto bg-slate-50 border border-slate-100 py-1 rounded hover:bg-slate-100 transition-colors uppercase tracking-wider">
                          + {hiddenCount} {hiddenCount === 1 ? "conta" : "contas"}
                        </div>
                      )}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-7xl max-h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black uppercase tracking-wider flex items-center gap-2">
                  <span className="text-2xl">🗓️</span> 
                  Detalhes do Dia: <span className="text-blue-400">{diaSelecionado.split("-").reverse().join("/")}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium tracking-wide">Gerencie as contas e obrigações vinculadas a esta data.</p>
              </div>
              <button onClick={() => setDiaSelecionado(null)} className="text-xl font-black text-slate-400 hover:text-white transition-colors px-2">✕</button>
            </div>

            <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
              <div className="flex gap-3">
                <button onClick={adicionarLinhaNoDia} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm">
                  ➕ Nova Conta a Pagar
                </button>
                <button onClick={adicionarColunaCustomizada} className="px-4 py-2 bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm">
                  ➕ Customizar Coluna
                </button>
              </div>
              <button 
                onClick={salvarPlanilha} 
                disabled={salvando}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-lg text-[10px] shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {salvando ? "⏳ Salvando..." : "💾 Salvar Alterações"}
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100/50 p-5 custom-scrollbar">
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider select-none border-b border-slate-200">
                      <th className="p-3 border-r border-slate-200 w-36 text-center">Status</th>
                      <th className="p-3 border-r border-slate-200 w-36">Vencimento</th>
                      {empresaAtiva === "TODAS" && <th className="p-3 border-r border-slate-200 w-32 bg-amber-50">Empresa</th>}
                      <th className="p-3 border-r border-slate-200 min-w-[200px]">Beneficiário / Descrição</th>
                      <th className="p-3 border-r border-slate-200 w-44">Categoria</th>
                      <th className="p-3 border-r border-slate-200 w-40 text-right">Valor (R$)</th>
                      {colunasDinamicas.map(col => <th key={col} className="p-3 border-r border-slate-200 w-40 bg-purple-50 text-purple-700 truncate" title={col}>{col}</th>)}
                      
                      {/* 👈 NOVA COLUNA: REPLICAR DIAS */}
                      <th className="p-3 border-r border-slate-200 w-36 text-center bg-indigo-50 text-indigo-700" title="Dias extras neste mês (ex: 12, 15, 20)">Replicar (Dias)</th>
                      
                      <th className="p-3 border-r border-slate-200 w-28 text-center bg-blue-50 text-blue-700" title="Repetir nos próximos 11 meses">Recorrente?</th>
                      <th className="p-3 border-slate-200 w-20 text-center text-rose-500">Excluir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pagamentosDoDia.length === 0 ? (
                      <tr><td colSpan={11 + colunasDinamicas.length} className="p-12 text-center text-slate-400 font-bold italic">Nenhum pagamento registrado para o dia {diaSelecionado.split("-").reverse().join("/")}.</td></tr>
                    ) : (
                      pagamentosDoDia.map((pag) => (
                        <tr key={pag.id} className={`hover:bg-slate-50/50 transition-colors ${pag.isNovo ? 'bg-emerald-50/20' : ''}`}>
                          <td className="p-2 border-r border-slate-100 text-center">
                            <select 
                              value={pag.status} 
                              onChange={(e) => atualizarCelula(pag.id, "status", e.target.value)}
                              className={`w-full p-2 text-[11px] uppercase tracking-wider outline-none font-black rounded-md border border-transparent hover:border-slate-200 cursor-pointer appearance-none text-center shadow-xs transition-colors ${
                                pag.status === "PAGO" ? "bg-emerald-100 text-emerald-800" :
                                pag.status === "PROGRAMADO" ? "bg-blue-100 text-blue-800" :
                                "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <option value="PREVISTO">⏳ PREVISTO</option>
                              <option value="PROGRAMADO">🗓️ PROGRAMADO</option>
                              <option value="PAGO">✅ PAGO</option>
                            </select>
                          </td>
                          <td className="p-2 border-r border-slate-100">
                            <input 
                              type="date" 
                              value={pag.data_vencimento} 
                              onChange={(e) => atualizarCelula(pag.id, "data_vencimento", e.target.value)}
                              className="w-full p-2 text-[11px] uppercase outline-none bg-slate-50 font-bold text-slate-700 focus:bg-white focus:ring-2 ring-blue-100 rounded-md border border-transparent hover:border-slate-200 transition-all"
                            />
                          </td>
                          {empresaAtiva === "TODAS" && (
                            <td className="p-2 border-r border-slate-100 bg-amber-50/30">
                              <select 
                                value={pag.empresa} 
                                onChange={(e) => atualizarCelula(pag.id, "empresa", e.target.value)}
                                className="w-full p-2 text-[11px] outline-none bg-transparent font-black text-amber-900 cursor-pointer rounded-md hover:bg-amber-100/50 transition-colors"
                              >
                                <option value="SEC">SEC</option>
                                <option value="FIDC">FIDC</option>
                              </select>
                            </td>
                          )}
                          <td className="p-2 border-r border-slate-100">
                            <input 
                              type="text" 
                              placeholder="Ex: Aluguel da Sede..."
                              value={pag.descricao} 
                              onChange={(e) => atualizarCelula(pag.id, "descricao", e.target.value)}
                              className="w-full p-2 text-xs outline-none bg-slate-50 font-bold text-slate-800 focus:bg-white focus:ring-2 ring-blue-100 rounded-md border border-transparent hover:border-slate-200 transition-all"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100">
                            <select 
                              value={pag.categoria} 
                              onChange={(e) => lidarMudancaCategoria(pag.id, e.target.value)}
                              className="w-full p-2 text-[11px] uppercase outline-none bg-slate-50 font-bold text-slate-600 focus:bg-white focus:ring-2 ring-blue-100 rounded-md border border-transparent hover:border-slate-200 cursor-pointer transition-all"
                            >
                              <option value="" disabled>Selecione...</option>
                              {categoriasLocais.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              <option value="NOVA_CATEGORIA" className="font-black text-blue-600 bg-blue-50">➕ Nova Categoria...</option>
                            </select>
                          </td>
                          <td className="p-2 border-r border-slate-100 bg-slate-50/30">
                            <input 
                              type="number" 
                              step="0.01"
                              value={pag.valor || ""} 
                              onChange={(e) => atualizarCelula(pag.id, "valor", parseFloat(e.target.value) || 0)}
                              className="w-full p-2 text-xs outline-none bg-slate-50 font-mono font-black text-right text-slate-900 focus:bg-white focus:ring-2 ring-blue-100 rounded-md border border-transparent hover:border-slate-200 transition-all"
                            />
                          </td>
                          {colunasDinamicas.map(col => (
                            <td key={col} className="p-2 border-r border-slate-100 bg-purple-50/20">
                              <input 
                                type="text" 
                                value={pag.dados_customizados[col] || ""} 
                                onChange={(e) => atualizarCelulaCustomizada(pag.id, col, e.target.value)}
                                className="w-full p-2 text-[11px] font-mono outline-none bg-transparent text-slate-700 focus:bg-white focus:ring-2 ring-purple-100 rounded-md border border-transparent hover:border-purple-200 transition-all"
                              />
                            </td>
                          ))}
                          
                          {/* 👈 NOVO INPUT: REPLICAR DIAS */}
                          <td className="p-2 border-r border-slate-100 bg-indigo-50/20 text-center">
                            <input 
                              type="text" 
                              placeholder="Ex: 10, 15"
                              value={pag.dias_replicacao || ""} 
                              onChange={(e) => atualizarCelula(pag.id, "dias_replicacao", e.target.value)}
                              className="w-full p-2 text-[11px] outline-none bg-transparent text-slate-700 focus:bg-white focus:ring-2 ring-indigo-100 rounded-md border border-transparent hover:border-indigo-200 transition-all text-center font-mono placeholder:text-slate-300"
                              title="Digite os dias deste mês separados por vírgula. Ex: 05, 12, 19"
                            />
                          </td>

                          <td className="p-2 border-r border-slate-100 text-center bg-blue-50/30">
                            <input 
                              type="checkbox" 
                              checked={pag.isRecorrente || false}
                              onChange={(e) => atualizarCelula(pag.id, "isRecorrente", e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded bg-white border-slate-300 cursor-pointer focus:ring-blue-500 shadow-sm"
                              title="Tornar despesa recorrente (12 meses)"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removerLinha(pag.id, pag.isNovo)} className="w-full py-2 rounded-md bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white font-black transition-colors text-[9px] uppercase tracking-wider border border-rose-100 shadow-sm">
                              Excluir
                            </button>
                          </td>
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

      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}