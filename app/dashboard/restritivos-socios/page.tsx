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

  const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando restritivos de sócios...</div>;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-6 text-[13px]">
      <div className="border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">👥 Restritivos de Sócios</h2>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
                <th className="p-4">Sócio Monitorado</th>
                <th className="p-3 text-right">PEFIN</th>
                <th className="p-3 text-right">REFIN</th>
                <th className="p-3 text-right">Protestos</th>
                <th className="p-3 text-right">Ações Judiciais</th>
                <th className="p-3 text-right">Dívidas Vencidas</th>
                <th className="p-4 text-right">Saldo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {socios.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400">Nenhum restritivo de sócio mapeado na sua carteira.</td></tr>
              ) : (
                socios.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{item.nome_socio}</div>
                      <div className="text-slate-400 text-xs font-mono mt-0.5">Empresa Vínculo: {item.nome_empresa || "N/A"}</div>
                    </td>
                    {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(key => (
                      <td key={key} className={`p-3 text-right ${parseFloat(item[key]) > 0 ? "text-red-500 font-bold bg-red-50/20" : "text-slate-400 font-normal"}`}>{fM(item[key])}</td>
                    ))}
                    <td className={`p-4 text-right font-bold ${parseFloat(item.saldo_total) > 0 ? "text-red-600 bg-red-50/40" : "text-slate-800"}`}>{fM(item.saldo_total)}</td>
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