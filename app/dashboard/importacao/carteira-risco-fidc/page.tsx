/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

// ============================================================================
// 🧽 UTILS DE CONVERSÃO DE FORMATOS DO EXCEL
// ============================================================================
function parseValorReal(valor: any): number {
  if (valor === null || valor === undefined || valor === "") return 0.0;
  if (typeof valor === "number") return valor;
  const txt = String(valor).replace(/[R$\s]/g, "").trim();
  const num = parseFloat(txt.replace(",", ".")); 
  return isNaN(num) ? 0.0 : num;
}

function limparCnpj(valor: any): string {
  if (!valor) return "";
  return String(valor).replace(/\D/g, "");
}

function formatarDataExcel(valorData: any): string | null {
  if (!valorData) return null;
  
  const numVal = Number(valorData);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
    const data = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    return data.toISOString().split("T")[0];
  }

  const txt = String(valorData).trim();
  if (txt.includes("-")) {
    const partes = txt.split("-");
    if (partes.length === 3) {
      if (partes[0].length === 4) return `${partes[0]}-${partes[1].padStart(2, "0")}-${partes[2].padStart(2, "0")}`;
      return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
    }
  }
  return null;
}

function checarSeVencidoISO(dataIso: string | null): string {
  if (!dataIso) return "A Vencer";
  try {
    const dataTitulo = new Date(dataIso + "T12:00:00");
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
  cnpjPlanilha: string;
  cnpjCadastrado: string | null;
  responsavelId: string | null;
  status: "🟢 PRONTO" | "🔴 CNPJ NÃO VINCULADO NO SISTEMA";
  titulos: any[];
  totalAberto: number;
  totalVencido: number;
}

export default function CarteiraRiscoFidcPage() {
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
  // 🦾 PROCESSADOR EXCEL SÍNCRONO (CRUZAMENTO MDM VIA CNPJ)
  // ============================================================================
  const processarArquivoExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessando(true);
    setStatusMsg("Processando planilhas e gerando lotes de auditoria...");

    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

      if (rawRows.length === 0) throw new Error("Planilha vazia.");

      const header = rawRows[0].map(c => String(c).trim().toUpperCase());
      
      // Mapeamento Atualizado (Buscando o máximo de dados do Excel Securitizadora)
      const idxNumRecebivel = header.indexOf("NÚMERO DO RECEBÍVEL");
      const idxNossoNumero = header.indexOf("NOSSONUMERO"); // NOVO
      const idxSituacao = header.indexOf("SITUAÇÃO RECEBÍVEL"); // PADRONIZADO
      const idxStatusBaixa = header.indexOf("STATUS DA BAIXA"); // NOVO
      const idxNumOp = header.indexOf("NÚMERO DA OPERAÇÃO");
      const idxDataOp = header.indexOf("DATA DA OPERAÇÃO"); // NOVO
      const idxCedente = header.indexOf("NOME DO CEDENTE");
      const idxCnpjCedente = header.indexOf("CNPJ/CPF DO CEDENTE");
      const idxSacado = header.indexOf("NOME DO SACADO");
      const idxCnpjSacado = header.indexOf("CNPJ/CPF DO SACADO");
      const idxValorFace = header.indexOf("VALOR FACE");
      const idxValorAberto = header.indexOf("VALOR ABERTO");
      const idxValorPago = header.indexOf("VALOR PAGO");
      const idxDesagio = header.indexOf("DESAGIO");
      const idxDataBaixa = header.indexOf("DATA DA BAIXA");
      const idxVctoOriginal = header.indexOf("DATA DE VENCIMENTO ORIGINAL"); // NOVO
      const idxVctoAtu = header.indexOf("DATA DE VENCIMENTO ATUALIZADA");
      const idxAgente = header.indexOf("AGENTE");

      const agrupamento: Record<string, { nome: string, titulos: any[] }> = {};

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const rawCnpj = limparCnpj(row[idxCnpjCedente]);
        const valorAberto = parseValorReal(row[idxValorAberto]);

        if (!rawCnpj || valorAberto <= 0) continue;

        if (!agrupamento[rawCnpj]) {
          agrupamento[rawCnpj] = { nome: String(row[idxCedente] || "NÃO INFORMADO").trim().toUpperCase(), titulos: [] };
        }

        const dataVctoIso = formatarDataExcel(row[idxVctoAtu]);

        // AQUI: Montamos o objeto do título JÁ NO PADRÃO UNIFICADO
        agrupamento[rawCnpj].titulos.push({
          numero_operacao: String(row[idxNumOp] || "").substring(0, 100),
          numero_titulo: String(row[idxNumRecebivel] || "").substring(0, 100),
          nosso_numero: String(row[idxNossoNumero] || "").substring(0, 100),
          
          sacado: String(row[idxSacado] || "NÃO INFORMADO").trim().toUpperCase().substring(0, 255),
          cnpj_sacado: limparCnpj(row[idxCnpjSacado]).substring(0, 20),
          
          valor_face: parseValorReal(row[idxValorFace]),
          valor_aberto: valorAberto,
          valor_pago: parseValorReal(row[idxValorPago]),
          desagio: parseValorReal(row[idxDesagio]),
          
          data_negociacao: formatarDataExcel(row[idxDataOp]),
          vencimento_original: formatarDataExcel(row[idxVctoOriginal]),
          vencimento: dataVctoIso,
          data_baixa: formatarDataExcel(row[idxDataBaixa]),
          
          status: String(row[idxStatusBaixa] || "ABERTO").toUpperCase().substring(0, 50),
          situacao_recebivel: String(row[idxSituacao] || "NORMAL").toUpperCase().substring(0, 100),
          gerente_comercial: String(row[idxAgente] || "").trim().toUpperCase().substring(0, 100),
          
          // Campo auxiliar para cálculo de risco do Dashboard
          _statusVencimento: checarSeVencidoISO(dataVctoIso) 
        });
      }

      const resultadoConciliado: LinhaConciliacao[] = [];

      for (const [cnpjPlanilha, meta] of Object.entries(agrupamento)) {
        const matchSistema = cedentesSistema.find(c => limparCnpj(c.cnpj) === cnpjPlanilha);

        const totalAberto = meta.titulos.reduce((acc, t) => acc + t.valor_aberto, 0);
        const totalVencido = meta.titulos.reduce((acc, t) => t._statusVencimento === "Vencido" ? acc + t.valor_aberto : acc, 0);

        resultadoConciliado.push({
          cedentePlanilha: meta.nome,
          cnpjPlanilha,
          cnpjCadastrado: matchSistema?.cnpj || null,
          responsavelId: matchSistema?.responsavel_id || null,
          status: matchSistema?.cnpj ? "🟢 PRONTO" : "🔴 CNPJ NÃO VINCULADO NO SISTEMA",
          titulos: meta.titulos,
          totalAberto,
          totalVencido
        });
      }

      setLinhasConciliadas(resultadoConciliado);
      setStatusMsg("✅ Mapeamento concluído! Valide o status dos lotes abaixo.");
    } catch (err: any) {
      alert("❌ Falha na leitura do arquivo Excel: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  // ... [Ocultado os handlers de Auto Cadastrar e Vincular para não poluir, são iguais ao seu código original] ...
  const handleAutoCadastrarCedente = async (nomePlanilha: string, cnpjPlanilha: string, index: number) => { /* Código original */ };
  const handleVincularManualmente = (index: number, cedenteSistemaId: string) => { /* Código original */ };
  const totalPendentes = useMemo(() => linhasConciliadas.filter(l => l.status.startsWith("🔴")).length, [linhasConciliadas]);

  const transferirDadosProSupabase = async () => {
    if (totalPendentes > 0) {
      alert("⚠️ Resolva ou cadastre as pendências cadastrais antes de efetuar a consolidação.");
      return;
    }

    setProcessando(true);
    setStatusMsg("🚀 Efetuando limpeza de lotes e persistindo tabelão unificado...");

    try {
      const cnpjsImportados = [...new Set(linhasConciliadas.map(l => l.cnpjCadastrado).filter(Boolean))];

      // 1. Limpeza segura na tabela destino 
      // (Mudei aqui para o nome da tabela unificada, volte para carteira_fidc se preferir não renomear)
      const { error: cleanError } = await supabase
        .from("carteira_unificada") 
        .delete()
        .in("cnpj_cedente", cnpjsImportados); 

      if (cleanError) throw cleanError;

      const payloadCarteira: any[] = [];

      for (const linha of linhasConciliadas) {
        if (!linha.cnpjCadastrado) continue;

        // 2. Monta o Payload exato pro novo Schema Unificado
        linha.titulos.forEach(t => {
          payloadCarteira.push({
            sistema_origem: 'SEC_EXCEL', // Identificador opcional para saber de qual arquivo veio
            cnpj_cedente: linha.cnpjCadastrado,
            cedente: linha.cedentePlanilha,
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
            
            responsavel_id: linha.responsavelId
          });
        });

        // 3. Atualiza riscos...
        // [Código original de atualização em cadastro_cedentes]
      }

      // 4. Inserção em Lote (Chunks)
      if (payloadCarteira.length > 0) {
        const chunk = 400;
        for (let i = 0; i < payloadCarteira.length; i += chunk) {
          const { error } = await supabase
            .from("carteira_unificada") // Mudar se você não alterou o nome da tabela
            .insert(payloadCarteira.slice(i, i + chunk));
          if (error) throw error;
        }
      }

      alert(`🎉 Carga concluída!\n${payloadCarteira.length} recebíveis integrados!`);
      setLinhasConciliadas([]);
      setStatusMsg("");
    } catch (err: any) {
      alert("❌ Falha crítica no salvamento: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  // ... [Ocultado o return com JSX para não ficar gigantesco, use o seu original!] ...
  return ( <div>{/* Seu JSX Original */}</div> );
}