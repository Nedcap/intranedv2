/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { normalizarPelaBaseUniversal, limparNome, BaseUniversal } from "@/lib/normalizador";

// ============================================================================
// 🧽 MOTOR SÍNCRONO DE LIMPEZA E CRUZAMENTO EM MEMÓRIA RAM
// ============================================================================

const strClean = (c: any) => {
  if (!c) return "";
  return String(c)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, ""); 
};

function parseValorReal(valor: any): number {
  if (valor === null || valor === undefined || valor === "") return 0.0;
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
}

function formatarDataExcel(valorData: any): string {
  if (!valorData) return "";
  
  const numVal = Number(valorData);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
    const data = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  const txt = String(valorData).trim();
  if (txt.includes("-")) {
    const partes = txt.split("-");
    if (partes.length === 3 && partes[0].length <= 2) {
      return `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${partes[2].substring(0, 4)}`;
    }
    if (partes.length === 3 && partes[0].length === 4) {
      return `${partes[2].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${partes[0]}`;
    }
  }
  if (txt.includes("/")) {
    const partes = txt.split("/");
    if (partes.length === 3) {
      let y = partes[2].substring(0, 4);
      if (y.length === 2) y = `20${y}`;
      return `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${y}`;
    }
  }
  return txt;
}

function converteDataParaISO(dataStr: string): string {
  const partes = dataStr.split("/");
  if (partes.length === 3) return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
  return new Date().toISOString().split("T")[0];
}

function formatarMesAno(dataStr: string): string {
  const partes = dataStr.split("/");
  if (partes.length === 3) return `${partes[1].padStart(2, '0')}/${partes[2]}`;
  return "";
}

function checarSeVencido(dataStr: string): string {
  if (!dataStr || dataStr === "-") return "A Vencer";
  try {
    const partes = dataStr.split("/");
    if (partes.length !== 3) return "A Vencer";
    const dataTitulo = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]), 12, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return dataTitulo.getTime() < hoje.getTime() ? "Vencido" : "A Vencer";
  } catch {
    return "A Vencer";
  }
}

// ============================================================================
// 🤖 PROCESSADORES BLINDADOS
// ============================================================================

const processarRiscoSec = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "CEDENTE"));
  if (headerIdx === -1) return {};
  
  const header = raw[headerIdx].map(strClean);
  const idxCedente = header.indexOf("CEDENTE");
  const idxLimUti = header.findIndex(c => c === "LIMUTI" || c === "LIMITEUTILIZADO" || c === "RISCO");
  const idxVencidos = header.findIndex(c => c === "VENCIDOS" || c === "VENCIDO");
  
  const records: any = {};
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxCedente]) continue;

    const rawCed = String(row[idxCedente]).trim();
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;
    
    const chave = normalizarPelaBaseUniversal(rawCed, null, base);
    if (!chave) continue;

    records[chave] = {
      cedenteOriginal: rawCed,
      risco: parseValorReal(row[idxLimUti]),
      vencido: parseValorReal(row[idxVencidos])
    };
  }
  return records;
};

const processarRiscoFidc = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "CLIENTE" || strClean(cell) === "CNPJCPF"));
  if (headerIdx === -1) return {};
  
  const header = raw[headerIdx].map(strClean);
  const idxCliente = header.indexOf("CLIENTE");
  const idxUtilizado = header.indexOf("UTILIZADO"); 
  const idxVencido = header.indexOf("VENCIDO");

  const records: any = {};
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxCliente]) continue;

    const rawCed = String(row[idxCliente]).trim();
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;

    const chave = normalizarPelaBaseUniversal(rawCed, null, base);
    if (!chave) continue;

    records[chave] = {
      cedenteOriginal: rawCed,
      risco: parseValorReal(row[idxUtilizado]),
      vencido: parseValorReal(row[idxVencido])
    };
  }
  return records;
};

