/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function simplificarNome(nome: string): string {
  if (!nome) return "";
  let n = nome.trim().toUpperCase();
  n = n.replace(/\b(LTDA|SA|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, "");
  return n.replace(/\s+/g, " ").trim();
}

export default function FinalizadosPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarFinalizados() {
      try {
        setCarregando(true);

        const userStr = localStorage.getItem("intraned_user");
        let allowedCedentes: string[] = [];
        let isComercial = false;
        let userNome = "";

        if (userStr) {
          const user = JSON.parse(userStr);
          userNome = user.nome;
          const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
          
          if (cargoUser === "comercial") {
            isComercial = true;
            const { data: vinculos } = await supabase.from("cadastro_cedentes").select("cedente").eq("comercial", user.nome);
            if (vinculos) allowedCedentes = vinculos.map((c: any) => simplificarNome(c.cedente));
          }
        }

        // 🎯 Puxa as análises direto da sua tabela oficial public.analises
        let query = supabase.from("analises").select("*");
        
        if (isComercial) {
          query = query.eq("comercial", userNome);
        }

        const { data, error } = await query.order("criado_em", { ascending: false });

        if (error) throw error;

        if (data) {
          // 🎯 Fix: Filtra qualquer registro que NÃO esteja com status 'aberta' (ou seja, concluídos pela esteira)
          const concluidos = data.filter((item: any) => {
            const statusLimpo = String(item.status || "").toLowerCase().trim();
            return statusLimpo !== "aberta" && statusLimpo !== "";
          });

          // Dupla checagem de segurança para carteira comercial
          if (isComercial) {
            setDados(concluidos.filter(a => allowedCedentes.includes(simplificarNome(a.empresa_nome))));
          } else {
            setDados(concluidos);
          }
        }
      } catch (err) {
        console.error("Erro ao consultar a tabela analises:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarFinalizados();
  }, []);

  const fD = (str: string) => str ? new Date(str).toLocaleDateString("pt-BR") : "-";

  // Busca focada no nome da empresa (coluna oficial do seu banco)
  const filtrados = dados.filter(item => 
    (item.empresa_nome || "").toLowerCase().includes(busca.toLowerCase())
  );

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Consultando histórico da esteira de comitê...</div>;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-6 text-[13px]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">🏁 Análises Finalizadas (Histórico)</h2>
        <input 
          type="text" 
          placeholder="Buscar por empresa..." 
          value={busca} 
          onChange={(e) => setBusca(e.target.value)} 
          className="p-1.5 border border-slate-200 rounded text-xs outline-none bg-white focus:border-blue-500 w-64 font-bold" 
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
                <th className="p-3">ID da Análise</th>
                <th className="p-3">Empresa / Cedente</th>
                <th className="p-3">Assessor Comercial</th>
                <th className="p-3 text-center">Status Final</th>
                <th className="p-3 text-center">Data Recebimento</th>
                <th className="p-3 text-center">Data Conclusão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                    Nenhuma análise finalizada encontrada no histórico desta carteira.
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => {
                  const statusAtual = String(item.status || "").toLowerCase();
                  const badgeCor = statusAtual === "aprovado" 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-red-50 text-red-700 border border-red-200";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-slate-400 text-xs select-all truncate max-w-[120px]">
                        {item.id}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {item.empresa_nome}
                      </td>
                      <td className="p-3 text-slate-500">
                        {item.comercial || "Diretoria / Geral"}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-tight uppercase ${badgeCor}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-400 text-xs font-mono">
                        {item.data_recebimento ? fD(item.data_recebimento) : "-"}
                      </td>
                      <td className="p-3 text-center text-slate-500 text-xs font-mono">
                        {fD(item.criado_em)}
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