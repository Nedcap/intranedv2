/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

// ============================================================================
// 🧽 FUNÇÕES DE LIMPEZA MATADORA
// ============================================================================
function limparNome(texto: any): string {
  if (!texto) return "";
  let n = String(texto).toUpperCase().trim();
  n = n.replace(/^\d+\s*-\s*/, ""); 
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
  n = n.replace(/[^A-Z0-9\s]/g, " "); 
  n = n.replace(/\b(LTDA|SA|S A|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, ""); 
  return n.replace(/\s+/g, " ").trim();
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
      const d = partes[0].padStart(2, "0");
      const m = partes[1].padStart(2, "0");
      const y = partes[2].substring(0, 4);
      return `${d}/${m}/${y}`;
    }
    if (partes.length === 3 && partes[0].length === 4) {
      return `${partes[2].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${partes[0]}`;
    }
  }
  
  if (txt.includes("/")) {
    const partes = txt.split("/");
    if (partes.length === 3) {
      const d = partes[0].padStart(2, "0");
      const m = partes[1].padStart(2, "0");
      let y = partes[2].substring(0, 4);
      if (y.length === 2) y = `20${y}`;
      return `${d}/${m}/${y}`;
    }
  }
  return txt;
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
    
    const ano = parseInt(partes[2]);
    if (ano <= 1930) return "A Vencer";
    
    const dataTitulo = new Date(ano, parseInt(partes[1]) - 1, parseInt(partes[0]), 12, 0, 0);
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
const processarRiscoSec = (raw: any[][]) => {
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
    const chave = limparNome(rawCed);
    if (!chave || chave === "NAN" || chave.includes("TOTAL")) continue;
    records[chave] = {
      cedenteOriginal: rawCed.trim(),
      risco: parseValorReal(row[idxLimUti]),
      vencido: parseValorReal(row[idxVencidos])
    };
  }
  return records;
};

const processarRiscoFidc = (raw: any[][]) => {
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
    const chave = limparNome(rawCed);
    if (!chave || chave === "NAN" || chave.includes("TOTAL")) continue;
    
    records[chave] = {
      cedenteOriginal: rawCed.trim(),
      risco: parseValorReal(row[idxUtilizado]),
      vencido: parseValorReal(row[idxVencido])
    };
  }
  return records;
};

const processarVopSec = (raw: any[][]) => {
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
    const chave = limparNome(rawCed);
    if (!chave || chave === "NAN" || chave.includes("TOTAL") || chave === "CEDENTE") continue;
    const dataOp = formatarDataExcel(row[idxData]);
    const mesAno = formatarMesAno(dataOp);
    const valor = parseValorReal(row[idxValor]);
    if (valor > 0) lancamentos.push({ dataOp, mesAno, cedenteOriginal: rawCed.trim(), vopSec: valor, vopFidc: 0 });
  }
  return lancamentos;
};

const processarVopFidc = (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => 
    row.some(cell => {
      const c = String(cell).trim().toUpperCase();
      return c === "CEDENTE" || c === "NOME DO CEDENTE" || c === "CLIENTE";
    })
  );
  
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(c => 
    String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s]/g, "")
  );
  
  const idxCedente = header.findIndex(c => c === "CEDENTE" || c.includes("NOME DO CEDENTE") || c === "CLIENTE");
  const idxData = header.findIndex(c => c.includes("DATA DA OPER") || c.includes("DATA OPER") || c === "DATA");
  const idxValor = header.findIndex(c => c.includes("VALOR FACE") || c.includes("FACE") || c.includes("VALOR"));

  if (idxCedente === -1 || idxValor === -1) {
    console.error("Cabeçalhos do VOP FIDC detectados:", header);
    return [];
  }

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCedente] || "");
    const chave = limparNome(rawCed);
    if (!chave || chave === "NAN" || chave.includes("TOTAL")) continue;
    
    const dataOp = idxData !== -1 ? formatarDataExcel(row[idxData]) : "-";
    const mesAno = formatarMesAno(dataOp);
    const valor = parseValorReal(row[idxValor]);
    if (valor > 0) lancamentos.push({ dataOp, mesAno, cedenteOriginal: rawCed.trim(), vopSec: 0, vopFidc: valor });
  }
  return lancamentos;
};