const processarVopSec = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "CEDENTE" || strClean(cell) === "CPFCNPJ"));
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(strClean);
  const idxCedente = header.indexOf("CEDENTE");
  const idxCnpj = header.findIndex(c => c.includes("CPFCNPJ") || c === "CNPJ");
  const idxData = header.findIndex(c => c === "DTANEG" || c === "DATANEGOCIACAO" || c === "DATA");
  const idxValor = header.findIndex(c => c === "VLRAPROVADO" || c === "VALORAPROVADO" || c === "VLRFACE");

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxCedente]) continue;
    
    const rawCed = String(row[idxCedente]).trim();
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL") || rawCed.toUpperCase() === "CEDENTE") continue;
    
    let rawCnpj = null;
    if (idxCnpj !== -1 && row[idxCnpj]) {
      rawCnpj = String(row[idxCnpj]).replace(/\D/g, "");
    }
    
    const dataOp = formatarDataExcel(row[idxData]);
    const mesAno = formatarMesAno(dataOp);
    const valor = parseValorReal(row[idxValor]);
    
    if (valor > 0) {
      lancamentos.push({ empresa: "SEC", dataOp, mesAno, cedenteOriginal: rawCed, cnpj: rawCnpj, vop: valor, desagio: 0, tarifas: 0, juros: 0 });
    }
  }
  return lancamentos;
};

const processarVopFidc = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "NOMEDOCEDENTE" || strClean(cell) === "CEDENTE"));
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(strClean);
  const idxCedente = header.indexOf("NOMEDOCEDENTE");
  const idxCnpj = header.findIndex(c => c.includes("CNPJ"));
  const idxData = header.findIndex(c => c === "DATADAOPERACAO" || c === "DATAOPER");
  const idxValor = header.indexOf("VALORFACE");
  const idxStatus = header.indexOf("STATUSDAOPERACAO"); 

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxCedente]) continue;
    
    const rawCed = String(row[idxCedente]).trim();
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;
    
    if (idxStatus !== -1) {
      const statusOp = String(row[idxStatus]).trim().toUpperCase();
      if (statusOp !== "FECHADA") continue;
    }

    let rawCnpj = null;
    if (idxCnpj !== -1 && row[idxCnpj]) {
      rawCnpj = String(row[idxCnpj]).replace(/\D/g, "");
    }
    
    const dataOp = idxData !== -1 ? formatarDataExcel(row[idxData]) : "-";
    const mesAno = formatarMesAno(dataOp);
    const valor = parseValorReal(row[idxValor]);
    
    if (valor > 0) {
      lancamentos.push({ empresa: "FIDC", dataOp, mesAno, cedenteOriginal: rawCed, cnpj: rawCnpj, vop: valor, desagio: 0, tarifas: 0, juros: 0 });
    }
  }
  return lancamentos;
};

const processarReceitasSec = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "ADITIVO"));
  if (headerIdx === -1) return [];

  const header = raw[headerIdx].map(strClean);
  const idxAditivo = header.indexOf("ADITIVO");
  const idxCliente = header.findIndex(c => c === "CLIENTE" || c === "CEDENTE");
  const idxDesagio = header.indexOf("DIFERENCIAL"); 
  const idxTaxa = header.indexOf("TAXASERVICO");
  const idxDespesa = header.indexOf("DESPESAS");

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxAditivo]) continue;

    let aditivo = String(row[idxAditivo]).trim();
    if (aditivo.endsWith(".0")) aditivo = aditivo.slice(0, -2);

    if (aditivo.length >= 6 && /^\d+$/.test(aditivo)) {
      const yy = aditivo.substring(0, 2);
      const mm = aditivo.substring(2, 4);
      const dd = aditivo.substring(4, 6);

      if (parseInt(mm) >= 1 && parseInt(mm) <= 12 && parseInt(dd) >= 1 && parseInt(dd) <= 31) {
        const dataOp = `${dd}/${mm}/20${yy}`;
        const mesAno = `${mm}/20${yy}`;
        
        let rawCed = String(row[idxCliente] || "").trim();
        if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;

        rawCed = rawCed.replace(/^\d+\s*-\s*/, "").trim();

        const desagio = idxDesagio !== -1 ? parseValorReal(row[idxDesagio]) : 0;
        let tarifas = 0;
        if (idxTaxa !== -1) tarifas += parseValorReal(row[idxTaxa]);
        if (idxDespesa !== -1) tarifas += parseValorReal(row[idxDespesa]);

        if (desagio > 0 || tarifas > 0) {
          lancamentos.push({ empresa: "SEC", dataOp, mesAno, cedenteOriginal: rawCed, cnpj: null, vop: 0, desagio, tarifas, juros: 0 });
        }
      }
    }
  }
  return lancamentos;
};

