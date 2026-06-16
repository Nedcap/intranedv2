/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

function simplificarNome(nome: string): string {
  if (!nome) return "";
  let n = nome.trim().toUpperCase();
  n = n.replace(/\b(LTDA|SA|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, "");
  return n.replace(/\s+/g, " ").trim();
}

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

function extrairMesAnoDeDataBR(dataStr: string): string {
  if (!dataStr) return "";
  const partes = dataStr.split("/");
  if (partes.length === 3) {
    return `${partes[1].padStart(2, "0")}/${partes[2]}`;
  }
  if (partes.length === 2) {
    return `${partes[0].padStart(2, "0")}/${partes[1]}`;
  }
  return dataStr;
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

export default function DashboardPage() {
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

  // 📡 Interpretador de Planilhas Google nativo e veloz da V1 integrado à V2
  const fetchGoogleSheet = async (sheetName: string) => {
    try {
      const sheetId = "1uJ_BysO5VW6DLxoDuoy2ZKzEtRBcptydAa87Ih8cRCw";
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
      const res = await fetch(url);
      const text = await res.text();
      const jsonString = text.substring(text.indexOf("({") + 1, text.lastIndexOf("})") + 1);
      const jsonData = JSON.parse(jsonString);
      const headers = jsonData.table.cols.map((c: any) => c?.label?.trim().toLowerCase() || "");
      
      return jsonData.table.rows.map((r: any) => {
        const rowData: any = {};
        r.c.forEach((cell: any, i: number) => {
          if (headers[i]) {
            rowData[headers[i]] = cell ? ((cell.f || cell.v) ?? null) : null;
          }
        });
        return rowData;
      });
    } catch (error) {
      console.error(`Erro ao buscar aba ${sheetName}:`, error);
      return [];
    }
  };

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
          if (vinculos) allowedCedentes = vinculos.map((c: any) => simplificarNome(c.cedente));
        }
      }

      // 1. Carrega Métricas do Comitê de Crédito (Supa)
      let queryAnalises = supabase.from("analises").select("*");
      if (isComercial) {
        queryAnalises = queryAnalises.eq("comercial", userNome);
      }
      const resAnalises = await queryAnalises;
      setAnalises(resAnalises.data || []);

      // 2. Coleta em lote os dados do Google Sheets preenchido
      const [vopRaw, cartRaw, receitasRaw] = await Promise.all([
        fetchGoogleSheet("LANCAMENTOS_VOP"),
        fetchGoogleSheet("BASE_CARTEIRA"),
        fetchGoogleSheet("RECEITAS")
      ]);

      // 3. Processamento das regras de cruzamento de VOP com Trava Comercial
      const vopMap: { [key: string]: any } = {};
      vopRaw.forEach((r: any) => {
        const cedente = simplificarNome(r["cedente"]);
        if (!cedente) return;
        
        // Se for Comercial, ignora dados de cedentes de terceiros
        if (isComercial && !allowedCedentes.includes(cedente)) return;

        const mes_ano = String(r["mes/ano"] || r["mês/ano"] || r["mes ano"] || "").trim();
        const chave = `${cedente}_${mes_ano}`;
        if (!vopMap[chave]) vopMap[chave] = { mes_ano, cedente, vop_sec: 0, vop_fidc: 0 };
        vopMap[chave].vop_sec += parseValorReal(r["vop sec"]);
        vopMap[chave].vop_fidc += parseValorReal(r["vop fidc"]);
      });
      const vopFinal = Object.values(vopMap);
      setDashVop(vopFinal);

      // 4. Processamento das regras de cruzamento de Carteira (Risco) com Trava Comercial
      const cartMap: { [key: string]: any } = {};
      cartRaw.forEach((r: any) => {
        const cedente = simplificarNome(r["cedente"]);
        if (!cedente) return;

        // Se for Comercial, ignora dados de risco de terceiros
        if (isComercial && !allowedCedentes.includes(cedente)) return;

        if (!cartMap[cedente]) {
          cartMap[cedente] = { cedente, risco_consolidated: 0, risco_sec: 0, risco_fidc: 0, vencidos_securitizadora: 0, vencidos_fidc: 0 };
        }
        cartMap[cedente].risco_consolidated += parseValorReal(r["risco total"] || r["risco consolidado"]);
        cartMap[cedente].risco_sec += parseValorReal(r["risco sec"] || r["risco securitizadora"]);
        cartMap[cedente].risco_fidc += parseValorReal(r["risco fidc"]);
        cartMap[cedente].vencidos_securitizadora += parseValorReal(r["vencido sec"] || r["vencidos sec"]);
        cartMap[cedente].vencidos_fidc += parseValorReal(r["vencido fidc"] || r["vencidos fidc"]);
      });
      const cartFinal = Object.values(cartMap);
      setDashCarteira(cartFinal);

      // 5. Processamento das regras de cruzamento de Receitas com Trava Comercial
      const recMap: { [key: string]: any } = {};
      receitasRaw.forEach((r: any) => {
        const emp = String(r["empresa"] || "").trim().toUpperCase();
        const rawCedente = String(r["cedente"] || "").trim();
        const dataOp = String(r["data"] || r["mês/ano"] || r["mes/ano"] || "").trim();
        if (!rawCedente || !dataOp) return;

        const cedente = simplificarNome(rawCedente);
        // Se for Comercial, ignora receitas de terceiros
        if (isComercial && !allowedCedentes.includes(cedente)) return;

        const mes_ano = extrairMesAnoDeDataBR(dataOp);
        const chave = `${emp}_${dataOp}_${cedente}`;

        if (!recMap[chave]) {
          recMap[chave] = { empresa: emp, data: dataOp, mes_ano, cedente, desagio: 0, tarifas: 0, juros: 0 };
        }
        
        recMap[chave].desagio += parseValorReal(r["deságio"] || r["desagio"] || r["deságio retido"] || 0);
        recMap[chave].tarifas += parseValorReal(r["tarifas"] || r["despesas"] || r["tarifas / despesas"] || 0);
        recMap[chave].juros += parseValorReal(r["juros e multa"] || r["juros"] || r["encargos"] || 0); 
      });
      const recFinal = Object.values(recMap);
      setDashReceitas(recFinal);

      // 6. Montagem dos Meses e Cedentes Permitidos para Filtro na Tela
      const mesesUnicos = Array.from(new Set([
        ...vopFinal.map(v => formatarMesAno(v.mes_ano)),
        ...recFinal.map(r => formatarMesAno(r.mes_ano))
      ].filter(str => str && /^(0[1-9]|1[0-2])\/\d{4}$/.test(str)))).sort((a, b) => {
        const [mA, yA] = a.split("/"); const [mB, yB] = b.split("/");
        return (parseInt(yB) * 100 + parseInt(mB)) - (parseInt(yA) * 100 + parseInt(mA));
      });
      setListaMeses(mesesUnicos);
      if (mesesSel.length === 0 && mesesUnicos.length > 0) setMesesSel([mesesUnicos[0]]);

      const cedentesUnicos = Array.from(new Set([
        ...vopFinal.map(v => v.cedente),
        ...cartFinal.map(c => c.cedente),
        ...recFinal.map(r => r.cedente)
      ].filter(Boolean))).sort();
      setListaCedentes(cedentesUnicos);
      if (cedentesSel.length === 0) setCedentesSel(cedentesUnicos);

    } catch (err) {
      console.error("Erro no processamento geral do Dashboard via Sheets:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDashboardFiel(); }, []);

  const sincronizarGoogleSheets = async () => {
    setSincronizando(true);
    await carregarDashboardFiel();
    setSincronizando(false);
    alert("🔄 Sincronizado! Planilhas lidas em tempo real com mapeamento comercial ativo.");
  };

  const filtroAtivo = (emp: string, m_a: string, ced: string) => {
    const bateEmpresa = Pattern = empresasSel.includes(emp.toUpperCase());
    const bateMes = mesesSel.length === 0 || mesesSel.includes(formatarMesAno(m_a));
    const bateCedente = cedentesSel.length === 0 || cedentesSel.includes(ced.toUpperCase());
    return bateEmpresa && bateMes && bateCedente;
  };

  const labelMesFiltro = mesesSel.length === 0 ? "Geral" : mesesSel.length === 1 ? mesesSel[0] : "Múltiplos";

  let aprovadosMes = 0; let recusadosMes = 0; let somaDias = 0; let qtdSla = 0;
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
  const prazoMedioDias = qtdSla > 0 ? (somaDias / qtdSla).toFixed(1) : "0.0";

  let vopMensalSec = 0; let vopMensalFidc = 0;
  dashVop.forEach(v => {
    if (mesesSel.length === 0 || mesesSel.includes(formatarMesAno(v.mes_ano))) {
      if (cedentesSel.includes(v.cedente)) {
        if (empresasSel.includes("SEC")) vopMensalSec += parseValorReal(v.vop_sec);
        if (empresasSel.includes("FIDC")) vopMensalFidc += parseValorReal(v.vop_fidc);
      }
    }
  });

  let vopVidaTodaSec = 0; let vopVidaTodaFidc = 0;
  dashVop.forEach(v => {
    vopVidaTodaSec += parseValorReal(v.vop_sec);
    vopVidaTodaFidc += parseValorReal(v.vop_fidc);
  });
  const vopVidaTodaConsolidadoGeral = vopVidaTodaSec + vopVidaTodaFidc;

  let riscoSec = 0; let riscoFidc = 0; let vencidosSec = 0; let vencidosFidc = 0;
  dashCarteira.forEach(c => {
    if (cedentesSel.includes(c.cedente)) {
      if (empresasSel.includes("SEC")) { riscoSec += c.risco_sec; vencidosSec += c.vencidos_securitizadora; }
      if (empresasSel.includes("FIDC")) { riscoFidc += c.risco_fidc; vencidosFidc += c.vencidos_fidc; }
    }
  });

  let totalDesagio = 0; let totalTarifas = 0; let totalJurosMultas = 0;
  dashReceitas.forEach(r => {
    if (filtroAtivo(r.empresa, r.mes_ano, r.cedente)) {
      totalDesagio += r.desagio;
      totalTarifas += r.tarifas;
      totalJurosMultas += r.juros; 
    }
  });
  const receitaTotalAcumulada = totalDesagio + totalTarifas + totalJurosMultas;

  const cedentesFiltradosPelaBusca = listaCedentes.filter(ced =>
    ced.toLowerCase().includes(termoBuscaCedente.toLowerCase())
  );

  const todosFiltradosAtivos = cedentesFiltradosPelaBusca.length > 0 && cedentesFiltradosPelaBusca.every(c => cedentesSel.includes(c));
  const handleToggleTodosFiltrados = () => {
    if (todosFiltradosAtivos) {
      setCedentesSel(cedentesSel.filter(c => !cedentesFiltradosPelaBusca.includes(c)));
    } else {
      setCedentesSel(Array.from(new Set([...cedentesSel, ...cedentesFiltradosPelaBusca])));
    }
  };

  const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Puxando dados vivos das planilhas...</div>;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-6 text-[13px] font-sans text-slate-800">
      
      {/* 🛠️ CONJUNTO DE MULTI-FILTROS */}
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
            <span className="truncate">{mesesSel.length === 0 ? "Todos os Meses" : mesesSel.length === 1 ? `Mês: ${mesesSel[0]}` : `${mesesSel.length} Meses Selecionados`}</span>
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

      {/* CARDS METRICOS */}
      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Crédito e Cadastro</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Aprovados</span>
            <div className="text-3xl font-black text-emerald-600 mt-2">{aprovadosMes}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Recusados</span>
            <div className="text-3xl font-black text-red-500 mt-2">{recusadosMes}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Prazo Médio SLA</span>
            <div className="text-3xl font-black text-blue-600 mt-2">{prazoMedioDias} {parseFloat(prazoMedioDias) === 1 ? "dia" : "dias"}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Valores Operados Mensal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-blue-700 block">VOP Securitizadora ({labelMesFiltro})</span>
            <div className="text-2xl font-black text-blue-700 mt-2 truncate">{fM(vopMensalSec)}</div>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-blue-700 block">VOP FIDC ({labelMesFiltro})</span>
            <div className="text-2xl font-black text-blue-700 mt-2 truncate">{fM(vopMensalFidc)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Receitas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-emerald-700 block">Deságio Retido ({labelMesFiltro})</span>
            <div className="text-xl font-black text-emerald-700 mt-2 truncate">{fM(totalDesagio)}</div>
          </div>
          <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-emerald-700 block">Tarifas / Despesas ({labelMesFiltro})</span>
            <div className="text-xl font-black text-emerald-700 mt-2 truncate">{fM(totalTarifas)}</div>
          </div>
          <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-emerald-700 block">Juros e Multa (Pgto Atraso)</span>
            <div className="text-xl font-black text-emerald-700 mt-2 truncate">{fM(totalJurosMultas)}</div>
          </div>
          <div className="bg-emerald-950 text-emerald-100 border border-emerald-900 p-6 rounded-xl text-center shadow-xs font-bold">
            <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">Receita Líquida (Total)</span>
            <div className="text-xl font-black text-white mt-2 truncate">{fM(receitaTotalAcumulada)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Valores Operados Geral (Vida Toda)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs bg-linear-to-b from-white to-slate-50/40">
            <span className="text-xs font-bold text-slate-500 block">VOP Consolidado Geral (Histórico)</span>
            <div className="text-xl font-black text-slate-900 mt-2 truncate">{fM(vopVidaTodaConsolidadoGeral)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs bg-linear-to-b from-white to-slate-50/40">
            <span className="text-xs font-bold text-slate-500 block">VOP Geral Sec (Histórico)</span>
            <div className="text-xl font-black text-slate-900 mt-2 truncate">{fM(vopVidaTodaSec)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs bg-linear-to-b from-white to-slate-50/40">
            <span className="text-xs font-bold text-slate-500 block">VOP Geral FIDC (Histórico)</span>
            <div className="text-xl font-black text-slate-900 mt-2 truncate">{fM(vopVidaTodaFidc)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Risco (Foto Atual da Carteira)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Risco Total Consolidado</span>
            <div className="text-2xl font-black text-slate-800 mt-2 truncate">{fM(riscoSec + riscoFidc)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Risco Securitizadora</span>
            <div className="text-2xl font-black text-slate-800 mt-2 truncate">{fM(riscoSec)}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl text-center shadow-xs">
            <span className="text-xs font-bold text-slate-500 block">Risco FIDC</span>
            <div className="text-2xl font-black text-slate-800 mt-2 truncate">{fM(riscoFidc)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 text-center">Títulos Vencidos (Foto Atual)</h3>
        <div className="flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-red-50/30 border border-red-100 p-6 rounded-xl text-center shadow-xs">
              <span className="text-xs font-bold text-red-600 block">Vencidos Securitizadora</span>
              <div className="text-2xl font-black text-red-600 mt-2 truncate">{fM(vencidosSec)}</div>
            </div>
            <div className="bg-red-50/30 border border-red-100 p-6 rounded-xl text-center shadow-xs">
              <span className="text-xs font-bold text-red-600 block">Vencidos FIDC</span>
              <div className="text-2xl font-black text-red-600 mt-2 truncate">{fM(vencidosFidc)}</div>
            </div>
          </div>
        </div>