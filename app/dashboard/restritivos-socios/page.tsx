/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 UTILS DE FORMATAÇÃO E CÁLCULO
// ============================================================================
const extrairRaizCnpj = (cnpj: string) => {
  if (!cnpj) return "";
  const apenasNumeros = cnpj.replace(/\D/g, "");
  return apenasNumeros.substring(0, 8).padStart(8, "0");
};

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));
const fD = (str: string) => str ? str.split("-").reverse().join("/") : "-";

export default function RestritivosSociosPage() {
  const [socios, setSocios] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarSocios() {
      try {
        setCarregando(true);
        
        // 🎯 O RLS atua aqui filtrando a base. Buscamos sócios e a tabela mestre de cedentes.
        const [resSocios, resCadastro] = await Promise.all([
          supabase.from("restritivos_socios").select("*").order("data_processamento", { ascending: false }).order("nome_socio", { ascending: true }),
          supabase.from("cadastro_cedentes").select("cedente, cnpj").not("cnpj", "is", null)
        ]);
        
        if (resSocios.error) throw resSocios.error;
        if (resCadastro.error) throw resCadastro.error;
        
        if (resSocios.data) {
          // 🛡️ Dicionário de CNPJs (Raiz) para nomes oficiais do CRM
          const cadastroMap = new Map();
          resCadastro.data?.forEach(c => {
            const raiz = extrairRaizCnpj(c.cnpj);
            if (raiz) cadastroMap.set(raiz, c.cedente);
          });

          // 💎 Enriquecimento dos dados cruzando a origem da empresa
          const dadosEnriquecidos = resSocios.data.map(socio => {
            const raizEmpresa = extrairRaizCnpj(socio.cnpj_empresa);
            const nomeOficial = cadastroMap.get(raizEmpresa);
            
            return {
              ...socio,
              empresa_vinculada: nomeOficial || "EMPRESA NÃO CADASTRADA",
              isProspecto: !nomeOficial
            };
          });

          setSocios(dadosEnriquecidos);
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
  // 🔍 FILTRO DE BUSCA DINÂMICO
  // ==========================================================================
  const filtrados = useMemo(() => {
    if (!busca) return socios;
    const term = busca.toLowerCase();
    return socios.filter(s => 
      (s.nome_socio || "").toLowerCase().includes(term) ||
      (s.empresa_vinculada || "").toLowerCase().includes(term) ||
      (s.cnpj_empresa || "").includes(term)
    );
  }, [socios, busca]);

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Varrendo histórico e cruzando vínculos societários...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 font-sans text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🚀 HEADER PREMIUM COM GRADIENTE */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight mb-2">👥 Restritivos de Sócios</h1>
          <p className="text-blue-200 opacity-90 text-sm font-medium">
            Monitoramento comportamental e financeiro do quadro societário vinculado à sua base.
          </p>
        </div>
        
        <div className="relative w-full md:w-80 shrink-0">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">🔎</span>
          <input 
            type="text" 
            placeholder="Buscar por sócio ou empresa..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl outline-none focus:bg-white focus:text-slate-900 focus:border-white transition-all font-bold text-sm text-white placeholder-blue-200 shadow-inner"
          />
        </div>
      </div>

      {/* 📋 TABELA (CLEAN UI) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px] text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Data</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-80">Sócio Monitorado & Vínculo</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">PEFIN</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">REFIN</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Protestos</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Ações Jud.</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Dív. Vencidas</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-800 bg-slate-100/50 w-40 border-l border-slate-200">Saldo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-bold italic">
                    🎉 Nenhum apontamento restritivo mapeado ou encontrado na busca.
                  </td>
                </tr>
              ) : (
                filtrados.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                    
                    {/* Data Processamento */}
                    <td className="p-4 text-center text-slate-400 font-mono text-xs whitespace-nowrap">
                      {fD(item.data_processamento)}
                    </td>

                    {/* Sócio Monitorado e Empresa Cruzada */}
                    <td className="p-4">
                      <div className="font-black text-slate-900 truncate max-w-[300px] uppercase" title={item.nome_socio}>
                        {item.nome_socio}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold tracking-wider mt-1 truncate max-w-[300px] uppercase" title={item.empresa_vinculada}>
                        <span className="opacity-60 text-[11px] font-mono">{item.cnpj_empresa}</span> 
                        <span className="opacity-50">•</span> 
                        {item.isProspecto && <span className="inline-block px-1 bg-orange-100 text-orange-700 border border-orange-200 rounded shadow-sm text-[8px]">Avulso</span>}
                        <span className={`${item.isProspecto ? 'text-orange-600' : 'text-blue-700'}`}>{item.empresa_vinculada}</span>
                      </div>
                    </td>
                    
                    {/* Colunas Dinâmicas de Apontamentos (Fundo Rose Dinâmico) */}
                    {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(key => {
                      const valor = parseFloat(item[key]);
                      const temApontamento = valor > 0;
                      return (
                        <td 
                          key={key} 
                          className={`p-4 text-right font-mono text-xs whitespace-nowrap ${
                            temApontamento ? "text-rose-600 font-black bg-rose-50/30" : "text-slate-300 font-medium"
                          }`}
                        >
                          {fM(item[key])}
                        </td>
                      );
                    })}
                    
                    {/* Saldo Total */}
                    <td 
                      className={`p-4 text-right font-mono text-[13px] whitespace-nowrap border-l border-slate-100 ${
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