/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { simplificarNome } from "@/actions/dashboard-service";

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

        if (userStr) {
          const user = JSON.parse(userStr);
          const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
          if (cargoUser === "comercial") {
            isComercial = true;
            const { data: vinculos } = await supabase.from("cadastro_cedentes").select("cedente").eq("comercial", user.nome);
            if (vinculos) allowedCedentes = vinculos.map((c: any) => simplificarNome(c.cedente));
          }
        }

        // Puxa análises do histórico finalizado
        const { data } = await supabase
          .from("analises")
          .select("*")
          .in("status", ["Aprovado", "Reprovado", "Recusado"])
          .order("atualizado_em", { ascending: false });

        if (data) {
          let listaFiltrada = data;
          if (isComercial) {
            listaFiltrada = data.filter(a => allowedCedentes.includes(simplificarNome(a.empresa_nome)));
          }
          setDados(listaFiltrada);
        }
      } catch (err) {
        console.error("Erro ao carregar finalizados:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarFinalizados();
  }, []);

  const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));
  const fD = (str: string) => str ? new Date(str).toLocaleDateString("pt-BR") : "-";

  const filtrados = dados.filter(item => 
    (item.empresa_nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (item.cnpj || "").includes(busca)
  );

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando histórico finalizado...</div>;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-6 text-[13px]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">🏁 Análises Finalizadas (Histórico)</h2>
        <input 
          type="text" 
          placeholder="Buscar por empresa ou CNPJ..." 
          value={busca} 
          onChange={(e) => setBusca(e.target.value)} 
          className="p-1.5 border border-slate-200 rounded text-xs outline-none bg-white focus:border-blue-500 w-64 font-bold" 
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
                <th className="p-3">Empresa / Cedente</th>
                <th className="p-3">CNPJ</th>
                <th className="p-3">Comercial</th>
                <th className="p-3 text-right">Limite Solicitado</th>
                <th className="p-3 text-center">Status Final</th>
                <th className="p-3 text-center">Data Conclusão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                    Nenhuma análise finalizada encontrada.
                  </td>
                </tr>
              ) : (
                filtrados.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{item.empresa_nome}</div>
                      {item.grupo && <div className="text-slate-400 text-xs font-medium">Grupo: {item.grupo}</div>}
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-xs">{item.cnpj || "-"}</td>
                    <td className="p-3 text-slate-500">{item.comercial || "-"}</td>
                    <td className="p-3 text-right font-bold text-slate-800">{fM(item.limite_solicitado)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-tight uppercase ${
                        (item.status || "").toLowerCase() === 'aprovado' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-400 text-xs font-mono">{fD(item.atualizado_em || item.criado_em)}</td>
                  </tr>
                )) // 🎯 Fix: Fechamento estrutural correto do map reposicionado e testado
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}