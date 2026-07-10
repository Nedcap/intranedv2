/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";
import * as XLSX from "xlsx";

// ============================================================================
// 🧽 UTILS DE CONVERSÃO DE FORMATOS DO EXCEL
// ============================================================================
function parseValorReal(valor: any): number {
  if (valor === null || valor === undefined || valor === "") return 0.0;
  if (typeof valor === "number") return valor;
  const txt = String(valor).replace(/[R$\s]/g, "").trim();
  const num = parseFloat(txt);
  return isNaN(num) ? 0.0 : num;
}

function limparCnpj(valor: any): string {
  if (!valor) return "";
  return String(valor).replace(/\D/g, "");
}

function formatarDataExcel(valorData: any): string | null {
  if (!valorData) return null;
  
  // Se for o número serial padrão do Excel
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

  useEffect(() => {
    async function carregarCedentes() {
      try {
        setCarregandoBase(true);
        const { data } = await supabase.from("cadastro_cedentes").select("id, cedente, cnpj, responsavel_id");
        if (data) setCedentesSistema(data);
      } catch (err) {
        console.error("Erro ao carregar cedentes oficiais:", err);
      } finally {
        setCarregandoBase(false);
      }
    }
    carregarCedentes();
  }, []);

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
      
      // Converte para JSON bruto em formato de Matriz (Array de Arrays)
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

      if (rawRows.length === 0) throw new Error("Planilha vazia.");

      const header = rawRows[0].map(c => String(c).trim().toUpperCase());
      
      const idxNumRecebivel = header.indexOf("NÚMERO DO RECEBÍVEL");
      const idxTipoRecebivel = header.indexOf("TIPO DO RECEBÍVEL");
      const idxSituacao = header.indexOf("SITUAÇÃO RECEBÍVEL COBRANÇA");
      const idxNumOp = header.indexOf("NÚMERO DA OPERAÇÃO");
      const idxTaxa = header.indexOf("TAXA DA OPERAÇÃO");
      const idxCedente = header.indexOf("NOME DO CEDENTE");
      const idxCnpjCedente = header.indexOf("CNPJ/CPF DO CEDENTE");
      const idxSacado = header.indexOf("NOME DO SACADO");
      const idxCnpjSacado = header.indexOf("CNPJ/CPF DO SACADO");
      const idxValorFace = header.indexOf("VALOR FACE");
      const idxValorAberto = header.indexOf("VALOR ABERTO");
      const idxValorPago = header.indexOf("VALOR PAGO");
      const idxDataBaixa = header.indexOf("DATA DA BAIXA");
      const idxVctoAtu = header.indexOf("DATA DE VENCIMENTO ATUALIZADA");
      const idxAgente = header.indexOf("AGENTE");
      const idxDesagio = header.indexOf("DESAGIO");

      // Agrupador temporário: CNPJ_Cedente -> Lista de Títulos
      const agrupamento: Record<string, { nome: string, titulos: any[] }> = {};

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const rawCnpj = limparCnpj(row[idxCnpjCedente]);
        const valorAberto = parseValorReal(row[idxValorAberto]);

        if (!rawCnpj || valorAberto <= 0) continue; // Pula liquidados ou sem identificação

        if (!agrupamento[rawCnpj]) {
          agrupamento[rawCnpj] = { nome: String(row[idxCedente]).trim().toUpperCase(), titulos: [] };
        }

        const dataVctoIso = formatarDataExcel(row[idxVctoAtu]);
        const statusVencimento = checarSeVencidoISO(dataVctoIso);

        agrupamento[rawCnpj].titulos.push({
          numero_recebivel: String(row[idxNumRecebivel] || ""),
          tipo_recebivel: String(row[idxTipoRecebivel] || ""),
          situacao_recebivel: String(row[idxSituacao] || "ABERTO").toUpperCase(),
          numero_operacao: String(row[idxNumOp] || ""),
          taxa_operacao: parseValorReal(row[idxTaxa]),
          sacado: String(row[idxSacado]).trim().toUpperCase(),
          cnpj_sacado: limparCnpj(row[idxCnpjSacado]),
          valor_face: parseValorReal(row[idxValorFace]),
          valor_aberto: valorAberto,
          valor_pago: parseValorReal(row[idxValorPago]),
          data_baixa: formatarDataExcel(row[idxDataBaixa]),
          vencimento: dataVctoIso,
          assessoria: String(row[idxAgente] || "").trim().toUpperCase(),
          desagio: parseValorReal(row[idxDesagio]),
          status: statusVencimento
        });
      }

      // 🧠 CONCILIAÇÃO INTELIGENTE POR CNPJ DIRECT MATCH
      const resultadoConciliado: LinhaConciliacao[] = [];

      for (const [cnpjPlanilha, meta] of Object.entries(agrupamento)) {
        // Busca direta e 100% segura usando o CNPJ limpo de 14 dígitos
        const matchSistema = cedentesSistema.find(c => limparCnpj(c.cnpj) === cnpjPlanilha);

        const totalAberto = meta.titulos.reduce((acc, t) => acc + t.valor_aberto, 0);
        const totalVencido = meta.titulos.reduce((acc, t) => t.status === "Vencido" ? acc + t.valor_aberto : acc, 0);

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

  const handleVincularManualmente = (index: number, cedenteSistemaId: string) => {
    const match = cedentesSistema.find(c => c.id === cedenteSistemaId);
    if (!match) return;

    setLinhasConciliadas(prev => {
      const copia = [...prev];
      copia[index].cnpjCadastrado = match.cnpj;
      copia[index].responsavelId = match.responsavel_id;
      copia[index].status = match.cnpj ? "🟢 PRONTO" : "🔴 CNPJ NÃO VINCULADO NO SISTEMA";
      return copia;
    });
  };

  const totalPendentes = useMemo(() => {
    return linhasConciliadas.filter(l => l.status.startsWith("🔴")).length;
  }, [linhasConciliadas]);

  // ============================================================================
  // ☁️ SALVAMENTO COM EXPURGO RETROATIVO
  // ============================================================================
  const transferirDadosProSupabase = async () => {
    if (totalPendentes > 0) {
      alert("⚠️ Resolva as pendências cadastrais antes de efetuar a consolidação do tabelão.");
      return;
    }

    setProcessando(true);
    setStatusMsg("🚀 Efetuando limpeza de lotes e persistindo tabelão FIDC...");

    try {
      const cnpjsImportados = linhasConciliadas.map(l => l.cnpjPlanilha);

      // 🎯 PASSO 1: LIMPEZA ATÔMICA RETROATIVADOS POR CNPJ
      const { error: cleanError } = await supabase
        .from("carteira_fidc")
        .delete()
        .in("cnpj_cnpj_cedente", cnpjsImportados); // Limpa só as empresas que estão subindo hoje

      if (cleanError) throw cleanError;

      const payloadCarteira: any[] = [];
      const payloadRisco: any[] = [];

      for (const linha of linhasConciliadas) {
        if (!linha.cnpjCadastrado) continue;

        linha.titulos.forEach(t => {
          payloadCarteira.push({
            cnpj_cedente: linha.cnpjCadastrado,
            cedente: linha.cedentePlanilha,
            sacado: t.sacado,
            numero_titulo: t.numero_recebivel,
            numero_recebivel: t.numero_recebivel,
            tipo_recebivel: t.tipo_recebivel,
            situacao_recebivel: t.situacao_recebivel,
            numero_operacao: t.numero_operacao,
            taxa_operacao: t.taxa_operacao,
            cnpj_sacado: t.cnpj_sacado,
            valor_face: t.valor_face,
            valor_aberto: t.valor_aberto,
            valor_pago: t.valor_pago,
            data_baixa: t.data_baixa,
            vencimento: t.vencimento,
            assessoria: t.assessoria,
            desagio: t.desagio,
            status: t.status,
            responsavel_id: linha.responsavelId
          });
        });

        // Alimenta/Atualiza o Risco FIDC na tabela com trava UNIQUE(cnpj)
        payloadRisco.push({
          cnpj: linha.cnpjCadastrado,
          cedente: linha.cedentePlanilha,
          risco_fidc: linha.totalAberto,
          vencido_fidc: broadband(linha.totalVencido),
          responsavel_id: linha.responsavelId,
          atualizado_em: new Date().toISOString()
        });
      }

      // Envia em blocos de 400 linhas
      if (payloadCarteira.length > 0) {
        const chunk = 400;
        for (let i = 0; i < payloadCarteira.length; i += chunk) {
          const { error } = await supabase.from("carteira_fidc").insert(payloadCarteira.slice(i, i + chunk));
          if (error) throw error;
        }
      }

      // IMPORTANTE: Aqui fazemos um RPC ou atualização parcial para não zerar os campos da Securitizadora!
      // Usamos uma transação em lote para o upsert respeitar as colunas da Securitizadora que já estão no banco
      if (payloadRisco.length > 0) {
        for (const riscoItem of payloadRisco) {
          // Busca o que já existe para somar de forma simétrica
          const { data: existente } = await supabase.from("dash_carteira").select("risco_sec, vencido_sec").eq("cnpj", riscoItem.cnpj).single();
          
          const rSec = existente ? parseFloat(existente.risco_sec || 0) : 0;
          const vSec = existente ? parseFloat(existente.vencido_sec || 0) : 0;

          const completo = {
            ...riscoItem,
            risco_sec: rSec,
            vencido_sec: vSec,
            risco_consolidado: rSec + riscoItem.risco_fidc,
            vencido_consolidado: vSec + riscoItem.risco_fidc
          };

          const { error } = await supabase.from("dash_carteira").upsert(completo, { onConflict: "cnpj" });
          if (error) throw error;
        }
      }

      alert(`🎉 Carga concluída!\n${payloadCarteira.length} títulos de sócios e recebíveis integrados à base operacional.`);
      setLinhasConciliadas([]);
      setStatusMsg("");
    } catch (err: any) {
      alert("❌ Falha crítica no salvamento: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  // Pequena correção de escopo seguro para o parâmetro vencido do loop
  function broadband(val: number) { return isNaN(val) ? 0 : val; }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 p-6 font-sans text-[13px] text-slate-700">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">🏦 Carga Máxima: Carteira e Risco FIDC (Black101)</h2>
          <span className="text-xs text-slate-500 font-medium">Alimentação em lote analítico do fluxo FIDC e sincronização síncrona do dashboard de alçadas.</span>
        </div>
        
        <button
          onClick={transferirDadosProSupabase}
          disabled={processando || linhasConciliadas.length === 0 || totalPendentes > 0}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer uppercase tracking-wider text-xs"
        >
          {processando ? "⏳ Sincronizando..." : "☁️ Enviar para o Banco Central"}
        </button>
      </div>

      {statusMsg && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg font-bold text-center animate-pulse">{statusMsg}</div>}

      {/* DRAG ZONE */}
      {linhasConciliadas.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center shadow-xs">
          <label className="flex flex-col items-center justify-center cursor-pointer gap-2">
            <span className="text-3xl">📋</span>
            <span className="font-bold text-slate-700">Carregar Relatório de Recebíveis FIDC (.XLSX)</span>
            <span className="text-xs text-slate-400 font-mono">Verificação via MDM por CNPJ ativo com expurgo retroativo ativado.</span>
            <input type="file" accept=".xlsx" onChange={processarArquivoExcel} className="hidden" disabled={carregandoBase || processando} />
          </label>
        </div>
      )}

      {/* RESULTADO DA CONCILIAÇÃO */}
      {linhasConciliadas.length > 0 && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center font-bold">
            <span>Validação de Consistência cadastral por CNPJ (MDM)</span>
            <span className={`px-3 py-1 rounded text-xs ${totalPendentes === 0 ? "bg-emerald-600" : "bg-rose-600 animate-pulse"}`}>
              {totalPendentes === 0 ? "✓ Tabelão Consistente" : `⚠️ ${totalPendentes} amarração(ões) pendente(s)`}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                    <th className="p-4 w-72">Cedente na Planilha</th>
                    <th className="p-4 text-center w-36">Total de Títulos</th>
                    <th className="p-4 text-right w-40">Saldo em Aberto</th>
                    <th className="p-4 text-right w-40">Total Vencido</th>
                    <th className="p-4 w-64">Status / Resolução de Vínculo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {linhasConciliadas.map((linha, index) => (
                    <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${linha.status.startsWith("🔴") ? "bg-rose-50/20" : ""}`}>
                      <td className="p-4 font-black text-slate-900 uppercase truncate max-w-[280px]" title={linha.cedentePlanilha}>
                        {linha.cedentePlanilha}
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-500">{linha.titulos.length}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900">{fM(linha.totalAberto)}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-600">{fM(linha.totalVencido)}</td>
                      <td className="p-4">
                        {linha.status.startsWith("🟢") ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-emerald-700 font-black text-[11px]">{linha.status}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">CNPJ: {linha.cnpjPlanilha}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <span className="text-rose-600 font-black text-[11px] leading-tight">{linha.status}</span>
                            <select
                              onChange={(e) => handleVincularManualmente(index, e.target.value)}
                              className="p-1.5 border border-slate-300 rounded bg-white text-xs font-bold text-slate-700 outline-none w-full max-w-[280px]"
                              defaultValue=""
                            >
                              <option value="" disabled>Vincular com Empresa do Sistema...</option>
                              {cedentesSistema.map(c => (
                                <option key={c.id} value={c.id}>{c.cedente} ({c.cnpj || "Sem CNPJ"})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}