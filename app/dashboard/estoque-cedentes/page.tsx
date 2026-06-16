/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TituloEstoque {
  id?: string;
  cedente: string;
  sacado: string;
  documento: string;
  vencimento: string;
  valorNominal: number;
  precoAquisicao: number;
  prazoDias: number;
  colunaPrazoMassa: number;
  colunaTaxaMassa: number;
  taxaFinalCalculada: number;
}

export default function AnaliseEstoqueCedentesPage() {
  const [titulos, setTitulos] = useState<TituloEstoque[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [statusTexto, setStatusStatusTexto] = useState("");
  const [cedenteExpandido, setCedenteExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Carrega os dados sincronizados do banco para toda a mesa de crédito
  const buscarEstoqueDoBanco = async () => {
    try {
      setCarregando(true);
      setStatusStatusTexto("Sincronizando dados com o banco...");
      const { data, error } = await supabase
        .from("estoque_fidc")
        .select("*")
        .order("valor_nominal", { ascending: false });

      if (error) throw error;
      if (data) {
        const mapeados = data.map((d: any) => ({
          id: d.id,
          cedente: d.cedente,
          sacado: d.sacado,
          documento: d.documento,
          vencimento: d.vencimento,
          valorNominal: Number(d.valor_nominal),
          precoAquisicao: Number(d.preco_aquisicao),
          prazoDias: Number(d.prazo_dias),
          colunaPrazoMassa: Number(d.coluna_prazo_massa),
          colunaTaxaMassa: Number(d.coluna_taxa_massa),
          taxaFinalCalculada: Number(d.taxa_final_calculada)
        }));
        setTitulos(mapeados);
      }
    } catch (err: any) {
      console.error("Erro ao ler banco:", err);
    } finally {
      setCarregando(false);
      setStatusStatusTexto("");
    }
  };

  useEffect(() => {
    buscarEstoqueDoBanco();
  }, []);

  // Upload Destrutivo Clean: Apaga a base antiga e injeta a nova computando as 4 colunas
  const handleImportarEstoqueDestrutivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmar = confirm("⚠️ ATENÇÃO: Deseja limpar TODO o estoque antigo no Supabase e carregar esta nova base diária?");
    if (!confirmar) return;

    setCarregando(true);
    try {
      setStatusStatusTexto("Limpando registros do estoque anterior...");
      // Deleta tudo de forma segura
      await supabase.from("estoque_fidc").delete().neq("cedente", "");

      setStatusStatusTexto("Lendo arquivo local...");
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/);
        let startIdx = 0;

        if (lines[0] && lines[0].includes("sep=")) startIdx = 1;
        while (startIdx < lines.length && !lines[startIdx].trim()) startIdx++;

        const parseLineCSV = (linhaTexto: string) => {
          const colunas = [];
          let dentroDeAspas = false;
          let celulaAcumulada = "";
          for (let i = 0; i < linhaTexto.length; i++) {
            const char = linhaTexto[i];
            if (char === '"') dentroDeAspas = !dentroDeAspas;
            else if (char === ',' && !dentroDeAspas) {
              colunas.push(celulaAcumulada.trim().replace(/^"|"$/g, ""));
              celulaAcumulada = "";
            } else {
              celulaAcumulada += char;
            }
          }
          colunas.push(celulaAcumulada.trim().replace(/^"|"$/g, ""));
          return colunas;
        };

        const headers = parseLineCSV(lines[startIdx]);

        const idxCedente = headers.indexOf("NOME_DO_CEDENTE");
        const idxSacado = headers.indexOf("NOME_DO_SACADO");
        const idxDoc = headers.indexOf("NUMERO_DOCUMENTO");
        const idxVencimento = headers.indexOf("DATA_DE_VENCIMENTO_AJUSTADA");
        const idxNominal = headers.indexOf("VALOR_NOMINAL");
        const idxPrecoAquisicao = headers.indexOf("PRECO_DE_AQUISICAO");
        const idxPrazoNativo = headers.indexOf("PRAZO_ATUAL");

        const payloadParaInsercao: any[] = [];

        for (let i = startIdx + 1; i < lines.length; i++) {
          const linha = lines[i].trim();
          if (!linha) continue;

          const colunas = parseLineCSV(linha);
          if (!colunas[idxCedente] || !colunas[idxNominal]) continue;

          const valorNominal = parseFloat(colunas[idxNominal]) || 0;
          const precoAquisicao = parseFloat(colunas[idxPrecoAquisicao]) || valorNominal;
          const prazoDias = Math.max(parseInt(colunas[idxPrazoNativo]) || 1, 1);

          // Formulação matemática das 4 colunas em memória
          const taxaFinalCalculada = Math.pow(1 + (valorNominal - precoAquisicao) / (precoAquisicao || 1), 30 / prazoDias) - 1;
          const colunaPrazoMassa = prazoDias * valorNominal;
          const colunaTaxaMassa = taxaFinalCalculada * valorNominal;

          payloadParaInsercao.push({
            cedente: colunas[idxCedente].toUpperCase().trim(),
            sacado: colunas[idxSacado] || "SACADO NÃO IDENTIFICADO",
            documento: colunas[idxDoc] || "-",
            vencimento: colunas[idxVencimento] || "-",
            valor_nominal: valorNominal,
            preco_aquisicao: precoAquisicao,
            prazo_dias: prazoDias,
            coluna_prazo_massa: colunaPrazoMassa,
            coluna_taxa_massa: colunaTaxaMassa,
            taxa_final_calculada: taxaFinalCalculada
          });
        }

        setStatusStatusTexto(`Injetando ${payloadParaInsercao.length} títulos no Supabase...`);
        const batchSize = 400;
        for (let k = 0; k < payloadParaInsercao.length; k += batchSize) {
          const chunk = payloadParaInsercao.slice(k, k + batchSize);
          await supabase.from("estoque_fidc").insert(chunk);
        }

        alert(`🏁 Sucesso! Base sincronizada globalmente com ${payloadParaInsercao.length} registros.`);
        await buscarEstoqueDoBanco();
      };
      reader.readAsText(file, "UTF-8");
    } catch (err: any) {
      alert(`❌ Erro ao processar carga: ${err.message}`);
      setCarregando(false);
    }
  };

  // Compila a visão dinâmica agrupada por cedente
  const carteiraCedentes = useMemo(() => {
    const mapa: Record<string, TituloEstoque[]> = {};
    titulos.forEach(t => {
      if (!mapa[t.cedente]) mapa[t.cedente] = [];
      mapa[t.cedente].push(t);
    });

    return Object.keys(mapa).map(nomeCedente => {
      const lista = mapa[nomeCedente];
      const valorNominalTotal = lista.reduce((acc, curr) => acc + curr.valorNominal, 0);
      const { somaMassaTaxa, somaMassaPrazo } = lista.reduce((acumulador, item) => {
        acumulador.somaMassaTaxa += item.colunaTaxaMassa;
        acumulador.somaMassaPrazo += item.colunaPrazoMassa;
        return acumulador;
      }, { somaMassaTaxa: 0, somaMassaPrazo: 0 });

      return {
        cedente: nomeCedente,
        valorNominalTotal,
        taxaMediaPonderada: valorNominalTotal > 0 ? (somaMassaTaxa / valorNominalTotal) * 100 : 0,
        prazoMedioPonderado: valorNominalTotal > 0 ? (somaMassaPrazo / valorNominalTotal) : 0,
        titulos: lista
      };
    }).sort((a, b) => b.valorNominalTotal - a.valorNominalTotal);
  }, [titulos]);

  const filtrados = useMemo(() => {
    return carteiraCedentes.filter(c => c.cedente.toLowerCase().includes(busca.toLowerCase()));
  }, [carteiraCedentes, busca]);

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700 p-4">
      
      {/* CONTROL BAR */}
      <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">💼 Análise de Estoque por Cedente (FIDC)</h2>
          <p className="text-xs text-slate-400">Visão consolidada dinâmica calculada a partir do estoque oficial.</p>
        </div>
        <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-xs uppercase tracking-wider text-[10px]">
          📥 CARREGAR BASE DIÁRIA DE ESTOQUE
          <input type="file" accept=".csv" onChange={handleImportarEstoqueDestrutivo} className="hidden" disabled={carregando} />
        </label>
      </div>

      {carregando && (
        <div className="p-6 font-bold text-center bg-blue-50 text-blue-700 rounded-xl border border-blue-100 animate-pulse">
          ⏳ {statusTexto || "Carregando dados..."}
        </div>
      )}

      {titulos.length > 0 && (
        <div className="bg-white p-2 border border-slate-200 rounded-xl shadow-xs">
          <input type="text" placeholder="🔍 Filtrar cedente na lista..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none font-medium text-slate-800" />
        </div>
      )}

      {/* CARDS CONTAINER */}
      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="p-12 border border-dashed border-slate-300 rounded-xl text-center text-slate-400 font-medium bg-white">
            Nenhum dado encontrado. Faça o upload do arquivo de estoque para alimentar a mesa.
          </div>
        ) : (
          filtrados.map((item) => {
            const isExpandido = cedenteExpandido === item.cedente;

            return (
              <div key={item.cedente} className={`bg-white border transition-all rounded-xl shadow-2xs overflow-hidden ${isExpandido ? "border-blue-500 ring-1 ring-blue-500/10" : "border-slate-200 hover:border-slate-300"}`}>
                
                <div onClick={() => setCedenteExpandido(isExpandido ? null : item.cedente)} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer bg-gradient-to-r from-white to-slate-50/20 select-none">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-blue-600">Empresa</span>
                    <h3 className="font-black text-slate-900 text-[13px] tracking-tight">{item.cedente}</h3>
                  </div>

                  <div className="flex items-center gap-8 text-right self-stretch sm:self-auto justify-between sm:justify-end">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">Nominal Total</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{formatarMoeda(item.valorNominalTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">Taxa Média</span>
                      <span className="font-mono font-black text-emerald-600">{item.taxaMediaPonderada.toFixed(2)}% a.m.</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">Prazo Ponderado</span>
                      <span className="font-mono font-black text-blue-900">{Math.round(item.prazoMedioPonderado)} dias</span>
                    </div>
                    <div className="text-slate-400 font-bold px-1">{isExpandido ? "▲" : "▼"}</div>
                  </div>
                </div>

                {isExpandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-fadeIn">
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[10px] font-black uppercase">
                            <th className="p-2">Sacado</th>
                            <th className="p-2 text-center">Nº Documento</th>
                            <th className="p-2 text-center">Vencimento</th>
                            <th className="p-2 text-center">Prazo</th>
                            <th className="p-2 text-right">Valor Nominal</th>
                            <th className="p-2 text-right">Taxa Final</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                          {item.titulos.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2 font-bold text-slate-900 truncate max-w-[280px]">{t.sacado}</td>
                              <td className="p-2 text-center font-mono text-slate-400">{t.documento}</td>
                              <td className="p-2 text-center text-slate-500">{t.vencimento}</td>
                              <td className="p-2 text-center font-mono text-blue-900 font-bold">{t.prazoDias}d</td>
                              <td className="p-2 text-right font-mono text-slate-900">{formatarMoeda(t.valorNominal)}</td>
                              <td className="p-2 text-right font-mono text-emerald-600 font-bold">{(t.taxaFinalCalculada * 100).toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}