"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MonitoreHistoricoPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarHistorico() {
      try {
        setCarregando(true);
        const [resHist, resCart] = await Promise.all([
          supabase.from("historico_consolidado").select("*").order("data_processamento", { ascending: false }),
          supabase.from("dash_carteira").select("*")
        ]);
        if (resHist.data) {
          setDados(resHist.data.map(linha => {
            const match = resCart.data?.find(c => c.cedente?.trim().toUpperCase() === linha.cedente?.trim().toUpperCase());
            return { ...linha, risco_aberto: match ? parseFloat(match.risco_consolidado || 0) : 0 };
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

  const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));
  const fD = (str: string) => str ? str.split("-").reverse().join("/") : "-";
  const filtrados = dados.filter(item => (item.cedente || "").toLowerCase().includes(busca.toLowerCase()));

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Montando linha do tempo...</div>;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto pb-4 text-[13px]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-200 pb-1.5">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">📊 Histórico de Monitoramento</h2>
        <input type="text" placeholder="Filtrar cedente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="p-1 border border-slate-200 rounded text-xs outline-none bg-white focus:border-blue-500 w-48 font-bold" />
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1700px] text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
              <th className="p-2.5 text-center">Data</th>
              <th className="p-2.5">CNPJ</th>
              <th className="p-2.5">Cedente</th>
              <th className="p-2.5 text-right">Risco Aberto</th>
              <th className="p-2.5 text-right">Saldo Ant.</th>
              <th className="p-2.5 text-right">Evolução</th>
              <th className="p-2.5 text-right">Saldo Atual</th>
              <th className="p-2.5 w-64">Resumo Analítico</th>
              <th className="p-2.5 text-right">PEFIN</th>
              <th className="p-2.5 text-right">REFIN</th>
              <th className="p-2.5 text-right">Protestos</th>
              <th className="p-2.5 text-right">Ações Jud.</th>
              <th className="p-2.5 text-right">Dív. Vencida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {filtrados.map((item, idx) => {
              const evo = parseFloat(item.evolucao || 0);
              return (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-2.5 text-center text-slate-400 font-normal whitespace-nowrap">{fD(item.data_processamento)}</td>
                  <td className="p-2.5 font-mono text-slate-400 text-xs whitespace-nowrap">{item.cnpj_cliente}</td>
                  <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{item.cedente}</td>
                  <td className="p-2.5 text-right font-bold text-blue-600 bg-blue-50/10 whitespace-nowrap">{fM(item.risco_aberto)}</td>
                  <td className="p-2.5 text-right text-slate-400 whitespace-nowrap">{fM(item.saldo_anterior)}</td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-xs ${evo > 0 ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50"}`}>
                      {evo > 0 ? "▲" : "▼"} {fM(evo)}
                    </span>
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">{fM(item.saldo_atual)}</td>
                  <td className="p-2.5 text-slate-400 max-w-xs text-xs whitespace-pre-wrap break-words font-medium leading-relaxed">{item.resumo_movimento || "Estável"}</td>
                  {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(k => (
                    <td key={k} className={`p-2.5 text-right whitespace-nowrap ${parseFloat(item[k]) > 0 ? "text-red-500 font-bold bg-red-50/30" : "text-slate-400 font-normal"}`}>{fM(item[k])}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}