const processarReceitasFidc = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "NOMEDOCEDENTE" || strClean(cell) === "CEDENTE"));
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(strClean);
  const idxCedente = header.indexOf("NOMEDOCEDENTE");
  const idxCnpj = header.findIndex(c => c.includes("CNPJ"));
  const idxData = header.findIndex(c => c === "DATADAOPERACAO" || c === "DATAOPER");
  const idxStatus = header.indexOf("STATUSDAOPERACAO");
  
  const idxDesagio = header.indexOf("DESAGIO");
  const idxDespesaOp = header.indexOf("DESPESAOPERACAO");
  const idxDespesaRec = header.indexOf("DESPESARECEBIVEL");
  const idxDespesaSac = header.indexOf("DESPESASACADO");

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxCedente]) continue;
    
    const rawCed = String(row[idxCedente]).trim();
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;
    
    if (idxStatus !== -1) {
      const statusOp = String(row[idxStatus]).trim().toUpperCase();
      if (statusOp !== "FECHADA") continue;
    }

    let rawCnpj = null;
    if (idxCnpj !== -1 && row[idxCnpj]) {
      rawCnpj = String(row[idxCnpj]).replace(/\D/g, "");
    }
    
    const dataOp = idxData !== -1 ? formatarDataExcel(row[idxData]) : "-";
    const mesAno = formatarMesAno(dataOp);
    const desagio = idxDesagio !== -1 ? parseValorReal(row[idxDesagio]) : 0;
    
    let tarifasConsolidadas = 0;
    if (idxDespesaOp !== -1) tarifasConsolidadas += parseValorReal(row[idxDespesaOp]);
    if (idxDespesaRec !== -1) tarifasConsolidadas += parseValorReal(row[idxDespesaRec]);
    if (idxDespesaSac !== -1) tarifasConsolidadas += parseValorReal(row[idxDespesaSac]);

    if (desagio > 0 || tarifasConsolidadas > 0) {
      lancamentos.push({ empresa: "FIDC", dataOp, mesAno, cedenteOriginal: rawCed, cnpj: rawCnpj, vop: 0, desagio, tarifas: tarifasConsolidadas, juros: 0 });
    }
  }
  return lancamentos;
};

const processarCampoLiquidadosSec = (raw: any[][], base: BaseUniversal[]) => {
  let colDtaBaixa = 12;
  let colEncargos = 15;

  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const rowStr = raw[i].map(x => strClean(x));
    if (rowStr.includes("DTABAIXA") || rowStr.includes("DATABAIXA")) {
      colDtaBaixa = rowStr.findIndex(x => x.includes("DTABAIXA") || x.includes("DATABAIXA"));
      colEncargos = rowStr.findIndex(x => x.includes("ENCARGOS"));
      break;
    }
  }

  const lancamentos: any[] = [];
  let currentCedente = "";

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row.find(cell => cell !== null && cell !== undefined && String(cell).trim() !== "") || "").trim();

    if (/^\d+\s*-/.test(firstCell)) { 
      currentCedente = firstCell.replace(/^\d+\s*-\s*/, "").trim(); 
      continue; 
    }

    const linhaTexto = row.map(x => String(x).toUpperCase()).join(" ");
    if (linhaTexto.includes("TOTAL") || linhaTexto.includes("MODALIDADE") || linhaTexto.includes("PÁG") || linhaTexto.includes("SACADO")) continue;

    const valorDataBruto = row[colDtaBaixa];
    const valorEncargoBruto = row[colEncargos];

    if (currentCedente && valorDataBruto && valorEncargoBruto) {
      const encargos = parseValorReal(valorEncargoBruto);
      if (encargos > 0) {
        const valStr = String(valorDataBruto).toUpperCase();
        if (!valStr.includes("BAIXA") && !valStr.includes("DATA")) {
          const dataOp = formatarDataExcel(valorDataBruto);
          const mesAno = formatarMesAno(dataOp);
          if (dataOp && mesAno) {
            lancamentos.push({ empresa: "SEC", dataOp, mesAno, cedenteOriginal: currentCedente, cnpj: null, vop: 0, desagio: 0, tarifas: 0, juros: encargos });
          }
        }
      }
    }
  }
  return lancamentos;
};

