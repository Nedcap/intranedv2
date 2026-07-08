"use client";

import { useState, useMemo } from "react";

// ============================================================================
// 📦 DADOS DE TESTE (MOCKS) - PARA ESTRUTURAR A VISUALIZAÇÃO
// ============================================================================
const MOCK_DADOS_COMISSAO = [
  {
    gerenteId: "g1",
    nome: "André",
    taxaNominal: 3.0,
    taxaLiquida: 2.0,
    repasse: { nome: "Luiz", taxa: 1.0 },
    resumo: {
      volumeTotal: 250000,
      comissaoGerada: 7500, // 3% sobre 250k
      comissaoLiquida: 5000, // 2% 
      valorRepassado: 2500, // 1% pro Luiz
    },
    empresas: {
      SEC: {
        volume: 150000,
        comissaoLiquida: 3000,
        cedentes: [
          {
            cedenteId: "c1",
            nome: "AMN TRANSPORTES",
            volume: 100000,
            comissaoLiquida: 2000,
            titulos: [
              { id: "t1", sacado: "VALE S/A", valor: 50000, tipoLiquidação: "Normal", statusValidacao: "Aprovado", comissao: 1000 },
              { id: "t2", sacado: "KLABIN", valor: 30000, tipoLiquidação: "Recompra", statusValidacao: "Aprovado", comissao: 0 },
              { id: "t3", sacado: "VALE S/A", valor: 20000, tipoLiquidação: "Outras", statusValidacao: "Pendente", comissao: 400 }, // Pendente avaliação
            ]
          },
          {
            cedenteId: "c2",
            nome: "LOGISTICA BRASIL",
            volume: 50000,
            comissaoLiquida: 1000,
            titulos: [
              { id: "t4", sacado: "AMBEV", valor: 50000, tipoLiquidação: "Normal", statusValidacao: "Aprovado", comissao: 1000 },
            ]
          }
        ]
      },
      FIDC: {
        volume: 100000,
        comissaoLiquida: 2000,
        cedentes: [
          {
            cedenteId: "c3",
            nome: "TECH SOLUTIONS",
            volume: 100000,
            comissaoLiquida: 2000,
            titulos: [
              { id: "t5", sacado: "SAMSUNG", valor: 100000, tipoLiquidação: "Normal", statusValidacao: "Aprovado", comissao: 2000 },
            ]
          }
        ]
      }
    }
  },
  {
    gerenteId: "g2",
    nome: "Luiz",
    taxaNominal: 2.0,
    taxaLiquida: 2.0,
    repasse: null, // Luiz não repassa pra ninguém, mas recebe do André
    resumo: {
      volumeTotal: 100000,
      comissaoGerada: 2000, // Comissões próprias dele
      comissaoLiquida: 2000,
      valorRepassado: 0,
      valorRecebidoSplit: 2500, // Vem do André
    },
    empresas: {
      SEC: { volume: 0, comissaoLiquida: 0, cedentes: [] },
      FIDC: {
        volume: 100000,
        comissaoLiquida: 2000,
        cedentes: [
          {
            cedenteId: "c4",
            nome: "AGRO SUL",
            volume: 100000,
            comissaoLiquida: 2000,
            titulos: [
              { id: "t6", sacado: "BUNGE", valor: 100000, tipoLiquidação: "Normal", statusValidacao: "Aprovado", comissao: 2000 },
            ]
          }
        ]
      }
    }
  }
];
// ============================================================================

const formatarMoeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CalculoComissoesPage() {
  // Controle de expansão de linhas dinâmico (Grava o ID do nível expandido)
  const [expandedGerentes, setExpandedGerentes] = useState<Record<string, boolean>>({});
  const [expandedEmpresas, setExpandedEmpresas] = useState<Record<string, boolean>>({});
  const [expandedCedentes, setExpandedCedentes] = useState<Record<string, boolean>>({});

  const toggleGerente = (id: string) => setExpandedGerentes(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleEmpresa = (id: string) => setExpandedEmpresas(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleCedente = (id: string) => setExpandedCedentes(prev => ({ ...prev, [id]: !prev[id] }));

  // KPIs globais
  const globais = useMemo(() => {
    let volTotal = 0, comissaoTotal = 0, pendencias = 0;
    MOCK_DADOS_COMISSAO.forEach(g => {
      volTotal += g.resumo.volumeTotal;
      comissaoTotal += g.resumo.comissaoLiquida;
      // Contagem mockada de pendencias
      ['SEC', 'FIDC'].forEach(tipo => {
        g.empresas[tipo as 'SEC' | 'FIDC'].cedentes.forEach(c => {
          c.titulos.forEach(t => { if (t.statusValidacao === "Pendente") pendencias++; });
        });
      });
    });
    return { volTotal, comissaoTotal, pendencias };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER & IMPORTAÇÕES */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Fechamento de Comissões</h2>
            </div>
            <span className="text-sm text-slate-500 font-medium ml-12">Leitura de baixas, conciliação e splits da equipe comercial.</span>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button className="flex-1 md:flex-none px-5 py-2.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2">
              <span className="text-lg leading-none">🏦</span> Importar SEC (CSV)
            </button>
            <button className="flex-1 md:flex-none px-5 py-2.5 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2">
              <span className="text-lg leading-none">🔮</span> Importar FIDC (Excel)
            </button>
            <button className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Aprovar Fechamento
            </button>
          </div>
        </div>

        {/* KPIs FINANCEIROS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-800"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1 ml-2">Volume Total Liquidado</span>
            <span className="text-3xl font-black text-slate-800 ml-2 font-mono">{formatarMoeda(globais.volTotal)}</span>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border border-emerald-600 shadow-lg shadow-emerald-500/20 flex flex-col justify-center relative overflow-hidden">
             <svg className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-100 mb-1">Comissões a Pagar (Líquidas)</span>
             <span className="text-3xl font-black font-mono">{formatarMoeda(globais.comissaoTotal)}</span>
          </div>
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-1 ml-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> Liquidações Pendentes (Outras)</span>
            <span className="text-3xl font-black text-slate-800 ml-2">{globais.pendencias} <span className="text-sm font-bold text-amber-600">títulos retidos</span></span>
          </div>
        </div>

        {/* TABELA DE 4 NÍVEIS (MASTER-DETAIL PROFUNDO) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              
              {/* HEADER NÍVEL 1 */}
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="w-14 px-4 text-center"></th>
                  <th className="px-4 w-80">Gerente Comercial</th>
                  <th className="px-4 text-center">Taxas e Regras de Split</th>
                  <th className="px-4 text-right">Volume Operado</th>
                  <th className="px-6 text-right">Total a Pagar</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {MOCK_DADOS_COMISSAO.map((gerente) => {
                  const isGerenteOpen = expandedGerentes[gerente.gerenteId];

                  return (
                    <tr key={gerente.gerenteId} style={{ display: "contents" }}>
                      
                      {/* --- NÍVEL 1: RESUMO DO GERENTE --- */}
                      <tr className={`group transition-all duration-200 ${isGerenteOpen ? "bg-slate-50/80" : "hover:bg-slate-50"}`}>
                        <td className="px-4 py-4 text-center border-l-4 border-l-transparent">
                          <button onClick={() => toggleGerente(gerente.gerenteId)} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-all border ${isGerenteOpen ? "bg-slate-800 text-white border-slate-800 shadow-md" : "bg-white text-slate-400 border-slate-300 hover:border-slate-500 hover:text-slate-600 shadow-sm"}`}>
                            <svg className={`w-4 h-4 transform transition-transform duration-300 ${isGerenteOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </td>
                        <td className="px-4 py-4 font-black text-slate-900 text-base">{gerente.nome}</td>
                        <td className="px-4 py-4 text-center">
                          {gerente.repasse ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">Retém {gerente.taxaLiquida}%</span>
                              <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg> Repassa {gerente.repasse.taxa}% p/ {gerente.repasse.nome}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">100% Retido ({gerente.taxaNominal}%)</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-bold text-slate-600">{formatarMoeda(gerente.resumo.volumeTotal)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-black text-emerald-600 text-base">{formatarMoeda(gerente.resumo.comissaoLiquida)}</span>
                            {gerente.resumo.valorRecebidoSplit > 0 && (
                              <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">+ {formatarMoeda(gerente.resumo.valorRecebidoSplit)} de Splits</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* --- NÍVEL 2: QUEBRA POR EMPRESA (SEC / FIDC) --- */}
                      {isGerenteOpen && (
                        <>
                          {['SEC', 'FIDC'].map((tipoEmpresa) => {
                            const dataEmpresa = gerente.empresas[tipoEmpresa as 'SEC' | 'FIDC'];
                            if (dataEmpresa.volume === 0) return null; // Não exibe aba vazia

                            const idEmpresa = `${gerente.gerenteId}-${tipoEmpresa}`;
                            const isEmpresaOpen = expandedEmpresas[idEmpresa];
                            const isSec = tipoEmpresa === 'SEC';

                            return (
                              <tr key={idEmpresa} style={{ display: "contents" }}>
                                <tr className={`border-t border-slate-100 transition-colors ${isSec ? 'bg-blue-50/20' : 'bg-purple-50/20'} ${isEmpresaOpen ? (isSec ? 'bg-blue-50/50' : 'bg-purple-50/50') : ''}`}>
                                  <td className={`px-4 py-2 border-l-4 ${isSec ? 'border-l-blue-400' : 'border-l-purple-400'}`}></td>
                                  <td className="px-4 py-2 pl-8 flex items-center gap-3">
                                    <button onClick={() => toggleEmpresa(idEmpresa)} className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs transition-colors border shadow-xs ${isSec ? 'bg-white text-blue-600 border-blue-300 hover:bg-blue-100' : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-100'}`}>
                                      {isEmpresaOpen ? "−" : "+"}
                                    </button>
                                    <span className={`font-black text-xs uppercase tracking-widest ${isSec ? 'text-blue-800' : 'text-purple-800'}`}>
                                      {isSec ? '🏦 Securitizadora' : '🔮 FIDC'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Subtotal</td>
                                  <td className="px-4 py-2 text-right font-mono font-bold text-slate-500 text-xs">{formatarMoeda(dataEmpresa.volume)}</td>
                                  <td className="px-6 py-2 text-right font-mono font-black text-slate-700 text-sm">{formatarMoeda(dataEmpresa.comissaoLiquida)}</td>
                                </tr>

                                {/* --- NÍVEL 3: CEDENTES --- */}
                                {isEmpresaOpen && dataEmpresa.cedentes.map(cedente => {
                                  const idCedente = `${idEmpresa}-${cedente.cedenteId}`;
                                  const isCedenteOpen = expandedCedentes[idCedente];

                                  return (
                                    <tr key={idCedente} style={{ display: "contents" }}>
                                      <tr className={`border-t border-slate-100/50 bg-white hover:bg-slate-50/50 transition-colors`}>
                                        <td className={`px-4 py-2 border-l-4 ${isSec ? 'border-l-blue-400' : 'border-l-purple-400'}`}></td>
                                        <td className="px-4 py-2 pl-16 flex items-center gap-3">
                                          <button onClick={() => toggleCedente(idCedente)} className="text-slate-400 hover:text-slate-700 w-4 h-4 flex items-center justify-center transition-transform">
                                            <svg className={`w-3 h-3 transform transition-transform ${isCedenteOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                          </button>
                                          <span className="font-extrabold text-slate-600 text-xs uppercase">{cedente.nome}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center"></td>
                                        <td className="px-4 py-2 text-right font-mono font-medium text-slate-500 text-[11px]">{formatarMoeda(cedente.volume)}</td>
                                        <td className="px-6 py-2 text-right font-mono font-bold text-slate-600 text-xs">{formatarMoeda(cedente.comissaoLiquida)}</td>
                                      </tr>

                                      {/* --- NÍVEL 4: TÍTULOS E VALIDAÇÕES (DETALHE FINAL) --- */}
                                      {isCedenteOpen && (
                                        <tr>
                                          <td className={`px-4 border-l-4 ${isSec ? 'border-l-blue-400' : 'border-l-purple-400'}`}></td>
                                          <td colSpan={4} className="p-0">
                                            <div className="bg-slate-50 border-y border-slate-200/60 p-4 pl-24 shadow-inner">
                                              <table className="w-full text-left border-collapse bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                                                <thead className="bg-slate-100 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                                  <tr>
                                                    <th className="px-3 py-2">ID Título</th>
                                                    <th className="px-3 py-2">Sacado</th>
                                                    <th className="px-3 py-2 text-right">Vlr. Liquidado</th>
                                                    <th className="px-3 py-2 text-center">Tipo Baixa</th>
                                                    <th className="px-3 py-2 text-center">Status Validação</th>
                                                    <th className="px-3 py-2 text-right">Comissão Gerada</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                  {cedente.titulos.map(titulo => {
                                                    
                                                    // Estilização condicional baseada na regra de negócio
                                                    const isNormal = titulo.tipoLiquidação === "Normal";
                                                    const isRecompra = titulo.tipoLiquidação === "Recompra";
                                                    const isOutras = titulo.tipoLiquidação === "Outras";

                                                    return (
                                                      <tr key={titulo.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-3 py-2 text-[10px] font-mono text-slate-400">#{titulo.id}</td>
                                                        <td className="px-3 py-2 text-[11px] font-bold text-slate-700">{titulo.sacado}</td>
                                                        <td className="px-3 py-2 text-right text-[11px] font-mono text-slate-600">{formatarMoeda(titulo.valor)}</td>
                                                        
                                                        <td className="px-3 py-2 text-center">
                                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                                            isNormal ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                                                            isRecompra ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                                                            'bg-amber-50 text-amber-600 border-amber-200'
                                                          }`}>
                                                            {titulo.tipoLiquidação}
                                                          </span>
                                                        </td>

                                                        <td className="px-3 py-2 text-center">
                                                          {titulo.statusValidacao === "Aprovado" ? (
                                                            <span className="text-[10px] text-slate-400">✔️ Automático</span>
                                                          ) : (
                                                            <button className="text-[9px] bg-indigo-600 text-white font-bold px-2 py-1 rounded shadow-sm hover:bg-indigo-700 transition-colors uppercase tracking-widest animate-pulse">
                                                              Aprovar Manual
                                                            </button>
                                                          )}
                                                        </td>

                                                        <td className="px-3 py-2 text-right text-[11px] font-mono font-black">
                                                          {isRecompra ? (
                                                            <span className="text-slate-300 line-through">{formatarMoeda(titulo.comissao)}</span>
                                                          ) : isOutras && titulo.statusValidacao === "Pendente" ? (
                                                            <span className="text-amber-500 flex items-center justify-end gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Em análise</span>
                                                          ) : (
                                                            <span className="text-emerald-600">{formatarMoeda(titulo.comissao)}</span>
                                                          )}
                                                        </td>
                                                      </tr>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}