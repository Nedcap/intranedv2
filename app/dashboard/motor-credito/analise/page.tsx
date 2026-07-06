"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface AnaliseData {
  id: string;
  cnpj: string;
  razao_social: string;
  uf: string;
  cidade: string;
  capital_social: number;
  status: string;
  dados_faturamento: Record<string, Record<string, string>>;
  dados_endividamento: Array<{ instituicao: string; modalidade: string; saldo: string }>;
  parecer_comite: string;
}

export default function MesaAnalisePage() {
  const searchParams = useSearchParams();
  const analiseId = searchParams.get("id"); // Pega o ?id= da URL

  const [abaAtiva, setAbaAtiva] = useState("fat");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  
  // Estado único para concentrar os dados dinâmicos vindos do Supabase
  const [analise, setAnalise] = useState<AnaliseData | null>(null);

  useEffect(() => {
    if (analiseId) {
      carregarAnaliseDoBanco();
    } else {
      setLoading(false);
    }
  }, [analiseId]);

  const carregarAnaliseDoBanco = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("analises_credito")
        .select("*")
        .eq("id", analiseId)
        .single();

      if (error) throw error;

      if (data) {
        setAnalise({
          id: data.id,
          cnpj: data.cnpj,
          razao_social: data.razao_social,
          uf: data.uf,
          cidade: data.cidade || "",
          capital_social: Number(data.capital_social || 0),
          status: data.status,
          dados_faturamento: data.dados_faturamento || { "2025": {}, "2024": {} },
          dados_endividamento: data.dados_endividamento || [],
          parecer_comite: data.parecer_comite || "",
        });
      }
    } catch (err) {
      console.error("Erro ao carregar análise:", err);
      alert("❌ Falha ao carregar os dados oficiais da mesa.");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarCelulaFat = (ano: string, mes: string, valor: string) => {
    if (!analise) return;
    setAnalise(prev => {
      if (!prev) return null;
      const fatAtual = { ...prev.dados_faturamento };
      if (!fatAtual[ano]) fatAtual[ano] = {};
      fatAtual[ano][mes] = valor;
      return { ...prev, dados_faturamento: fatAtual };
    });
  };

  const handleSalvarParecer = (texto: string) => {
    setAnalise(prev => prev ? { ...prev, parecer_comite: texto } : null);
  };

  const persistirDadosNoSupabase = async () => {
    if (!analise) return;
    try {
      setSalvando(true);
      const { error } = await supabase
        .from("analises_credito")
        .update({
          dados_faturamento: analise.dados_faturamento,
          parecer_comite: analise.parecer_comite,
          status: "em_revisao_humana" // Garante a atualização do estágio
        })
        .eq("id", analise.id);

      if (error) throw error;
      alert("✅ Planilha de faturamento e parecer salvos com sucesso!");
    } catch (err: any) {
      alert("❌ Erro ao sincronizar com Supabase: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-2">
          <div className="animate-spin text-xl">⏳</div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Buscando Registro no Supabase...</p>
        </div>
      </div>
    );
  }

  if (!analise) {
    return (
      <div className="min-h-screen bg-slate-50 p-12 text-center font-sans">
        <p className="text-sm font-bold text-red-500">Nenhum ID de análise válido foi passado na URL ou o registro foi excluído.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1800px] mx-auto space-y-4">
        
        {/* HEADER DA MESA DE ANÁLISE DINÂMICO */}
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <div>
            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase">
              Mesa de Crédito — Modo Auditor
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase mt-1">
              🕵️ Auditoria de Risco: <span className="text-indigo-600">{analise.razao_social}</span>
            </h1>
            <p className="text-xs font-mono font-bold text-slate-500">CNPJ: {analise.cnpj} — {analise.cidade}/{analise.uf}</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={persistirDadosNoSupabase}
              disabled={salvando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2 rounded-lg uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-50"
            >
              {salvando ? "Sincronizando..." : "💾 Salvar Alterações"}
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2 rounded-lg uppercase tracking-wider shadow-md cursor-pointer">
              🚀 Concluir & Despachar
            </button>
          </div>
        </div>

        {/* ESTRUTURA SPLIT SCREEN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* COLUNA ESQUERDA: A VIEW */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
              <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest block border-b border-slate-100 pb-1.5">
                🖼️ Evidências de Campo (Google Maps / Satélite)
              </span>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-100 border border-slate-200 rounded-lg h-44 flex flex-col items-center justify-center text-center p-4">
                  <span className="text-2xl mb-1">🏪</span>
                  <p className="font-black text-slate-800 text-[11px] uppercase">Fachada StreetView</p>
                  <p className="text-[10px] text-slate-400 mt-1">Imagem integrada do Google API</p>
                </div>
                <div className="bg-slate-100 border border-slate-200 rounded-lg h-44 flex flex-col items-center justify-center text-center p-4">
                  <span className="text-2xl mb-1">🛰️</span>
                  <p className="font-black text-slate-800 text-[11px] uppercase">Visão Satélite Zoom 20</p>
                  <p className="text-[10px] text-slate-400 mt-1">Imagem integrada do Google API</p>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: O PROCESSAMENTO (Excel Virtual) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            
            <div className="bg-slate-50 border-b border-slate-200 flex p-1 gap-1">
              <button 
                onClick={() => setAbaAtiva("fat")}
                className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded-md transition-all cursor-pointer ${
                  abaAtiva === "fat" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                📊 [FAT] Faturamento
              </button>
              <button 
                onClick={() => setAbaAtiva("endiv")}
                className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded-md transition-all cursor-pointer ${
                  abaAtiva === "endiv" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                🏦 [INST] Instituições / Dívidas
              </button>
              <button 
                onClick={() => setAbaAtiva("parecer")}
                className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded-md transition-all cursor-pointer ${
                  abaAtiva === "parecer" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                📝 [PARECER] Conclusão
              </button>
            </div>

            <div className="p-5 min-h-[400px]">
              
              {/* ABA FATURAMENTO */}
              {abaAtiva === "fat" && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium">
                    ✏️ Altere os valores abaixo diretamente nas células.
                  </p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <th className="p-2.5 border-r border-slate-200">Mês de Referência</th>
                          <th className="p-2.5 border-r border-slate-200 text-center">Ano 2024 (R$)</th>
                          <th className="p-2.5 text-center">Ano 2025 (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"].map((mes) => (
                          <tr key={mes} className="hover:bg-slate-50">
                            <td className="p-2.5 font-sans font-bold uppercase text-slate-700 border-r border-slate-200 bg-slate-50/50 w-[180px]">
                              {mes}
                            </td>
                            <td className="p-1 border-r border-slate-200">
                              <input 
                                type="text"
                                value={analise.dados_faturamento["2024"]?.[mes] || ""}
                                onChange={(e) => handleSalvarCelulaFat("2024", mes, e.target.value)}
                                className="w-full p-1.5 bg-transparent font-bold text-slate-800 text-center outline-none focus:bg-indigo-50/50 focus:ring-1 focus:ring-indigo-400 rounded transition-all"
                              />
                            </td>
                            <td className="p-1">
                              <input 
                                type="text"
                                value={analise.dados_faturamento["2025"]?.[mes] || ""}
                                onChange={(e) => handleSalvarCelulaFat("2025", mes, e.target.value)}
                                className="w-full p-1.5 bg-transparent font-bold text-slate-800 text-center outline-none focus:bg-indigo-50/50 focus:ring-1 focus:ring-indigo-400 rounded transition-all"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA ENDIVIDAMENTO */}
              {abaAtiva === "endiv" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 font-medium">Operações em aberto localizadas pelo robô.</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <th className="p-2.5">Instituição Credora</th>
                          <th className="p-2.5">Modalidade</th>
                          <th className="p-2.5 text-right">Saldo Devedor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {analise.dados_endividamento.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center p-4 text-slate-400">Nenhum endividamento registrado.</td>
                          </tr>
                        ) : (
                          analise.dados_endividamento.map((div, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2.5 font-black uppercase text-slate-900">{div.instituicao}</td>
                              <td className="p-2.5 text-slate-500 uppercase">{div.modalidade}</td>
                              <td className="p-2.5 text-right font-mono text-red-600 font-bold">{div.saldo}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA PARECER */}
              {abaAtiva === "parecer" && (
                <div className="space-y-3">
                  <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest">
                    Redigir Parecer Final do Comitê de Crédito
                  </label>
                  <textarea
                    value={analise.parecer_comite}
                    onChange={(e) => handleSalvarParecer(e.target.value)}
                    placeholder="Escreva aqui a sua conclusão sobre o risco da empresa..."
                    className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[250px] font-sans"
                  />
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}