const processarReceitasSec = (raw: any[][]) => {
  const lancamentos: any[] = [];
  for (const row of raw) {
    let aditivo = String(row[0] || "").trim();
    if (aditivo.endsWith(".0")) aditivo = aditivo.slice(0, -2);
    if (aditivo.length === 10 && /^\d+$/.test(aditivo)) {
      const yy = aditivo.substring(0, 2);
      const mm = aditivo.substring(2, 4);
      const dd = aditivo.substring(4, 6);
      if (parseInt(mm) >= 1 && parseInt(mm) <= 12 && parseInt(dd) >= 1 && parseInt(dd) <= 31) {
        const dataOp = `${dd}/${mm}/20${yy}`;
        const rawCed = String(row[5] || "").trim();
        if (!rawCed || rawCed.toUpperCase() === "NAN" || rawCed.toUpperCase().includes("TOTAL") || rawCed.toUpperCase() === "CLIENTE") continue;
        const desagio = parseValorReal(row[12]);
        const tarifas = parseValorReal(row[14]);
        lancamentos.push({ empresa: "SEC", dataOp, cedenteOriginal: rawCed, desagio, tarifas, juros: 0 });
      }
    }
  }
  return lancamentos;
};

const processarReceitasFidc = (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => 
    row.some(cell => {
      const c = String(cell).trim().toUpperCase();
      return c === "CEDENTE" || c === "NOME DO CEDENTE" || c === "CLIENTE";
    })
  );
  
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(c => 
    String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s]/g, "")
  );
  
  const idxCedente = header.findIndex(c => c === "CEDENTE" || c.includes("NOME DO CEDENTE") || c === "CLIENTE");
  const idxData = header.findIndex(c => c.includes("DATA DA OPER") || c.includes("DATA OPER") || c === "DATA");
  const idxDesagio = header.findIndex(c => c === "DESAGIO" || c.includes("VALOR DESAGIO") || c.includes("DESCONTO"));
  
  const indicesTarifas = header.reduce((acc: number[], col, idx) => {
    if (
      col.includes("DESPESA") || 
      col.includes("TARIFA") || 
      col.includes("TAXA") || 
      col.includes("SVALORTAR") ||
      col.includes("SVALORDESP")
    ) {
      acc.push(idx);
    }
    return acc;
  }, []);

  if (idxCedente === -1 || idxDesagio === -1) {
    console.error("Cabeçalhos de Receitas FIDC detectados:", header);
    return [];
  }

  const lancamentos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const rawCed = String(row[idxCedente] || "");
    const chave = limparNome(rawCed);
    if (!chave || chave === "NAN" || chave.includes("TOTAL")) continue;
    
    const dataOp = idxData !== -1 ? formatarDataExcel(row[idxData]) : "-";
    const desagio = parseValorReal(row[idxDesagio]);
    
    let tarifasConsolidadas = 0;
    indicesTarifas.forEach(idxCol => {
      if (idxCol !== idxDesagio) {
        tarifasConsolidadas += parseValorReal(row[idxCol]);
      }
    });

    if (desagio > 0 || tarifasConsolidadas > 0) {
      lancamentos.push({ 
        empresa: "FIDC", 
        dataOp, 
        cedenteOriginal: rawCed.trim(), 
        desagio: desagio, 
        tarifas: tarifasConsolidadas, 
        juros: 0 
      });
    }
  }
  return lancamentos;
};

// 🔥 FIX: Leitura Cirúrgica para Ignorar Colunas de "Situação Baixa"
const processarCampoLiquidadosSec = (raw: any[][]) => {
  let colDtaBaixa = 12; // Valor fallback default
  let colEncargos = 15; // Valor fallback default
  
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const rowStr = raw[i].map(x => String(x).trim().toUpperCase());
    if (rowStr.includes("DTA BAIXA") || rowStr.includes("DATA BAIXA")) {
      // Aqui morava o perigo: Forçamos a busca exata pra ele pular qualquer coisa que seja "SITUACAO DE BAIXA"
      colDtaBaixa = rowStr.findIndex(x => x.includes("DTA BAIXA") || x.includes("DATA BAIXA"));
      colEncargos = rowStr.findIndex(x => x.includes("ENCARGOS"));
      break;
    }
  }

  const lancamentos: any[] = [];
  let currentCedente = "";
  
  for (const row of raw) {
    const c0 = String(row[0] || "").trim();
    
    // Captura o bloco do Cedente atual
    if (/^\d+\s*-/.test(c0) && (!row[1] || String(row[1]).trim() === "")) {
      currentCedente = c0.replace(/^\d+\s*-\s*/, "").trim();
      continue;
    }
    
    const linhaTexto = row.map(x => String(x).toUpperCase()).join(" ");
    if (linhaTexto.includes("TOTAL")) continue;
    
    const valorDataBruto = row[colDtaBaixa];
    const valorEncargoBruto = row[colEncargos];
    
    if (currentCedente && valorDataBruto && valorEncargoBruto) {
      const encargos = parseValorReal(valorEncargoBruto);
      if (encargos > 0) {
        // Trava final de segurança para não deixar texto entrar no formatador de datas
        const valStr = String(valorDataBruto).toUpperCase();
        if (!valStr.includes("BAIXA") && !valStr.includes("NORMAL")) {
          const dataOp = formatarDataExcel(valorDataBruto);
          if (dataOp) {
            lancamentos.push({ empresa: "SEC", dataOp, cedenteOriginal: currentCedente, desagio: 0, tarifas: 0, juros: encargos });
          }
        }
      }
    }
  }
  return lancamentos;
};

