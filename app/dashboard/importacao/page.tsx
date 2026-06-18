/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 FUNÇÕES DE LIMPEZA MATADORA E NORMALIZAÇÃO VIA API/SQLITE
// ============================================================================

// 🚀 NOSSA ARMA SECRETA: O Dicionário de Cache
// Isso evita que o sistema faça milhares de requisições repetidas para a mesma empresa.
const cacheNormalizacao = new Map<string, string>();

function limparNome(texto: any): string {
  if (!texto) return "";
  let n = String(texto).toUpperCase().trim();
  n = n.replace(/^\d+\s*-\s*/, ""); 
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
  n = n.replace(/[^A-Z0-9\s]/g, " "); 
  n = n.replace(/\b(LTDA|SA|S A|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, ""); 
  return n.replace(/\s+/g, " ").trim();
}

/**
 * 🔥 MOTOR DE NORMALIZAÇÃO GLOBAL OTIMIZADO:
 * Agora ele checa a memória RAM antes de incomodar a API do Bot.
 */
async function normalizarNomeCedenteGlobal(nomeBruto: string): Promise<string> {
  const nomeTratadoLocal = limparNome(nomeBruto);
  if (!nomeTratadoLocal) return "";

  // 1. CHECAGEM DE CACHE: Se já pesquisamos essa empresa hoje, devolve na hora!
  if (cacheNormalizacao.has(nomeTratadoLocal)) {
    return cacheNormalizacao.get(nomeTratadoLocal)!;
  }

  // 2. Não achou no cache? Vai na API buscar a verdade absoluta
  try {
    const res = await fetch(`http://localhost:5000/api/prospeccao?query=${encodeURIComponent(nomeTratadoLocal)}`);
    if (res.ok) {
      const dadosBot = await res.json();
      if (dadosBot && dadosBot.razaoSocial) {
        const nomeFinal = limparNome(dadosBot.razaoSocial);
        cacheNormalizacao.set(nomeTratadoLocal, nomeFinal); // Salva no dicionário para a próxima!
        return nomeFinal;
      }
    }
  } catch (err) {
    console.warn(`API Local offline ou falha para: ${nomeTratadoLocal}. Usando fallback.`);
  }

  // 3. Fallback Seguro: Se a API falhar ou não achar, salva o nome limpo no cache e segue o jogo
  cacheNormalizacao.set(nomeTratadoLocal, nomeTratadoLocal);
  return nomeTratadoLocal;
}

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
  if (typeof valorData === "number" && valorData > 30000 && valorData < 60000) {
    const data = new Date(Math.round((valorData - 25569) * 86400 * 1000));
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
// 🤖 MOTORES DE LEITURA ESPECÍFICOS
// ============================================================================
const processarRiscoSec = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => String(cell).trim().toUpperCase() === "CEDENTE"));
  if (headerIdx === -1) return {};
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().replace(/[^A-Z]/g, ""));
  const idxCedente = header.indexOf("CEDENTE");
  const idxLimUti = header.findIndex(c => c.includes("LIMUTI") || c.includes("RISCO"));
  const idxVencidos = header.findIndex(c => c.includes("VENCIDOS"));
  
  const records: any = {};
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCedente] || "");
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;
    
    const chave = await normalizarNomeCedenteGlobal(rawCed);
    if (!chave) continue;

    records[chave] = {
      cedenteOriginal: rawCed.trim(),
      risco: parseValorReal(row[idxLimUti]),
      vencido: parseValorReal(row[idxVencidos])
    };
  }
  return records;
};

const processarRiscoFidc = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => String(cell).trim().toUpperCase() === "CLIENTE"));
  if (headerIdx === -1) return {};
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z]/g, ""));
  const idxCliente = header.indexOf("CLIENTE");
  const idxUtilizado = header.indexOf("UTILIZADO");
  const idxVencido = header.indexOf("VENCIDO");

  const records: any = {};
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCliente] || "");
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;

    const chave = await normalizarNomeCedenteGlobal(rawCed);
    if (!chave) continue;

    records[chave] = {
      cedenteOriginal: rawCed.trim(),
      risco: parseValorReal(row[idxUtilizado]),
      vencido: parseValorReal(row[idxVencido])
    };
  }
  return records;
};

