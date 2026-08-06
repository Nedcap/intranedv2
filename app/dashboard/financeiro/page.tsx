/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Pagamento {
  id: string;
  isNovo?: boolean;
  isRecorrente?: boolean;
  dias_replicacao?: string;
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
// 🧹 MOTOR DE NORMALIZAÇÃO DE TEXTO
// ============================================================================
const normalizarTexto = (texto: string) => {
  if (!texto) return "";
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

// 🔥 CORREÇÃO DE BUG: Matemática blindada para adição de meses (Evita pular fevereiro e transição de anos)
const adicionarMeses = (dataString: string, meses: number) => {
  const [a, m, d] = dataString.split("-").map(Number);
  const date = new Date(a, (m - 1) + meses, 1, 12, 0, 0);
  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(d, lastDayOfTargetMonth));
  
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function FinanceiroCalendarioPage() {
  const [empresaAtiva, setEmpresaAtiva] = useState("TODAS");
  const [mesAtivo, setMesAtivo] = useState(new Date().toISOString().slice(0, 7)); 
  
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [colunasDinamicas, setColunasDinamicas] = useState<string[]>([]);
  const [categoriasLocais, setCategoriasLocais] = useState<string[]>(CATEGORIAS_PADRAO);
  
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [normalizando, setNormalizando] = useState(false);

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
          dias_replicacao: "" 
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

  const hojeStr = new Date().toISOString().split("T")[0];
  const dataMais2 = new Date();
  dataMais2.setDate(dataMais2.getDate() + 2);
  const dataMais2Str = dataMais2.toISOString().split("T")[0];

  // ==========================================================================
  // ✏️ MANIPULAÇÃO DO GRID
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
      dias_replicacao: "", 
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
        // Atualiza a flag de Mês/Ano para não se perder na listagem geral do BD
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
    if (!confirm("Deletar esta conta definitivamente do banco de dados?")) return;
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
        const { isNovo, isRecorrente, dias_replicacao, ...rest } = p;
        
        rest.descricao = normalizarTexto(rest.descricao);
        rest.categoria = normalizarTexto(rest.categoria);
        
        if (rest.dados_customizados) {
          Object.keys(rest.dados_customizados).forEach(key => {
            rest.dados_customizados[key] = normalizarTexto(rest.dados_customizados[key]);
          });
        }

        payload.push(rest);

        // 🔄 REPLICAR PARA DIAS DO MÊS
        if (dias_replicacao && dias_replicacao.trim() !== "") {
          const dias = dias_replicacao
            .split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= 1 && d <= 31);
          
          const diasUnicos = Array.from(new Set(dias));

          for (const diaNum of diasUnicos) {
            const novaData = `${rest.mes_ano}-${String(diaNum).padStart(2, '0')}`;
            if (novaData !== rest.data_vencimento) { 
              payload.push({
                ...rest,
                id: crypto.randomUUID(),
                data_vencimento: novaData,
                status: "PREVISTO" 
              });
            }
          }
        }

        // 🔄 REPLICAR MESES (RECORRENTE)
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
      
      alert(`✅ Sucesso! Lançamentos atualizados. (Lançamentos alterados para o futuro foram gravados no banco).`);
      carregarPlanilha(); 
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // ==========================================================================
  // 💅 CLASSES DE ESTILIZAÇÃO PADRÃO
  // ==========================================================================
  const cellStyle = "w-full p-2.5 text-xs outline-none bg-slate-50 font-medium text-slate-700 focus:bg-white focus:ring-2 ring-indigo-500/20 rounded-lg border border-slate-200 transition-all shadow-inner placeholder:text-slate-400";
  const numStyle = "w-full p-2.5 text-xs outline-none bg-slate-50 font-mono font-black text-right text-slate-900 focus:bg-white focus:ring-2 ring-indigo-500/20 rounded-lg border border-slate-200 transition-all shadow-inner";
  const thStyle = "p-4 border-r border-slate-200 uppercase tracking-widest text-[10px] font-black bg-slate-100/80 text-slate-600";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* 🚀 HEADER & TOGGLE DE EMPRESA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase shadow-sm">
                Controladoria
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
              💰 Calendário <span className="text-indigo-600 font-bold">Financeiro</span>
            </h1>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {EMPRESAS.map(emp => (
              <button
                key={emp.id}
                onClick={() => setEmpresaAtiva(emp.id)}
                className={`px-6 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex flex-col items-center gap-0.5 ${
                  empresaAtiva === emp.id 
                    ? emp.id === "TODAS" ? "bg-slate-800 text-white shadow-md scale-105" : "bg-indigo-600 text-white shadow-md scale-105" 
                    : "text-slate-500 hover:bg-slate-100"
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
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="bg-gradient-to-br from-indigo-800 to-indigo-950 text-white p-6 rounded-2xl shadow-lg w-full xl:w-72 shrink-0 flex flex-col justify-center gap-3 relative overflow-hidden border border-indigo-700">
            <div className="absolute -right-4 -top-4 text-white opacity-10 text-8xl font-black select-none pointer-events-none">🗓️</div>
            <span className="text-[11px] font-black uppercase text-indigo-300 tracking-widest relative z-10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Mês de Referência
            </span>
            <input 
              type="month" 
              value={mesAtivo}
              onChange={(e) => setMesAtivo(e.target.value)}
              className="w-full p-4 bg-indigo-900/50 border border-indigo-400/30 rounded-xl font-bold outline-none text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50 transition-all relative z-10 shadow-inner cursor-pointer"
            />
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col justify-center transition-all hover:shadow-md hover:border-slate-300 group">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><span className="text-base">📊</span> Total Projetado (Mês)</span>
              <span className="text-3xl font-black text-slate-800 font-mono mt-2 truncate group-hover:text-indigo-600 transition-colors" title={fM(kpis.totalMes)}>{fM(kpis.totalMes)}</span>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl shadow-sm flex flex-col justify-center transition-all hover:shadow-md hover:border-emerald-200 group">
              <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1.5"><span className="text-base">✅</span> Total Baixado (Pago)</span>
              <span className="text-3xl font-black text-emerald-700 font-mono mt-2 truncate group-hover:text-emerald-800 transition-colors" title={fM(kpis.totalPago)}>{fM(kpis.totalPago)}</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-2xl shadow-sm flex flex-col justify-center transition-all hover:shadow-md hover:border-amber-200 group">
              <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5"><span className="text-base">⏳</span> Em Aberto (Prev. / Prog.)</span>
              <span className="text-3xl font-black text-amber-700 font-mono mt-2 truncate group-hover:text-amber-800 transition-colors" title={fM(kpis.totalAberto)}>{fM(kpis.totalAberto)}</span>
            </div>
          </div>
        </div>

        {/* 🗓️ CALENDÁRIO VISUAL */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <span className="text-[13px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> Cronograma Diário de Contas
            </span>
            <button 
              onClick={limparSujeiraDoBanco} 
              disabled={carregando || normalizando || pagamentos.length === 0}
              className="text-[10px] uppercase font-black tracking-wider flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              title="Padroniza todas as descrições e remove espaços duplos do banco."
            >
              {normalizando ? "⏳ Padronizando..." : "🧹 Normalizar Textos"}
            </button>
          </div>

          {carregando ? (
            <div className="h-64 flex flex-col items-center justify-center text-indigo-500 font-bold animate-pulse text-xs uppercase tracking-wider gap-3">
               <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
               Sincronizando calendário...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-3">
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center font-black text-slate-400 text-[10px] uppercase tracking-widest py-2 bg-slate-50 rounded-lg border border-slate-100">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3">
                {diasBrancos.map((_, i) => <div key={`b-${i}`} className="h-[150px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200/50"></div>)}

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
                      className={`h-[150px] relative rounded-xl p-3 flex flex-col gap-2.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                        isHoje 
                          ? "border-2 border-indigo-400 bg-indigo-50/30 shadow-md ring-4 ring-indigo-500/10" 
                          : "border border-slate-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      {hasAtraso && <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-bounce z-10" title="Contas em atraso!"></div>}
                      {!hasAtraso && hasAlerta && <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white shadow-sm animate-bounce z-10" title="Vencimentos iminentes!"></div>}

                      <div className="flex justify-between items-start shrink-0">
                        <span className={`text-xs font-black ${isHoje ? "bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md" : "text-slate-500"}`}>
                          {dia}
                        </span>
                        {valorDia > 0 && (
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 shadow-sm">
                            {fM(valorDia)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 flex-1 overflow-hidden mt-1">
                        {visiblePags.map(p => (
                          <div key={p.id} className={`text-[9px] font-black uppercase tracking-wide px-2 py-1.5 rounded truncate border flex items-center gap-1.5 shadow-sm transition-colors ${
                            p.status === "PAGO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            p.status === "PROGRAMADO" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`} title={`${p.descricao} - ${fM(p.valor)}`}>
                            <span className="text-[10px] leading-none shrink-0">{p.status === "PAGO" ? "✅" : p.status === "PROGRAMADO" ? "🗓️" : "⏳"}</span>
                            <span className="truncate">{p.descricao || "Nova Conta"}</span>
                          </div>
                        ))}
                        
                        {hiddenCount > 0 && (
                          <div className="text-[9px] font-black text-slate-400 text-center mt-auto bg-slate-50 border border-slate-200 py-1 rounded hover:bg-slate-100 transition-colors uppercase tracking-wider shadow-sm">
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

        {/* 🔍 MODAL DO DIA ESPECÍFICO (TABELA EXCEL-LIKE) */}
        {diaSelecionado && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in duration-200">
            <div className="bg-white w-full max-w-7xl max-h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
              
              <div className="bg-indigo-950 text-white p-5 flex justify-between items-center shrink-0 border-b border-indigo-900">
                <div>
                  <h3 className="font-black uppercase tracking-wider flex items-center gap-3">
                    <span className="text-2xl">🗓️</span> 
                    Detalhes do Dia: <span className="text-indigo-400">{diaSelecionado.split("-").reverse().join("/")}</span>
                  </h3>
                  <p className="text-[11px] text-indigo-200/80 mt-1 font-medium tracking-wide">Gerencie os pagamentos, defina recorrências e edite valores como em uma planilha.</p>
                </div>
                <button onClick={() => setDiaSelecionado(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-rose-500 hover:text-white transition-colors text-lg font-black cursor-pointer">✕</button>
              </div>

              <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
                <div className="flex gap-3">
                  <button onClick={adicionarLinhaNoDia} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer">
                    ➕ Nova Conta a Pagar
                  </button>
                  <button onClick={adicionarColunaCustomizada} className="px-4 py-2 bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer">
                    🛠️ Adicionar Coluna
                  </button>
                </div>
                <button 
                  onClick={salvarPlanilha} 
                  disabled={salvando}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-lg text-[10px] shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {salvando ? "⏳ Salvando..." : "💾 Salvar Planilha"}
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100/50 p-6 custom-scrollbar relative">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr>
                        <th className={`${thStyle} w-40 text-center`}>Status</th>
                        <th className={`${thStyle} w-40`}>Vencimento</th>
                        {empresaAtiva === "TODAS" && <th className={`${thStyle} w-36 bg-slate-200 text-slate-700`}>Empresa</th>}
                        <th className={`${thStyle} min-w-[250px]`}>Beneficiário / Descrição</th>
                        <th className={`${thStyle} w-48`}>Categoria</th>
                        <th className={`${thStyle} w-44 text-right`}>Valor (R$)</th>
                        {colunasDinamicas.map(col => <th key={col} className={`${thStyle} w-44 bg-indigo-50 text-indigo-800 truncate`} title={col}>{col}</th>)}
                        
                        <th className={`${thStyle} w-40 text-center bg-blue-50 text-blue-800`} title="Replicar valores para outros dias no mesmo mês (Ex: 05, 10, 20)">Replicar (Dias)</th>
                        <th className={`${thStyle} w-32 text-center bg-emerald-50 text-emerald-800`} title="Clonar pagamento para os próximos 11 meses">Recorrente?</th>
                        <th className="p-4 uppercase tracking-widest text-[10px] font-black bg-slate-100/80 w-24 text-center text-rose-500">Excluir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {pagamentosDoDia.length === 0 ? (
                        <tr><td colSpan={12 + colunasDinamicas.length} className="p-16 text-center text-slate-400 font-bold italic text-sm">Nenhum lançamento financeiro registrado nesta data.</td></tr>
                      ) : (
                        pagamentosDoDia.map((pag) => (
                          <tr key={pag.id} className={`hover:bg-indigo-50/20 transition-colors ${pag.isNovo ? 'bg-emerald-50/10' : ''}`}>
                            <td className="p-2 border-r border-slate-100 text-center">
                              <select 
                                value={pag.status} 
                                onChange={(e) => atualizarCelula(pag.id, "status", e.target.value)}
                                className={`w-full p-2 text-[10px] uppercase tracking-widest outline-none font-black rounded-lg border border-transparent hover:border-slate-200 cursor-pointer appearance-none text-center shadow-xs transition-colors ${
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
                                className={cellStyle}
                                title="Aviso: Ao alterar a data, o item será movido para o respectivo dia ao salvar."
                              />
                            </td>
                            {empresaAtiva === "TODAS" && (
                              <td className="p-2 border-r border-slate-100 bg-slate-50/50">
                                <select 
                                  value={pag.empresa} 
                                  onChange={(e) => atualizarCelula(pag.id, "empresa", e.target.value)}
                                  className={`${cellStyle} font-black text-slate-800 cursor-pointer`}
                                >
                                  <option value="SEC">SEC</option>
                                  <option value="FIDC">FIDC</option>
                                </select>
                              </td>
                            )}
                            <td className="p-2 border-r border-slate-100">
                              <input 
                                type="text" 
                                placeholder="Ex: Fornecedor, Serviço..."
                                value={pag.descricao} 
                                onChange={(e) => atualizarCelula(pag.id, "descricao", e.target.value)}
                                className={`${cellStyle} font-bold text-slate-800`}
                              />
                            </td>
                            <td className="p-2 border-r border-slate-100">
                              <select 
                                value={pag.categoria} 
                                onChange={(e) => lidarMudancaCategoria(pag.id, e.target.value)}
                                className={`${cellStyle} font-bold text-slate-600 uppercase cursor-pointer`}
                              >
                                <option value="" disabled>Selecione...</option>
                                {categoriasLocais.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                <option value="NOVA_CATEGORIA" className="font-black text-indigo-600 bg-indigo-50">➕ CRIAR CATEGORIA...</option>
                              </select>
                            </td>
                            <td className="p-2 border-r border-slate-100 bg-slate-50/30">
                              <input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00"
                                value={pag.valor || ""} 
                                onChange={(e) => atualizarCelula(pag.id, "valor", parseFloat(e.target.value) || 0)}
                                className={numStyle}
                              />
                            </td>
                            {colunasDinamicas.map(col => (
                              <td key={col} className="p-2 border-r border-slate-100 bg-indigo-50/10">
                                <input 
                                  type="text" 
                                  value={pag.dados_customizados[col] || ""} 
                                  onChange={(e) => atualizarCelulaCustomizada(pag.id, col, e.target.value)}
                                  className={`${cellStyle} font-mono`}
                                />
                              </td>
                            ))}
                            
                            <td className="p-2 border-r border-slate-100 bg-blue-50/10 text-center">
                              <input 
                                type="text" 
                                placeholder="Dias: 05, 12, 19"
                                value={pag.dias_replicacao || ""} 
                                onChange={(e) => atualizarCelula(pag.id, "dias_replicacao", e.target.value)}
                                className={`${cellStyle} text-center font-mono`}
                                title="Clonar lançamento para outros dias neste mesmo mês (separados por vírgula)"
                              />
                            </td>

                            <td className="p-2 border-r border-slate-100 text-center bg-emerald-50/10">
                              <input 
                                type="checkbox" 
                                checked={pag.isRecorrente || false}
                                onChange={(e) => atualizarCelula(pag.id, "isRecorrente", e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded bg-white border-slate-300 cursor-pointer focus:ring-emerald-500 shadow-sm"
                                title="Tornar despesa recorrente (Próximos 11 meses)"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => removerLinha(pag.id, pag.isNovo)} className="w-10 h-10 flex items-center justify-center mx-auto rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white font-black transition-colors border border-rose-100 shadow-sm cursor-pointer" title="Remover Pagamento">
                                🗑️
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
          .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f1f5f9; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
      </div>
    </div>
  );
}