const processarCarteiraSec = (raw: any[][]) => {
  const headerIdx = raw.findIndex(row => 
    row.some(cell => {
      const c = String(cell).trim().toUpperCase();
      return c === "CEDENTE" || c === "RAZAO SOCIAL" || c.includes("CLIENTE");
    })
  );
  
  if (headerIdx === -1) return [];
  
  const header = raw[headerIdx].map(c => 
    String(c).trim().toUpperCase().normalize("NFD").replace(/[^A-Z\s\.]/g, "")
  );
  
  const idxCedente = header.findIndex(c => c === "CEDENTE" || c.includes("RAZAO") || c.includes("CLIENTE"));
  const idxSacado = header.findIndex(c => c === "SACADO" || c.includes("NOME SACADO") || c.includes("SACADO/DEVEDOR"));
  const idxNumTitulo = header.findIndex(c => c.includes("NUM") || c.includes("TITULO") || c.includes("DOCUMENTO"));
  const idxVencimento = header.findIndex(c => c.includes("VCTO") || c.includes("VENCIMENTO") || c.includes("DATA VENC"));
  const idxValorFace = header.findIndex(c => c.includes("VLR FACE") || c.includes("VALOR FACE") || c.includes("FACE"));
  const idxValorAberto = header.findIndex(c => c.includes("VLR ABERTO") || c.includes("VALOR ABERTO") || c.includes("ABERTO"));

  if (idxCedente === -1 || idxSacado === -1 || idxValorAberto === -1) {
    console.error("Cabeçalhos detectados no CSV da Securitizadora:", header);
    return [];
  }

  const titulos: any[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const cedente = String(row[idxCedente] || "").trim();
    if (!cedente || cedente.toUpperCase().includes("TOTAL") || cedente.toUpperCase() === "CEDENTE") continue;
    
    const sacado = String(row[idxSacado] || "").trim();
    const numeroTitulo = idxNumTitulo !== -1 ? String(row[idxNumTitulo] || "").trim() : "-";
    const vencimento = idxVencimento !== -1 ? formatarDataExcel(row[idxVencimento]) : "-";
    const valorFace = idxValorFace !== -1 ? parseValorReal(row[idxValorFace]) : 0;
    const valorAberto = parseValorReal(row[idxValorAberto]);
    const status = checarSeVencido(vencimento);

    if (valorAberto > 0) {
      titulos.push({ cedente, sacado, numeroTitulo, vencimento, valorFace, valorAberto, status });
    }
  }
  return titulos;
};