const processarCarteiraSec = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "CEDENTE"));
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(strClean);
  const idxCedente = header.indexOf("CEDENTE");
  const idxSacado = header.indexOf("SACADO");
  
  const idxNumTitulo = header.findIndex(c => c === "SNUM" || c === "SEQTIT" || c === "NOSSONUM");
  const idxVencimento = header.findIndex(c => c === "DTAVCTO" || c === "VENCIMENTO");
  const idxValorFace = header.findIndex(c => c === "VLRFACE" || c === "VALORFACE");
  const idxValorAberto = header.findIndex(c => c === "VLRABERTO" || c === "VALORABERTO");

  const titulos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[idxCedente]) continue;
    
    const cedente = String(row[idxCedente]).trim();
    if (!cedente || cedente.toUpperCase().includes("TOTAL") || cedente.toUpperCase() === "CEDENTE") continue;
    
    const cedenteNormalizado = limparNome(cedente);
    if (!cedenteNormalizado) continue;

    const sacado = String(row[idxSacado] || "").trim();
    const numeroTitulo = idxNumTitulo !== -1 ? String(row[idxNumTitulo] || "").trim() : "-";
    const vencimento = idxVencimento !== -1 ? formatarDataExcel(row[idxVencimento]) : "-";
    const valorFace = idxValorFace !== -1 ? parseValorReal(row[idxValorFace]) : 0;
    const valorAberto = idxValorAberto !== -1 ? parseValorReal(row[idxValorAberto]) : 0;
    const status = checarSeVencido(vencimento);

    if (valorAberto > 0) {
      titulos.push({ cedente: cedenteNormalizado, sacado: sacado.toUpperCase(), numero_titulo: numeroTitulo, vencimento: converteDataParaISO(vencimento), valor_face: valorFace, valor_aberto: valorAberto, status });
    }
  }
  return titulos;
};

const processarCarteiraFidc = (raw: any[][], base: BaseUniversal[]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => strClean(cell) === "NOMEDOCEDENTE" || strClean(cell) === "CEDENTE"));
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(strClean);
  const idxCedente = header.findIndex(c => c === "NOMEDOCEDENTE" || c === "CEDENTE");
  const idxSacado = header.findIndex(c => c === "NOMEDOSACADO" || c === "SACADO");
  
  const idxVencimento = header.findIndex(c => c === "DATADEVENCIMENTOATUALIZADA" || c === "DATADEVENCIMENTOORIGINAL" || c === "VENCIMENTO");
  const idxValorFace = header.findIndex(c => c === "VALORFACE" || c === "FACE");
  const idxValorAberto = header.findIndex(c => c === "VALORABERTO" || c === "ABERTO");

  const titulos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]; 
    if (!row || !row[idxCedente]) continue;

    const cedente = String(row[idxCedente]).trim();
    if (!cedente || cedente.toUpperCase().includes("TOTAL")) continue;
    
    const cedenteNormalizado = limparNome(cedente);
    if (!cedenteNormalizado) continue;

    const sacado = String(row[idxSacado] || "").trim();
    const vencimento = idxVencimento !== -1 ? formatarDataExcel(row[idxVencimento]) : "-";
    const valorFace = idxValorFace !== -1 ? parseValorReal(row[idxValorFace]) : 0;
    const valorAberto = idxValorAberto !== -1 ? parseValorReal(row[idxValorAberto]) : 0;
    const status = checarSeVencido(vencimento);

    if (valorAberto > 0) {
      titulos.push({ cedente: cedenteNormalizado, sacado: sacado.toUpperCase(), vencimento: converteDataParaISO(vencimento), valor_face: valorFace, valor_aberto: valorAberto, status });
    }
  }
  return titulos;
};

