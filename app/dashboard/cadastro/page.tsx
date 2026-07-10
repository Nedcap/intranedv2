/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link"; // Import do Link do Next.js para a navegação dos cards

// ============================================================================
// 🧽 UTILS CORRIGIDOS E SEGUROS
// ============================================================================
function parseValorReal(valor: any): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;
  const str = String(valor).replace(/[R$\s]/g, "").trim();
  if (str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(str) || 0;
}

function formatarMesAno(str: string): string {
  if (!str) return "";
  const txt = String(str).trim();
  if (/^\d{2}\/\d{4}$/.test(txt)) return txt;
  
  if (txt.includes("-")) {
    const partes = txt.split("-");
    if (partes.length >= 2) return `${partes[1].padStart(2, "0")}/${partes[0]}`;
  }
  
  const partes = txt.split("/");
  if (partes.length === 2) {
    return `${partes[0].padStart(2, "0")}/${partes[1]}`;
  }
  return txt;
}

function limparCnpjSimples(valor: any): string {
  if (!valor) return "";
  return String(valor).replace(/\D/g, "");
}

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

// ============================================================================
// 📊 COMPONENTE PRINCIPAL (DASHBOARD BI)
// ============================================================================
export default function PowerBIPage() {
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
      
      const [resVop, resCarteira, resExtrato] = await Promise.all([
        supabase.from("dash_vop").select("*"),
        supabase.from("dash_carteira").select("*"),
        supabase.from("extrato_financeiro").select("*")
      ]);

      setDashVop(resVop.data || []);
      setDashCarteira(resCarteira.data || []);
      setDashReceitas(resExtrato.data || []);

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
      console.error("Erro no processamento de BI V2:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { if (carregando) carregarDashboardFiel(); }, []);

  const sincronizarSupabase = async () => {
    setSincronizando(true);
    await carregarDashboardFiel();
    setSincronizando(false);
  };

  // ==========================================================================
  // ⚡ CÁLCULOS MEMOIZADOS (Focados em VOP, Risco e Receitas)
  // ==========================================================================
  const kpis = useMemo(() => {
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

    // 1. VOP MENSAL E HISTÓRICO ACUMULADO
    dashVop.forEach(v => {
      const isCedenteAtivo = cedentesSel.includes(v.cedente);
      if (isCedenteAtivo) {
        vopVidaTodaSec += parseValorReal(v.vop_sec);
        vopVidaTodaFidc += parseValorReal(v.vop_fidc);

        if (mesesSel.length === 0 || mesesSel.includes(formatarMesAno(v.mes_ano))) {
          if (empresasSel.includes("SEC")) vopMensalSec += parseValorReal(v.vop_sec);
          if (empresasSel.includes("FIDC")) vopMensalFidc += parseValorReal(v.vop_fidc);
        }
      }
    });

    // 2. FOTO DA CARTEIRA ATUAL DE EXPOSIÇÃO
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

    // 3. RECEITAS ANALÍTICAS DO EXTRATO DO DRE
    dashReceitas.forEach(r => {
      if (filtroAtivo(r.empresa, r.mes_ano, r.cedente)) {
        totalDesagio += parseValorReal(r.desagio);
        totalTarifas += parseValorReal(r.tarifas);
        totalJurosMultas += parseValorReal(r.juros); 
      }
    });

    const vopVidaTodaConsolidadoGeral = vopVidaTodaSec + vopVidaTodaFidc;
    const receitaTotalAcumulada = totalDesagio + totalTarifas + totalJurosMultas;

    return {
      vopMensalSec, vopMensalFidc, vopVidaTodaSec, vopVidaTodaFidc, vopVidaTodaConsolidadoGeral,
      riscoSec, riscoFidc, vencidosSec, vencidosFidc,
      totalDesagio, totalTarifas, totalJurosMultas, receitaTotalAcumulada
    };
  }, [dashVop, dashCarteira, dashReceitas, empresasSel, mesesSel, cedentesSel]);

  const labelMesFiltro = mesesSel.length === 0 ? "Geral" : mesesSel.length === listaMeses.length ? "Todos" : mesesSel.length === 1 ? mesesSel[0] : "Múltiplos";

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

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Sincronizando Business Intelligence Ned...</div>;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-6 text-[13px] font-sans text-slate-800">
      
      <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">📊 Painel de Indicadores Estratégicos (BI)</h2>
          <span className="text-xs text-slate-500 font-medium">Consolidação em tempo real dos fluxos, receitas e riscos aprovados em comitê.</span>
        </div>
      </div>

      {/* MULTI-FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div ref={refEmp} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Filtrar Origem (Empresa):</label>
          <button onClick={() => setOpenEmpresa(!openEmpresa)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors">
            <span className="truncate">{empresasSel.length === 0 ? "Nenhuma" : empresasSel.length === listaEmpresas.length ? "Todas (SEC e FIDC)" : empresasSel.join(", ")}</span>
            <span className="text-slate-400">▼</span>
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
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Mês de Referência:</label>
          <button onClick={() => setOpenMes(!openMes)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors">
            <span className="truncate">{mesesSel.length === 0 ? "Todos os Meses" : mesesSel.length === listaMeses.length ? "Todos os Meses" : mesesSel.length === 1 ? `Mês: ${mesesSel[0]}` : `${mesesSel.length} Meses`}</span>
            <span className="text-slate-400">▼</span>
          </button>
          {openMes && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2 max-h-64 overflow-y-auto">
              <button onClick={() => setMesesSel(mesesSel.length === listaMeses.length ? [] : listaMeses)} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-2 border-b border-slate-100 mb-1">
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
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Filtrar por Cedentes:</label>
          <button onClick={() => setOpenCedente(!openCedente)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors">
            <span className="truncate">{cedentesSel.length === listaCedentes.length ? "Todos os Cedentes" : `${cedentesSel.length} Selecionados`}</span>
            <span className="text-slate-400">▼</span>
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
                  className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-2 border-b border-slate-100 mb-1 block"
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

      {/* ==================================================================================== */}
      {/* 🚀 CARDS CLICÁVEIS: VALORES OPERADOS (MENSAL + HISTÓRICO MESCLADO) */}
      {/* ==================================================================================== */}
      <div className="space-y-3">
        <h3 className="font-black text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-1">Valores Operados (VOP)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card Consolidado Total (Informativo, sem Link) */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-600/30 border border-indigo-500">
             <svg className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
             <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-100 block mb-2">Consolidado Geral (Vida Toda)</span>
             <div className="text-3xl font-black truncate">{fM(kpis.vopVidaTodaConsolidadoGeral)}</div>
             <span className="text-[10px] text-indigo-300 font-bold block mt-2 uppercase">SEC + FIDC</span>
          </div>

          {/* VOP SEC -> Link Operações SEC */}
          <Link href="/dashboard/importacao/operacoes-sec" className="group relative overflow-hidden p-6 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-md hover:-translate-y-0.5 block">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 group-hover:bg-indigo-600 transition-colors"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 block mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> VOP Securitizadora ({labelMesFiltro})</span>
              <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-black text-lg">➔</span>
            </span>
            <div className="flex flex-col">
               <span className="text-3xl font-black text-slate-800 truncate">{fM(kpis.vopMensalSec)}</span>
               <span className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider flex items-center gap-1">Histórico Geral: {fM(kpis.vopVidaTodaSec)}</span>
            </div>
          </Link>

          {/* VOP FIDC -> Link Operações FIDC */}
          <Link href="/dashboard/importacao/operacoes-fidc" className="group relative overflow-hidden p-6 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 hover:shadow-md hover:-translate-y-0.5 block">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 group-hover:bg-purple-600 transition-colors"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-600 block mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div> VOP FIDC ({labelMesFiltro})</span>
              <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-black text-lg">➔</span>
            </span>
            <div className="flex flex-col">
               <span className="text-3xl font-black text-slate-800 truncate">{fM(kpis.vopMensalFidc)}</span>
               <span className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider flex items-center gap-1">Histórico Geral: {fM(kpis.vopVidaTodaFidc)}</span>
            </div>
          </Link>

        </div>
      </div>

      {/* ==================================================================================== */}
      {/* 🚀 CARDS CLICÁVEIS: RISCO, EXPOSIÇÃO E VENCIDOS (MESCLADO) */}
      {/* ==================================================================================== */}
      <div className="space-y-3 pt-2">
        <h3 className="font-black text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-1">Carteira em Aberto (Risco e Inadimplência)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Risco Total Consolidado (Informativo, sem Link) */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-xl shadow-slate-900/20 border border-slate-600">
             <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300 block mb-2">Exposição Total Consolidada</span>
             <div className="text-3xl font-black truncate">{fM(kpis.riscoSec + kpis.riscoFidc)}</div>
             <span className="text-[10px] text-rose-400 font-bold block mt-2 uppercase flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div> Total Vencido: {fM(kpis.vencidosSec + kpis.vencidosFidc)}
             </span>
          </div>

          {/* RISCO SEC -> Link Carteira SEC */}
          <Link href="/dashboard/importacao/carteira-risco-sec" className="group relative overflow-hidden p-6 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 hover:shadow-md hover:-translate-y-0.5 block">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:bg-blue-600 transition-colors"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600 block mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Risco Securitizadora</span>
              <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-black text-lg">➔</span>
            </span>
            <div className="flex flex-col">
               <span className="text-3xl font-black text-slate-800 truncate">{fM(kpis.riscoSec)}</span>
               <span className="text-[11px] font-bold text-rose-500 mt-2 uppercase tracking-wider flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Títulos Vencidos: {fM(kpis.vencidosSec)}</span>
            </div>
          </Link>

          {/* RISCO FIDC -> Link Carteira FIDC */}
          <Link href="/dashboard/importacao/carteira-risco-fidc" className="group relative overflow-hidden p-6 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-md hover:-translate-y-0.5 block">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 group-hover:bg-indigo-600 transition-colors"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 block mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Risco FIDC</span>
              <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-black text-lg">➔</span>
            </span>
            <div className="flex flex-col">
               <span className="text-3xl font-black text-slate-800 truncate">{fM(kpis.riscoFidc)}</span>
               <span className="text-[11px] font-bold text-rose-500 mt-2 uppercase tracking-wider flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Títulos Vencidos: {fM(kpis.vencidosFidc)}</span>
            </div>
          </Link>

        </div>
      </div>

      {/* ==================================================================================== */}
      {/* 🚀 RECEITAS FINANCEIRAS (Com atalhos de importação no Header) */}
      {/* ==================================================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center border-b border-slate-200 pb-1">
          <h3 className="font-black text-slate-400 uppercase tracking-wider text-[10px]">Receitas Financeiras</h3>
          <div className="flex gap-2">
            <Link href="/dashboard/importacao/receitas-sec" className="text-[9px] uppercase font-black bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 border border-transparent px-3 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm">Importar SEC ➔</Link>
            <Link href="/dashboard/importacao/receitas-fidc" className="text-[9px] uppercase font-black bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 border border-transparent px-3 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm">Importar FIDC ➔</Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          <div className="relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:shadow-md">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Deságio Retido</span>
            <span className="text-2xl font-black text-slate-800 truncate block">{fM(kpis.totalDesagio)}</span>
          </div>
          
          <div className="relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:shadow-md">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-400"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-teal-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-500"></div> Tarifas / Despesas</span>
            <span className="text-2xl font-black text-slate-800 truncate block">{fM(kpis.totalTarifas)}</span>
          </div>
          
          <div className="relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border bg-white border-slate-200 hover:shadow-md">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-400"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Juros e Multa</span>
            <span className="text-2xl font-black text-slate-800 truncate block">{fM(kpis.totalJurosMultas)}</span>
          </div>
          
          <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-xl shadow-emerald-900/20 border border-emerald-500">
             <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-100 block mb-2">Receita Líquida (Total)</span>
             <span className="text-3xl font-black text-white truncate block">{fM(kpis.receitaTotalAcumulada)}</span>
          </div>
        </div>
      </div>

      {/* SINCRO */}
      <div className="flex justify-between items-center bg-white border border-slate-200 p-5 rounded-2xl mt-8 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-2xl bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-xs">📊</span>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">Painel Integrado Ned Capital</span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mt-1">Conexão Direta via Supabase V2</span>
          </div>
        </div>
        <button 
          onClick={sincronizarSupabase} 
          disabled={sincronizando}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {sincronizando ? "⏳ Puxando..." : "🔄 Atualizar Dados"}
        </button>
      </div>

    </div>
  );
}