const processarVopSec = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => String(cell).trim().toUpperCase() === "CEDENTE"));
  if (headerIdx === -1) return [];
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z]/g, ""));
  const idxCedente = header.indexOf("CEDENTE");
  const idxData = header.findIndex(c => c.includes("DTA") || c.includes("DATA"));
  const idxValor = header.findIndex(c => c.includes("APROVADO") || c.includes("VLRAPROV"));

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCedente] || "");
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL") || rawCed.toUpperCase() === "CEDENTE") continue;
    
    const dataOp = formatarDataExcel(row[idxData]);
    const mesAno = formatarMesAno(dataOp);
    const valor = parseValorReal(row[idxValor]);
    if (valor > 0) {
      lancamentos.push({ empresa: "SEC", dataOp, mesAno, cedenteOriginal: rawCed.trim(), vop: valor, desagio: 0, tarifas: 0, juros: 0 });
    }
  }
  return lancamentos;
};

const processarVopFidc = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => { const c = String(cell).trim().toUpperCase(); return c === "CEDENTE" || c === "NOME DO CEDENTE" || c === "CLIENTE"; }));
  if (headerIdx === -1) return [];
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s]/g, ""));
  const idxCedente = header.findIndex(c => c === "CEDENTE" || c.includes("NOME DO CEDENTE") || c === "CLIENTE");
  const idxData = header.findIndex(c => c.includes("DATA DA OPER") || c.includes("DATA OPER") || c === "DATA");
  const idxValor = header.findIndex(c => c.includes("VALOR FACE") || c.includes("FACE") || c.includes("VALOR"));

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCedente] || "");
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;
    
    const dataOp = idxData !== -1 ? formatarDataExcel(row[idxData]) : "-";
    const mesAno = formatarMesAno(dataOp);
    const valor = parseValorReal(row[idxValor]);
    if (valor > 0) {
      lancamentos.push({ empresa: "FIDC", dataOp, mesAno, cedenteOriginal: rawCed.trim(), vop: valor, desagio: 0, tarifas: 0, juros: 0 });
    }
  }
  return lancamentos;
};

const processarReceitasSec = async (raw: any[][]) => {
  const lancamentos: any[] = [];
  for (const row of raw) {
    let aditivo = String(row[0] || "").trim();
    if (aditivo.endsWith(".0")) aditivo = aditivo.slice(0, -2);
    if (aditivo.length === 10 && /^\d+$/.test(aditivo)) {
      const yy = aditivo.substring(0, 2); const mm = aditivo.substring(2, 4); const dd = aditivo.substring(4, 6);
      if (parseInt(mm) >= 1 && parseInt(mm) <= 12 && parseInt(dd) >= 1 && parseInt(dd) <= 31) {
        const dataOp = `${dd}/${mm}/20${yy}`;
        const mesAno = `${mm}/20${yy}`;
        const rawCed = String(row[5] || "").trim();
        if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL") || rawCed.toUpperCase() === "CLIENTE") continue;
        const desagio = parseValorReal(row[12]);
        const tarifas = parseValorReal(row[14]);
        lancamentos.push({ empresa: "SEC", dataOp, mesAno, cedenteOriginal: rawCed, vop: 0, desagio, tarifas, juros: 0 });
      }
    }
  }
  return lancamentos;
};

