"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AnaliseFila {
  id: string;
  razao_social: string;
  cnpj: string;
  status: string;
  created_at: string;
}

export default function FilaAnalises() {
  const [analises, setAnalises] = useState<AnaliseFila[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buscarFilaAtiva();

    // 🔄 CONEXÃO EM TEMPO REAL: Se a IA terminar de processar no Render, a tabela atualiza na hora na tela!
    const canal = supabase
      .channel("fila_v8_updates")
      .on(
        "postgres_changes",
        { event: "*", scheme: "public", table: "analises_credito" },
        () => {
          buscarFilaAtiva(); // Recarrega se houver qualquer mudança
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const buscarFilaAtiva = async () => {
    try {
      // Traz tudo o que o robô está processando ou o que o humano precisa revisar
      const { data, error } = await supabase
        .from("analises_credito")
        .select("id, razao_social, cnpj, status, created_at")
        .in("status", ["em_processamento_ia", "em_revisao_humana"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setAnalises(data as any);
    } catch (err) {
      console.error("Erro ao carregar fila de monitoramento:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatarCnpj = (cnpj: string) => {
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) return cnpj;
    return `${limpo.substring(0, 2)}.${limpo.substring(2, 5)}.${limpo.substring(5, 8)}/${limpo.substring(8, 12)}-${limpo.substring(12, 14)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-6 text-xs font-mono text-indigo-500 animate-pulse">
        ⚡ Sincronizando monitor do Motor V8...
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans text-[13px]">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <span className="font-black text-slate-700 uppercase tracking-widest text-[11px] flex items-center gap-2">
          🤖 Monitor de Operações da Esteira V8 ({analises.length})
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
              <th className="p-3.5">Empresa</th>
              <th className="p-3.5">CNPJ</th>
              <th className="p-3.5">Status do Processamento</th>
              <th className="p-3.5 text-center">Entrada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-xs">
            {analises.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold bg-slate-50/50">
                  Nenhum documento sendo processado ou aguardando revisão no momento.
                </td>
              </tr>
            ) : (
              analises.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5 font-black text-slate-900 uppercase truncate max-w-[300px]">
                    {item.razao_social}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-slate-600">
                    {formatarCnpj(item.cnpj)}
                  </td>
                  <td className="p-3.5">
                    {item.status === "em_processamento_ia" ? (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 block animate-ping"></span>
                        🔮 Robô Extraindo PDFs...
                      </span>
                    ) : item.status === "em_revisao_humana" ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block"></span>
                        📋 Na Mesa do Analista
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                        {item.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center font-mono text-slate-500 font-bold">
                    {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}