/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

interface TituloChecagem {
  id: string;
  data_referencia: string;
  empresa: string;
  cedente: string;
  sacado: string;
  documento: string;
  vencimento: string;
  valor_aberto: number;
  status_confirmacao: string;
  ocorrencias: string;
}

interface AgregacaoCedente {
  cedente: string;
  total_aberto: number;
  confirmado: number;
  a_confirmar: number;
  alto_risco: number;
  baixado: number;
  outros: number;
  titulos: TituloChecagem[];
}

const EMPRESAS = [
  { id: "TODAS", nome: "Visão Consolidada" },
  { id: "SEC", nome: "Ned Securitizadora" },
  { id: "FIDC", nome: "Ned FIDC" }
];

// ============================================================================
// 🧽 UTILS DE LIMPEZA E FORMATAÇÃO
// ============================================================================
const strClean = (c: any) => {
  if (!c) return "";
  return String(c).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
};

const parseValorReal = (valor: any): number => {
  if (!valor) return 0.0;
  if (typeof valor === "number") return valor;
  let txt = String(valor).toUpperCase().replace(/[R$\s]/g, "").trim();
  const isNeg = txt.startsWith("(") && txt.endsWith(")");
  if (isNeg) txt = txt.slice(1, -1);
  if (txt === "-" || txt === "NAN" || txt === "") return 0.0;
  if (txt.includes(",") && txt.includes(".")) {
    if (txt.lastIndexOf(",") < txt.lastIndexOf(".")) txt = txt.replace(/,/g, "");
    else txt = txt.replace(/\./g, "").replace(/,/g, ".");
  } else if (txt.includes(",")) {
    txt = txt.replace(/,/g, ".");
  }
  const num = parseFloat(txt);
  return isNaN(num) ? 0.0 : (isNeg ? -num : num);
};

