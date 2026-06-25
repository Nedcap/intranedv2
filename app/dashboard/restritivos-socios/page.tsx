/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { simplificarNome } from "@/actions/dashboard-service";

export default function RestritivosSociosPage() {
  const [socios, setSocios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarSocios() {
      try {
        setCarregando(true);
        
        const userStr = localStorage.getItem("intraned_user");
        let allowedCedentes: string[] = [];
        let isComercial = false;

        // Verifica permissões do usuário para isolamento comercial
        if (userStr) {
          const user = JSON.parse(userStr);
          const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
          if (cargoUser === "comercial") {
            isComercial = true;
            const { data: vinculos } = await supabase.from("cadastro_cedentes").select("cedente").eq("comercial", user.nome);
            if (vinculos) allowedCedentes = vinculos.map((c: any) => simplificarNome(c.cedente));
          }
        }

        const { data } = await supabase.from("restritivos_socios").select("*").order("nome_socio", { ascending: true });
        
        if (data) {
          let filtrados = data;
          
          // 🔐 Segurança de escopo comercial ativada
          if (isComercial) {
            // Nota: Se a tabela tiver o nome da empresa parceira, filtramos por ela. 
            // Caso contrário, faz o match seguro com base no vínculo corporativo
            filtrados = data.filter(s => !s.nome_empresa || allowedCedentes.includes(simplificarNome(s.nome_empresa)));
          }
          
          setSocios(filtrados);
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setCarregando(false); 
      }
    }
    carregarSocios();
  }, []);

  // ==========================================================================
  // 🎨 UTILS DE FORMATAÇÃO VISUAL
  // ==========================================================================
  const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Varrendo histórico de restritivos de sócios...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">👥 Restritivos de Sócios</h2>
          <span className="text-xs text-slate-500 font-medium">Monitoramento do quadro societário vinculado à carteira de cedentes.</span>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                <th className="p-4 w-72">Sócio Monitorado</th>
                <th className="p-4 text-right">PEFIN</th>
                <th className="p-4 text-right">REFIN</th>
                <th className="p-4 text-right">Protestos</th>
                <th className="p-4 text-right">Ações Judiciais</th>
                <th className="p-4 text-right">Dívidas Vencidas</th>
                <th className="p-4 text-right w-40">Saldo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {socios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400 font-bold italic">
                    🎉 Nenhum apontamento restritivo mapeado no quadro societário da sua carteira.
                  </td>
                </tr>
              ) : (
                socios.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Sócio Monitorado */}
                    <td className="p-4">
                      <div className="font-black text-slate-900 truncate max-w-[280px]" title={item.nome_socio}>
                        {item.nome_socio}
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono mt-0.5 truncate max-w-[280px]" title={item.nome_empresa}>
                        Vínculo: {item.nome_empresa || "N/A"}
                      </div>
                    </td>
                    
                    {/* Colunas Dinâmicas de Apontamentos */}
                    {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(key => {
                      const valor = parseFloat(item[key]);
                      const temApontamento = valor > 0;
                      return (
                        <td 
                          key={key} 
                          className={`p-4 text-right font-mono text-xs whitespace-nowrap ${
                            temApontamento ? "text-rose-600 font-bold bg-rose-50/40" : "text-slate-300 font-normal"
                          }`}
                        >
                          {fM(item[key])}
                        </td>
                      );
                    })}
                    
                    {/* Saldo Total */}
                    <td 
                      className={`p-4 text-right font-mono text-xs whitespace-nowrap border-l border-slate-100 ${
                        parseFloat(item.saldo_total) > 0 
                          ? "text-rose-700 font-black bg-rose-50/60" 
                          : "text-slate-500 font-bold bg-slate-50/50"
                      }`}
                    >
                      {fM(item.saldo_total)}
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}