/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { simplificarNome } from "@/actions/dashboard-service";

export default function RevisaoPage() {
  const [revisoes, setRevisoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarRevisoes = async () => {
    try {
      setCarregando(true);
      
      const userStr = localStorage.getItem("intraned_user");
      let query = supabase.from("revisao_cedentes").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
        
        // 🔐 Segurança de escopo comercial ativada direto na query nativa
        if (cargoUser === "comercial") {
          query = query.eq("comercial", user.nome);
        }
      }

      const { data } = await query.order("data_proxima_renovacao", { ascending: true });
      if (data) setRevisoes(data);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setCarregando(false); 
    }
  };

  useEffect(() => { carregarRevisoes(); }, []);

  const renovarCedenteWeb = async (item: any) => {
    if (!confirm(`Confirmar a renovação de ${item.cedente} por mais 180 dias?`)) return;
    try {
      const hoje = new Date();
      const ultima = hoje.toISOString().split("T")[0];
      const proxima = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      // 🎯 Fix: Atualização indexada e blindada pelo ID único do registro no banco
      const { error } = await supabase
        .from("revisao_cedentes")
        .update({ 
          data_ultima_renovacao: ultima, 
          data_proxima_renovacao: proxima, 
          ultimo_email_enviado: null 
        })
        .eq("id", item.id);

      if (error) throw error;

      alert("📅 Limite renovado com sucesso!"); 
      carregarRevisoes();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao renovar: ${err.message}`);
    }
  };

  // ==========================================================================
  // 🎨 UTILS DE FORMATAÇÃO VISUAL
  // ==========================================================================
  const fData = (str: string) => str ? str.split("-").reverse().join("/") : "-";

  const getStatusVencimento = (dataStr: string) => {
    if (!dataStr) return { cor: "bg-slate-100 text-slate-600 border-slate-200", alerta: "" };
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(dataStr + "T12:00:00");
    const diffDias = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) return { cor: "bg-rose-50 text-rose-700 border-rose-200", alerta: "🔴" };
    if (diffDias <= 30) return { cor: "bg-amber-50 text-amber-700 border-amber-200", alerta: "🟡" };
    return { cor: "bg-emerald-50 text-emerald-700 border-emerald-200", alerta: "🟢" };
  };

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando cronograma de renovações...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">📅 Revisão de Cedentes</h2>
          <span className="text-xs text-slate-500 font-medium">Acompanhe os vencimentos de limite e pendências documentais da carteira.</span>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                <th className="p-4 w-64">Cedente</th>
                <th className="p-4 w-32">Comercial</th>
                <th className="p-4 text-center w-32">Última Renovação</th>
                <th className="p-4 text-center w-40">Próxima Expiração</th>
                <th className="p-4 w-[350px]">Pendências Documentais</th>
                <th className="p-4 text-center w-32">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {revisoes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-bold italic">
                    🎉 Nenhum vencimento de limite agendado para a sua carteira!
                  </td>
                </tr>
              ) : (
                revisoes.map((item, idx) => {
                  const status = getStatusVencimento(item.data_proxima_renovacao);
                  const temPendencia = item.pendencias && item.pendencias.trim().length > 0;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* Cedente */}
                      <td className="p-4 font-black text-slate-900 truncate max-w-[250px]" title={item.cedente}>
                        {item.cedente}
                      </td>
                      
                      {/* Comercial */}
                      <td className="p-4 text-slate-500 text-xs font-bold uppercase">
                        {item.comercial || "-"}
                      </td>
                      
                      {/* Última Renovação */}
                      <td className="p-4 text-center text-slate-400">
                        {fData(item.data_ultima_renovacao)}
                      </td>
                      
                      {/* Próxima Expiração (Com Status Visual) */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wide border shadow-xs ${status.cor}`}>
                          {status.alerta} {fData(item.data_proxima_renovacao)}
                        </span>
                      </td>
                      
                      {/* Pendências */}
                      <td className="p-4 text-xs leading-relaxed">
                        {temPendencia ? (
                          <div className="flex gap-2 items-start text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-100">
                            <span className="mt-0.5">⚠️</span>
                            <span className="whitespace-pre-wrap break-words">{item.pendencias}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Nenhuma pendência cadastrada.</span>
                        )}
                      </td>
                      
                      {/* Ações */}
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => renovarCedenteWeb(item)} 
                          className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          Renovar
                        </button>
                      </td>
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