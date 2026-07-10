/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";

// ============================================================================
// 🧽 UTILS DE LIMPEZA E TRATAMENTO DE FORMATOS (BLINDADO CONTRA ASPAS)
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

// ⚡ Parser inteligente de CSV que lida com aspas nativamente
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
  
  // 🛡️ Remove aspas duplas, simples, R$ e espaços antes de fazer a conta
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
  // 🛡️ Arranca qualquer aspa residual antes de quebrar a data
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
  // 🛡️ Arranca aspas da data aqui também
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

      const idxNumTitulo = findCol(["SNUM", "SEQTIT", "NOSSONUM", "NUMERODOTITULO"], ["QTD", "VALOR"]);
      const idxSituacao = findCol(["SITUACAO", "STATUS"]);
      const idxVencimento = findCol(["VENCIMENTO", "DTAVCTO", "VCTO"]);
      const idxValorFace = findCol(["VALORFACE", "VLRFACE", "VALORDOTITULO"], ["ABERTO", "PAGO", "LIQUIDO"]);
      const idxValorAberto = findCol(["VALORABERTO", "VLRABERTO", "SALDO", "EMABERTO"]);
      const idxAtr = findCol(["ATR", "ATRASO", "DIAS"]);
      const idxValorPago = findCol(["VALORPAGO", "VLRPAGO", "PAGO"]);
      const idxDataLiq = findCol(["DATALIQUIDACAO", "DTALIQ", "LIQUIDACAO", "PAGAMENTO"]);
      const idxAgNeg = findCol(["AGNEG", "AGENEG", "ASSESSOR", "GERENTE", "COMERCIAL"]);
      const idxAditivo = findCol(["ADITIVO", "BORDERO"]);
      const idxDtaNeg = findCol(["DATANEGOCIACAO", "DTANEG", "OPERACAO"]);

      if (idxValorAberto === -1 && idxValorFace === -1) {
        alert("⚠️ Arquivo Incompatível!\n\nNão encontrei colunas financeiras (Ex: Valor Aberto, Valor Face). Parece que você importou um 'Relatório de Cadastros' no lugar do relatório da Carteira.");
        setProcessando(false);
        return;
      }

      const agrupamento: Record<string, any[]> = {};

      for (let i = headerIdx + 1; i < linhasRaw.length; i++) {
        const row = linhasRaw[i];
        if (!row || row.length <= idxCedente) continue;

        // Tira as aspas dos nomes também por precaução
        const rawCedente = String(row[idxCedente] || "").replace(/['"]/g, "").trim();
        if (!rawCedente || rawCedente.toUpperCase().includes("TOTAL") || rawCedente.toUpperCase() === "CEDENTE") continue;

        if (!agrupamento[rawCedente]) {
          agrupamento[rawCedente] = [];
        }

        const vencimentoRaw = String(row[idxVencimento] || "").trim();
        const statusVencimento = checarSeVencido(vencimentoRaw);

        agrupamento[rawCedente].push({
          sacado: idxSacado !== -1 ? String(row[idxSacado] || "").replace(/['"]/g, "").trim().toUpperCase() : "-",
          numero_titulo: idxNumTitulo !== -1 ? String(row[idxNumTitulo] || "").replace(/['"]/g, "").trim() : "-",
          situacao: idxSituacao !== -1 ? String(row[idxSituacao] || "").replace(/['"]/g, "").trim().toUpperCase() : "ABERTO",
          vencimento: converteDataParaISO(vencimentoRaw),
          valor_face: idxValorFace !== -1 ? parseValorReal(row[idxValorFace]) : 0,
          valor_aberto: idxValorAberto !== -1 ? parseValorReal(row[idxValorAberto]) : 0,
          dias_atraso: idxAtr !== -1 ? parseInteiro(row[idxAtr]) : 0,
          valor_pago: idxValorPago !== -1 ? parseValorReal(row[idxValorPago]) : 0,
          data_liquidacao: idxDataLiq !== -1 ? converteDataParaISO(row[idxDataLiq]) : null,
          gerente_comercial: idxAgNeg !== -1 ? String(row[idxAgNeg] || "").replace(/['"]/g, "").trim().toUpperCase() : null,
          aditivo: idxAditivo !== -1 ? String(row[idxAditivo] || "").replace(/['"]/g, "").trim() : null,
          data_negociacao: idxDtaNeg !== -1 ? converteDataParaISO(row[idxDtaNeg]) : null,
          status: statusVencimento
        });
      }

      const resultadoConciliado: LinhaConciliacao[] = [];

      for (const [cedentePlanilha, titulosCedente] of Object.entries(agrupamento)) {
        const nomePlanilhaLimpo = limparNome(cedentePlanilha);
        const matchSistema = cedentesSistema.find(c => limparNome(c.cedente) === nomePlanilhaLimpo);

        const totalAberto = titulosCedente.reduce((acc, t) => acc + t.valor_aberto, 0);
        const totalVencido = titulosCedente.reduce((acc, t) => t.status === "Vencido" ? acc + t.valor_aberto : acc, 0);

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

  // ============================================================================
  // ⚡ FUNÇÃO DE AUTO-CADASTRO INTELIGENTE (EVITA DUPLICIDADE DE CNPJ)
  // ============================================================================
  const handleAutoCadastrarCedente = async (nomePlanilha: string, index: number) => {
    const cnpjPrompt = prompt(`Insira o CNPJ (Apenas números - 14 dígitos) para a empresa:\n${nomePlanilha.toUpperCase()}`);
    if (!cnpjPrompt) return;
    
    const cnpjLimpo = cnpjPrompt.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      alert("❌ CNPJ inválido! Deve conter exatamente 14 dígitos.");
      return;
    }

    // 🔍 Verifica se esse CNPJ já existe na base para não violar a chave única
    const cedenteExistente = cedentesSistema.find(c => c.cnpj === cnpjLimpo);

    if (cedenteExistente) {
      setLinhasConciliadas(prev => {
        const copia = [...prev];
        copia[index].cnpjCadastrado = cedenteExistente.cnpj;
        copia[index].responsavelId = cedenteExistente.responsavel_id;
        copia[index].status = "🟢 PRONTO";
        return copia;
      });
      alert(`✅ Esse CNPJ já estava cadastrado no sistema sob o nome "${cedenteExistente.cedente}". O vínculo foi realizado!`);
      return;
    }

    setProcessando(true);
    try {
      const { data: novoCedente, error } = await supabase
        .from("cadastro_cedentes")
        .insert({
          id: crypto.randomUUID(),
          cnpj: cnpjLimpo,
          cedente: nomePlanilha.toUpperCase().trim(),
          atualizado_em: new Date().toISOString()
        })
        .select("id, cnpj, cedente, responsavel_id")
        .single();

      if (error) throw error;

      setLinhasConciliadas(prev => {
        const copia = [...prev];
        copia[index].cnpjCadastrado = novoCedente.cnpj;
        copia[index].responsavelId = novoCedente.responsavel_id;
        copia[index].status = "🟢 PRONTO";
        return copia;
      });

      setCedentesSistema(prev => [...prev, novoCedente]);
      alert(`⚡ ${nomePlanilha.toUpperCase()} cadastrada com sucesso!`);
    } catch (err: any) {
      alert("❌ Falha ao cadastrar: " + err.message);
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
      copia[index].status = match.cnpj ? "🟢 PRONTO" : "🔴 CEDENTE NÃO LOCALIZADO NO SISTEMA";
      return copia;
    });
  };

  const totalPendentes = useMemo(() => {
    return linhasConciliadas.filter(l => l.status.startsWith("🔴")).length;
  }, [linhasConciliadas]);

  const transferirDadosProSupabase = async () => {
    if (totalPendentes > 0) {
      alert("⚠️ Vincule ou Cadastre todos os cedentes antes de sincronizar a carteira!");
      return;
    }

    setProcessando(true);
    setStatusMsg("🚀 Sincronizando tabelão de carteira...");

    try {
      const cnpjsParaLimpar = [...new Set(linhasConciliadas.map(l => l.cnpjCadastrado).filter(Boolean))];

      const { error: errorClean } = await supabase
        .from("carteira_sec")
        .delete()
        .in("cnpj_cedente", cnpjsParaLimpar);

      if (errorClean) throw errorClean;

      const payloadCarteira: any[] = [];

      for (const linha of linhasConciliadas) {
        if (!linha.cnpjCadastrado) continue;

        linha.titulos.forEach(t => {
          payloadCarteira.push({
            cnpj_cedente: linha.cnpjCadastrado,
            cedente: linha.cedentePlanilha.toUpperCase(),
            sacado: t.sacado,
            numero_titulo: t.numero_titulo,
            situacao: t.situacao,
            vencimento: t.vencimento,
            valor_face: t.valor_face,
            valor_aberto: t.valor_aberto,
            dias_atraso: t.dias_atraso,
            valor_pago: t.valor_pago,
            data_liquidacao: t.data_liquidacao,
            gerente_comercial: t.gerente_comercial,
            aditivo: t.aditivo,
            data_negociacao: t.data_negociacao,
            status: t.status,
            responsavel_id: linha.responsavelId
          });
        });
      }

      if (payloadCarteira.length > 0) {
        const chunk = 400; 
        for (let i = 0; i < payloadCarteira.length; i += chunk) {
          const { error } = await supabase.from("carteira_sec").insert(payloadCarteira.slice(i, i + chunk));
          if (error) throw error;
        }
      }

      alert(`🎉 Sucesso total!\n${payloadCarteira.length} títulos adicionados à carteira SEC.`);
      setLinhasConciliadas([]);
      setStatusMsg("");
    } catch (err: any) {
      alert("❌ Falha na gravação dos lotes: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 p-6 font-sans text-[13px] text-slate-700">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">🏦 Carga Máxima: Carteira SEC (Qprof)</h2>
          <span className="text-xs text-slate-500 font-medium">Alimentação síncrona do tabelão analítico de títulos (carteira_sec).</span>
        </div>
        <button
          onClick={transferirDadosProSupabase}
          disabled={processando || linhasConciliadas.length === 0 || totalPendentes > 0}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer uppercase tracking-wider text-xs"
        >
          {processando ? "⏳ Sincronizando..." : "☁️ Enviar para o Banco de Dados"}
        </button>
      </div>

      {statusMsg && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg font-bold text-center animate-pulse">{statusMsg}</div>}

      {linhasConciliadas.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center shadow-xs">
          <label className="flex flex-col items-center justify-center cursor-pointer gap-2">
            <span className="text-3xl">📊</span>
            <span className="font-bold text-slate-700">Carregar Relatório Analítico de Carteira/Cobrança Qprof (.CSV)</span>
            <span className="text-xs text-slate-400 font-mono">Processamento unificado de segurança com tolerância a BOM/Separadores.</span>
            <input type="file" accept=".csv" onChange={processarArquivoCSV} className="hidden" disabled={processando} />
          </label>
        </div>
      )}

      {linhasConciliadas.length > 0 && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center font-bold">
            <span>Validação de Consistência cadastral (MDM)</span>
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
                      <td className="p-4 font-black text-slate-900 uppercase truncate max-w-[280px]" title={linha.cedentePlanilha}>{linha.cedentePlanilha}</td>
                      <td className="p-4 text-center font-mono font-bold text-slate-500">{linha.titulos.length}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900">{fM(linha.totalAberto)}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-600">{fM(linha.totalVencido)}</td>
                      <td className="p-4">
                        {linha.status.startsWith("🟢") ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-emerald-700 font-black text-[11px]">{linha.status}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">CNPJ: {linha.cnpjCadastrado}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex-1">
                              <span className="text-rose-600 font-black text-[11px] block leading-tight mb-1">{linha.status}</span>
                              <select
                                onChange={(e) => handleVincularManualmente(index, e.target.value)}
                                className="p-1.5 border border-slate-300 rounded bg-white text-xs font-bold text-slate-700 outline-none w-full max-w-[240px]"
                                defaultValue=""
                              >
                                <option value="" disabled>Vincular com Cadastrado...</option>
                                {cedentesSistema.map(c => (
                                  <option key={c.id} value={c.id}>{c.cedente} ({c.cnpj || "Sem CNPJ"})</option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAutoCadastrarCedente(linha.cedentePlanilha, index)}
                              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase rounded shadow-xs cursor-pointer h-8 self-end transition-colors"
                            >
                              ⚡ Auto-Cadastrar
                            </button>
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