const processarCarteiraFidc = (raw: any[][]) => {
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
    const row = raw[i];
    const cedente = String(row[idxCedente] || "").trim();
    if (!cedente || cedente.toUpperCase().includes("TOTAL")) continue;
    
    const sacado = String(row[idxSacado] || "").trim();
    const vencimento = formatarDataExcel(row[idxVencimento]);
    const valorFace = parseValorReal(row[idxValorFace]);
    const valorAberto = parseValorReal(row[idxValorAberto]);
    const status = checarSeVencido(vencimento);

    if (valorAberto > 0) {
      titulos.push({ cedente, sacado, vencimento, valorFace, valorAberto, status });
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
            if (!lines[0].includes(";") && !lines[0].includes(",") && lines[0].includes("\t")) separador = "\t";

            const rows = lines.map(line => line.split(separador).map(cell => {
              let c = cell.trim();
              return (c.startsWith('"') && c.endsWith('"')) ? c.slice(1, -1) : c;
            }));
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
    setStatusMsg(`Lendo e mapeando ${file.name}...`);

    try {
      const rawData = await lerArquivoExcel(file);
      let dadosMapeados: any = null;

      if (tipo === "risco") { dadosMapeados = empresa === "sec" ? processarRiscoSec(rawData) : processarRiscoFidc(rawData); } 
      else if (tipo === "vop") { dadosMapeados = empresa === "sec" ? processarVopSec(rawData) : processarVopFidc(rawData); } 
      else if (tipo === "receitas") { dadosMapeados = empresa === "sec" ? processarReceitasSec(rawData) : processarReceitasFidc(rawData); } 
      else if (tipo === "juros") { dadosMapeados = empresa === "sec" ? processarCampoLiquidadosSec(rawData) : []; }
      else if (tipo === "carteira") { dadosMapeados = empresa === "sec" ? processarCarteiraSec(rawData) : processarCarteiraFidc(rawData); }

      if (tipo === "carteira" && (!dadosMapeados || dadosMapeados.length === 0)) {
        alert(`⚠️ Atenção: Não foram encontrados títulos válidos no arquivo ${file.name}. Verifique se a estrutura e as colunas estão corretas.`);
        setProcessando(false);
        return;
      }

      setDadosFinais((prev: any) => {
        const atualizado = { ...prev };
        atualizado[tipo] = { ...atualizado[tipo], [empresa]: dadosMapeados };
        return atualizado;
      });

      setStatusMsg(`✅ Mapeamento de ${file.name} fixado com sucesso! Pronto para envio.`);
      setTimeout(() => setStatusMsg(""), 5000);
    } catch (error) {
      console.error(error);
      alert(`Erro ao ler o arquivo ${file.name}.`);
      setStatusMsg("");
    } finally {
      setProcessando(false);
      event.target.value = "";
    }
  };

  const dispararProGoogleSheets = async () => {
    const temDados = 
      (dadosFinais.risco.sec && Object.keys(dadosFinais.risco.sec).length > 0) ||
      (dadosFinais.risco.fidc && Object.keys(dadosFinais.risco.fidc).length > 0) ||
      dadosFinais.vop.sec.length > 0 ||
      dadosFinais.vop.fidc.length > 0 ||
      dadosFinais.receitas.sec.length > 0 ||
      dadosFinais.receitas.fidc.length > 0 ||
      dadosFinais.carteira.sec.length > 0 ||
      dadosFinais.carteira.fidc.length > 0 ||
      dadosFinais.juros.sec.length > 0;

    if (!temDados) return alert("⚠️ Mapeie pelo menos um arquivo antes de enviar!");

    setProcessando(true);
    setStatusMsg("🚀 Transmitindo dados para o Google Sheets... Aguarde!");

    try {
      const res = await fetch("/api/importacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosFinais)
      });

      const responseData = await res.json();
      if (!res.ok || responseData.success === false) {
        throw new Error(responseData.error || "Erro desconhecido na API.");
      }

      setStatusMsg("✅ Sincronização concluída com sucesso! O Painel de Controle foi atualizado.");
      setTimeout(() => {
        setStatusMsg("");
        setDadosFinais({ risco: { sec: null, fidc: null }, vop: { sec: [], fidc: [] }, receitas: { sec: [], fidc: [] }, juros: { sec: [], fidc: [] }, carteira: { sec: [], fidc: [] }});
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro no envio: ${err.message || "Verifique as abas e credenciais do Google."}`);
      setStatusMsg("");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">📥 Central de Importação de Relatórios</h2>
          <span className="text-xs text-slate-500 font-medium">Siga as instruções de extração em cada bloco para manter o Painel de Controle atualizado.</span>
        </div>
        <button 
          onClick={dispararProGoogleSheets}
          disabled={processando}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          {processando ? "⏳ Transmitindo..." : "☁️ Enviar para o Painel de Controle"}
        </button>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg font-bold text-center animate-pulse">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Bloco 1: Risco e Vencidos */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">1</span>
            Risco e Vencidos (Consolidação de Carteira)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-blue-700 block uppercase">1.1 Securitizadora</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                  ⚙️ Qprof ➔ Relatórios ➔ Limites e checagem dos cedentes consolidados
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "risco", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer outline-none" />
              {dadosFinais.risco.sec && Object.keys(dadosFinais.risco.sec).length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-blue-700 block uppercase">1.2 FIDC</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                  ⚙️ Black101 ➔ Relatórios ➔ Operação ➔ Risco Cedente
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "risco", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer outline-none" />
              {dadosFinais.risco.fidc && Object.keys(dadosFinais.risco.fidc).length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
          </div>
        </div>

        {/* Bloco 2: Valores Operados (VOP) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">2</span>
            Valores Operados (VOP Realizado)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-indigo-700 block uppercase">2.1 Securitizadora</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                  ⚙️ Qprof ➔ Operações ➔ Consulta | Situação: Pago | Consolidado: S
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "vop", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer outline-none" />
              {dadosFinais.vop.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-indigo-700 block uppercase">2.2 FIDC</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                  ⚙️ Black101 ➔ Operações ➔ Operações ➔ Filtros: Status "Fechada" ➔ Exportar
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "vop", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer outline-none" />
              {dadosFinais.vop.fidc.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
          </div>
        </div>

        {/* Bloco 3: Receitas e Faturamento */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">3</span>
            Receitas (Deságio e Tarifas)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-emerald-700 block uppercase">3.1 Securitizadora</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                  ⚙️ Qprof ➔ Relatórios ➔ Negócios Realizados por Data | De: 01/01/2023 | Consolidado: S
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "receitas", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer outline-none" />
              {dadosFinais.receitas.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-emerald-700 block uppercase">3.2 FIDC</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-emerald-100 font-mono font-bold text-emerald-800">
                  ⚠️ Importe AQUI o MESMO relatório extraído no passo 2.2 do Black101
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "receitas", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer outline-none" />
              {dadosFinais.receitas.fidc.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
          </div>
        </div>

        {/* Bloco 4: Posição Liquidados */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-amber-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">4</span>
            Posição Liquidados (Juros de Atraso)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-black text-amber-700 block uppercase">4.1 Securitizadora</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                  ⚙️ Qprof ➔ Relatórios ➔ Posição Liquidados | Filtro De: 01/01/2023 | Consolidado: S
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "juros", "sec")} className="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer outline-none" />
              {dadosFinais.juros.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[140px] opacity-60 grayscale cursor-not-allowed">
              <div>
                <span className="text-[11px] font-black text-slate-400 block uppercase">4.2 FIDC</span>
                <p className="text-[11px] text-slate-400 mt-1 mb-3 bg-slate-100 p-1.5 rounded border border-slate-200 font-mono">
                  ⏳ Mapeamento de Liquidados FIDC (Em Breve)
                </p>
              </div>
              <input type="file" disabled className="w-full text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100 outline-none" />
            </div>
          </div>
        </div>

        {/* Bloco 5: Carteira Aberta Detalhada */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 xl:col-span-2">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-[12px] border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="bg-purple-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]">5</span>
            Carteira Aberta Detalhada (Concentração Cedente x Sacado)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[150px]">
              <div>
                <span className="text-[11px] font-black text-purple-700 block uppercase">5.1 Carteira Securitizadora</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono leading-relaxed">
                  ⚙️ Qprof ➔ Cobrança Consolidada | Tipo Doc: Vazio | Aprovados: S ➔ Buscar ➔ <kbd className="bg-slate-200 px-1 rounded font-bold text-slate-700 text-[10px]">Ctrl+Alt+Click</kbd> para exportar
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "carteira", "sec")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer outline-none" />
              {dadosFinais.carteira.sec.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative flex flex-col justify-between min-h-[150px]">
              <div>
                <span className="text-[11px] font-black text-purple-700 block uppercase">5.2 Carteira FIDC</span>
                <p className="text-[11px] text-slate-500 mt-1 mb-3 bg-slate-50 p-1.5 rounded border border-slate-100 font-mono leading-relaxed">
                  ⚙️ Black101 ➔ Operações ➔ Recebíveis ➔ Filtrar ➔ Remover Filtros ➔ Situação: Aberto ➔ Selecionar Todos ➔ Download Excel
                </p>
              </div>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => handleFileUpload(e, "carteira", "fidc")} className="w-full text-[11px] text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer outline-none" />
              {dadosFinais.carteira.fidc.length > 0 && <span className="absolute top-4 right-4 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold shadow-xs animate-bounce">Mapeado</span>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}