const processarReceitasFidc = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => { const c = String(cell).trim().toUpperCase(); return c === "CEDENTE" || c === "NOME DO CEDENTE" || c === "CLIENTE"; }));
  if (headerIdx === -1) return [];
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s]/g, ""));
  const idxCedente = header.findIndex(c => c === "CEDENTE" || c.includes("NOME DO CEDENTE") || c === "CLIENTE");
  const idxData = header.findIndex(c => c.includes("DATA DA OPER") || c.includes("DATA OPER") || c === "DATA");
  const idxDesagio = header.findIndex(c => c === "DESAGIO" || c.includes("VALOR DESAGIO") || c.includes("DESCONTO"));
  
  const indicesTarifas = header.reduce((acc: number[], col, idx) => {
    if (col.includes("DESPESA") || col.includes("TARIFA") || col.includes("TAXA") || col.includes("SVALORTAR") || col.includes("SVALORDESP")) acc.push(idx);
    return acc;
  }, []);

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCedente] || "");
    if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL")) continue;
    
    const dataOp = idxData !== -1 ? formatarDataExcel(row[idxData]) : "-";
    const mesAno = formatarMesAno(dataOp);
    const desagio = parseValorReal(row[idxDesagio]);
    
    let tarifasConsolidadas = 0;
    indicesTarifas.forEach(idxCol => { if (idxCol !== idxDesagio) tarifasConsolidadas += parseValorReal(row[idxCol]); });

    if (desagio > 0 || tarifasConsolidadas > 0) {
      lancamentos.push({ empresa: "FIDC", dataOp, mesAno, cedenteOriginal: rawCed.trim(), vop: 0, desagio, tarifas: tarifasConsolidadas, juros: 0 });
    }
  }
  return lancamentos;
};

const processarCampoLiquidadosSec = async (raw: any[][]) => {
  let colDtaBaixa = 12; let colEncargos = 15;
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const rowStr = raw[i].map(x => String(x).trim().toUpperCase());
    if (rowStr.includes("DTA BAIXA") || rowStr.includes("DATA BAIXA")) {
      colDtaBaixa = rowStr.findIndex(x => x.includes("DTA BAIXA") || x.includes("DATA BAIXA"));
      colEncargos = rowStr.findIndex(x => x.includes("ENCARGOS"));
      break;
    }
  }
  const lancamentos: any[] = [];
  let currentCedente = "";
  for (const row of raw) {
    const c0 = String(row[0] || "").trim();
    if (/^\d+\s*-/.test(c0) && (!row[1] || String(row[1]).trim() === "")) { currentCedente = c0.replace(/^\d+\s*-\s*/, "").trim(); continue; }
    if (row.map(x => String(x).toUpperCase()).join(" ").includes("TOTAL")) continue;
    const valorDataBruto = row[colDtaBaixa]; const valorEncargoBruto = row[colEncargos];
    if (currentCedente && valorDataBruto && valorEncargoBruto) {
      const encargos = parseValorReal(valorEncargoBruto);
      if (encargos > 0) {
        const valStr = String(valorDataBruto).toUpperCase();
        if (!valStr.includes("BAIXA") && !valStr.includes("NORMAL")) {
          const dataOp = formatarDataExcel(valorDataBruto);
          const mesAno = formatarMesAno(dataOp);
          if (dataOp) lancamentos.push({ empresa: "SEC", dataOp, mesAno, cedenteOriginal: currentCedente, vop: 0, desagio: 0, tarifas: 0, juros: encargos });
        }
      }
    }
  }
  return lancamentos;
};

const processarCarteiraSec = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => { const c = String(cell).trim().toUpperCase(); return c === "CEDENTE" || c === "RAZAO SOCIAL" || c.includes("CLIENTE"); }));
  if (headerIdx === -1) return [];
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s\.]/g, ""));
  const idxCedente = header.findIndex(c => c === "CEDENTE" || c.includes("RAZAO") || c.includes("CLIENTE"));
  const idxSacado = header.findIndex(c => c === "SACADO" || c.includes("NOME SACADO") || c.includes("SACADO/DEVEDOR"));
  const idxNumTitulo = header.findIndex(c => c.includes("NUM") || c.includes("TITULO") || c.includes("DOCUMENTO"));
  const idxVencimento = header.findIndex(c => c.includes("VCTO") || c.includes("VENCIMENTO") || c.includes("DATA VENC"));
  const idxValorFace = header.findIndex(c => c.includes("VLR FACE") || c.includes("VALOR FACE") || c.includes("FACE"));
  const idxValorAberto = header.findIndex(c => c.includes("VLR ABERTO") || c.includes("VALOR ABERTO") || c.includes("ABERTO"));

  const titulos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]; const cedente = String(row[idxCedente] || "").trim();
    if (!cedente || cedente.toUpperCase().includes("TOTAL") || cedente.toUpperCase() === "CEDENTE") continue;
    
    const cedenteNormalizado = await normalizarNomeCedenteGlobal(cedente);
    if (!cedenteNormalizado) continue;

    const sacado = String(row[idxSacado] || "").trim();
    const numeroTitulo = idxNumTitulo !== -1 ? String(row[idxNumTitulo] || "").trim() : "-";
    const vencimento = idxVencimento !== -1 ? formatarDataExcel(row[idxVencimento]) : "-";
    const valorFace = idxValorFace !== -1 ? parseValorReal(row[idxValorFace]) : 0;
    const valorAberto = parseValorReal(row[idxValorAberto]);
    const status = checarSeVencido(vencimento);

    if (valorAberto > 0) {
      titulos.push({ 
        origem: "SEC", 
        cedente: cedenteNormalizado, 
        sacado: sacado.toUpperCase(), 
        numero_titulo: numeroTitulo, 
        vencimento: converteDataParaISO(vencimento), 
        valor_face: valorFace, 
        valor_aberto: valorAberto, 
        status 
      });
    }
  }
  return titulos;
};

