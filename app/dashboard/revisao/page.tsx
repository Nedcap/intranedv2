"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RevisaoPage() {
  const [revisoes, setRevisoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarRevisoes = async () => {
    try {
      setCarregando(true);
      const { data } = await supabase.from("revisao_cedentes").select("*").order("data_proxima_renovacao", { ascending: true });
      if (data) setRevisoes(data);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setCarregando(false); 
    }
  };

  useEffect(() => { carregarRevisoes(); }, []);

  const renovarCedenteWeb = async (nome: string) => {
    if (!confirm(`Confirmar a renovação de ${nome}?`)) return;
    try {
      const hoje = new Date();
      const ultima = hoje.toISOString().split("T")[0];
      const proxima = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      await supabase.from("revisao_cedentes").update({ data_ultima_renovacao: ultima, data_proxima_renovacao: proxima, ultimo_email_enviado: null }).eq("cedente", nome);
      alert("📅 Limite renovado!"); carregarRevisoes();
    } catch (err) {
      console.error(err);
      alert("Erro ao renovar.");
    }
  };

  const fData = (str: string) => str ? str.split("-").reverse().join("/") : "-";

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-6 text-[13px]">
      <div className="border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">📅 Revisão de Cedentes</h2>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
              <th className="p-3">Cedente</th>
              <th className="p-3">Comercial</th>
              <th className="p-3 text-center">Última Renovação</th>
              <th className="p-3 text-center">Próxima Expiração</th>
              <th className="p-3 w-[350px]">Pendências Documentais</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {revisoes.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-900">{item.cedente}</td>
                <td className="p-3 text-slate-500">{item.comercial || "-"}</td>
                <td className="p-3 text-center text-slate-500">{fData(item.data_ultima_renovacao)}</td>
                <td className="p-3 text-center">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded border border-slate-200 text-xs">{fData(item.data_proxima_renovacao)}</span>
                </td>
                <td className="p-3 text-slate-500 whitespace-pre-wrap break-words text-xs leading-relaxed">{item.pendencias || "Nenhuma cadastrada."}</td>
                <td className="p-3 text-center">
                  <button onClick={() => renovarCedenteWeb(item.cedente)} className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded text-xs cursor-pointer">✅ RENOVAR</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}