// ============================================================================
// 📊 COMPONENTE VISUAL PRINCIPAL
// ============================================================================
export default function ImportacaoPage() {
  const [baseUniversalData, setBaseUniversalData] = useState<BaseUniversal[]>([]);
  const [dadosFinais, setDadosFinais] = useState<any>({
    risco: { sec: null, fidc: null },
    vop: { sec: [], fidc: [] },
    receitas: { sec: [], fidc: [] },
    juros: { sec: [], fidc: [] },
    carteira: { sec: [], fidc: [] }
  });

  const [processando, setProcessando] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const carregarBase = async () => {
      setStatusMsg("📦 Baixando Base Universal de Cedentes na memória RAM...");
      const { data, error } = await supabase.from("base_universal_cedentes").select("*");
      if (error) {
        console.error(error);
        setStatusMsg("❌ Erro ao baixar Base Universal.");
      } else if (data) {
        setBaseUniversalData(data);
        setStatusMsg(`✅ Base Universal pronta: ${data.length} empresas carregadas na memória.`);
        setTimeout(() => setStatusMsg(""), 3000);
      }
    };
    carregarBase();
  }, []);

  const lerArquivoExcel = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (file.name.toLowerCase().endsWith(".csv")) {
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length === 0) return resolve([]);
            let separador = ";";
            if (!lines[0].includes(";") && lines[0].includes(",")) separador = ",";
            const rows = lines.map(line => line.split(separador).map(cell => { let c = cell.trim(); return (c.startsWith('"') && c.endsWith('"')) ? c.slice(1, -1) : c; }));
            resolve(rows);
          } catch (error) { reject(error); }
        };
        reader.readAsText(file, "ISO-8859-1");
      } else {
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: "array" });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" }));
          } catch (error) { reject(error); }
        };
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, tipo: string, empresa: "sec" | "fidc") => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessando(true);
    setStatusMsg(`Lendo e cruzando com Base Universal: ${file.name}...`);
    
    try {
      const rawData = await lerArquivoExcel(file);
      let dadosMapeados: any = null;

      if (tipo === "risco") dadosMapeados = empresa === "sec" ? processarRiscoSec(rawData, baseUniversalData) : processarRiscoFidc(rawData, baseUniversalData);
      else if (tipo === "vop") dadosMapeados = empresa === "sec" ? processarVopSec(rawData, baseUniversalData) : processarVopFidc(rawData, baseUniversalData);
      else if (tipo === "receitas") dadosMapeados = empresa === "sec" ? processarReceitasSec(rawData, baseUniversalData) : processarReceitasFidc(rawData, baseUniversalData);
      else if (tipo === "juros") dadosMapeados = empresa === "sec" ? processarCampoLiquidadosSec(rawData, baseUniversalData) : [];
      else if (tipo === "carteira") dadosMapeados = empresa === "sec" ? processarCarteiraSec(rawData, baseUniversalData) : processarCarteiraFidc(rawData, baseUniversalData);

      // 🎯 FIX: Deep copy para atualizar o estado do React corretamente nos nós profundos
      setDadosFinais((prev: any) => {
        const atualizado = JSON.parse(JSON.stringify(prev));
        atualizado[tipo][empresa] = dadosMapeados;
        return atualizado;
      });
      setStatusMsg(`✅ Processamento instantâneo concluído em ${file.name}!`);
    } catch (error) { 
      alert(`Erro ao ler e normalizar o arquivo ${file.name}.`); 
    } finally { 
      setProcessando(false); 
      event.target.value = ""; 
    }
  };

  const dispararProSupabase = async () => {
    setProcessando(true);
    setStatusMsg("🚀 Consolidando e Transmitindo dados para o Supabase V2...");
    try {
      
      // ========================================================================
      // 1. GRAVAR RISCO (DASH CARTEIRA)
      // ========================================================================
      const { data: dbCarteira } = await supabase.from('dash_carteira').select('*');
      const carteiraMap = new Map();
      dbCarteira?.forEach(row => carteiraMap.set(row.cedente, row));

      for (const [chave, val] of Object.entries(dadosFinais.risco.sec || {}) as any) {
        const existente = carteiraMap.get(chave) || { risco_fidc: 0, vencido_fidc: 0 };
        carteiraMap.set(chave, { ...existente, cedente: chave, risco_sec: val.risco, vencido_sec: val.vencido });
      }
      for (const [chave, val] of Object.entries(dadosFinais.risco.fidc || {}) as any) {
        const existente = carteiraMap.get(chave) || { risco_sec: 0, vencido_sec: 0 };
        carteiraMap.set(chave, { ...existente, cedente: chave, risco_fidc: val.risco, vencido_fidc: val.vencido });
      }

      const carteiraPayload = Array.from(carteiraMap.values()).map((row: any) => ({
        cedente: row.cedente,
        risco_sec: row.risco_sec || 0,
        vencido_sec: row.vencido_sec || 0,
        risco_fidc: row.risco_fidc || 0,
        vencido_fidc: row.vencido_fidc || 0,
        risco_consolidado: (row.risco_sec || 0) + (row.risco_fidc || 0),
        vencido_consolidado: (row.vencido_sec || 0) + (row.vencido_fidc || 0),
        atualizado_em: new Date().toISOString()
      }));

      if (carteiraPayload.length > 0) {
        const chunk = 500;
        for (let i = 0; i < carteiraPayload.length; i += chunk) {
          await supabase.from("dash_carteira").upsert(carteiraPayload.slice(i, i + chunk), { onConflict: "cedente" });
        }
      }

      // ========================================================================
      // 2. GRAVAR EXTRATO FINANCEIRO E AGREGAR DASH VOP (COM LIMPEZA INTELIGENTE)
      // ========================================================================
      const loteFinancas: any[] = [];
      const mesclarLancamento = (item: any) => {
        const cedenteFinalNormalizado = normalizarPelaBaseUniversal(item.cedenteOriginal, item.cnpj || null, baseUniversalData);
        if (!cedenteFinalNormalizado) return;
        loteFinancas.push({
          empresa: item.empresa,
          data_operacao: converteDataParaISO(item.dataOp),
          mes_ano: item.mesAno,
          cedente: cedenteFinalNormalizado,
          vop: item.vop || 0,
          desagio: item.desagio || 0,
          tarifas: item.tarifas || 0,
          juros: item.juros || 0
        });
      };

      for (const item of dadosFinais.vop.sec) mesclarLancamento(item);
      for (const item of dadosFinais.vop.fidc) mesclarLancamento(item);
      for (const item of dadosFinais.receitas.sec) mesclarLancamento(item);
      for (const item of dadosFinais.receitas.fidc) mesclarLancamento(item);
      for (const item of dadosFinais.juros.sec) mesclarLancamento(item);

      if (loteFinancas.length > 0) {
        // 🎯 FIX 1: Limpeza cirúrgica do extrato por cedente
        const periodosCedentes = new Set(loteFinancas.map(i => `${i.empresa}|${i.mes_ano}|${i.cedente}`));

        for (const pc of periodosCedentes) {
          const [empresa, mes_ano, cedente] = pc.split("|");
          await supabase.from("extrato_financeiro")
            .delete()
            .eq("empresa", empresa)
            .eq("mes_ano", mes_ano)
            .eq("cedente", cedente);
        }

        const chunkFinancas = 500;
        for (let i = 0; i < loteFinancas.length; i += chunkFinancas) {
          const { error: errExtrato } = await supabase.from("extrato_financeiro").insert(loteFinancas.slice(i, i + chunkFinancas));
          if (errExtrato) throw errExtrato;
        }

        // 🎯 FIX 2: Nova agregação matemática para dash_vop prevenindo zeramento incorreto
        const { data: dbVop } = await supabase.from('dash_vop').select('*');
        const vopMap = new Map();
        
        dbVop?.forEach(row => {
          const key = `${row.mes_ano}_${row.cedente}`;
          vopMap.set(key, { ...row });
        });

        // Zera apenas os cedentes afetados por essa atualização
        for (const pc of periodosCedentes) {
          const [empresa, mes_ano, cedente] = pc.split("|");
          const key = `${mes_ano}_${cedente}`;
          if (vopMap.has(key)) {
            if (empresa === 'SEC') vopMap.get(key).vop_sec = 0;
            if (empresa === 'FIDC') vopMap.get(key).vop_fidc = 0;
          }
        }

        // Soma os novos dados
        loteFinancas.forEach(item => {
          if (item.vop > 0) {
            const key = `${item.mes_ano}_${item.cedente}`;
            if (!vopMap.has(key)) {
              vopMap.set(key, { mes_ano: item.mes_ano, cedente: item.cedente, vop_sec: 0, vop_fidc: 0 });
            }
            const obj = vopMap.get(key);
            if (item.empresa === 'SEC') obj.vop_sec += item.vop;
            if (item.empresa === 'FIDC') obj.vop_fidc += item.vop;
          }
        });

        const vopPayload = Array.from(vopMap.values()).map((v: any) => ({
          mes_ano: v.mes_ano,
          cedente: v.cedente,
          vop_sec: v.vop_sec || 0,
          vop_fidc: v.vop_fidc || 0,
          vop_consolidado: (v.vop_sec || 0) + (v.vop_fidc || 0),
          atualizado_em: new Date().toISOString()
        }));

        const chunkVop = 500;
        for (let i = 0; i < vopPayload.length; i += chunkVop) {
          const { error: errVop } = await supabase.from("dash_vop").upsert(vopPayload.slice(i, i + chunkVop), { onConflict: "mes_ano,cedente" });
          if (errVop) throw errVop;
        }
      }

      // ========================================================================
      // 3. GRAVAR CARTEIRA DETALHADA EM ABERTO (FOTOS DIÁRIAS)
      // ========================================================================
      
      // 🎯 FIX 3: Delete cirúrgico da carteira apenas dos cedentes importados
      if (dadosFinais.carteira.sec.length > 0) {
        const cedentesSec = [...new Set(dadosFinais.carteira.sec.map((c: any) => c.cedente))];
        
        await supabase.from("carteira_sec").delete().in("cedente", cedentesSec);
        
        const chunk = 500;
        for (let i = 0; i < dadosFinais.carteira.sec.length; i += chunk) {
          await supabase.from("carteira_sec").insert(dadosFinais.carteira.sec.slice(i, i + chunk));
        }
      }

      if (dadosFinais.carteira.fidc.length > 0) {
        const cedentesFidc = [...new Set(dadosFinais.carteira.fidc.map((c: any) => c.cedente))];
        
        await supabase.from("carteira_fidc").delete().in("cedente", cedentesFidc);
        
        const chunk = 500;
        for (let i = 0; i < dadosFinais.carteira.fidc.length; i += chunk) {
          await supabase.from("carteira_fidc").insert(dadosFinais.carteira.fidc.slice(i, i + chunk));
        }
      }

      setStatusMsg("✅ Sincronização e recálculo finalizados com sucesso!");
      setDadosFinais({ risco: { sec: null, fidc: null }, vop: { sec: [], fidc: [] }, receitas: { sec: [], fidc: [] }, juros: { sec: [], fidc: [] }, carteira: { sec: [], fidc: [] }});
    } catch (err: any) {
      alert(`❌ Erro no envio direto: ${err.message}`);
    } finally { setProcessando(false); }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">📥 Central de Importação de Relatórios (Motor Síncrono Universal)</h2>
          <span className="text-xs text-slate-500 font-medium">Cruzamento instantâneo via MDM (Master Data Management).</span>
        </div>
        <button 
          onClick={dispararProSupabase}
          disabled={processando || baseUniversalData.length === 0}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          {processando ? "⏳ Processando..." : "☁️ Enviar para o Banco Central"}
        </button>
      </div>

      {statusMsg && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg font-bold text-center animate-pulse">{statusMsg}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bloco 1 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">1</span>
            Risco e Vencidos (Consolidação de Carteira)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-blue-700 block uppercase">1.1 Securitizadora</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">Qprof ➔ Relatórios ➔ Limites e checagem</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "risco", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              {dadosFinais.risco.sec && Object.keys(dadosFinais.risco.sec).length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-blue-700 block uppercase">1.2 FIDC</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">Black101 ➔ Relatórios ➔ Operação ➔ Risco Cedente</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "risco", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              {dadosFinais.risco.fidc && Object.keys(dadosFinais.risco.fidc).length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
          </div>
        </div>

        {/* Bloco 2 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">2</span>
            Valores Operados (VOP Realizado)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-indigo-700 block uppercase">2.1 Securitizadora</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">Qprof ➔ Operações ➔ Consulta | Pago</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "vop", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              {dadosFinais.vop.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-indigo-700 block uppercase">2.2 FIDC</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">Black101 ➔ Operações ➔ Status "Fechada"</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "vop", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              {dadosFinais.vop.fidc.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
          </div>
        </div>

        {/* Bloco 3 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">3</span>
            Receitas (Deságio e Tarifas)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-emerald-700 block uppercase">3.1 Securitizadora</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">Qprof ➔ Negócios Realizados por Data</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "receitas", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
              {dadosFinais.receitas.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-emerald-700 block uppercase">3.2 FIDC</span>
              <p className="text-[11px] mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-emerald-100 font-mono font-bold text-emerald-800">⚠️ Importe o MESMO relatório extraído no passo 2.2</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "receitas", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
              {dadosFinais.receitas.fidc.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
          </div>
        </div>

        {/* Bloco 4 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-amber-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">4</span>
            Posição Liquidados (Juros de Atraso)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div><span className="text-[11px] font-black text-amber-700 block uppercase">4.1 Securitizadora</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">Qprof ➔ Relatórios ➔ Posição Liquidados</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "juros", "sec")} className="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
              {dadosFinais.juros.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px] opacity-60 grayscale cursor-not-allowed">
              <div><span className="text-[11px] font-black text-slate-400 block uppercase">4.2 FIDC</span>
              <p className="text-[11px] text-slate-400 mt-1 mb-3 bg-slate-100 p-1.5 rounded border border-slate-200 font-mono">⏳ Mapeamento em Breve</p></div>
              <input type="file" disabled className="w-full text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100" />
            </div>
          </div>
        </div>

        {/* Bloco 5 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 xl:col-span-2">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-purple-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">5</span>
            Carteira Aberta Detalhada (Concentração Cedente x Sacado)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[150px]">
              <div><span className="text-[11px] font-black text-purple-700 block uppercase">5.1 Carteira Securitizadora</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono leading-relaxed">Qprof ➔ Cobrança Consolidada ➔ Ctrl+Alt+Click para exportar</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "carteira", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
              {dadosFinais.carteira.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[150px]">
              <div><span className="text-[11px] font-black text-purple-700 block uppercase">5.2 Carteira FIDC</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono leading-relaxed">Black101 ➔ Operações ➔ Recebíveis ➔ Aberto ➔ Download</p></div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "carteira", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
              {dadosFinais.carteira.fidc.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs">Mapeado</span>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}