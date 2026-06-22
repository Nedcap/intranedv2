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
  emissao: string | null;
  atualizacao: string | null;
}

interface AgregacaoCedente {
  cedente: string;
  total_aberto: number;
  confirmado: number;
  a_confirmar: number;
  risco: number;
  outros: number;
  titulos: TituloChecagem[];
}

const EMPRESAS = [
  { id: "TODAS", nome: "Visão Consolidada" },
  { id: "SEC", nome: "Ned Securitizadora" },
  { id: "FIDC", nome: "Ned FIDC" }
];

// ============================================================================
// 🧽 UTILS DE LIMPEZA E CÁLCULO
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

const formatarDataExcel = (valorData: any): string | null => {
  if (!valorData || valorData === "-") return null;
  if (typeof valorData === "number" && valorData > 30000 && valorData < 60000) {
    const data = new Date(Math.round((valorData - 25569) * 86400 * 1000));
    return data.toISOString().split("T")[0];
  }
  let txt = String(valorData).trim().split(" ")[0]; // Pega só a data, descarta hora 00:00:00
  if (!txt) return null;
  if (txt.includes("/")) {
    const partes = txt.split("/");
    if (partes.length === 3) {
      let y = partes[2].substring(0, 4);
      if (y.length === 2) y = `20${y}`;
      return `${y}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) return txt;
  return null;
};

const classificarStatus = (ocorrenciaStr: string) => {
  const s = String(ocorrenciaStr).toUpperCase();
  if (s.includes("NÃO CONFIRMA") || s.includes("NAO CONFIRMA")) return "Não Confirma";
  if (s.includes("A CONFIRMAR")) return "A Confirmar";
  if (s.includes("CONFIRMADO")) return "Confirmado";
  if (s.includes("ALTO RISCO") || s.includes("FALSO")) return "Alto Risco";
  if (s.includes("POLÍTICA") || s.includes("POLITICA")) return "Política";
  if (s.includes("PROBLEMA")) return "Problema";
  if (s.includes("BAIXADO") || s.includes("LIQUIDADO") || s.includes("PAGO")) return "Baixado";
  return "A Confirmar";
};

const calcularDiasSLA = (d1: string | null, d2: string | null) => {
  if (!d1 || !d2) return null;
  const data1 = new Date(d1);
  const data2 = new Date(d2);
  const diffTime = Math.abs(data2.getTime() - data1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const fM = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
const fMShort = (val: number) => {
  if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}k`;
  return `R$ ${val.toFixed(0)}`;
};
const fData = (iso: string | null) => {
  if (!iso) return "-";
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
  
  // Controle de Ordenação da Tabela
  const [sortConfig, setSortConfig] = useState<{ key: keyof AgregacaoCedente; direction: "asc" | "desc" }>({
    key: "total_aberto",
    direction: "desc"
  });

  // ==========================================================================
  // 📥 BUSCA DE DADOS (SNAPSHOT DIÁRIO)
  // ==========================================================================
  const carregarDados = async () => {
    setCarregando(true);
    try {
      let query = supabase.from("checagem_titulos").select("*").eq("data_referencia", dataReferencia);
      if (empresaAtiva !== "TODAS") query = query.eq("empresa", empresaAtiva);

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
        
        if (file.name.toLowerCase().endsWith(".csv")) {
          const text = e.target?.result as string;
          let separador = ";";
          if (text.split("\n")[0].split(";").length < 5) separador = ",";
          
          const lines = text.split(/\r?\n/).filter(line => line.trim());
          rawData = lines.map(line => {
            let inQuotes = false;
            let current = "";
            const row = [];
            for (let i = 0; i < line.length; i++) {
              if (line[i] === '"') inQuotes = !inQuotes;
              else if (line[i] === separador && !inQuotes) { row.push(current.trim()); current = ""; } 
              else { current += line[i]; }
            }
            row.push(current.trim());
            return row;
          });
        } else {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
        }

        const loteUpload: any[] = [];
        
        if (tipoEmpresa === "SEC") {
          const headerIdx = rawData.findIndex(row => row.some(cell => strClean(cell) === "CEDENTE" || strClean(cell) === "NOMEDOCEDENTE"));
          
          if (headerIdx !== -1) {
            const header = rawData[headerIdx].map(strClean);
            
            const idxCed = header.findIndex(c => c === "CEDENTE" || c === "NOMEDOCEDENTE" || c === "RAZAOSOCIAL");
            const idxSac = header.findIndex(c => c === "SACADO" || c === "NOMESACADO");
            const idxDoc = header.findIndex(c => c === "SEUNUMERO" || c.includes("DOCUMENTO"));
            const idxVenc = header.findIndex(c => c === "VENCORIG" || c === "DTAVCTO" || c === "VENCIMENTO");
            const idxAberto = header.findIndex(c => c.includes("VLRABERTO") || c.includes("VALORABERTO"));
            const idxOcorr = header.findIndex(c => c.includes("OCORRENCIAS") || c.includes("OBSERVACAO"));
            
            // Novas colunas de Datas para o SLA
            const idxEmissao = header.findIndex(c => c === "DTAEMISSAO" || c === "EMISSAO" || c === "DATAEMISSAO");
            const idxExp = header.findIndex(c => c === "DTAEXP" || c === "ATUALIZACAO" || c === "DATAEXP");

            for (let i = headerIdx + 1; i < rawData.length; i++) {
              const row = rawData[i];
              const cedente = String(row[idxCed] || "").trim();
              if (!cedente || cedente.toUpperCase().includes("TOTAL")) continue;

              const vlrAberto = parseValorReal(row[idxAberto]);
              if (vlrAberto <= 0) continue; 

              const ocorrenciaTexto = idxOcorr !== -1 ? String(row[idxOcorr] || "").trim() : "";

              loteUpload.push({
                data_referencia: dataReferencia,
                empresa: "SEC",
                cedente: cedente,
                sacado: String(row[idxSac] || "").trim(),
                documento: idxDoc !== -1 ? String(row[idxDoc] || "").trim() : "-",
                vencimento: formatarDataExcel(row[idxVenc]),
                valor_aberto: vlrAberto,
                status_confirmacao: classificarStatus(ocorrenciaTexto),
                ocorrencias: ocorrenciaTexto,
                emissao: idxEmissao !== -1 ? formatarDataExcel(row[idxEmissao]) : null,
                atualizacao: idxExp !== -1 ? formatarDataExcel(row[idxExp]) : null
              });
            }
          }
        } else {
          alert("Mapeamento do FIDC em construção. Faça upload do SEC por enquanto.");
          setProcessandoUpload(false);
          return;
        }

        if (loteUpload.length > 0) {
          await supabase.from("checagem_titulos").delete().eq("data_referencia", dataReferencia).eq("empresa", tipoEmpresa);
          const chunkSize = 500;
          for (let i = 0; i < loteUpload.length; i += chunkSize) {
            const { error } = await supabase.from("checagem_titulos").insert(loteUpload.slice(i, i + chunkSize));
            if (error) throw error;
          }
          alert(`✅ Importação concluída! ${loteUpload.length} títulos da ${tipoEmpresa} processados na data ${fData(dataReferencia)}.`);
          carregarDados();
        } else {
          alert("❌ Nenhum título com saldo em aberto foi encontrado.");
        }
      };
      
      if (file.name.toLowerCase().endsWith(".csv")) reader.readAsText(file, "latin1");
      else reader.readAsArrayBuffer(file);
      
    } catch (e: any) {
      alert(`❌ Erro crítico no processamento: ${e.message}`);
    } finally {
      setProcessandoUpload(false);
      event.target.value = "";
    }
  };

  // ==========================================================================
  // 🧮 CÁLCULOS DOS KPIS E AGREGAÇÃO
  // ==========================================================================
  const kpis = useMemo(() => {
    let total = 0, confirmado = 0, aConfirmar = 0, risco = 0, outros = 0;
    titulos.forEach(t => {
      const v = Number(t.valor_aberto) || 0;
      total += v;
      if (t.status_confirmacao === "Confirmado") confirmado += v;
      else if (t.status_confirmacao === "A Confirmar") aConfirmar += v;
      else if (["Alto Risco", "Não Confirma", "Problema"].includes(t.status_confirmacao)) risco += v;
      else outros += v;
    });
    const calcPerc = (val: number) => total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
    return { 
      total, confirmado, aConfirmar, risco, outros,
      pConfirmado: calcPerc(confirmado),
      pAConfirmar: calcPerc(aConfirmar),
      pRisco: calcPerc(risco)
    };
  }, [titulos]);

  // 📈 GRÁFICO DE EVOLUÇÃO DIÁRIA (AGORA COM SCALES E TENDÊNCIAS)
  const chartEvolucao = useMemo(() => {
    const [anoRef, mesRef] = dataReferencia.split("-");
    const prefixoMes = `${anoRef}-${mesRef}`;
    
    const confirmadosNoMes = titulos.filter(t => t.status_confirmacao === "Confirmado" && t.atualizacao?.startsWith(prefixoMes));
    
    const arrayDias: { dia: string; valor: number; evolucao: "UP" | "DOWN" | "NEUTRAL" }[] = [];
    const totalDiasMes = new Date(Number(anoRef), Number(mesRef), 0).getDate();
    
    for (let i = 1; i <= totalDiasMes; i++) {
      arrayDias.push({ dia: String(i).padStart(2, "0"), valor: 0, evolucao: "NEUTRAL" });
    }

    confirmadosNoMes.forEach(t => {
      const dia = t.atualizacao!.split("-")[2];
      const idx = arrayDias.findIndex(d => d.dia === dia);
      if (idx !== -1) {
        arrayDias[idx].valor += Number(t.valor_aberto) || 0;
      }
    });

    // Calcula a tendência em relação ao dia anterior com dados
    let lastValor = 0;
    for (let i = 0; i < arrayDias.length; i++) {
      if (arrayDias[i].valor > 0) {
        if (lastValor > 0) {
          arrayDias[i].evolucao = arrayDias[i].valor > lastValor ? "UP" : "DOWN";
        }
        lastValor = arrayDias[i].valor;
      }
    }

    const maxValor = Math.max(...arrayDias.map(d => d.valor), 1); 
    
    // Calcula Escala Y para exibir 4 linhas guias
    const gridY = [maxValor, maxValor * 0.75, maxValor * 0.50, maxValor * 0.25, 0];

    return { dados: arrayDias, maxValor, gridY };
  }, [titulos, dataReferencia]);

  // 📄 TABELA ORDENÁVEL E AGREGAÇÃO DE CEDENTES
  const cedentesAgregados = useMemo(() => {
    const mapa: Record<string, AgregacaoCedente> = {};

    titulos.forEach(t => {
      if (!mapa[t.cedente]) {
        mapa[t.cedente] = { cedente: t.cedente, total_aberto: 0, confirmado: 0, a_confirmar: 0, risco: 0, outros: 0, titulos: [] };
      }
      const v = Number(t.valor_aberto) || 0;
      mapa[t.cedente].total_aberto += v;
      
      if (t.status_confirmacao === "Confirmado") mapa[t.cedente].confirmado += v;
      else if (t.status_confirmacao === "A Confirmar") mapa[t.cedente].a_confirmar += v;
      else if (["Alto Risco", "Não Confirma", "Problema"].includes(t.status_confirmacao)) mapa[t.cedente].risco += v;
      else mapa[t.cedente].outros += v;

      mapa[t.cedente].titulos.push(t);
    });

    const array = Object.values(mapa);
    
    array.sort((a: any, b: any) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return array;
  }, [titulos, sortConfig]);

  const handleSort = (key: keyof AgregacaoCedente) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const toggleLinha = (cedente: string) => {
    setExpandidos(prev => ({ ...prev, [cedente]: !prev[cedente] }));
  };

  const badgeStatus = (status: string) => {
    if (status === "Confirmado") return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (status === "A Confirmar") return "bg-blue-100 text-blue-800 border-blue-300";
    if (["Alto Risco", "Não Confirma", "Problema"].includes(status)) return "bg-rose-100 text-rose-800 border-rose-300 animate-pulse";
    if (status === "Política") return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-slate-100 text-slate-600 border-slate-300";
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-800">
      
      {/* 🚀 HEADER & CONTROLES DE DATA / EMPRESA */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">✅ Controle de Checagem</h2>
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
              className="p-1.5 rounded border border-slate-300 text-xs font-bold text-blue-700 outline-none focus:border-blue-500 cursor-pointer"
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
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md flex flex-col justify-center border border-slate-800">
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Saldo Total em Aberto</span>
          <span className="text-2xl font-black font-mono mt-1 truncate">{fM(kpis.total)}</span>
        </div>
        <div className="bg-white border-l-4 border-emerald-500 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">✅ Confirmados</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.confirmado)}</span>
          <div className="absolute right-4 top-4 text-emerald-500 font-black text-lg">{kpis.pConfirmado}%</div>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kpis.pConfirmado}%` }}></div>
          </div>
        </div>
        <div className="bg-white border-l-4 border-blue-500 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">⏳ A Confirmar</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.aConfirmar)}</span>
          <div className="absolute right-4 top-4 text-blue-500 font-black text-lg">{kpis.pAConfirmar}%</div>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${kpis.pAConfirmar}%` }}></div>
          </div>
        </div>
        <div className="bg-white border-l-4 border-rose-500 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">🚨 Alto Risco / Problema</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.risco)}</span>
          <div className="absolute right-4 top-4 text-rose-500 font-black text-lg">{kpis.pRisco}%</div>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${kpis.pRisco}%` }}></div>
          </div>
        </div>
        <div className="bg-white border-l-4 border-slate-400 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-center relative overflow-hidden">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">🗂️ Outros / Política</span>
          <span className="text-xl font-black text-slate-800 font-mono mt-1">{fM(kpis.outros)}</span>
        </div>
      </div>

      {/* 📈 GRÁFICO DE BARRAS TURBINADO: EVOLUÇÃO DIÁRIA (VALORIZAÇÃO/ESCALA) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col">
        <div className="mb-4 border-b border-slate-100 pb-2">
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">📈 Evolução Diária de Confirmações</h3>
          <span className="text-[10px] font-bold text-slate-400">Desempenho da equipe (Valores totais confirmados no dia - Referência: {fData(dataReferencia).split("/").slice(1).join("/")})</span>
        </div>
        
        {/* GRÁFICO AREA */}
        <div className="flex h-44 w-full mt-2 relative">
          
          {/* Escala Y (Valores na Esquerda) */}
          <div className="w-14 flex flex-col justify-between items-end pr-2 text-[9px] font-mono font-bold text-slate-400 border-r border-slate-100 pb-5">
            {chartEvolucao.gridY.map((gy, i) => (
              <span key={i} className="leading-none">{fMShort(gy)}</span>
            ))}
          </div>

          {/* Grid de Fundo */}
          <div className="absolute inset-0 left-14 flex flex-col justify-between pointer-events-none pb-5">
            {chartEvolucao.gridY.map((_, i) => (
              <div key={i} className="w-full border-t border-slate-100 border-dashed h-0"></div>
            ))}
          </div>

          {/* Barras e Eixo X */}
          <div className="flex-1 flex items-end gap-1.5 pl-2 relative">
            {chartEvolucao.dados.map((item, idx) => {
              const altura = item.valor > 0 ? Math.max((item.valor / chartEvolucao.maxValor) * 100, 2) : 0; 
              
              let corBarra = "bg-slate-200";
              let corFundo = "bg-slate-50";
              let iconeTendencia = "";

              if (item.valor > 0) {
                if (item.evolucao === "UP") {
                  corBarra = "bg-emerald-500 hover:bg-emerald-400";
                  corFundo = "bg-emerald-50";
                  iconeTendencia = "text-emerald-500";
                } else if (item.evolucao === "DOWN") {
                  corBarra = "bg-rose-500 hover:bg-rose-400";
                  corFundo = "bg-rose-50";
                  iconeTendencia = "text-rose-500";
                } else {
                  corBarra = "bg-blue-500 hover:bg-blue-400";
                  corFundo = "bg-blue-50";
                  iconeTendencia = "text-blue-500";
                }
              }

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full relative group">
                  {/* Tooltip Hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    Dia {item.dia}: {fM(item.valor)}
                  </div>
                  
                  {/* Container da Barra para preencher altura total */}
                  <div className={`w-full h-full flex flex-col justify-end ${corFundo} rounded-t-sm relative pb-5`}>
                    
                    {/* Seta de Tendência e Valor (Sobe e Desce conforme altura) */}
                    {item.valor > 0 && (
                      <div className="absolute w-full flex flex-col items-center justify-end z-10 transition-all duration-500" style={{ bottom: `calc(${altura}% + 20px)` }}>
                        <span className={`text-[8px] font-black leading-none ${iconeTendencia}`}>
                          {item.evolucao === "UP" ? "▲" : item.evolucao === "DOWN" ? "▼" : "—"}
                        </span>
                      </div>
                    )}

                    {/* A Barra Colorida */}
                    <div className={`w-full rounded-t-sm transition-all duration-500 ${corBarra}`} style={{ height: `${altura}%` }}></div>
                  </div>

                  {/* Label Dia Eixo X (Absoluto no fundo para ficar alinhado) */}
                  <span className="text-[9px] font-black text-slate-400 absolute bottom-0 h-5 flex items-center justify-center">{item.dia}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 📄 TABELÃO MASTER-DETAIL COM ORDENAÇÃO */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider select-none">
                <th className="p-3 w-10 text-center">Abrir</th>
                <th className="p-3 min-w-[250px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort("cedente")}>
                  Cedente / Assignor {sortConfig.key === "cedente" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
                <th className="p-3 text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort("total_aberto")}>
                  Saldo Aberto (R$) {sortConfig.key === "total_aberto" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
                <th className="p-3 text-right text-emerald-600 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => handleSort("confirmado")}>
                  Confirmado {sortConfig.key === "confirmado" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
                <th className="p-3 text-right text-blue-600 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => handleSort("a_confirmar")}>
                  A Confirmar {sortConfig.key === "a_confirmar" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
                <th className="p-3 text-right text-rose-500 cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => handleSort("risco")}>
                  Riscos / Falso {sortConfig.key === "risco" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                </th>
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
                        <td className="p-2.5 text-[12px] font-black text-slate-800 uppercase truncate max-w-[300px]" title={ced.cedente}>{ced.cedente}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800 bg-slate-50/50">{fM(ced.total_aberto)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">{fM(ced.confirmado)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-700 bg-blue-50/30">{fM(ced.a_confirmar)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-600 bg-rose-50/30">{fM(ced.risco)}</td>
                      </tr>

                      {/* LINHA DETAIL (SACADOS DAQUELE CEDENTE) */}
                      {isOpen && (
                        <tr>
                          <td colSpan={6} className="bg-slate-100/50 p-4 border-b border-slate-200">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
                              <table className="w-full text-[11px] text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-800 text-slate-300 font-bold uppercase text-[9px] tracking-wider border-b border-slate-900">
                                    <th className="p-2.5 pl-4 min-w-[200px]">Sacado / Devedor</th>
                                    <th className="p-2.5 text-center">Nº Doc</th>
                                    <th className="p-2.5 text-center">Emissão</th>
                                    <th className="p-2.5 text-center">Vencimento</th>
                                    <th className="p-2.5 text-right">Valor Aberto</th>
                                    <th className="p-2.5 text-center">Status</th>
                                    <th className="p-2.5 text-center bg-slate-700">SLA / Aging</th>
                                    <th className="p-2.5 max-w-[200px]">Ocorrências (QPROF)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                  {ced.titulos.sort((a,b) => b.valor_aberto - a.valor_aberto).map(tit => {
                                    
                                    // ⏱️ Lógica de SLA e Aging
                                    const diasSla = calcularDiasSLA(tit.emissao, tit.atualizacao);
                                    const diasAberto = calcularDiasSLA(tit.emissao, dataReferencia);
                                    
                                    let slaText = "-";
                                    let slaClass = "text-slate-400";
                                    
                                    if (tit.status_confirmacao === "Confirmado") {
                                      slaText = diasSla !== null ? `✅ Conf. em ${diasSla} d` : "-";
                                      slaClass = "text-emerald-700 font-bold bg-emerald-50 rounded px-1.5 py-0.5";
                                    } else {
                                      slaText = diasAberto !== null ? `⏳ Pend. há ${diasAberto} d` : "-";
                                      slaClass = (diasAberto && diasAberto > 15) ? "text-rose-700 font-bold bg-rose-50 rounded px-1.5 py-0.5" : "text-amber-700 font-bold bg-amber-50 rounded px-1.5 py-0.5";
                                    }

                                    return (
                                      <tr key={tit.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-2.5 pl-4 font-bold text-slate-800 max-w-[250px] truncate" title={tit.sacado}>{tit.sacado}</td>
                                        <td className="p-2.5 text-center text-slate-500 font-mono">{tit.documento}</td>
                                        <td className="p-2.5 text-center font-mono text-slate-400">{fData(tit.emissao)}</td>
                                        <td className="p-2.5 text-center font-mono">{fData(tit.vencimento)}</td>
                                        <td className="p-2.5 text-right font-mono font-black text-slate-800">{fM(tit.valor_aberto)}</td>
                                        <td className="p-2.5 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-xs tracking-wider ${badgeStatus(tit.status_confirmacao)}`}>
                                            {tit.status_confirmacao}
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-center text-[9px] whitespace-nowrap">
                                          <span className={slaClass}>{slaText}</span>
                                        </td>
                                        <td className="p-2.5 max-w-[200px] truncate text-slate-500 italic text-[10px]" title={tit.ocorrencias}>
                                          {tit.ocorrencias || "-"}
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}