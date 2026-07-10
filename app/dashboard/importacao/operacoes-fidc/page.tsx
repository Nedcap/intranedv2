/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";
import * as XLSX from "xlsx";

// ============================================================================
// 🧽 UTILS DE TRATAMENTO DE FORMATOS DO EXCEL
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

function extrairMesAno(dataIso: string | null): string {
  if (!dataIso) return "";
  const partes = dataIso.split("-"); // AAAA-MM-DD
  if (partes.length >= 2) return `${partes[1]}/${partes[0]}`; // MM/AAAA
  return "";
}

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));

interface LinhaConciliacao {
  cedentePlanilha: string;
  cnpjPlanilha: string;
  cnpjCadastrado: string | null;
  responsavelId: string | null;
  status: "🟢 PRONTO" | "🔴 CNPJ NÃO VINCULADO NO SISTEMA";
  operacoes: any[];
  totalVop: number;
  totalReceita: number;
}

export default function OperacoesFidcPage() {
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
  // 🦾 PROCESSADOR EXCEL (VOP + RECEITA COMBINADOS)
  // ============================================================================
  const processarArquivoExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessando(true);
    setStatusMsg("Processando e unificando VOP + Receitas em memória RAM...");

    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

      if (rawRows.length === 0) throw new Error("Planilha vazia.");

      const header = rawRows[0].map(c => String(c).trim().toUpperCase());
      
      const idxDataOp = header.indexOf("DATA DA OPERAÇÃO");
      const idxCedente = header.indexOf("NOME DO CEDENTE");
      const idxCnpjCedente = header.indexOf("CNPJ/CPF DO CEDENTE");
      const idxValorFace = header.indexOf("VALOR FACE");
      const idxStatus = header.indexOf("STATUS DA OPERAÇÃO");
      const idxDesagio = header.indexOf("DESÁGIO");
      const idxDespOp = header.indexOf("DESPESA OPERAÇÃO");
      const idxDespRec = header.indexOf("DESPESA RECEBÍVEL");
      const idxDespSac = header.indexOf("DESPESA SACADO");

      const agrupamento: Record<string, { nome: string, ops: any[] }> = {};

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        // Trava de segurança operacional: Só importa o que de fato fechou na mesa
        if (idxStatus !== -1 && String(row[idxStatus]).trim().toUpperCase() !== "FECHADA") continue;

        const rawCnpj = limparCnpj(row[idxCnpjCedente]);
        const vop = parseValorReal(row[idxValorFace]);

        if (!rawCnpj) continue;

        if (!agrupamento[rawCnpj]) {
          agrupamento[rawCnpj] = { nome: String(row[idxCedente]).trim().toUpperCase(), ops: [] };
        }

        const dataOpIso = formatarDataExcel(row[idxDataOp]);
        const mesAno = extrairMesAno(dataOpIso);

        // Soma todas as frentes de tarifas e deságio para formar a receita real da operação
        const receitaTotalOp = 
          parseValorReal(row[idxDesagio]) +
          parseValorReal(row[idxDespOp]) +
          parseValorReal(row[idxDespRec]) +
          parseValorReal(row[idxDespSac]);

        agrupamento[rawCnpj].ops.push({
          data_operacao: dataOpIso,
          mes_ano: mesAno,
          vop: vop,
          receita: receitaTotalOp
        });
      }

      // 🧠 CONCILIAÇÃO MDM SÍNCRONA VIA CNPJ
      const resultadoConciliado: LinhaConciliacao[] = [];

      for (const [cnpjPlanilha, meta] of Object.entries(agrupamento)) {
        const matchSistema = cedentesSistema.find(c => limparCnpj(c.cnpj) === cnpjPlanilha);

        const totalVop = meta.ops.reduce((acc, o) => acc + o.vop, 0);
        const totalReceita = meta.ops.reduce((acc, o) => acc + o.receita, 0);

        resultadoConciliado.push({
          cedentePlanilha: meta.nome,
          cnpjPlanilha,
          cnpjCadastrado: matchSistema?.cnpj || null,
          responsavelId: matchSistema?.responsavel_id || null,
          status: matchSistema?.cnpj ? "🟢 PRONTO" : "🔴 CNPJ NÃO VINCULADO NO SISTEMA",
          operacoes: meta.ops,
          totalVop,
          totalReceita
        });
      }

      setLinhasConciliadas(resultadoConciliado);
      setStatusMsg("✅ Lote de conciliação pronto para processamento.");
    } catch (err: any) {
      alert("❌ Falha crítica ao ler Excel: " + err.message);
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
  // ☁️ COMIT DEFINITIVO DO DRE UNIFICADO PRO SUPABASE
  // ============================================================================
  const transferirDadosProSupabase = async () => {
    if (totalPendentes > 0) {
      alert("⚠️ Vincule todos os CNPJs antes de enviar pro banco de dados.");
      return;
    }

    setProcessando(true);
    setStatusMsg("🚀 Expurgando períodos retroativos e consolidando DRE do FIDC...");

    try {
      // Coleta o mapeamento de competências (mes_ano) e cedentes contidos no arquivo
      const periodosAfetados = new Set<string>();
      linhasConciliadas.forEach(linha => {
        linha.operacoes.forEach(op => {
          if (op.mes_ano) periodosAfetados.add(`${op.mes_ano}|${linha.cnpjPlanilha}`);
        });
      });

      // 🎯 PASSO 1: SISTEMA DE LIMPEZA DIÁRIA CIRÚRGICA (EXTRATO)
      // Evita duplicar o extrato financeiro limpando as competências daquele cedente específico
      for (const pa of periodosAfetados) {
        const [mes_ano, cnpj] = pa.split("|");
        await supabase
          .from("extrato_financeiro")
          .delete()
          .eq("empresa", "FIDC")
          .eq("mes_ano", mes_ano)
          .eq("cnpj", cnpj);
      }

      const payloadExtrato: any[] = [];
      const vopAgregadoMap = new Map<string, { mes_ano: string, cnpj: string, cedente: string, vop: number, respId: string | null }>();

      linhasConciliadas.forEach(linha => {
        if (!linha.cnpjCadastrado) return;

        linha.operacoes.forEach(op => {
          // 1. Prepara linha detalhada para o extrato analítico
          payloadExtrato.push({
            empresa: "FIDC",
            data_operacao: op.data_operacao,
            mes_ano: op.mes_ano,
            cnpj: linha.cnpjCadastrado,
            cedente: linha.cedentePlanilha,
            vop: op.vop,
            desagio: op.receita, // Consolida o deságio + tarifas totais na mesma coluna
            tarifas: 0,
            juros: 0,
            responsavel_id: linha.responsavelId
          });

          // 2. Agrega os volumes de VOP para alimentar a tabela dash_vop de forma incremental
          const keyVop = `${op.mes_ano}_${linha.cnpjCadastrado}`;
          if (!vopAgregadoMap.has(keyVop)) {
            vopAgregadoMap.set(keyVop, {
              mes_ano: op.mes_ano,
              cnpj: linha.cnpjCadastrado,
              cedente: linha.cedentePlanilha,
              vop: 0,
              respId: linha.responsavelId
            });
          }
          vopAgregadoMap.get(keyVop)!.vop += op.vop;
        });
      });

      // Salva lote do extrato analítico
      if (payloadExtrato.length > 0) {
        const chunk = 400;
        for (let i = 0; i < payloadExtrato.length; i += chunk) {
          const { error } = await supabase.from("extrato_financeiro").insert(payloadExtrato.slice(i, i + chunk));
          if (error) throw error;
        }
      }

      // 🎯 PASSO 2: ATUALIZAÇÃO INCREMENTAL DO DASH_VOP SEM APAGAR O FLUXO DA SECURITIZADORA
      if (vopAgregadoMap.size > 0) {
        for (const [_, item] of vopAgregadoMap.entries()) {
          // Puxa o volume que a Securitizadora já realizou naquele mês para somar de forma simétrica
          const { data: existente } = await supabase
            .from("dash_vop")
            .select("vop_sec")
            .eq("mes_ano", item.mes_ano)
            .eq("cnpj", item.cnpj)
            .maybeSingle();

          const vSec = existente ? parseFloat(existente.vop_sec || 0) : 0;

          const payloadConsolidado = {
            mes_ano: item.mes_ano,
            cnpj: item.cnpj,
            cedente: item.cedente,
            vop_fidc: item.vop,
            vop_sec: vSec,
            vop_consolidado: vSec + item.vop,
            responsavel_id: item.respId,
            atualizado_em: new Date().toISOString()
          };

          const { error } = await supabase.from("dash_vop").upsert(payloadConsolidado, { onConflict: "mes_ano,cnpj" });
          if (error) throw error;
        }
      }

      alert(`🎉 Carga concluída!\nDRE analítico de Finanças atualizado e gráficos de VOP recalculados.`);
      setLinhasConciliadas([]);
      setStatusMsg("");
    } catch (err: any) {
      alert("❌ Falha crítica no salvamento financeiro: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 p-6 font-sans text-[13px] text-slate-700">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">🏦 Fluxo Unificado FIDC: VOP e Receitas (Black101)</h2>
          <span className="text-xs text-slate-500 font-medium">Extração síncrona do DRE em lote. O sistema calcula o Volume de Produção e a rentabilidade em uma única carga.</span>
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
            <span className="text-3xl">📥</span>
            <span className="font-bold text-slate-700">Carregar Relatório de Operações FIDC (.XLSX)</span>
            <span className="text-xs text-slate-400 font-mono">Processamento unificado de performance financeira com conciliação MDM.</span>
            <input type="file" accept=".xlsx" onChange={processarArquivoExcel} className="hidden" disabled={carregandoBase || processando} />
          </label>
        </div>
      )}

      {/* RESULTADO DA CONCILIAÇÃO */}
      {linhasConciliadas.length > 0 && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center font-bold">
            <span>Mesa Operacional de Performance Financeira (MDM)</span>
            <span className={`px-3 py-1 rounded text-xs ${totalPendentes === 0 ? "bg-emerald-600" : "bg-rose-600 animate-pulse"}`}>
              {totalPendentes === 0 ? "✓ Lote Consistente" : `⚠️ ${totalPendentes} amarração(ões) pendente(s)`}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                    <th className="p-4 w-72">Cedente na Planilha</th>
                    <th className="p-4 text-center w-36">Operações Lidas</th>
                    <th className="p-4 text-right w-40">Volume Total (VOP)</th>
                    <th className="p-4 text-right w-40">Receitas Totais</th>
                    <th className="p-4 w-64">Status / Resolução de Vínculo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {linhasConciliadas.map((linha, index) => (
                    <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${linha.status.startsWith("🔴") ? "bg-rose-50/20" : ""}`}>
                      <td className="p-4 font-black text-slate-900 uppercase truncate max-w-[280px]" title={linha.cedentePlanilha}>
                        {linha.cedentePlanilha}
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-500">{linha.operacoes.length}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900">{fM(linha.totalVop)}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600">{fM(linha.totalReceita)}</td>
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