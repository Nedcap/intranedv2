/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";

// ============================================================================
// 🧽 UTILS DE LIMPEZA E TRATAMENTO DE FORMATOS
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

function parseCSVLine(line: string, delimiter: string = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes; 
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseValorReal(valor: any): number {
  if (valor === null || valor === undefined || valor === "") return 0.0;
  if (typeof valor === "number") return valor;
  
  let txt = String(valor).toUpperCase().replace(/[R$\s"']/g, "").trim();
  
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

function parseInteiro(valor: any): number {
  if (!valor) return 0;
  const num = parseInt(String(valor).replace(/\D/g, ""));
  return isNaN(num) ? 0 : num;
}

function converteDataParaISO(dataStr: string): string | null {
  if (!dataStr) return null;
  const txt = dataStr.replace(/['"]/g, "").trim();
  
  if (txt === "" || txt === "-") return null;
  const partes = txt.split("/");
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
  }
  return null;
}

function checarSeVencido(dataStr: string): string {
  if (!dataStr) return "A Vencer";
  const txt = dataStr.replace(/['"]/g, "").trim();
  
  if (txt === "" || txt === "-") return "A Vencer";
  try {
    const partes = txt.split("/");
    if (partes.length !== 3) return "A Vencer";
    const dataTitulo = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]), 12, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return dataTitulo.getTime() < hoje.getTime() ? "Vencido" : "A Vencer";
  } catch {
    return "A Vencer";
  }
}

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));

interface LinhaConciliacao {
  cedentePlanilha: string;
  cnpjCadastrado: string | null;
  responsavelId: string | null;
  status: "🟢 PRONTO" | "🔴 CEDENTE NÃO LOCALIZADO NO SISTEMA";
  titulos: any[];
  totalAberto: number;
  totalVencido: number;
}

export default function CarteiraRiscoSecPage() {
  const [cedentesSistema, setCedentesSistema] = useState<any[]>([]);
  const [linhasConciliadas, setLinhasConciliadas] = useState<LinhaConciliacao[]>([]);
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const carregarCedentes = async () => {
    try {
      setCarregandoBase(true);
      const { data } = await supabase.from("cadastro_cedentes").select("id, cedente, cnpj, responsavel_id");
      if (data) setCedentesSistema(data);
    } catch (err) {
      console.error("Erro ao carregar cedentes oficiais:", err);
    } finally {
      setCarregandoBase(false);
    }
  };

  useEffect(() => { carregarCedentes(); }, []);

  // ============================================================================
  // 🦾 LEITORA ROBUSTA COM AUTO-DETECÇÃO DE LAYOUT E CABEÇALHOS
  // ============================================================================
  const processarArquivoCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessando(true);
    setStatusMsg("Processando codificação e minerando cabeçalhos do Qprof...");

    try {
      const texto = await file.text();
      
      let linhasRaw = texto.split(/\r?\n/).filter(l => l.trim() !== "").map(l => parseCSVLine(l, ";"));
      
      if (linhasRaw.length > 0 && linhasRaw[0].length <= 1) {
        linhasRaw = texto.split(/\r?\n/).filter(l => l.trim() !== "").map(l => parseCSVLine(l, ","));
      }

      const headerIdx = linhasRaw.findIndex(row => {
        const colunasLimpas = row.map(strClean);
        return colunasLimpas.some(c => c === "CEDENTE" || c === "NOMEDOCEDENTE" || c === "NOME");
      });

      if (headerIdx === -1) {
        alert("❌ Layout inválido! Coluna de 'Nome' ou 'Cedente' não encontrada no arquivo.");
        setProcessando(false);
        return;
      }

      const header = linhasRaw[headerIdx].map(strClean);

      const findCol = (possibilidades: string[], proibir: string[] = []) => {
        return header.findIndex(c => 
          possibilidades.some(p => c === p || c.includes(p)) && 
          !proibir.some(proib => c.includes(proib))
        );
      };

      let idxCedente = header.findIndex(c => c === "CEDENTE" || c === "NOMEDOCEDENTE" || c === "CLIENTE");
      if (idxCedente === -1) idxCedente = findCol(["CEDENTE", "NOME"], ["DATA", "CNPJ", "CPF", "REG", "MOTIVO"]);

      let idxSacado = header.findIndex(c => c === "SACADO" || c === "NOMEDOSACADO");
      if (idxSacado === -1) idxSacado = findCol(["SACADO"], ["CNPJ", "CPF", "DATA"]);

      const idxNumTitulo = findCol(["SNUM", "SEQTIT", "NUMERODOTITULO"], ["QTD", "VALOR"]);
      const idxNossoNumero = findCol(["NOSSONUM", "NOSSONUMERO"]); // NOVO MAPEAMENTO
      
      const idxSituacao = findCol(["SITUACAO", "STATUS"]);
      const idxSitRec = findCol(["SITREC", "SITUACAORECEBIVEL"]); // NOVO: Tentar achar situação secundária
      
      const idxVencimento = findCol(["VENCIMENTO", "DTAVCTO", "VCTO"], ["ORI"]);
      const idxVctoOriginal = findCol(["VCTOORI", "VENCIMENTOORIGINAL", "DTAORI"]); // NOVO MAPEAMENTO
      
      const idxValorFace = findCol(["VALORFACE", "VLRFACE", "VALORDOTITULO"], ["ABERTO", "PAGO", "LIQUIDO"]);
      const idxValorAberto = findCol(["VALORABERTO", "VLRABERTO", "SALDO", "EMABERTO"]);
      const idxAtr = findCol(["ATR", "ATRASO", "DIAS"]);
      const idxValorPago = findCol(["VALORPAGO", "VLRPAGO", "PAGO"]);
      const idxDesagio = findCol(["VLRDESAGIO", "DESAGIO"]); // NOVO MAPEAMENTO
      
      const idxDataLiq = findCol(["DATALIQUIDACAO", "DTALIQ", "LIQUIDACAO", "PAGAMENTO"]);
      const idxAgNeg = findCol(["AGNEG", "AGENEG", "ASSESSOR", "GERENTE", "COMERCIAL"]);
      const idxAditivo = findCol(["ADITIVO", "BORDERO", "OPERACAO"]); // Aditivo passa a ser operacao
      const idxDtaNeg = findCol(["DATANEGOCIACAO", "DTANEG"]);

      if (idxValorAberto === -1 && idxValorFace === -1) {
        alert("⚠️ Arquivo Incompatível!\n\nNão encontrei colunas financeiras (Ex: Valor Aberto, Valor Face). Parece que você importou um 'Relatório de Cadastros' no lugar do relatório da Carteira.");
        setProcessando(false);
        return;
      }

      const agrupamento: Record<string, any[]> = {};

      for (let i = headerIdx + 1; i < linhasRaw.length; i++) {
        const row = linhasRaw[i];
        if (!row || row.length <= idxCedente) continue;

        const rawCedente = String(row[idxCedente] || "").replace(/['"]/g, "").trim();
        if (!rawCedente || rawCedente.toUpperCase().includes("TOTAL") || rawCedente.toUpperCase() === "CEDENTE") continue;

        if (!agrupamento[rawCedente]) {
          agrupamento[rawCedente] = [];
        }

        const vencimentoRaw = String(row[idxVencimento] || "").trim();
        const statusVencimento = checarSeVencido(vencimentoRaw);

        // AQUI: Montamos o objeto do título JÁ NO PADRÃO UNIFICADO DA TABELA
        agrupamento[rawCedente].push({
          // Identificação
          numero_operacao: idxAditivo !== -1 ? String(row[idxAditivo] || "").replace(/['"]/g, "").trim() : null,
          numero_titulo: idxNumTitulo !== -1 ? String(row[idxNumTitulo] || "").replace(/['"]/g, "").trim() : "-",
          nosso_numero: idxNossoNumero !== -1 ? String(row[idxNossoNumero] || "").replace(/['"]/g, "").trim() : null,
          
          sacado: idxSacado !== -1 ? String(row[idxSacado] || "").replace(/['"]/g, "").trim().toUpperCase() : "-",
          cnpj_sacado: null, // CSV padrão geralmente não tem CNPJ Sacado, mantemos nulo
          
          // Valores
          valor_face: idxValorFace !== -1 ? parseValorReal(row[idxValorFace]) : 0,
          valor_aberto: idxValorAberto !== -1 ? parseValorReal(row[idxValorAberto]) : 0,
          valor_pago: idxValorPago !== -1 ? parseValorReal(row[idxValorPago]) : 0,
          desagio: idxDesagio !== -1 ? parseValorReal(row[idxDesagio]) : 0,
          
          // Datas
          data_negociacao: idxDtaNeg !== -1 ? converteDataParaISO(row[idxDtaNeg]) : null,
          vencimento_original: idxVctoOriginal !== -1 ? converteDataParaISO(row[idxVctoOriginal]) : converteDataParaISO(vencimentoRaw), // Fallback
          vencimento: converteDataParaISO(vencimentoRaw),
          data_baixa: idxDataLiq !== -1 ? converteDataParaISO(row[idxDataLiq]) : null,
          
          // Status e Controle
          status: idxSituacao !== -1 ? String(row[idxSituacao] || "").replace(/['"]/g, "").trim().toUpperCase() : "ABERTO",
          situacao_recebivel: idxSitRec !== -1 ? String(row[idxSitRec] || "").replace(/['"]/g, "").trim().toUpperCase() : "NORMAL",
          gerente_comercial: idxAgNeg !== -1 ? String(row[idxAgNeg] || "").replace(/['"]/g, "").trim().toUpperCase() : null,
          dias_atraso: idxAtr !== -1 ? parseInteiro(row[idxAtr]) : 0, // Campo nativo da Sec, mantido
          
          // Campo auxiliar para cálculo do painel
          _statusVencimento: statusVencimento 
        });
      }

      const resultadoConciliado: LinhaConciliacao[] = [];

      for (const [cedentePlanilha, titulosCedente] of Object.entries(agrupamento)) {
        const nomePlanilhaLimpo = limparNome(cedentePlanilha);
        const matchSistema = cedentesSistema.find(c => limparNome(c.cedente) === nomePlanilhaLimpo);

        const totalAberto = titulosCedente.reduce((acc, t) => acc + t.valor_aberto, 0);
        const totalVencido = titulosCedente.reduce((acc, t) => t._statusVencimento === "Vencido" ? acc + t.valor_aberto : acc, 0);

        resultadoConciliado.push({
          cedentePlanilha,
          cnpjCadastrado: matchSistema?.cnpj || null,
          responsavelId: matchSistema?.responsavel_id || null,
          status: matchSistema?.cnpj ? "🟢 PRONTO" : "🔴 CEDENTE NÃO LOCALIZADO NO SISTEMA",
          titulos: titulosCedente,
          totalAberto,
          totalVencido
        });
      }

      setLinhasConciliadas(resultadoConciliado);
      setStatusMsg("✅ Dados da Carteira minerados com sucesso!");
    } catch (err: any) {
      alert("❌ Erro ao ler arquivo: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  // ... [Ocultado os handlers de Auto Cadastrar e Vincular (mantidos idênticos do seu código original)] ...
  const handleAutoCadastrarCedente = async (nomePlanilha: string, index: number) => { /* Original */ };
  const handleVincularManualmente = (index: number, cedenteSistemaId: string) => { /* Original */ };
  const totalPendentes = useMemo(() => linhasConciliadas.filter(l => l.status.startsWith("🔴")).length, [linhasConciliadas]);

  const transferirDadosProSupabase = async () => {
    if (totalPendentes > 0) {
      alert("⚠️ Vincule ou Cadastre todos os cedentes antes de sincronizar a carteira!");
      return;
    }

    setProcessando(true);
    setStatusMsg("🚀 Sincronizando tabelão unificado de carteira...");

    try {
      const cnpjsParaLimpar = [...new Set(linhasConciliadas.map(l => l.cnpjCadastrado).filter(Boolean))];

      // 1. Limpeza segura na tabela destino 
      // (Mudei aqui para o nome da tabela unificada, volte para carteira_sec se preferir não renomear)
      const { error: errorClean } = await supabase
        .from("carteira_unificada")
        .delete()
        .in("cnpj_cedente", cnpjsParaLimpar);

      if (errorClean) throw errorClean;

      const payloadCarteira: any[] = [];

      for (const linha of linhasConciliadas) {
        if (!linha.cnpjCadastrado) continue;

        linha.titulos.forEach(t => {
          // 2. O Payload exato casando com a nova estrutura padronizada
          payloadCarteira.push({
            sistema_origem: 'FIDC_CSV', // Para saber de onde veio
            cnpj_cedente: linha.cnpjCadastrado,
            cedente: linha.cedentePlanilha.toUpperCase(),
            cnpj_sacado: t.cnpj_sacado,
            sacado: t.sacado,
            
            numero_operacao: t.numero_operacao,
            numero_titulo: t.numero_titulo,
            nosso_numero: t.nosso_numero,
            
            valor_face: t.valor_face,
            valor_aberto: t.valor_aberto,
            valor_pago: t.valor_pago,
            desagio: t.desagio,
            
            data_negociacao: t.data_negociacao,
            vencimento_original: t.vencimento_original,
            vencimento: t.vencimento,
            data_baixa: t.data_baixa,
            
            status: t.status,
            situacao_recebivel: t.situacao_recebivel,
            gerente_comercial: t.gerente_comercial,
            
            // Campo que o CSV tem e mantemos para histórico
            dias_atraso: t.dias_atraso,
            
            responsavel_id: linha.responsavelId
          });
        });
      }

      if (payloadCarteira.length > 0) {
        const chunk = 400; 
        for (let i = 0; i < payloadCarteira.length; i += chunk) {
          const { error } = await supabase
            .from("carteira_unificada") // Mudar se você não alterou o nome da tabela
            .insert(payloadCarteira.slice(i, i + chunk));
          if (error) throw error;
        }
      }

      alert(`🎉 Sucesso total!\n${payloadCarteira.length} títulos adicionados à carteira unificada.`);
      setLinhasConciliadas([]);
      setStatusMsg("");
    } catch (err: any) {
      alert("❌ Falha na gravação dos lotes: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  // ... [Ocultado o return com JSX para não ficar gigantesco, use o seu original!] ...
  return ( <div>{/* Seu JSX Original */}</div> );
}