const formatarDataExcel = (valorData: any): string => {
  if (!valorData) return "-";
  if (typeof valorData === "number" && valorData > 30000 && valorData < 60000) {
    const data = new Date(Math.round((valorData - 25569) * 86400 * 1000));
    return data.toISOString().split("T")[0];
  }
  const txt = String(valorData).trim();
  if (txt.includes("/")) {
    const partes = txt.split("/");
    if (partes.length === 3) {
      let y = partes[2].substring(0, 4);
      if (y.length === 2) y = `20${y}`;
      return `${y}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
    }
  }
  return txt.split(" ")[0]; // Retorna YYYY-MM-DD
};

// Radar inteligente para padronizar os status malucos do sistema original
const classificarStatus = (statusCru: string) => {
  const s = String(statusCru).toUpperCase();
  if (s.includes("CONFIRMADO")) return "Confirmado";
  if (s.includes("A CONFIRMAR")) return "A Confirmar";
  if (s.includes("ALTO RISCO") || s.includes("FALSO") || s.includes("PROBLEMA")) return "Alto Risco";
  if (s.includes("BAIXADO") || s.includes("LIQUIDADO") || s.includes("PAGO")) return "Baixado";
  return "Outros / Sem Status";
};

const fM = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
const fData = (iso: string) => {
  if (!iso || iso === "-") return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function ChecagemPage() {
  const [empresaAtiva, setEmpresaAtiva] = useState("TODAS");
  const hoje = new Date().toISOString().split("T")[0];
  const [dataReferencia, setDataReferencia] = useState(hoje);
  
  const [titulos, setTitulos] = useState<TituloChecagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [processandoUpload, setProcessandoUpload] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  // ==========================================================================
  // 📥 BUSCA DE DADOS (SNAPSHOT DIÁRIO)
  // ==========================================================================
  const carregarDados = async () => {
    setCarregando(true);
    try {
      let query = supabase.from("checagem_titulos").select("*").eq("data_referencia", dataReferencia);
      
      if (empresaAtiva !== "TODAS") {
        query = query.eq("empresa", empresaAtiva);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTitulos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReferencia, empresaAtiva]);

  // ==========================================================================
  // 📤 UPLOAD E PROCESSAMENTO DE PLANILHAS (QPROF SEC)
  // ==========================================================================
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, tipoEmpresa: "SEC" | "FIDC") => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessandoUpload(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let rawData: any[][] = [];
        
        // Trata CSV (Padrão do QPROF) ou XLSX
        if (file.name.toLowerCase().endsWith(".csv")) {
          const text = e.target?.result as string;
          const lines = text.split(/\r?\n/).filter(line => line.trim());
          let separador = ";";
          if (!lines[0].includes(";") && lines[0].includes(",")) separador = ",";
          rawData = lines.map(line => line.split(separador).map(cell => { 
            let c = cell.trim(); 
            return (c.startsWith('"') && c.endsWith('"')) ? c.slice(1, -1) : c; 
          }));
        } else {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
        }

        const loteUpload: any[] = [];
        
        if (tipoEmpresa === "SEC") {
          const headerIdx = rawData.findIndex(row => row.some(cell => strClean(cell).includes("CEDENTE")));
          if (headerIdx !== -1) {
            const header = rawData[headerIdx].map(strClean);
            const idxCed = header.findIndex(c => c.includes("CEDENTE"));
            const idxSac = header.findIndex(c => c.includes("SACADO"));
            const idxDoc = header.findIndex(c => c.includes("SEUNUMERO") || c.includes("DOCUMENTO"));
            const idxVenc = header.findIndex(c => c.includes("VENCORIG") || c.includes("DTAVCTO"));
            const idxAberto = header.findIndex(c => c.includes("VLRABERTO"));
            const idxStatus = header.findIndex(c => c === "STATUS" || c === "ROTULO" || c === "SITUACAO");
            const idxOcorr = header.findIndex(c => c.includes("OCORRENCIAS"));

            for (let i = headerIdx + 1; i < rawData.length; i++) {
              const row = rawData[i];
              const cedente = String(row[idxCed] || "").trim();
              if (!cedente || cedente.toUpperCase().includes("TOTAL")) continue;

              const vlrAberto = parseValorReal(row[idxAberto]);
              if (vlrAberto <= 0) continue; // Só trazemos o que está aberto

              loteUpload.push({
                data_referencia: dataReferencia,
                empresa: "SEC",
                cedente: cedente,
                sacado: String(row[idxSac] || "").trim(),
                documento: idxDoc !== -1 ? String(row[idxDoc] || "").trim() : "-",
                vencimento: formatarDataExcel(row[idxVenc]),
                valor_aberto: vlrAberto,
                status_confirmacao: classificarStatus(String(row[idxStatus] || "")),
                ocorrencias: idxOcorr !== -1 ? String(row[idxOcorr] || "").trim() : ""
              });
            }
          }
        } else {
          // Lógica do FIDC futura (mantendo o esqueleto)
          alert("Mapeamento do FIDC em construção. Faça upload do SEC por enquanto.");
          setProcessandoUpload(false);
          return;
        }

        if (loteUpload.length > 0) {
          // Deleta dados existentes desta empresa + data (para evitar duplicidade no re-upload)
          await supabase.from("checagem_titulos").delete().eq("data_referencia", dataReferencia).eq("empresa", tipoEmpresa);
          
          // Insere em lotes de 500
          const chunkSize = 500;
          for (let i = 0; i < loteUpload.length; i += chunkSize) {
            await supabase.from("checagem_titulos").insert(loteUpload.slice(i, i + chunkSize));
          }
          
          alert(`✅ Importação concluída! ${loteUpload.length} títulos de ${tipoEmpresa} processados para a data ${fData(dataReferencia)}.`);
          carregarDados();
        } else {
          alert("Nenhum título com saldo em aberto encontrado na planilha.");
        }
      };
      
      if (file.name.toLowerCase().endsWith(".csv")) reader.readAsText(file, "latin1");
      else reader.readAsArrayBuffer(file);
      
    } catch (e: any) {
      alert(`Erro no processamento: ${e.message}`);
    } finally {
      setProcessandoUpload(false);
      event.target.value = "";
    }
  };

  // ==========================================================================
  // 🧮 CÁLCULOS DOS KPIS E AGREGAÇÃO (VISÃO)
  // ==========================================================================
  const kpis = useMemo(() => {
    let total = 0, confirmado = 0, aConfirmar = 0, altoRisco = 0, baixado = 0, outros = 0;

    titulos.forEach(t => {
      total += Number(t.valor_aberto);
      if (t.status_confirmacao === "Confirmado") confirmado += Number(t.valor_aberto);
      else if (t.status_confirmacao === "A Confirmar") aConfirmar += Number(t.valor_aberto);
      else if (t.status_confirmacao === "Alto Risco") altoRisco += Number(t.valor_aberto);
      else if (t.status_confirmacao === "Baixado") baixado += Number(t.valor_aberto);
      else outros += Number(t.valor_aberto);
    });

    const calcPerc = (val: number) => total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";

    return { 
      total, confirmado, aConfirmar, altoRisco, baixado, outros,
      pConfirmado: calcPerc(confirmado),
      pAConfirmar: calcPerc(aConfirmar),
      pAltoRisco: calcPerc(altoRisco)
    };
  }, [titulos]);

  const cedentesAgregados = useMemo(() => {
    const mapa: Record<string, AgregacaoCedente> = {};

    titulos.forEach(t => {
      if (!mapa[t.cedente]) {
        mapa[t.cedente] = { cedente: t.cedente, total_aberto: 0, confirmado: 0, a_confirmar: 0, alto_risco: 0, baixado: 0, outros: 0, titulos: [] };
      }
      
      const v = Number(t.valor_aberto);
      mapa[t.cedente].total_aberto += v;
      if (t.status_confirmacao === "Confirmado") mapa[t.cedente].confirmado += v;
      else if (t.status_confirmacao === "A Confirmar") mapa[t.cedente].a_confirmar += v;
      else if (t.status_confirmacao === "Alto Risco") mapa[t.cedente].alto_risco += v;
      else if (t.status_confirmacao === "Baixado") mapa[t.cedente].baixado += v;
      else mapa[t.cedente].outros += v;

      mapa[t.cedente].titulos.push(t);
    });

    return Object.values(mapa).sort((a, b) => b.total_aberto - a.total_aberto); // Ordena do maior pro menor saldo
  }, [titulos]);

  const toggleLinha = (cedente: string) => {
    setExpandidos(prev => ({ ...prev, [cedente]: !prev[cedente] }));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-800">
      
      {/* 🚀 HEADER & CONTROLES DE DATA / EMPRESA */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">✅ Controle de Checagem / Confirmações</h2>
          <span className="text-xs text-slate-500 font-medium">Acompanhamento diário da qualidade e risco da carteira aberta.</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-hidden shrink-0">
            {EMPRESAS.map(emp => (
              <button
                key={emp.id}
                onClick={() => setEmpresaAtiva(emp.id)}
                className={`px-4 py-2 rounded-md font-bold text-[11px] uppercase transition-all ${
                  empresaAtiva === emp.id ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                {emp.nome}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 shrink-0">
            <span className="text-xs font-black text-slate-400 uppercase ml-2">Foto Diária:</span>
            <input 
              type="date" 
              value={dataReferencia}
              onChange={(e) => setDataReferencia(e.target.value)}
              className="p-1.5 rounded border border-slate-300 text-xs font-bold text-blue-700 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className={`px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-black rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer border border-indigo-200 shadow-sm flex items-center gap-2 ${processandoUpload ? "opacity-50 pointer-events-none" : ""}`}>
              {processandoUpload ? "⏳ Lendo..." : "📥 Importar SEC"}
              <input type="file" accept=".csv, .xls, .xlsx" className="hidden" onChange={(e) => handleFileUpload(e, "SEC")} />
            </label>
            <label className={`px-4 py-2 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 font-black rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer border border-purple-200 shadow-sm flex items-center gap-2 ${processandoUpload ? "opacity-50 pointer-events-none" : ""}`}>
              {processandoUpload ? "⏳ Lendo..." : "📥 Importar FIDC"}
              <input type="file" accept=".csv, .xls, .xlsx" className="hidden" onChange={(e) => handleFileUpload(e, "FIDC")} />
            </label>
          </div>
        </div>
      </div>

      {/* 📊 PAINEL DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI: Total Aberto */}
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md flex flex-col justify-center border border-slate-800">
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Saldo Total em Aberto</span>
          <span className="text-2xl font-black font-mono mt-1 truncate">{fM(kpis.total)}</span>
        </div>

        {/* KPI: Confirmado */}
        <div className="bg-white border-l-4 border-emerald-500 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">✅ Confirmados</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.confirmado)}</span>
          <div className="absolute right-4 top-4 text-emerald-500 font-black text-lg">{kpis.pConfirmado}%</div>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kpis.pConfirmado}%` }}></div>
          </div>
        </div>

        {/* KPI: A Confirmar */}
        <div className="bg-white border-l-4 border-amber-400 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">⏳ A Confirmar</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.aConfirmar)}</span>
          <div className="absolute right-4 top-4 text-amber-500 font-black text-lg">{kpis.pAConfirmar}%</div>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${kpis.pAConfirmar}%` }}></div>
          </div>
        </div>

        {/* KPI: Alto Risco */}
        <div className="bg-white border-l-4 border-rose-500 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">🚨 Alto Risco / Falso</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.altoRisco)}</span>
          <div className="absolute right-4 top-4 text-rose-500 font-black text-lg">{kpis.pAltoRisco}%</div>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${kpis.pAltoRisco}%` }}></div>
          </div>
        </div>

        {/* KPI: Baixados/Outros */}
        <div className="bg-white border-l-4 border-slate-400 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">🗂️ Outros / Baixados</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.baixado + kpis.outros)}</span>
        </div>
      </div>

      {/* 📄 TABELÃO MASTER-DETAIL */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider select-none">
              <th className="p-3 w-10 text-center">Abrir</th>
              <th className="p-3 w-[300px]">Cedente / Assignor</th>
              <th className="p-3 text-right">Saldo Aberto (R$)</th>
              <th className="p-3 text-right text-emerald-600">Confirmado</th>
              <th className="p-3 text-right text-amber-500">A Confirmar</th>
              <th className="p-3 text-right text-rose-500">Alto Risco</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carregando ? (
              <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold animate-pulse">Buscando snapshot de confirmações...</td></tr>
            ) : cedentesAgregados.length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Nenhum dado importado para a data selecionada ({fData(dataReferencia)}).</td></tr>
            ) : (
              cedentesAgregados.map((ced) => {
                const isOpen = !!expandidos[ced.cedente];
                return (
                  <tr key={ced.cedente} style={{ display: "contents" }}>
                    {/* LINHA MASTER (CEDENTE) */}
                    <tr className="bg-white hover:bg-blue-50/30 transition-colors">
                      <td className="p-2.5 text-center border-l-4 border-transparent">
                        <button 
                          onClick={() => toggleLinha(ced.cedente)} 
                          className="w-5 h-5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded font-black flex items-center justify-center border border-slate-300 shadow-xs cursor-pointer text-xs transition-colors"
                        >
                          {isOpen ? "−" : "+"}
                        </button>
                      </td>
                      <td className="p-2.5 text-[12px] font-black text-slate-800 uppercase truncate max-w-[280px]" title={ced.cedente}>{ced.cedente}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-800 bg-slate-50/50">{fM(ced.total_aberto)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">{fM(ced.confirmado)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-600 bg-amber-50/30">{fM(ced.a_confirmar)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-600 bg-rose-50/30">{fM(ced.alto_risco)}</td>
                    </tr>

                    {/* LINHA DETAIL (SACADOS DAQUELE CEDENTE) */}
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="bg-slate-100/50 p-4 border-b border-slate-200">
                          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
                            <table className="w-full text-[11px] text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-800 text-slate-300 font-bold uppercase text-[9px] tracking-wider border-b border-slate-900">
                                  <th className="p-2.5 pl-4">Sacado / Devedor</th>
                                  <th className="p-2.5 text-center">Nº Documento</th>
                                  <th className="p-2.5 text-center">Vencimento</th>
                                  <th className="p-2.5 text-right">Valor Aberto</th>
                                  <th className="p-2.5 text-center">Status Confirmação</th>
                                  <th className="p-2.5">Ocorrências / Notas</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {ced.titulos.sort((a,b) => b.valor_aberto - a.valor_aberto).map(tit => (
                                  <tr key={tit.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2.5 pl-4 font-bold text-slate-800 max-w-[200px] truncate" title={tit.sacado}>{tit.sacado}</td>
                                    <td className="p-2.5 text-center text-slate-500 font-mono">{tit.documento}</td>
                                    <td className="p-2.5 text-center font-mono">{fData(tit.vencimento)}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-800">{fM(tit.valor_aberto)}</td>
                                    <td className="p-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-xs tracking-wider ${
                                        tit.status_confirmacao === "Confirmado" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                        tit.status_confirmacao === "Alto Risco" ? "bg-rose-100 text-rose-800 border-rose-300 animate-pulse" :
                                        tit.status_confirmacao === "A Confirmar" ? "bg-amber-100 text-amber-800 border-amber-300" :
                                        "bg-slate-100 text-slate-600 border-slate-300"
                                      }`}>
                                        {tit.status_confirmacao}
                                      </span>
                                    </td>
                                    <td className="p-2.5 max-w-[250px] truncate text-slate-500 italic text-[10px]" title={tit.ocorrencias}>
                                      {tit.ocorrencias || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}