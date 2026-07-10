/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { simplificarNome } from "@/actions/dashboard-service";

export default function MonitoreHistoricoPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarHistorico() {
      try {
        setCarregando(true);

        // 🎯 A MÁGICA DO RLS: Removemos o localStorage e os filtros manuais!
        // O Supabase intercepta essas chamadas e já devolve os dados filtrados pela hierarquia.
        const [resHist, resCadastro] = await Promise.all([
          supabase.from("historico_consolidado").select("*").order("data_processamento", { ascending: false }),
          supabase.from("cadastro_cedentes").select("cedente, risco_sec, risco_fidc")
        ]);

        if (resHist.data) {
          const filtradosLog = resHist.data;

          // Indexa os cadastros em um Map para evitar a lentidão de loop aninhado (.find) na memória
          const cadastroMap = new Map();
          resCadastro.data?.forEach(c => {
            cadastroMap.set(simplificarNome(c.cedente), (parseFloat(c.risco_sec || 0) + parseFloat(c.risco_fidc || 0)));
          });

          setDados(filtradosLog.map(linha => {
            const riscoConsolidado = cadastroMap.get(simplificarNome(linha.cedente)) || 0;
            return { ...linha, risco_aberto: riscoConsolidado };
          }));
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setCarregando(false); 
      }
    }
    carregarHistorico();
  }, []);

  // ==========================================================================
  // 🎨 UTILS DE FORMATAÇÃO VISUAL
  // ==========================================================================
  const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));
  const fD = (str: string) => str ? str.split("-").reverse().join("/") : "-";
  
  const filtrados = dados.filter(item => (item.cedente || "").toLowerCase().includes(busca.toLowerCase()));

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Montando linha do tempo histórica...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER & BUSCA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">📊 Histórico de Monitoramento</h2>
          <span className="text-xs text-slate-500 font-medium">Acompanhe a linha do tempo e a evolução de restritivos da carteira.</span>
        </div>
        
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔎</span>
          <input 
            type="text" 
            placeholder="Filtrar por cedente..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-xs text-slate-700 shadow-xs"
          />
        </div>
      </div>

      {/* TABELA DE HISTÓRICO */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                <th className="p-3 text-center w-28">Data</th>
                <th className="p-3 w-36">CNPJ</th>
                <th className="p-3 w-64">Cedente</th>
                <th className="p-3 text-right w-36">Risco Aberto</th>
                <th className="p-3 text-right w-32">Saldo Ant.</th>
                <th className="p-3 text-right w-36">Evolução</th>
                <th className="p-3 text-right w-36">Saldo Atual</th>
                <th className="p-3 w-64">Resumo Analítico</th>
                <th className="p-3 text-right w-28">PEFIN</th>
                <th className="p-3 text-right w-28">REFIN</th>
                <th className="p-3 text-right w-28">Protestos</th>
                <th className="p-3 text-right w-28">Ações Jud.</th>
                <th className="p-3 text-right w-28">Dív. Vencida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-10 text-center text-slate-400 font-bold italic">
                    Nenhum registro histórico encontrado para a sua busca ou carteira.
                  </td>
                </tr>
              ) : (
                filtrados.map((item, idx) => {
                  const evo = parseFloat(item.evolucao || 0);
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-normal whitespace-nowrap">{fD(item.data_processamento)}</td>
                      <td className="p-3 font-mono text-slate-400 text-xs whitespace-nowrap">{item.cnpj_cliente}</td>
                      <td className="p-3 font-black text-slate-900 truncate max-w-[250px]" title={item.cedente}>{item.cedente}</td>
                      <td className="p-3 text-right font-mono font-black text-blue-700 bg-blue-50/30 whitespace-nowrap border-r border-slate-50">{fM(item.risco_aberto)}</td>
                      <td className="p-3 text-right text-slate-400 whitespace-nowrap">{fM(item.saldo_anterior)}</td>
                      
                      {/* EVOLUÇÃO (Com Badges Padronizados) */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center justify-end gap-1 font-black px-2 py-0.5 rounded text-[11px] w-[120px] shadow-xs ${
                          evo === 0 ? "text-slate-500 bg-slate-100 border border-slate-200" : 
                          evo > 0 ? "text-rose-700 bg-rose-50 border border-rose-200" : 
                          "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        }`}>
                          {evo === 0 ? "•" : evo > 0 ? "▲" : "▼"} {fM(evo)}
                        </span>
                      </td>
                      
                      <td className="p-3 text-right font-mono font-black text-slate-900 whitespace-nowrap border-r border-slate-50">{fM(item.saldo_atual)}</td>
                      <td className="p-3 text-slate-500 text-[11px] leading-tight pr-4 border-r border-slate-50">{item.resumo_movimento || "Estável"}</td>
                      
                      {/* RESTRITIVOS DINÂMICOS (Fundo Rose) */}
                      {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(k => (
                        <td key={k} className={`p-3 text-right font-mono text-xs whitespace-nowrap ${
                          parseFloat(item[k]) > 0 ? "text-rose-600 font-bold bg-rose-50/40" : "text-slate-300 font-normal"
                        }`}>
                          {fM(item[k])}
                        </td>
                      ))}
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