const processarCarteiraFidc = async (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => row.some(cell => String(cell).trim().toUpperCase() === "NOME DO CEDENTE"));
  if (headerIdx === -1) return [];
  const header = raw[headerIdx].map(c => String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s]/g, ""));
  const idxCedente = header.indexOf("NOME DO CEDENTE");
  const idxSacado = header.indexOf("NOME DO SACADO");
  const idxVencimento = header.indexOf("DATA DE VENCIMENTO ORIGINAL");
  const idxValorFace = header.indexOf("VALOR FACE");
  const idxValorAberto = header.indexOf("VALOR ABERTO");

  const titulos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]; const cedente = String(row[idxCedente] || "").trim();
    if (!cedente || cedente.toUpperCase().includes("TOTAL")) continue;
    
    const cedenteNormalizado = await normalizarNomeCedenteGlobal(cedente);
    if (!cedenteNormalizado) continue;

    const sacado = String(row[idxSacado] || "").trim();
    const vencimento = formatarDataExcel(row[idxVencimento]);
    const valorFace = parseValorReal(row[idxValorFace]);
    const valorAberto = parseValorReal(row[idxValorAberto]);
    const status = checarSeVencido(vencimento);

    if (valorAberto > 0) {
      titulos.push({ 
        origem: "FIDC", 
        cedente: cedenteNormalizado, 
        sacado: sacado.toUpperCase(), 
        numero_titulo: "-", 
        vencimento: converteDataParaISO(vencimento), 
        valor_face: valorFace, 
        valor_aberto: valorAberto, 
        status 
      });
    }
  }
  return titulos;
};

