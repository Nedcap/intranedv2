/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 UTILS
// ============================================================================
function parseValorReal(valor: any): number {
  if (!valor) return 0;
  if (typeof valor === "number") return valor;
  const str = String(valor).replace(/[R$\s]/g, "").trim();
  if (str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(str) || 0;
}

function formatarMesAno(str: string) {
  if (!str) return "";
  const partes = str.split("/");
  if (partes.length === 2) {
    return `${partes[0].padStart(2, "0")}/${partes[1]}`;
  }
  return str;
}

function parseDataSegura(dataStr: string) {
  if (!dataStr) return null;
  const apenasData = dataStr.trim().split("T")[0];
  return new Date(`${apenasData}T12:00:00`);
}

function calcularDiasUteis(dInicio: Date, dFim: Date) {
  let count = 0;
  const atual = new Date(dInicio.getTime());
  atual.setHours(12, 0, 0, 0);
  const fim = new Date(dFim.getTime());
  fim.setHours(12, 0, 0, 0);
  if (fim < atual) return 0;
  while (atual < fim) {
    atual.setDate(atual.getDate() + 1);
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      count++;
    }
  }
  return count;
}

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

// ============================================================================
// 📊 COMPONENTE PRINCIPAL
// ============================================================================
export default function PowerBIPage() {
  const [analises, setAnalises] = useState<any[]>([]);
  const [dashCarteira, setDashCarteira] = useState<any[]>([]);
  const [dashVop, setDashVop] = useState<any[]>([]);
  const [dashReceitas, setDashReceitas] = useState<any[]>([]);
  
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const [listaMeses, setListaMeses] = useState<string[]>([]);
  const [listaCedentes, setListaCedentes] = useState<string[]>([]);
  const listaEmpresas = ["SEC", "FIDC"];

  const [empresasSel, setEmpresasSel] = useState<string[]>(["SEC", "FIDC"]);
  const [mesesSel, setMesesSel] = useState<string[]>([]);
  const [cedentesSel, setCedentesSel] = useState<string[]>([]);
  const [termoBuscaCedente, setTermoBuscaCedente] = useState("");

  const [openEmpresa, setOpenEmpresa] = useState(false);
  const [openMes, setOpenMes] = useState(false);
  const [openCedente, setOpenCedente] = useState(false);

  const refEmp = useRef<HTMLDivElement>(null);
  const refMes = useRef<HTMLDivElement>(null);
  const refCed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function clickFora(e: MouseEvent) {
      if (refEmp.current && !refEmp.current.contains(e.target as Node)) setOpenEmpresa(false);
      if (refMes.current && !refMes.current.contains(e.target as Node)) setOpenMes(false);
      if (refCed.current && !refCed.current.contains(e.target as Node)) setOpenCedente(false);
    }
    document.addEventListener("mousedown", clickFora);
    return () => document.removeEventListener("mousedown", clickFora);
  }, []);

  const carregarDashboardFiel = async () => {
    try {
      setCarregando(true);
      
      const userStr = localStorage.getItem("intraned_user");
      let allowedCedentes: string[] = [];
      let isComercial = false;
      let userNome = "";

      if (userStr) {
        const user = JSON.parse(userStr);
        userNome = user.nome;
        const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
        if (cargoUser === "comercial") {
          isComercial = true;
          const { data: vinculos } = await supabase.from("cadastro_cedentes").select("cedente").eq("comercial", user.nome);
          if (vinculos) allowedCedentes = vinculos.map((c: any) => c.cedente);
        }
      }

      // 1. Comitê de Crédito (analises)
      let queryAnalises = supabase.from("analises").select("*");
      if (isComercial) { queryAnalises = queryAnalises.eq("comercial", userNome); }
      const resAnalises = await queryAnalises;
      setAnalises(resAnalises.data || []);

      // Preparar consultas V2 com trava de comercial
      let qVop = supabase.from("dash_vop").select("*");
      let qCarteira = supabase.from("dash_carteira").select("*");
      let qExtrato = supabase.from("extrato_financeiro").select("*");

      if (isComercial) {
        if (allowedCedentes.length > 0) {
          qVop = qVop.in("cedente", allowedCedentes);
          qCarteira = qCarteira.in("cedente", allowedCedentes);
          qExtrato = qExtrato.in("cedente", allowedCedentes);
        } else {
          // Bloqueio total se comercial não tiver carteira vinculada
          qVop = qVop.in("cedente", ["__VAZIO__"]);
          qCarteira = qCarteira.in("cedente", ["__VAZIO__"]);
          qExtrato = qExtrato.in("cedente", ["__VAZIO__"]);
        }
      }

      // 2. Extração Simultânea e Super Rápida (Supabase V2)
      const [resVop, resCarteira, resExtrato] = await Promise.all([
        qVop, qCarteira, qExtrato
      ]);

      setDashVop(resVop.data || []);
      setDashCarteira(resCarteira.data || []);
      setDashReceitas(resExtrato.data || []);

      // 3. Configuração Dinâmica de Filtros
      const mesesUnicos = Array.from(new Set([
        ...(resVop.data || []).map(v => formatarMesAno(v.mes_ano)),
        ...(resExtrato.data || []).map(r => formatarMesAno(r.mes_ano))
      ].filter(str => str && /^(0[1-9]|1[0-2])\/\d{4}$/.test(str)))).sort((a, b) => {
        const [mA, yA] = a.split("/"); const [mB, yB] = b.split("/");
        return (parseInt(yB) * 100 + parseInt(mB)) - (parseInt(yA) * 100 + parseInt(mA));
      });
      
      setListaMeses(mesesUnicos);
      if (mesesSel.length === 0 && mesesUnicos.length > 0) {
        setMesesSel(mesesUnicos);
      }

      const cedentesUnicos = Array.from(new Set([
        ...(resVop.data || []).map(v => v.cedente),
        ...(resCarteira.data || []).map(c => c.cedente),
        ...(resExtrato.data || []).map(r => r.cedente)
      ].filter(Boolean))).sort();
      
      setListaCedentes(cedentesUnicos);
      if (cedentesSel.length === 0) setCedentesSel(cedentesUnicos);

    } catch (err) {
      console.error("Erro no processamento V2:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDashboardFiel(); }, []);

  const sincronizarSupabase = async () => {
    setSincronizando(true);
    await carregarDashboardFiel();
    setSincronizando(false);
  };

  // ==========================================================================
  // ⚡ CÁLCULOS MEMOIZADOS (Alta Performance)
  // ==========================================================================
  const kpis = useMemo(() => {
    let aprovadosMes = 0, recusadosMes = 0, somaDias = 0, qtdSla = 0;
    let vopMensalSec = 0, vopMensalFidc = 0;
    let vopVidaTodaSec = 0, vopVidaTodaFidc = 0;
    let riscoSec = 0, riscoFidc = 0, vencidosSec = 0, vencidosFidc = 0;
    let totalDesagio = 0, totalTarifas = 0, totalJurosMultas = 0;

    const filtroAtivo = (emp: string, m_a: string, ced: string) => {
      const bateEmpresa = empresasSel.includes((emp || "").toUpperCase());
      const bateMes = mesesSel.length === 0 || mesesSel.includes(formatarMesAno(m_a));
      const bateCedente = cedentesSel.length === 0 || cedentesSel.includes(ced);
      return bateEmpresa && bateMes && bateCedente;
    };

    // 1. SLA / Comitê
    analises.forEach(a => {
      const dRec = parseDataSegura(a.data_recebimento);
      if (dRec) {
        const m_a = `${String(dRec.getMonth() + 1).padStart(2, "0")}/${dRec.getFullYear()}`;
        const bateMes = mesesSel.length === 0 || mesesSel.includes(m_a);
        if (bateMes) {
          if ((a.status || "").toLowerCase() === "aprovado") aprovadosMes++;
          if (["reprovado", "recusado"].includes((a.status || "").toLowerCase())) recusadosMes++;
          const dFim = parseDataSegura(a.criado_em || a.atualizado_em);
          if (dFim) { somaDias += calcularDiasUteis(dRec, dFim); qtdSla++; }
        }
      }
    });

    // 2. VOP Mensal e Histórico Geral
    dashVop.forEach(v => {
      const isCedenteAtivo = cedentesSel.includes(v.cedente);
      if (isCedenteAtivo) {
        // Histórico (ignora o mês)
        vopVidaTodaSec += parseValorReal(v.vop_sec);
        vopVidaTodaFidc += parseValorReal(v.vop_fidc);

        // Mensal (Filtra mês e empresa)
        if (mesesSel.length === 0 || mesesSel.includes(formatarMesAno(v.mes_ano))) {
          if (empresasSel.includes("SEC")) vopMensalSec += parseValorReal(v.vop_sec);
          if (empresasSel.includes("FIDC")) vopMensalFidc += parseValorReal(v.vop_fidc);
        }
      }
    });

    // 3. Carteira Atual
    dashCarteira.forEach(c => {
      if (cedentesSel.includes(c.cedente)) {
        if (empresasSel.includes("SEC")) { 
          riscoSec += parseValorReal(c.risco_sec); 
          vencidosSec += parseValorReal(c.vencido_sec); 
        }
        if (empresasSel.includes("FIDC")) { 
          riscoFidc += parseValorReal(c.risco_fidc); 
          vencidosFidc += parseValorReal(c.vencido_fidc); 
        }
      }
    });

    // 4. Receitas
    dashReceitas.forEach(r => {
      if (filtroAtivo(r.empresa, r.mes_ano, r.cedente)) {
        totalDesagio += parseValorReal(r.desagio);
        totalTarifas += parseValorReal(r.tarifas);
        totalJurosMultas += parseValorReal(r.juros); 
      }
    });

    const prazoMedioDias = qtdSla > 0 ? (somaDias / qtdSla).toFixed(1) : "0.0";
    const vopVidaTodaConsolidadoGeral = vopVidaTodaSec + vopVidaTodaFidc;
    const receitaTotalAcumulada = totalDesagio + totalTarifas + totalJurosMultas;

    return {
      aprovadosMes, recusadosMes, prazoMedioDias,
      vopMensalSec, vopMensalFidc, vopVidaTodaSec, vopVidaTodaFidc, vopVidaTodaConsolidadoGeral,
      riscoSec, riscoFidc, vencidosSec, vencidosFidc,
      totalDesagio, totalTarifas, totalJurosMultas, receitaTotalAcumulada
    };
  }, [analises, dashVop, dashCarteira, dashReceitas, empresasSel, mesesSel, cedentesSel]);

  const labelMesFiltro = mesesSel.length === 0 ? "Geral" : mesesSel.length === listaMeses.length ? "Todos" : mesesSel.length === 1 ? mesesSel[0] : "Múltiplos";

  // Filtro inteligente do Dropdown (Fora do Memo principal para não rodar cálculos matemáticos à toa)
  const cedentesFiltradosPelaBusca = useMemo(() => {
    return listaCedentes.filter(ced => ced.toLowerCase().includes(termoBuscaCedente.toLowerCase()));
  }, [listaCedentes, termoBuscaCedente]);

  const todosFiltradosAtivos = cedentesFiltradosPelaBusca.length > 0 && cedentesFiltradosPelaBusca.every(c => cedentesSel.includes(c));
  const handleToggleTodosFiltrados = () => {
    if (todosFiltradosAtivos) {
      setCedentesSel(cedentesSel.filter(c => !cedentesFiltradosPelaBusca.includes(c)));
    } else {
      setCedentesSel(Array.from(new Set([...cedentesSel, ...cedentesFiltradosPelaBusca])));
    }
  };

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Conectando ao Banco Central Ned Capital (Supabase)...</div>;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-6 text-[13px] font-sans text-slate-800">
      
      <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">📊 Painel de Indicadores Estratégicos (BI)</h2>
          <span className="text-xs text-slate-500 font-medium">Consolidação em tempo real dos fluxos, receitas e riscos aprovados em comitê.</span>
        </div>
      </div>

      {/* MULTI-FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div ref={refEmp} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[11px] tracking-wider mb-1.5">Filtrar Origem (Empresa):</label>
          <button onClick={() => setOpenEmpresa(!openEmpresa)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs flex justify-between items-center outline-none">
            <span className="truncate">{empresasSel.length === 0 ? "Nenhuma" : empresasSel.length === listaEmpresas.length ? "Todas (SEC e FIDC)" : empresasSel.join(", ")}</span>
            <span>▼</span>
          </button>
          {openEmpresa && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2">
              {listaEmpresas.map(emp => (
                <label key={emp} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={empresasSel.includes(emp)} onChange={() => setEmpresasSel(empresasSel.includes(emp) ? empresasSel.filter(e => e !== emp) : [...empresasSel, emp])} className="w-4 h-4 rounded text-blue-600 border-slate-300" />
                  {emp === "SEC" ? "Securitizadora (SEC)" : "Fundo de Investimento (FIDC)"}
                </label>
              ))}
            </div>
          )}
        </div>

        <div ref={refMes} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[11px] tracking-wider mb-1.5">Mês de Referência:</label>
          <button onClick={() => setOpenMes(!openMes)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs flex justify-between items-center outline-none">
            <span className="truncate">{mesesSel.length === 0 ? "Todos os Meses" : mesesSel.length === listaMeses.length ? "Todos os Meses" : mesesSel.length === 1 ? `Mês: ${mesesSel[0]}` : `${mesesSel.length} Meses`}</span>
            <span>▼</span>
          </button>
          {openMes && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2 max-h-64 overflow-y-auto">
              <button onClick={() => setMesesSel(mesesSel.length === listaMeses.length ? [] : listaMeses)} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-1 border-b border-slate-100 mb-1">
                {mesesSel.length === listaMeses.length ? "🔲 Desmarcar Todos" : "☑️ Selecionar Todos"}
              </button>
              {listaMeses.map(mes => (
                <label key={mes} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={mesesSel.includes(mes)} onChange={() => setMesesSel(mesesSel.includes(mes) ? mesesSel.filter(m => m !== mes) : [...mesesSel, mes])} className="w-4 h-4 rounded text-blue-600 border-slate-300" />
                  {mes}
                </label>
              ))}
            </div>
          )}
        </div>

        <div ref={refCed} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[11px] tracking-wider mb-1.5">Filtrar por Cedentes:</label>
          <button onClick={() => setOpenCedente(!openCedente)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs flex justify-between items-center outline-none">
            <span className="truncate">{cedentesSel.length === listaCedentes.length ? "Todos os Cedentes" : `${cedentesSel.length} Selecionados`}</span>
            <span>▼</span>
          </button>
          {openCedente && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 flex flex-col gap-2 max-h-72">
              <input 
                type="text"
                placeholder="🔎 Digite para pesquisar..."
                value={termoBuscaCedente}
                onChange={(e) => setTermoBuscaCedente(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md outline-none text-xs focus:border-blue-500 font-bold bg-slate-50"
              />
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
                <button 
                  type="button"
                  onClick={handleToggleTodosFiltrados} 
                  className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-1 border-b border-slate-100 mb-1 block"
                >
                  {todosFiltradosAtivos ? "🔲 Limpar Resultados" : "☑️ Marcar Resultados"}
                </button>
                {cedentesFiltradosPelaBusca.length === 0 ? (
                  <div className="text-center p-3 text-slate-400 font-bold text-xs">Nenhum correspondente encontrado.</div>
                ) : (
                  cedentesFiltradosPelaBusca.map(ced => (
                    <label key={ced} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                      <input type="checkbox" checked={cedentesSel.includes(ced)} onChange={() => setCedentesSel(cedentesSel.includes(ced) ? cedentesSel.filter(c => c !== ced) : [...cedentesSel, ced])} className="w-4 h-4 rounded text-blue-600 border-slate-300" />
                      {ced}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* METRICAS DE CADASTRO */}
      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Crédito e Cadastro</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Aprovados</span>
            <div className="text-3xl font-black text-emerald-600 mt-2">{kpis.aprovadosMes}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Recusados</span>
            <div className="text-3xl font-black text-red-500 mt-2">{kpis.recusadosMes}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Prazo Médio SLA</span>
            <div className="text-3xl font-black text-blue-600 mt-2">{kpis.prazoMedioDias} {parseFloat(kpis.prazoMedioDias) === 1 ? "dia" : "dias"}</div>
          </div>
        </div>
      </div>

      {/* VALORES OPERADOS */}
      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Valores Operados Mensal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-blue-700 block">VOP Securitizadora ({labelMesFiltro})</span>
            <div className="text-2xl font-black text-blue-700 mt-2 truncate">{fM(kpis.vopMensalSec)}</div>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-blue-700 block">VOP FIDC ({labelMesFiltro})</span>
            <div className="text-2xl font-black text-blue-700 mt-2 truncate">{fM(kpis.vopMensalFidc)}</div>
          </div>
        </div>
      </div>

      {/* RECEITAS */}
      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Receitas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-emerald-700 block">Deságio Retido ({labelMesFiltro})</span>
            <div className="text-xl font-black text-emerald-700 mt-2 truncate">{fM(kpis.totalDesagio)}</div>
          </div>
          <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-emerald-700 block">Tarifas / Despesas ({labelMesFiltro})</span>
            <div className="text-xl font-black text-emerald-700 mt-2 truncate">{fM(kpis.totalTarifas)}</div>
          </div>
          <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-emerald-700 block">Juros e Multa (Pgto Atraso)</span>
            <div className="text-xl font-black text-emerald-700 mt-2 truncate">{fM(kpis.totalJurosMultas)}</div>
          </div>
          <div className="bg-emerald-950 text-emerald-100 border border-emerald-900 p-6 rounded-xl text-center shadow-xs font-bold">
            <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">Receita Líquida (Total)</span>
            <div className="text-xl font-black text-white mt-2 truncate">{fM(kpis.receitaTotalAcumulada)}</div>
          </div>
        </div>
      </div>

      {/* HISTORICO VIDA TODA */}
      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Valores Operados Geral (Vida Toda)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs bg-linear-to-b from-white to-slate-50/40">
            <span className="text-xs font-bold text-slate-500 block">VOP Consolidado Geral (Histórico)</span>
            <div className="text-xl font-black text-slate-900 mt-2 truncate">{fM(kpis.vopVidaTodaConsolidadoGeral)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs bg-linear-to-b from-white to-slate-50/40">
            <span className="text-xs font-bold text-slate-500 block">VOP Geral Sec (Histórico)</span>
            <div className="text-xl font-black text-slate-900 mt-2 truncate">{fM(kpis.vopVidaTodaSec)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs bg-linear-to-b from-white to-slate-50/40">
            <span className="text-xs font-bold text-slate-500 block">VOP Geral FIDC (Histórico)</span>
            <div className="text-xl font-black text-slate-900 mt-2 truncate">{fM(kpis.vopVidaTodaFidc)}</div>
          </div>
        </div>
      </div>

      {/* RISCO ATUAL */}
      <div className="space-y-3 pt-2">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Risco (Foto Atual da Carteira)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Risco Total Consolidado</span>
            <div className="text-2xl font-black text-slate-800 mt-2 truncate">{fM(kpis.riscoSec + kpis.riscoFidc)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Risco Securitizadora</span>
            <div className="text-2xl font-black text-slate-800 mt-2 truncate">{fM(kpis.riscoSec)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Risco FIDC</span>
            <div className="text-2xl font-black text-slate-800 mt-2 truncate">{fM(kpis.riscoFidc)}</div>
          </div>
        </div>
      </div>

      {/* VENCIDOS */}
      <div className="space-y-3 pt-2">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Títulos Vencidos (Foto Atual)</h3>
        <div className="flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-red-50/30 border border-red-100 p-6 rounded-xl text-center shadow-xs">
              <span className="text-xs font-bold text-red-600 block">Vencidos Securitizadora</span>
              <div className="text-2xl font-black text-red-600 mt-2 truncate">{fM(kpis.vencidosSec)}</div>
            </div>
            <div className="bg-red-50/30 border border-red-100 p-6 rounded-xl text-center shadow-xs">
              <span className="text-xs font-bold text-red-600 block">Vencidos FIDC</span>
              <div className="text-2xl font-black text-red-600 mt-2 truncate">{fM(kpis.vencidosFidc)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* SINCRO */}
      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl mt-8 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xl">📊</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700">Painel Integrado Ned Capital</span>
            <span className="text-[10px] font-bold text-emerald-600">🔥 Filtros Cruzados Ativos — Conexão Direta e Pura via Supabase V2</span>
          </div>
        </div>
        <button 
          onClick={sincronizarSupabase} 
          disabled={sincronizando}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-lg transition-all cursor-pointer text-xs shadow-sm disabled:opacity-50"
        >
          {sincronizando ? "⏳ Puxando..." : "🔄 Atualizar Dados da Tela"}
        </button>
      </div>

    </div>
  );
}