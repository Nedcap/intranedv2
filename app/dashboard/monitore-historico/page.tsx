/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 UTILS DE FORMATAÇÃO E CÁLCULO
// ============================================================================
// Extrai apenas os números e garante que temos a raiz (8 primeiros dígitos)
const extrairRaizCnpj = (cnpj: string) => {
  if (!cnpj) return "";
  const apenasNumeros = cnpj.replace(/\D/g, "");
  return apenasNumeros.substring(0, 8).padStart(8, "0");
};

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));
const fD = (str: string) => str ? str.split("-").reverse().join("/") : "-";

export default function MonitoreHistoricoPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarHistorico() {
      try {
        setCarregando(true);

        // 🎯 O Supabase intercepta essas chamadas e já devolve os dados filtrados pela hierarquia (RLS).
        const [resHist, resCadastro] = await Promise.all([
          supabase.from("historico_consolidado").select("*").order("data_processamento", { ascending: false }),
          supabase.from("cadastro_cedentes").select("cedente, cnpj, risco_sec, risco_fidc").not("cnpj", "is", null)
        ]);

        if (resHist.data) {
          const filtradosLog = resHist.data;

          // 🛡️ Indexa os cadastros no Map usando a RAIZ DO CNPJ para precisão absoluta
          const cadastroMap = new Map();
          resCadastro.data?.forEach(c => {
            const raiz = extrairRaizCnpj(c.cnpj);
            if (raiz) {
              cadastroMap.set(raiz, {
                riscoConsolidado: parseFloat(c.risco_sec || 0) + parseFloat(c.risco_fidc || 0),
                nomeOficial: c.cedente
              });
            }
          });

          setDados(filtradosLog.map(linha => {
            const raizLinha = extrairRaizCnpj(linha.cnpj_cliente);
            const match = cadastroMap.get(raizLinha);
            
            const riscoAberto = match ? match.riscoConsolidado : 0;
            // Se houver nome oficial no banco, sobrepõe o nome sujo do TXT
            const nomeFinal = match ? match.nomeOficial : linha.cedente;
            
            // Verifica se é prospecto checando o JSONB ou se não achou match no banco
            const isProspecto = linha.detalhes_completos?.comercial?.status_banco === "PROSPECTO_AVULSO" || !match;

            return { ...linha, risco_aberto: riscoAberto, cedente_normalizado: nomeFinal, isProspecto };
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
  
  // Filtro de busca na tabela
  const filtrados = dados.filter(item => 
    (item.cedente_normalizado || "").toLowerCase().includes(busca.toLowerCase()) ||
    (item.cnpj_cliente || "").includes(busca)
  );

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Montando linha do tempo histórica...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 font-sans text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🚀 HEADER PREMIUM COM GRADIENTE */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight mb-2">📚 Histórico de Monitoramento</h1>
          <p className="text-blue-200 opacity-90 text-sm font-medium">
            Acompanhe a linha do tempo e a evolução diária de restritivos da carteira.
          </p>
        </div>
        
        <div className="relative w-full md:w-[340px] shrink-0">
          {/* Se você tiver o lucide-react, pode trocar o emoji 🔎 pelo ícone <Search /> */}
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">🔎</span>
          <input 
            type="text" 
            placeholder="Filtrar por cedente ou CNPJ..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl outline-none focus:bg-white focus:text-slate-900 focus:border-white transition-all font-bold text-sm text-white placeholder-blue-200 shadow-inner"
          />
        </div>
      </div>

      {/* 📋 TABELA DE HISTÓRICO (CLEAN UI & CENTRALIZADA) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[1700px] text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Data</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">CNPJ</th>
                <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Cedente</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50/50">Risco Aberto</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Saldo Ant.</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Evolução</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-800 bg-slate-100/50">Saldo Atual</th>
                <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Resumo da Ocorrência</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">PEFIN</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">REFIN</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Protestos</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Ações Jud.</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Dív. Vencida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-400 font-bold italic">
                    Nenhum registro histórico encontrado para a sua busca ou carteira.
                  </td>
                </tr>
              ) : (
                filtrados.map((item, idx) => {
                  const evo = parseFloat(item.evolucao || 0);
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="p-4 text-slate-400 font-mono text-xs whitespace-nowrap">{fD(item.data_processamento)}</td>
                      <td className="p-4 font-mono text-slate-400 text-xs whitespace-nowrap group-hover:text-blue-600 transition-colors">{item.cnpj_cliente}</td>
                      
                      {/* Apenas Cedente mantido à esquerda (text-left) */}
                      <td className="p-4 text-left font-black text-slate-800 truncate max-w-[250px] uppercase" title={item.cedente_normalizado}>
                        {item.isProspecto && <span className="inline-block mr-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 text-[9px] rounded uppercase font-black tracking-wider shadow-sm">Avulso</span>}
                        {item.cedente_normalizado}
                      </td>
                      
                      <td className="p-4 font-mono font-black text-blue-700 bg-blue-50/30 whitespace-nowrap">{fM(item.risco_aberto)}</td>
                      <td className="p-4 text-slate-400 font-mono whitespace-nowrap">{fM(item.saldo_anterior)}</td>
                      
                      {/* EVOLUÇÃO DESTACADA */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center gap-1 font-black px-2.5 py-1 rounded text-[11px] min-w-[100px] shadow-sm ${
                          evo === 0 ? "text-slate-500 bg-slate-100 border border-slate-200" : 
                          evo > 0 ? "text-rose-700 bg-rose-50 border border-rose-200" : 
                          "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        }`}>
                          {evo === 0 ? "•" : evo > 0 ? "▲" : "▼"} {fM(Math.abs(evo))}
                        </span>
                      </td>
                      
                      <td className="p-4 font-mono font-black text-slate-900 bg-slate-50/50 whitespace-nowrap">{fM(item.saldo_atual)}</td>
                      
                      {/* Resumo mantido à esquerda (text-left) */}
                      <td className="p-4 text-left text-slate-500 text-[11px] leading-tight pr-4 font-semibold">{item.resumo_movimento || "Estável"}</td>
                      
                      {/* COLUNAS RESTRITIVOS (Fundo Rose Dinâmico) */}
                      {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(k => {
                        const val = parseFloat(item[k]);
                        return (
                          <td key={k} className={`p-4 font-mono text-xs whitespace-nowrap ${
                            val > 0 ? "text-rose-600 font-black bg-rose-50/30" : "text-slate-300 font-medium"
                          }`}>
                            {fM(item[k])}
                          </td>
                        );
                      })}
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