// ============================================================================
// 📊 COMPONENTE VISUAL PRINCIPAL
// ============================================================================
export default function ImportacaoPage() {
  const [dadosFinais, setDadosFinais] = useState<any>({
    risco: { sec: null, fidc: null },
    vop: { sec: [], fidc: [] },
    receitas: { sec: [], fidc: [] },
    juros: { sec: [], fidc: [] },
    carteira: { sec: [], fidc: [] }
  });

  const [processando, setProcessando] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

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
    setStatusMsg(`Lendo e mapeando nomes para: ${file.name}... (Isto pode levar alguns segundos)`);
    try {
      const rawData = await lerArquivoExcel(file);
      let dadosMapeados: any = null;

      if (tipo === "risco") dadosMapeados = empresa === "sec" ? await processarRiscoSec(rawData) : await processarRiscoFidc(rawData);
      else if (tipo === "vop") dadosMapeados = empresa === "sec" ? await processarVopSec(rawData) : await processarVopFidc(rawData);
      else if (tipo === "receitas") dadosMapeados = empresa === "sec" ? await processarReceitasSec(rawData) : await processarReceitasFidc(rawData);
      else if (tipo === "juros") dadosMapeados = empresa === "sec" ? await processarCampoLiquidadosSec(rawData) : [];
      else if (tipo === "carteira") dadosMapeados = empresa === "sec" ? await processarCarteiraSec(rawData) : await processarCarteiraFidc(rawData);

      setDadosFinais((prev: any) => {
        const atualizado = { ...prev };
        atualizado[tipo] = { ...atualizado[tipo], [empresa]: dadosMapeados };
        return atualizado;
      });
      setStatusMsg(`✅ Mapeamento concluído em ${file.name}! Cache em memória atualizado.`);
    } catch (error) { alert(`Erro ao ler e normalizar o arquivo ${file.name}.`); }
    finally { setProcessando(false); event.target.value = ""; }
  };

  const dispararProSupabase = async () => {
    setProcessando(true);
    setStatusMsg("🚀 Transmitindo e consolidando dados no Supabase V2...");
    try {
      // 1. Grava Módulo de Risco de Carteira
      if (dadosFinais.risco.sec) {
        for (const [chave, val] of Object.entries(dadosFinais.risco.sec) as any) {
          await supabase.from("cadastro_cedentes").update({ risco_sec: val.risco, vencido_sec: val.vencido }).eq("cedente", chave);
        }
      }
      if (dadosFinais.risco.fidc) {
        for (const [chave, val] of Object.entries(dadosFinais.risco.fidc) as any) {
          await supabase.from("cadastro_cedentes").update({ risco_fidc: val.risco, vencido_fidc: val.vencido }).eq("cedente", chave);
        }
      }

      // 2. Grava Módulo de Finanças (VOP, Receitas e Juros) consolidado em Lote com Nomes Normalizados
      const loteFinancas: any[] = [];
      const mesclarLancamento = async (item: any) => {
        const cedenteFinalNormalizado = await normalizarNomeCedenteGlobal(item.cedenteOriginal);
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

      for (const item of dadosFinais.vop.sec) await mesclarLancamento(item);
      for (const item of dadosFinais.vop.fidc) await mesclarLancamento(item);
      for (const item of dadosFinais.receitas.sec) await mesclarLancamento(item);
      for (const item of dadosFinais.receitas.fidc) await mesclarLancamento(item);
      for (const item of dadosFinais.juros.sec) await mesclarLancamento(item);

      if (loteFinancas.length > 0) {
        const { error } = await supabase.from("extrato_financeiro").insert(loteFinancas);
        if (error) throw error;
      }

      // 3. Grava Módulo de Carteira Detalhada (Blocos de 500 linhas)
      if (dadosFinais.carteira.sec.length > 0) {
        await supabase.from("carteira_titulos").delete().eq("origem", "SEC");
        const chunk = 500;
        for (let i = 0; i < dadosFinais.carteira.sec.length; i += chunk) {
          await supabase.from("carteira_titulos").insert(dadosFinais.carteira.sec.slice(i, i + chunk));
        }
      }
      if (dadosFinais.carteira.fidc.length > 0) {
        await supabase.from("carteira_titulos").delete().eq("origem", "FIDC");
        const chunk = 500;
        for (let i = 0; i < dadosFinais.carteira.fidc.length; i += chunk) {
          await supabase.from("carteira_titulos").insert(dadosFinais.carteira.fidc.slice(i, i + chunk));
        }
      }

      setStatusMsg("✅ Sincronização V2 concluída com sucesso direto no banco de dados!");
      setDadosFinais({ risco: { sec: null, fidc: null }, vop: { sec: [], fidc: [] }, receitas: { sec: [], fidc: [] }, juros: { sec: [], fidc: [] }, carteira: { sec: [], fidc: [] }});
    } catch (err: any) {
      alert(`❌ Erro no envio direto: ${err.message}`);
    } finally { setProcessando(false); }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">📥 Central de Importação de Relatórios (V2 Supabase)</h2>
          <span className="text-xs text-slate-500 font-medium">Os relatórios agora são filtrados e normalizados em tempo real cruzando a inteligência do SQLite local.</span>
        </div>
        <button 
          onClick={dispararProSupabase}
          disabled={processando}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          {processando ? "⏳ Transmitindo..." : "☁️ Enviar para a Infraestrutura V2"}
        </button>
      </div>

      {statusMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg font-bold text-center animate-pulse">{statusMsg}</div>}

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