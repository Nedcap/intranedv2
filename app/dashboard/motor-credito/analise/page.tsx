"use client";

import { useState } from "react";

export default function MesaAnalisePage() {
  const [abaAtiva, setAbaAtiva] = useState("fat");
  const [parecer, setParecer] = useState("");

  // Dados fictícios simulando o que o robô vai ler e jogar no Supabase (JSONB)
  const [dadosEmpresa, setDadosEmpresa] = useState({
    razao_social: "CALCADOS FRANCA S/A",
    cnpj: "98.765.432/0001-11",
    capital_social: 1500000,
    cidade: "FRANCA",
    uf: "SP",
  });

  // Tabela editável de faturamento (Simulando o Excel dentro da tela)
  const [faturamento, setFaturamento] = useState({
    "2025": { janeiro: "120000", fevereiro: "145000", marco: "130000" },
    "2024": { janeiro: "95000", fevereiro: "110000", marco: "105000" }
  });

  const handleSalvarCelulaFat = (ano: string, mes: string, valor: string) => {
    setFaturamento(prev => ({
      ...prev,
      [ano]: {
        ...prev[ano as keyof typeof prev],
        [mes]: valor
      }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1800px] mx-auto space-y-4">
        
        {/* HEADER DA MESA DE ANÁLISE */}
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <div>
            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase">
              Mesa de Crédito — Modo Auditor
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase mt-1">
              🕵️ Auditoria de Risco: <span className="text-indigo-600">{dadosEmpresa.razao_social}</span>
            </h1>
            <p className="text-xs font-mono font-bold text-slate-500">CNPJ: {dadosEmpresa.cnpj}</p>
          </div>
          
          <div className="flex gap-2">
            <button className="bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm">
              📁 Ver Todos os PDFs no R2
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2 rounded-lg uppercase tracking-wider shadow-md cursor-pointer">
              🚀 Concluir & Despachar
            </button>
          </div>
        </div>

        {/* ESTRUTURA SPLIT SCREEN (VIEW + PROCESSAMENTO LADO A LADO) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* COLUNA ESQUERDA: A VIEW (Documentos, Imagens do Google, Notícias) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
              <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest block border-b border-slate-100 pb-1.5">
                🖼️ Evidências de Campo (Google Maps / Satélite)
              </span>
              
              {/* Simulador de Fachada/Satélite */}
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

              {/* Bloco de Notícias/Restritivos Extraídos */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block">
                  📰 Últimas Notícias Encontradas via Serper
                </span>
                <div className="space-y-2 divide-y divide-slate-200">
                  <div className="pt-1">
                    <p className="font-bold text-slate-900">Empresa expande parque fabril em Franca</p>
                    <p className="text-[11px] text-slate-400 lowercase">Fonte: Valor Econômico • 3 meses atrás</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: O PROCESSAMENTO (O Excel Virtual Editável) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            
            {/* SUB-MENU DE ABAS DO EXCEL VIRTUAL */}
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

            {/* CONTEÚDO DINÂMICO DAS ABAS EDITÁVEIS */}
            <div className="p-5 min-h-[400px]">
              
              {/* ABA FATURAMENTO (ESTILO EXCEL) */}
              {abaAtiva === "fat" && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium">
                    ✏️ Altere os valores abaixo diretamente nas células. O sistema recalcula os totais automaticamente.
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
                        {["janeiro", "fevereiro", "marco"].map((mes) => (
                          <tr key={mes} className="hover:bg-slate-50">
                            <td className="p-2.5 font-sans font-bold uppercase text-slate-700 border-r border-slate-200 bg-slate-50/50 w-[180px]">
                              {mes}
                            </td>
                            {/* Célula do Ano 2024 */}
                            <td className="p-1 border-r border-slate-200">
                              <input 
                                type="text"
                                value={faturamento["2024"][mes as keyof typeof faturamento["2024"]]}
                                onChange={(e) => handleSalvarCelulaFat("2024", mes, e.target.value)}
                                className="w-full p-1.5 bg-transparent font-bold text-slate-800 text-center outline-none focus:bg-indigo-50/50 focus:ring-1 focus:ring-indigo-400 rounded transition-all"
                              />
                            </td>
                            {/* Célula do Ano 2025 */}
                            <td className="p-1">
                              <input 
                                type="text"
                                value={faturamento["2025"][mes as keyof typeof faturamento["2025"]]}
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
                  <p className="text-xs text-slate-500 font-medium">Operations em aberto localizadas pelo robô no SCR / Planilhas.</p>
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
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 font-black uppercase text-slate-900">BANCO ITAU S/A</td>
                          <td className="p-2.5 text-slate-500 uppercase">CCB - CAPITAL DE GIRO</td>
                          <td className="p-2.5 text-right font-mono text-red-600 font-bold">R$ 450.000,00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA PARECER (TEXTO RICO / TEXTAREA) */}
              {abaAtiva === "parecer" && (
                <div className="space-y-3">
                  <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest">
                    Redigir Parecer Final do Comitê de Crédito
                  </label>
                  <textarea
                    value={parecer}
                    onChange={(e) => setParecer(e.target.value)}
                    placeholder="Escreva aqui a sua conclusão sobre o risco da empresa, garantias propostas e decisão final..."
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