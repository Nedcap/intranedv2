// components/sistema-analise.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { AnaliseData } from "@/app/types/analise";
import { supabase } from "@/lib/supabase"; // 🔥 ADICIONADO PARA BUSCAR DADOS PAI

// --- COMPONENTE DE APOIO MATEMÁTICO ---
function MathInput({ value, onChange, className }: { value: any, onChange: (v: string) => void, className: string }) {
  const formatValue = (v: any) => {
    if (v === undefined || v === null || v === "") return "";
    const num = Number(v);
    return !isNaN(num) ? (Math.round(num * 100) / 100).toString() : String(v);
  };

  const [localVal, setLocalVal] = useState(formatValue(value));
  
  useEffect(() => { setLocalVal(formatValue(value)); }, [value]);

  const handleBlur = () => {
    try {
      const valStr = String(localVal).trim().replace(/\s/g, '').replace(',', '.');
      if (valStr === '') {
        onChange('');
        setLocalVal('');
        return;
      }
      if (/[\+\-\*\/]/.test(valStr)) {
        const sanitized = valStr.replace(/[^\d\.\+\-\*\/\(\)]/g, '');
        const result = new Function(`'use strict'; return (${sanitized})`)();
        const finalVal = (Math.round(Number(result) * 100) / 100).toString();
        onChange(finalVal);
        setLocalVal(finalVal);
      } else {
        const num = Number(valStr);
        if (!isNaN(num)) {
          const finalVal = (Math.round(num * 100) / 100).toString();
          onChange(finalVal);
          setLocalVal(finalVal);
        } else {
          onChange(localVal);
        }
      }
    } catch {
      onChange(localVal);
    }
  };

  return (
    <input type="text" value={localVal} onChange={(e) => setLocalVal(e.target.value)} onBlur={handleBlur} className={className} />
  );
}

// 🔥 NOVO: COMPONENTE VISUAL DE COMPARAÇÃO (DIFF BADGE)
function IndicadorEvolucao({ atual, antigo, invertido = false }: { atual: number, antigo: number, invertido?: boolean }) {
  if (!antigo || antigo === 0) return null;
  
  const variacao = ((atual - antigo) / antigo) * 100;
  const ehPositivo = variacao > 0;
  
  // Invertido = true significa que "subir" é ruim (ex: Endividamento, Prazos)
  const corPositiva = invertido ? "text-rose-600 bg-rose-50 border-rose-200" : "text-emerald-600 bg-emerald-50 border-emerald-200";
  const corNegativa = invertido ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200";
  const corBase = variacao === 0 ? "text-slate-500 bg-slate-50 border-slate-200" : (ehPositivo ? corPositiva : corNegativa);
  const icone = variacao === 0 ? "➖" : (ehPositivo ? "↗" : "↘");

  return (
    <div className={`inline-flex flex-col ml-3 border px-2 py-0.5 rounded shadow-sm ${corBase}`}>
      <span className="text-[9px] font-black uppercase opacity-70 tracking-wider">Últ. Revisão</span>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono font-bold">R$ {antigo.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
        <span className="text-[10px] font-bold">{icone} {Math.abs(variacao).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL DO ESQUELETO ---
interface SistemaAnaliseProps {
  analise: AnaliseData;
  setAnalise: React.Dispatch<React.SetStateAction<AnaliseData>>;
}

export default function SistemaAnalise({ analise, setAnalise }: SistemaAnaliseProps) {
  const [abaAtiva, setAbaAtiva] = useState("capa");
  const uploadJsonRef = useRef<HTMLInputElement>(null);

  // 🔥 NOVO: Estado para armazenar os dados da análise anterior (se for uma reanálise)
  const [dadosPai, setDadosPai] = useState<any | null>(null);

  // Busca os dados da revisão anterior assim que o componente montar
  useEffect(() => {
    const analiseExtendida = analise as any; 
    if (analiseExtendida.analise_pai_id) {
      supabase
        .from("analises")
        .select("dados_consolidados")
        .eq("id", analiseExtendida.analise_pai_id)
        .single()
        .then(({ data, error }) => {
          if (!error && data?.dados_consolidados) {
            setDadosPai(data.dados_consolidados);
          }
        });
    } else {
      setDadosPai(null);
    }
  }, [(analise as any).analise_pai_id]);

  // =========================================================================
  // FUNÇÕES DE ATUALIZAÇÃO DE ESTADO
  // =========================================================================
  const updateArray = (campo: keyof AnaliseData, index: number, subCampo: string, valor: any) => {
    const novoArray = [...(analise[campo] as any[])];
    novoArray[index][subCampo] = valor;
    if (campo === 'empresas_principais' && index === 0) {
       if (subCampo === 'razao_social') setAnalise({ ...analise, [campo]: novoArray, razao_social: valor });
       else if (subCampo === 'cnpj') setAnalise({ ...analise, [campo]: novoArray, cnpj: valor });
       else setAnalise({ ...analise, [campo]: novoArray });
    } else setAnalise({ ...analise, [campo]: novoArray });
  };
  const addArray = (campo: keyof AnaliseData, obj: any) => setAnalise({ ...analise, [campo]: [...(analise[campo] as any[]), obj] });
  const rmArray = (campo: keyof AnaliseData, index: number) => setAnalise({ ...analise, [campo]: (analise[campo] as any[]).filter((_, i) => i !== index) });
  const updateNested = (campoPai: keyof AnaliseData, campoFilho: string, valor: any) => setAnalise({ ...analise, [campoPai]: { ...(analise[campoPai] as any), [campoFilho]: valor } });

  const handleFatGrupo = (empIndex: number, ano: string, mes: string, val: string) => {
    const novasEmpresas = [...analise.empresas_faturamento];
    if (!novasEmpresas[empIndex].faturamento) novasEmpresas[empIndex].faturamento = {};
    if (!novasEmpresas[empIndex].faturamento[ano]) novasEmpresas[empIndex].faturamento[ano] = {};
    novasEmpresas[empIndex].faturamento[ano][mes] = val;
    setAnalise({ ...analise, empresas_faturamento: novasEmpresas });
  };

  const updateArrayNested = (campoPaiArray: keyof AnaliseData, paiIndex: number, campoFilhoArray: string, filhoIndex: number, prop: string, valor: any) => {
    const novaListaPai = [...(analise[campoPaiArray] as any[])];
    const novaListaFilho = [...novaListaPai[paiIndex][campoFilhoArray]];
    novaListaFilho[filhoIndex][prop] = valor;
    novaListaPai[paiIndex][campoFilhoArray] = novaListaFilho;
    setAnalise({ ...analise, [campoPaiArray]: novaListaPai });
  };

  const rmArrayNested = (campoPaiArray: keyof AnaliseData, paiIndex: number, campoFilhoArray: string, filhoIndex: number) => {
    const novaListaPai = [...(analise[campoPaiArray] as any[])];
    novaListaPai[paiIndex][campoFilhoArray] = novaListaPai[paiIndex][campoFilhoArray].filter((_: any, i: number) => i !== filhoIndex);
    setAnalise({ ...analise, [campoPaiArray]: novaListaPai });
  };

  // =========================================================================
  // MATEMÁTICA CONSOLIDADA (BLINDADA)
  // =========================================================================
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  
  const faturamentoConsolidado = analise.empresas_faturamento.reduce((acc, emp) => {
    Object.entries(emp.faturamento || {}).forEach(([ano, m]) => {
      if (!acc[ano]) acc[ano] = {};
      Object.entries(m).forEach(([mes, valor]) => {
        const soma = (Number(acc[ano][mes]) || 0) + Number(valor);
        acc[ano][mes] = Math.round(soma * 100) / 100;
      });
    });
    return acc as Record<string, any>;
  }, {} as Record<string, any>);

  const endividamentoFlat = analise.empresas_endividamento.flatMap(e => e.endividamento || []);
  const restritivosFlat = analise.empresas_serasa.flatMap(e => e.restritivos || []);

  let lastFilledIndex26 = -1;
  for (let i = 11; i >= 0; i--) {
      if (Number(faturamentoConsolidado["2026"]?.[meses[i]] || 0) > 0) { lastFilledIndex26 = i; break; }
  }
  
  const has26Data = lastFilledIndex26 >= 0;
  const limitIndex = has26Data ? lastFilledIndex26 : 11; 
  const mesesYTD = meses.slice(0, limitIndex + 1);
  const labelMascaraYTD = has26Data ? `MÉDIA ATÉ ${meses[lastFilledIndex26].toUpperCase()}` : "MÉDIA YTD";

  const calcMediaYTD = (ano: string) => {
      if (mesesYTD.length === 0) return 0;
      const soma = mesesYTD.reduce((acc, m) => acc + Number(faturamentoConsolidado[ano]?.[m] || 0), 0);
      return soma / mesesYTD.length;
  };

  const mediaYTD26 = has26Data ? calcMediaYTD("2026") : 0;
  const mediaYTD25 = calcMediaYTD("2025");
  const mediaYTD24 = calcMediaYTD("2024");
  
  const calcTotAno = (ano: string) => meses.reduce((acc, m) => acc + Number(faturamentoConsolidado[ano]?.[m] || 0), 0);
  const calcDelta = (m: string, aAt: string, aAnt: string) => { const at = Number(faturamentoConsolidado[aAt]?.[m] || 0); const ant = Number(faturamentoConsolidado[aAnt]?.[m] || 0); return !ant || ant === 0 ? 0 : ((at - ant) / ant) * 100; };

  const varYTD26_25 = mediaYTD25 > 0 ? ((mediaYTD26 - mediaYTD25) / mediaYTD25) * 100 : 0;
  const varYTD25_24 = mediaYTD24 > 0 ? ((mediaYTD25 - mediaYTD24) / mediaYTD24) * 100 : 0;

  const totAno26 = calcTotAno("2026");
  const totAno25 = calcTotAno("2025");
  const totAno24 = calcTotAno("2024");
  const varTot26_25 = totAno25 > 0 ? ((totAno26 - totAno25) / totAno25) * 100 : 0;
  const varTot25_24 = totAno24 > 0 ? ((totAno25 - totAno24) / totAno24) * 100 : 0;

  const faturamentoMedioReferencia = has26Data ? mediaYTD26 : (mediaYTD25 > 0 ? mediaYTD25 : mediaYTD24);

  const prazoDiasDpls = parseInt(String(analise.dados_potencial.prazo_medio_dpls).replace(/\D/g, "")) || 0;
  const prazoDiasComissaria = parseInt(String(analise.dados_potencial.prazo_medio_comissaria).replace(/\D/g, "")) || 0;
  
  const percAPrazo = Number(analise.dados_potencial.forma_recebimento_prazo || 0) / 100;
  const percDpls = Number(analise.dados_potencial.composicao_dpls || 0) / 100;
  const percComissaria = Number(analise.dados_potencial.composicao_comissaria || 0) / 100;

  const potDpls = (faturamentoMedioReferencia / 30) * prazoDiasDpls * percDpls * percAPrazo;
  const potComissaria = (faturamentoMedioReferencia / 30) * prazoDiasComissaria * percComissaria * percAPrazo;
  const potencialRealCalculado = Math.round((potDpls + potComissaria) * 100) / 100;

  // Atualiza o potencial na master para o Parent conseguir salvar no banco
  useEffect(() => {
    if (analise.dados_potencial.potencial_estimado !== potencialRealCalculado) {
      setAnalise(prev => ({ ...prev, dados_potencial: { ...prev.dados_potencial, potencial_estimado: potencialRealCalculado }}));
    }
  }, [potencialRealCalculado, analise.dados_potencial.potencial_estimado, setAnalise]);

  const totLimites = analise.propostas.reduce((acc, p) => acc + Number(p.limite), 0);
  const totPatrimonio = analise.patrimonios.reduce((acc, p) => acc + Number(p.valor), 0);

  const totEndivGeral = Math.round(endividamentoFlat.reduce((acc, d) => acc + Number(d.saldo || 0), 0) * 100) / 100;
  const endivCurtoPrazo = Math.round(endividamentoFlat.filter(d => d.prazo === "Curto Prazo").reduce((acc, d) => acc + Number(d.saldo || 0), 0) * 100) / 100;
  const endivLongoPrazo = Math.round(endividamentoFlat.filter(d => d.prazo === "Longo Prazo").reduce((acc, d) => acc + Number(d.saldo || 0), 0) * 100) / 100;
  
  const totalBancos = Math.round(endividamentoFlat.filter(d => d.tipo === "Banco").reduce((acc, d) => acc + Number(d.saldo || 0), 0) * 100) / 100;
  const totalFundos = Math.round(endividamentoFlat.filter(d => d.tipo === "Fundo").reduce((acc, d) => acc + Number(d.saldo || 0), 0) * 100) / 100;
  
  const percBancos = totEndivGeral > 0 ? (totalBancos / totEndivGeral) * 100 : 0;
  const percFundos = totEndivGeral > 0 ? (totalFundos / totEndivGeral) * 100 : 0;
  
  const totalDplsCP = Math.round(endividamentoFlat.filter(d => d.prazo === "Curto Prazo" && (d.modalidade.toLowerCase().includes("desc") || d.modalidade.toLowerCase().includes("dupl"))).reduce((acc, d) => acc + Number(d.saldo || 0), 0) * 100) / 100;
  const percDplsCP = totEndivGeral > 0 ? (totalDplsCP / totEndivGeral) * 100 : 0;

  // 🔥 CÁLCULOS DO PAI PARA COMPARAÇÃO
  const totLimitesPai = dadosPai?.propostas?.reduce((acc: number, p: any) => acc + Number(p.limite), 0) || 0;
  const totEndivGeralPai = dadosPai?.empresas_endividamento?.flatMap((e: any) => e.endividamento || []).reduce((acc: number, d: any) => acc + Number(d.saldo || 0), 0) || 0;
  const potEstimadoPai = dadosPai?.dados_potencial?.potencial_estimado || 0;

  // =========================================================================
  // ESTILOS
  // =========================================================================
  const cellStyle = "w-full h-full py-1.5 px-2 bg-transparent outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500 font-sans text-[11px] text-slate-700 transition-all placeholder-slate-400";
  const numStyle = "w-full h-full py-1.5 px-2 bg-transparent outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500 font-mono text-[11px] text-right text-slate-800 transition-all placeholder-slate-400";
  const thStyle = "p-2 bg-slate-100 border border-slate-200 font-semibold text-[10px] text-slate-600 uppercase tracking-wider text-center";
  const tdStyle = "border border-slate-200 p-0 bg-white hover:bg-slate-50 relative focus-within:bg-indigo-50/40 transition-colors h-8";
  const sectionHeaderStyle = "flex justify-between items-center bg-indigo-950 text-white text-[11px] font-semibold tracking-wide p-2.5 rounded-t-md shadow-sm border border-indigo-950";

  return (
    <>
      {/* ABAS ESTILO PILLS & HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 pt-3 pb-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: "capa", label: "📄 Capa & Proposta" },
            { id: "cadastro", label: "🏢 Dados da Empresa" },
            { id: "societario", label: "👥 Societário & Patrimônio" },
            { id: "fat", label: "📈 Faturamento & Potencial" },
            { id: "endividamento", label: "🏦 Endividamento & Refs" },
            { id: "restritivos", label: "⚖️ Restritivos & Jurídico" },
            { id: "parecer", label: "📝 Parecer Final" }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setAbaAtiva(tab.id)} 
              className={`px-4 py-2 font-semibold text-[11px] rounded-full cursor-pointer whitespace-nowrap transition-all shadow-sm ${abaAtiva === tab.id ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ALERTA DE REANÁLISE NA BARRA SUPERIOR */}
        {(analise as any).revisao_numero > 1 && (
          <div className="bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 shrink-0 animate-in fade-in zoom-in ml-4">
            <span className="text-lg">🔄</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-black uppercase tracking-wider opacity-80">Modo de Comparação</span>
              <span className="text-[11px] font-bold">Revisão 0{(analise as any).revisao_numero} Ativa</span>
            </div>
          </div>
        )}
      </div>

      {/* ÁREA DA PLANILHA */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 relative scrollbar-thin scrollbar-thumb-slate-300">
        
        {abaAtiva === "capa" && (
          <div className="max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {analise.status === "em_processamento_ia" && (
              <div className="p-4 border-l-4 border-purple-500 bg-purple-50 text-purple-900 font-semibold text-xs rounded-r-md shadow-sm flex items-center gap-3">
                <span className="text-lg">🔮</span>
                <span>O Motor Python V8 está lendo e estruturando arquivos. Os dados abaixo vão atualizar dinamicamente enquanto você acompanha!</span>
              </div>
            )}

            <div className="bg-white rounded-md shadow-sm border border-slate-200">
              <div className={sectionHeaderStyle}>
                <span>Empresas (Principal e Coobrigados Base)</span>
                <button onClick={() => addArray('empresas_principais', {razao_social:"", cnpj:""})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Adicionar Linha</button>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {analise.empresas_principais?.map((emp, i) => (
                    <tr key={i}>
                      <td className={`${thStyle} w-1/6 text-right`}>{i === 0 ? "Empresa Principal" : "Coobrigado"}</td>
                      <td className={`${tdStyle} w-2/6`}><input value={emp.razao_social} onChange={(e)=>updateArray('empresas_principais', i, 'razao_social', e.target.value)} className={`${cellStyle} font-bold bg-slate-50/50`} /></td>
                      <td className={`${thStyle} w-1/6 text-right`}>CNPJ</td>
                      <td className={`${tdStyle} w-2/6 relative`}>
                        <input value={emp.cnpj} onChange={(e)=>updateArray('empresas_principais', i, 'cnpj', e.target.value)} className={`${cellStyle} font-mono bg-slate-50/50 pr-8`} />
                        {i > 0 && <button onClick={()=>rmArray('empresas_principais', i)} className="absolute right-0 top-0 text-red-500 font-bold hover:bg-red-50 w-8 h-full border-l border-slate-200 transition-colors">X</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={`${thStyle} text-right w-1/6`}>Relacionamento</td>
                    <td className={`${tdStyle} w-2/6`}>
                      <select value={analise.relacionamento} onChange={(e)=>setAnalise({...analise, relacionamento: e.target.value})} className={cellStyle}>
                        <option value="Prospect">Prospect</option><option value="Cliente">Cliente</option>
                      </select>
                    </td>
                    <td className={`${thStyle} text-right w-1/6`}>Data Análise</td>
                    <td className={`${tdStyle} w-2/6`}><input type="date" value={analise.data_analise} onChange={(e)=>setAnalise({...analise, data_analise: e.target.value})} className={cellStyle} /></td>
                  </tr>
                  <tr>
                    <td className={`${thStyle} text-right`}>Gerente Comercial</td><td className={tdStyle}><input value={analise.gerente} onChange={(e)=>setAnalise({...analise, gerente: e.target.value})} className={cellStyle} /></td>
                    <td className={`${thStyle} text-right`}>Analista Resp.</td><td className={tdStyle}><input value={analise.analista} onChange={(e)=>setAnalise({...analise, analista: e.target.value})} className={cellStyle} /></td>
                  </tr>
                  <tr>
                    <td className={`${thStyle} text-right bg-amber-50 border-amber-200 text-amber-900`}>RATING PRÉVIO</td>
                    <td colSpan={3} className={`${tdStyle} border-amber-200`}>
                      <select value={analise.rating} onChange={(e)=>setAnalise({...analise, rating: e.target.value})} className={`${cellStyle} font-bold text-amber-800 bg-amber-50/50`}>
                        <option value="A - Risco reduzido">A - Risco reduzido</option><option value="B - Risco médio">B - Risco médio</option><option value="C - Risco elevado">C - Risco elevado</option><option value="D - Fora do perfil">D - Fora do perfil</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center bg-indigo-600 text-white text-[11px] font-semibold tracking-wide p-2.5 shadow-sm">
                <span>Proposta e Condições Comerciais Requeridas</span>
                <button onClick={() => addArray('propostas', {modalidade:"", limite:0, prazo:"", tranche:0, taxa:"", garantia:""})} className="bg-indigo-500 hover:bg-indigo-400 border border-indigo-400 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Adicionar Linha</button>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thStyle}>Modalidade</th><th className={`${thStyle} w-32`}>Limite Solicitado</th><th className={`${thStyle} w-28`}>Prazo Médio</th>
                    <th className={`${thStyle} w-28`}>Tranche</th><th className={`${thStyle} w-24`}>Taxa Base</th><th className={thStyle}>Garantia Adicional</th><th className={`${thStyle} w-8`}>-</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.propostas.map((p, i) => (
                    <tr key={i}>
                      <td className={tdStyle}><input value={p.modalidade} onChange={(e)=>updateArray('propostas', i, 'modalidade', e.target.value)} className={cellStyle}/></td>
                      <td className={tdStyle}><input type="number" value={p.limite} onChange={(e)=>updateArray('propostas', i, 'limite', Number(e.target.value))} className={`${numStyle} font-bold text-indigo-700 bg-indigo-50/30`}/></td>
                      <td className={tdStyle}><input value={p.prazo} onChange={(e)=>updateArray('propostas', i, 'prazo', e.target.value)} className={cellStyle}/></td>
                      <td className={tdStyle}><input type="number" value={p.tranche} onChange={(e)=>updateArray('propostas', i, 'tranche', Number(e.target.value))} className={numStyle}/></td>
                      <td className={tdStyle}><input value={p.taxa} onChange={(e)=>updateArray('propostas', i, 'taxa', e.target.value)} className={`${cellStyle} text-center`}/></td>
                      <td className={tdStyle}><input value={p.garantia} onChange={(e)=>updateArray('propostas', i, 'garantia', e.target.value)} className={cellStyle}/></td>
                      <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('propostas', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td className="p-2 text-right font-bold text-[10px] text-slate-700">LIMITE TOTAL PLEITEADO</td>
                    <td className="p-2 text-right font-mono font-bold text-indigo-800 text-[12px] flex items-center justify-end">
                      R$ {totLimites.toLocaleString('pt-BR')}
                      {/* 🔥 APLICAÇÃO DO DIFF NO LIMITE */}
                      <IndicadorEvolucao atual={totLimites} antigo={totLimitesPai} />
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={sectionHeaderStyle}>Relatório de Visitas Corporativas</div>
              <textarea 
                value={analise.resumo_visita} 
                onChange={(e) => setAnalise({...analise, resumo_visita: e.target.value})}
                className="w-full p-3 border-none h-40 font-sans text-[12px] text-slate-700 outline-none resize-none bg-slate-50/50 focus:bg-white transition-colors"
                placeholder="Insira detalhes qualitativos da visita..."
              />
            </div>
          </div>
        )}

        {abaAtiva === "cadastro" && (
            <div className="max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                <div className={sectionHeaderStyle}>Dados Cadastrais e Financeiros Básicos</div>
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={`${thStyle} text-right w-1/6`}>Fundação / Idade</td><td className={`${tdStyle} w-2/6`}><input value={analise.fundacao} onChange={(e)=>setAnalise({...analise, fundacao: e.target.value})} className={cellStyle} /></td>
                      <td className={`${thStyle} text-right w-1/6`}>Capital Social (R$)</td><td className={`${tdStyle} w-2/6`}><input type="number" value={analise.capital_social} onChange={(e)=>setAnalise({...analise, capital_social: Number(e.target.value)})} className={numStyle} /></td>
                    </tr>
                    <tr>
                      <td className={`${thStyle} text-right`}>Localização / Matriz</td><td className={tdStyle}><input value={analise.localizacao} onChange={(e)=>setAnalise({...analise, localizacao: e.target.value})} className={cellStyle} placeholder="Endereço oficial corporativo..." /></td>
                      <td className={`${thStyle} text-right`}>Ramo de Atividade</td><td className={tdStyle}><input value={analise.ramo} onChange={(e)=>setAnalise({...analise, ramo: e.target.value})} className={cellStyle} /></td>
                    </tr>
                    <tr>
                      <td className={`${thStyle} text-right`}>Licenças / Certificações</td><td className={tdStyle}><input value={analise.licencas} onChange={(e)=>setAnalise({...analise, licencas: e.target.value})} className={cellStyle} /></td>
                      <td className={`${thStyle} text-right`}>Balanço Auditado?</td>
                      <td className={tdStyle}>
                        <select value={analise.balanco_auditado} onChange={(e)=>setAnalise({...analise, balanco_auditado: e.target.value})} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                      </td>
                    </tr>
                    <tr>
                      <td className={`${thStyle} text-right`}>Consultoria Externa?</td>
                      <td className={tdStyle}>
                        <select value={analise.consultoria_gestao} onChange={(e)=>setAnalise({...analise, consultoria_gestao: e.target.value})} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                      </td>
                      <td className={`${thStyle} text-right`}>Site Corporativo</td><td className={tdStyle}><input value={analise.site} onChange={(e)=>setAnalise({...analise, site: e.target.value})} className={cellStyle} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                <div className={`${sectionHeaderStyle} bg-slate-800 border-slate-800`}>Arquivos Vinculados, Organograma e Endereços Externos</div>
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={`${thStyle} w-1/4 text-right bg-purple-50 text-purple-900 border-purple-200`}>Organograma Interativo (Teia JSON)</td>
                      <td className={`${tdStyle} bg-purple-50/20`}>
                        <div className="flex gap-3 items-center h-full px-3 py-1">
                          <button
                            onClick={() => {
                              if(!analise.id) return alert("💡 Salve a análise no banco antes de gerar a teia!");
                              const cnpjLimpo = analise.cnpj.replace(/\D/g, '');
                              window.open(`/dashboard/busca-grupo?analise_id=${analise.id}&cnpj=${cnpjLimpo}`, '_blank');
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 px-4 text-[10px] rounded shadow-sm flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors"
                          >
                            🕸️ Abrir Gerador de Teia Interativa
                          </button>
                          
                          <input 
                            type="file" 
                            accept=".json" 
                            ref={uploadJsonRef}
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                  try {
                                      const json = JSON.parse(evt.target?.result as string);
                                      setAnalise({ ...analise, organograma_json: json });
                                      alert("✅ JSON de Organograma anexado com sucesso!");
                                  } catch(err: any) {
                                      alert("❌ Erro ao ler JSON: " + err.message);
                                  }
                              };
                              reader.readAsText(file);
                            }}
                          />
                          <button 
                            onClick={() => uploadJsonRef.current?.click()} 
                            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-1.5 px-3 text-[10px] rounded border border-slate-300 shadow-sm whitespace-nowrap transition-colors"
                          >
                            📎 Anexar JSON Manual
                          </button>
                          
                          {analise.organograma_json && analise.organograma_json.nodes?.length > 0 ? (
                            <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1 ml-2">
                              ✅ Teia processada ({analise.organograma_json.nodes.length} nós)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic ml-2">Sem teia mapeada no sistema</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    <tr><td className={`${thStyle} w-1/4 text-right`}>URL Organograma (Imagem estática)</td><td className={tdStyle}><input type="text" value={analise.anexos?.organograma_url || ""} onChange={(e) => updateNested("anexos", "organograma_url", e.target.value)} className={cellStyle} placeholder="Cole o Link da Imagem do Grupo..." /></td></tr>
                    <tr><td className={`${thStyle} text-right`}>URL Fachada (Google Street View)</td><td className={tdStyle}><input type="text" value={analise.anexos?.fachada_url || ""} onChange={(e) => updateNested("anexos", "fachada_url", e.target.value)} className={cellStyle} placeholder="Cole o Link da visão da rua..." /></td></tr>
                    <tr><td className={`${thStyle} text-right`}>URL Satélite (Google Maps)</td><td className={tdStyle}><input type="text" value={analise.anexos?.satelite_url || ""} onChange={(e) => updateNested("anexos", "satelite_url", e.target.value)} className={cellStyle} placeholder="Cole o Link da visão aérea..." /></td></tr>
                    <tr><td className={`${thStyle} text-right`}>URL Fotos da Visita Interna</td><td className={tdStyle}><input type="text" value={analise.anexos?.fotos_visita_url || ""} onChange={(e) => updateNested("anexos", "fotos_visita_url", e.target.value)} className={cellStyle} placeholder="Link do Drive com Evidências Fotográficas..." /></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {abaAtiva === "societario" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl">
            {analise.empresas_societario.map((empresaSoc, empIndex) => (
              <div key={empIndex} className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className={sectionHeaderStyle}>
                    <span>📋 Quadro Societário Consolidado do Grupo</span>
                    <button onClick={() => {
                      const novasEmp = [...analise.empresas_societario];
                      novasEmp[empIndex].socios.push({nome:"", perc:0, funcao:"Sócio", figura_contrato:"Sim"} as any);
                      setAnalise({...analise, empresas_societario: novasEmp});
                    }} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Adicionar Sócio/Entidade</button>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                      <tr>
                          <th className={`${thStyle} w-48 text-left pl-3`}>Empresa Participada</th>
                          <th className={thStyle}>Nome Civil / PJ Associada</th>
                          <th className={`${thStyle} w-24`}>Cotas (%)</th>
                          <th className={`${thStyle} w-40`}>Papel / Cargo</th>
                          <th className={`${thStyle} w-32`}>Assina Contrato?</th>
                          <th className={`${thStyle} w-8`}>-</th>
                      </tr>
                  </thead>
                  <tbody>
                      {empresaSoc.socios.map((s: any, i) => (
                      <tr key={i}>
                          <td className={tdStyle}><input value={s.empresa_origem || ""} onChange={(e)=>updateArrayNested('empresas_societario', empIndex, 'socios', i, 'empresa_origem', e.target.value)} className={`${cellStyle} text-slate-500`} placeholder="Qual CNPJ?" /></td>
                          <td className={tdStyle}><input value={s.nome} onChange={(e)=>updateArrayNested('empresas_societario', empIndex, 'socios', i, 'nome', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                          <td className={tdStyle}><input type="number" value={s.perc ?? ""} onChange={(e)=>updateArrayNested('empresas_societario', empIndex, 'socios', i, 'perc', Number(e.target.value))} className={`${numStyle} font-bold text-indigo-700 bg-indigo-50/20`} /></td>
                          <td className={tdStyle}><input value={s.funcao} onChange={(e)=>updateArrayNested('empresas_societario', empIndex, 'socios', i, 'funcao', e.target.value)} className={cellStyle} /></td>
                          <td className={tdStyle}>
                              <select value={s.figura_contrato} onChange={(e)=>updateArrayNested('empresas_societario', empIndex, 'socios', i, 'figura_contrato', e.target.value)} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                          </td>
                          <td className={`${tdStyle} text-center`}><button onClick={()=>rmArrayNested('empresas_societario', empIndex, 'socios', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                      </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse">
                <tbody>
                  <tr><td className={`${thStyle} w-1/4 text-right`}>Regra de Assinatura Consolidada</td><td className={tdStyle}><input value={analise.regra_assinatura} onChange={(e)=>setAnalise({...analise, regra_assinatura: e.target.value})} className={cellStyle} placeholder="( ) em conjunto (x) isolada" /></td></tr>
                  <tr><td className={`${thStyle} w-1/4 text-right`}>Aval Societário Coletado</td><td className={tdStyle}><input value={analise.aval_societario} onChange={(e)=>setAnalise({...analise, aval_societario: e.target.value})} className={cellStyle} /></td></tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={sectionHeaderStyle}>
                <span>Patrimônio Avalizado (IRPF Vinculado)</span>
                <button onClick={() => addArray('patrimonios', {socio:"", descricao:"", valor:0})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Declarar Bem</button>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr><th className={thStyle}>Titular / Sócio Detentor</th><th className={thStyle}>Descrição Detalhada do Bem</th><th className={`${thStyle} w-56 text-right`}>Valor Estimado (R$)</th><th className={`${thStyle} w-8`}>-</th></tr>
                </thead>
                <tbody>
                  {analise.patrimonios.map((p, i) => (
                    <tr key={i}>
                      <td className={tdStyle}><input value={p.socio} onChange={(e)=>updateArray('patrimonios', i, 'socio', e.target.value)} className={`${cellStyle} font-semibold text-slate-800`} /></td>
                      <td className={tdStyle}><input value={p.descricao} onChange={(e)=>updateArray('patrimonios', i, 'descricao', e.target.value)} className={cellStyle} /></td>
                      <td className={tdStyle}><input type="number" value={p.valor ?? ""} onChange={(e)=>updateArray('patrimonios', i, 'valor', Number(e.target.value))} className={`${numStyle} text-emerald-700 font-bold bg-emerald-50/20`} /></td>
                      <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('patrimonios', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan={2} className="p-2 text-right font-bold text-[10px] text-slate-700 tracking-wide">TOTAL DE BENS ARRESTÁVEIS IDENTIFICADOS</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-800 text-[12px]">R$ {totPatrimonio.toLocaleString('pt-BR')}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaAtiva === "fat" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-indigo-600 rounded-xl shadow-md p-8 flex flex-col justify-center items-center text-center text-white relative overflow-hidden border border-indigo-700 max-w-4xl mx-auto">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                <span className="text-[12px] font-bold uppercase tracking-widest text-indigo-100 mb-1 z-10 flex items-center gap-2">
                  Potencial Real de Antecipação (Grupo Consolidado)
                </span>
                
                <div className="flex items-center gap-4 z-10 my-3">
                  <span className="font-mono text-4xl font-black drop-shadow-md">R$ {potencialRealCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  
                  {/* 🔥 APLICAÇÃO DO DIFF NO POTENCIAL DA CARTEIRA */}
                  {dadosPai && (
                    <div className="bg-white/20 border border-white/30 px-3 py-1.5 rounded-lg flex flex-col items-start backdrop-blur-sm shadow-inner">
                      <span className="text-[9px] uppercase tracking-wider text-indigo-200 font-bold mb-0.5">Potencial Ano Passado</span>
                      <span className="text-sm font-mono font-bold text-white">R$ {potEstimadoPai.toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-indigo-200 mt-6 space-y-1.5 z-10 bg-black/10 p-3 rounded backdrop-blur-sm w-full max-w-sm text-left">
                    <p><strong>Base de Faturamento (YTD/Parcial):</strong> R$ {faturamentoMedioReferencia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="border-t border-indigo-400/30 pt-1.5"><strong>Modelo:</strong> (Fat.Base ÷ 30) × Prazo × Compos(%) × APrazo(%)</p>
                </div>
            </div>

            {analise.empresas_faturamento.map((empFat, empIndex) => (
              <div key={empIndex} className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className={`${sectionHeaderStyle} bg-slate-900 border-slate-900`}>
                  📈 Quadro de Faturamento Consolidado do Grupo Mês a Mês
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left min-w-[800px]">
                    <thead>
                      <tr>
                        <th className={`${thStyle} w-28 text-left`}>Mês Referência</th>
                        <th className={thStyle}>Realizado 2026 (R$)</th><th className={`${thStyle} w-24`}>Var YoY (%)</th>
                        <th className={thStyle}>Realizado 2025 (R$)</th><th className={`${thStyle} w-24`}>Var YoY (%)</th>
                        <th className={thStyle}>Realizado 2024 (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meses.map((mes) => {
                        const d26 = calcDelta(mes, "2026", "2025");
                        const d25 = calcDelta(mes, "2025", "2024");
                        return (
                          <tr key={mes}>
                            <td className={`${tdStyle} bg-slate-50 font-bold uppercase text-[10px] pl-4 text-slate-600`}>{mes}</td>
                            <td className={tdStyle}>
                              <MathInput value={empFat.faturamento["2026"]?.[mes]} onChange={(val) => handleFatGrupo(empIndex, "2026", mes, val)} className={numStyle} />
                            </td>
                            <td className={`${tdStyle} text-center font-bold text-[10px] ${d26 > 0 ? 'text-emerald-600 bg-emerald-50/30' : d26 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>{d26 === 0 ? "-" : `${d26.toFixed(1)}%`}</td>
                            <td className={tdStyle}>
                              <MathInput value={empFat.faturamento["2025"]?.[mes]} onChange={(val) => handleFatGrupo(empIndex, "2025", mes, val)} className={numStyle} />
                            </td>
                            <td className={`${tdStyle} text-center font-bold text-[10px] ${d25 > 0 ? 'text-emerald-600 bg-emerald-50/30' : d25 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>{d25 === 0 ? "-" : `${d25.toFixed(1)}%`}</td>
                            <td className={tdStyle}>
                              <MathInput value={empFat.faturamento["2024"]?.[mes]} onChange={(val) => handleFatGrupo(empIndex, "2024", mes, val)} className={numStyle} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-[11px]">
                        <td className="p-2 border border-slate-200 text-slate-700 text-right">TOTAL ANO</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-indigo-700">{totAno26.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`border border-slate-200 text-center font-mono ${varTot26_25 > 0 ? 'text-emerald-600 bg-emerald-50/30' : varTot26_25 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>{varTot26_25 === 0 ? "-" : `${varTot26_25.toFixed(1)}%`}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-800">{totAno25.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`border border-slate-200 text-center font-mono ${varTot25_24 > 0 ? 'text-emerald-600 bg-emerald-50/30' : varTot25_24 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>{varTot25_24 === 0 ? "-" : `${varTot25_24.toFixed(1)}%`}</td>
                        <td className="p-2 border border-slate-200 text-right font-mono text-slate-800">{totAno24.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-bold text-[11px]">
                        <td className="p-2 border border-indigo-100 text-indigo-900 text-right">{labelMascaraYTD}</td>
                        <td className="p-2 border border-indigo-100 text-right font-mono text-indigo-900">{mediaYTD26.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`border border-indigo-100 text-center font-mono ${varYTD26_25 > 0 ? 'text-emerald-700 bg-emerald-100/50' : varYTD26_25 < 0 ? 'text-rose-700 bg-rose-100/50' : 'text-indigo-600'}`}>{varYTD26_25 === 0 ? "-" : `${varYTD26_25.toFixed(1)}%`}</td>
                        <td className="p-2 border border-indigo-100 text-right font-mono text-indigo-900/80">{mediaYTD25.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`border border-indigo-100 text-center font-mono ${varYTD25_24 > 0 ? 'text-emerald-700 bg-emerald-100/50' : varYTD25_24 < 0 ? 'text-rose-700 bg-rose-100/50' : 'text-indigo-600'}`}>{varYTD25_24 === 0 ? "-" : `${varYTD25_24.toFixed(1)}%`}</td>
                        <td className="p-2 border border-indigo-100 text-right font-mono text-indigo-900/80">{mediaYTD24.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                <div className={sectionHeaderStyle}>Parâmetros e Prazos Operacionais</div>
                <table className="w-full border-collapse">
                  <tbody>
                    <tr><td className={`${thStyle} text-right w-1/2`}>Ticket Médio da Base (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.ticket_medio ?? ""} onChange={(e)=>updateNested("dados_potencial", "ticket_medio", Number(e.target.value))} className={`${numStyle} text-indigo-700 font-bold`} /></td></tr>
                    <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Duplicatas</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_dpls} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_dpls", e.target.value)} className={cellStyle} /></td></tr>
                    <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Comissária</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_comissaria} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_comissaria", e.target.value)} className={cellStyle} /></td></tr>
                    <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Intercompany</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_intercompany || ""} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_intercompany", e.target.value)} className={cellStyle} /></td></tr>
                    
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className={`${thStyle} text-right font-bold text-slate-800`}>Volume de Recebimento (À Vista %)</td>
                      <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_vista ?? ""} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_vista", Number(e.target.value))} className={`${numStyle} font-semibold`} /></td>
                    </tr>
                    <tr className="bg-indigo-50/30">
                      <td className={`${thStyle} text-right font-bold text-indigo-900 bg-indigo-50/50`}>Volume de Recebimento (A Prazo %)</td>
                      <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_prazo ?? ""} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_prazo", Number(e.target.value))} className={`${numStyle} text-indigo-700 font-bold bg-indigo-100/30`} /></td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className={`${thStyle} text-right`}>Natureza do Prazo (Duplicatas %)</td>
                      <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_dpls ?? ""} onChange={(e)=>updateNested("dados_potencial", "composicao_dpls", Number(e.target.value))} className={numStyle} /></td>
                    </tr>
                    <tr>
                      <td className={`${thStyle} text-right`}>Natureza do Prazo (Comissária %)</td>
                      <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_comissaria ?? ""} onChange={(e)=>updateNested("dados_potencial", "composicao_comissaria", Number(e.target.value))} className={numStyle} /></td>
                    </tr>
                    <tr>
                      <td className={`${thStyle} text-right`}>Natureza do Prazo (Intercompany %)</td>
                      <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_intercompany ?? 0} onChange={(e)=>updateNested("dados_potencial", "composicao_intercompany", Number(e.target.value))} className={numStyle} /></td>
                    </tr>
                    <tr>
                      <td className={`${thStyle} text-right`}>Natureza do Prazo (Outros %)</td>
                      <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_outros ?? 0} onChange={(e)=>updateNested("dados_potencial", "composicao_outros", Number(e.target.value))} className={numStyle} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtiva === "endividamento" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={`${sectionHeaderStyle} bg-slate-900 border-slate-900 flex justify-between items-center`}>
                <span>Radar de Alavancagem Global do Grupo (Consolidado)</span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thStyle}>Passivo CP</th>
                    <th className={thStyle}>Passivo LP</th>
                    <th className={`${thStyle} bg-rose-50 text-rose-800 border-rose-200`}>ENDIVIDAMENTO TOTAL</th>
                    <th className={thStyle}>Pressão Antecipação DPLS (CP)</th>
                    <th className={thStyle}>Concentração Fundos</th>
                    <th className={thStyle}>Concentração Bancos</th>
                    <th className={thStyle}>Conta em Renegociação?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50 font-mono text-[12px] text-center">
                    <td className="p-3 border border-slate-200 text-slate-700">R$ {endivCurtoPrazo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-3 border border-slate-200 text-slate-700">R$ {endivLongoPrazo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-3 border border-slate-200 text-rose-700 bg-rose-50 font-bold flex flex-col items-center justify-center h-full">
                      <span>R$ {totEndivGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {/* 🔥 APLICAÇÃO DO DIFF NO ENDIVIDAMENTO COM CORES INVERTIDAS (Subir é ruim) */}
                      {dadosPai && (
                        <div className="mt-1">
                          <IndicadorEvolucao atual={totEndivGeral} antigo={totEndivGeralPai} invertido={true} />
                        </div>
                      )}
                    </td>
                    <td className="p-3 border border-slate-200 text-slate-600">{percDplsCP.toFixed(1)}%</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{percFundos.toFixed(1)}%</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{percBancos.toFixed(1)}%</td>
                    <td className="p-0 border border-slate-200 bg-white">
                        <select value={analise.endividamento_resumo.renegociando} onChange={(e)=>updateNested("endividamento_resumo", "renegociando", e.target.value)} className="w-full h-full p-2 text-center font-sans font-bold text-[11px] bg-transparent outline-none cursor-pointer hover:bg-slate-50 transition-colors"><option value="Não">Não</option><option value="Sim">Sim</option></select>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="p-3 text-center text-[11px] text-slate-600 bg-slate-100/50 font-sans border-t border-slate-200">
                      Multiplicador de Alavancagem do Grupo: <strong className="text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 ml-1 shadow-sm">{faturamentoMedioReferencia > 0 ? (totEndivGeral / faturamentoMedioReferencia).toFixed(2) : "0.00"} x</strong> o faturamento consolidado.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {analise.empresas_endividamento.map((empEndiv, empIndex) => (
              <div key={empIndex} className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className={sectionHeaderStyle}>
                    <span>🏦 Lista Consolidada de Passivos (Todas as Entidades)</span>
                    <button onClick={() => {
                      const novasEmp = [...analise.empresas_endividamento];
                      novasEmp[empIndex].endividamento.push({instituicao:"", modalidade:"", saldo:0, tipo:"Banco", prazo:"Curto Prazo"} as any);
                      setAnalise({...analise, empresas_endividamento: novasEmp});
                    }} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Nova Dívida na Lista</button>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={`${thStyle} w-48 text-left pl-3`}>CNPJ / Empresa Devedora</th>
                      <th className={thStyle}>Credor Oficial</th>
                      <th className={thStyle}>Linha / Modalidade</th>
                      <th className={`${thStyle} w-40 text-right`}>Saldo Aberto (R$)</th>
                      <th className={`${thStyle} w-32`}>Categoria Mercado</th>
                      <th className={`${thStyle} w-32`}>Vencimento Original</th>
                      <th className={`${thStyle} w-8`}>-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empEndiv.endividamento.map((div: any, i) => (
                      <tr key={i}>
                        <td className={tdStyle}><input value={div.empresa_origem || ""} onChange={(e)=>updateArrayNested('empresas_endividamento', empIndex, 'endividamento', i, 'empresa_origem', e.target.value)} className={`${cellStyle} text-slate-500`} placeholder="Qual CNPJ?" /></td>
                        <td className={tdStyle}><input value={div.instituicao} onChange={(e)=>updateArrayNested('empresas_endividamento', empIndex, 'endividamento', i, 'instituicao', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                        <td className={tdStyle}><input value={div.modalidade} onChange={(e)=>updateArrayNested('empresas_endividamento', empIndex, 'endividamento', i, 'modalidade', e.target.value)} className={cellStyle} /></td>
                        <td className={tdStyle}><input type="number" value={div.saldo ?? ""} onChange={(e)=>updateArrayNested('empresas_endividamento', empIndex, 'endividamento', i, 'saldo', Number(e.target.value))} className={`${numStyle} font-bold text-rose-600 bg-rose-50/10`} /></td>
                        <td className={tdStyle}>
                          <select value={div.tipo} onChange={(e)=>updateArrayNested('empresas_endividamento', empIndex, 'endividamento', i, 'tipo', e.target.value)} className={cellStyle}>
                            <option value="Banco">Banco</option><option value="Fundo">FIDC/SEC</option>
                          </select>
                        </td>
                        <td className={tdStyle}>
                          <select value={div.prazo} onChange={(e)=>updateArrayNested('empresas_endividamento', empIndex, 'endividamento', i, 'prazo', e.target.value)} className={cellStyle}>
                            <option value="Curto Prazo">Curto Prazo (CP)</option><option value="Longo Prazo">Longo Prazo (LP)</option>
                          </select>
                        </td>
                        <td className={`${tdStyle} text-center`}><button onClick={()=>rmArrayNested('empresas_endividamento', empIndex, 'endividamento', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            
            {/* REFERÊNCIAS COMERCIAIS */}
            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={sectionHeaderStyle}>
                <span>Market Check & Referências Comerciais Ativas</span>
                <button onClick={() => addArray('referencias', {instituicao:"", rnx:"", cliente_desde:"", ultima_operacao:"", vop:0, limite_global:0, risco_total:0, risco_1:0, operacao_1:"", vcto_1:"", risco_2:0, operacao_2:"", vcto_2:"", liquidez_5_dias:0, liquidez_pontual:0, atraso_5_dias:0, atraso_15_dias:0, recompra:"", concentracao:0})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Cadastrar Referência</button>
              </div>
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
                <table className="w-full border-collapse min-w-[1500px]">
                    <thead>
                    <tr>
                      <th className={thStyle}>Agente Financeiro</th><th className={thStyle}>Rating/RNX</th><th className={`${thStyle} w-24`}>Início Relac.</th><th className={`${thStyle} w-24`}>Última Operação</th>
                      <th className={`${thStyle} w-28 text-right`}>VOP (R$)</th>
                      <th className={`${thStyle} w-28 text-right`}>Limite Aprovado</th><th className={`${thStyle} w-28 text-right`}>Carteira Total</th>
                      <th className={`${thStyle} w-24 text-right bg-indigo-50 border-indigo-200`}>Risco 1 (R$)</th><th className={`${thStyle} bg-indigo-50 border-indigo-200`}>Tipo Op 1</th><th className={`${thStyle} bg-indigo-50 border-indigo-200`}>Vcto Final 1</th>
                      <th className={`${thStyle} w-24 text-right bg-amber-50 border-amber-200`}>Risco 2 (R$)</th><th className={`${thStyle} bg-amber-50 border-amber-200`}>Tipo Op 2</th><th className={`${thStyle} bg-amber-50 border-amber-200`}>Vcto Final 2</th>
                      <th className={thStyle}>Liq. Pontual (%)</th><th className={thStyle}>Atrasos (Até 5D) (%)</th><th className={`${thStyle} bg-slate-200`}>Liq. 5 Dias (Total)</th><th className={thStyle}>Atrasos (15D+)</th>
                      <th className={thStyle}>Freq. Recompra</th><th className={thStyle}>Concentração Máx</th><th className={`${thStyle} w-8`}>-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.referencias.map((ref, i) => {
                        const calcLiq5 = (Number(ref.liquidez_pontual) || 0) + (Number(ref.atraso_5_dias) || 0);
                        return (
                      <tr key={i}>
                        <td className={tdStyle}><input value={ref.instituicao} onChange={(e)=>updateArray('referencias', i, 'instituicao', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                        <td className={tdStyle}><input value={ref.rnx} onChange={(e)=>updateArray('referencias', i, 'rnx', e.target.value)} className={cellStyle} /></td>
                        <td className={tdStyle}><input type="date" value={ref.cliente_desde} onChange={(e)=>updateArray('referencias', i, 'cliente_desde', e.target.value)} className={`${cellStyle} text-center`} /></td>
                        <td className={tdStyle}><input type="date" value={ref.ultima_operacao} onChange={(e)=>updateArray('referencias', i, 'ultima_operacao', e.target.value)} className={`${cellStyle} text-center`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.vop ?? ""} onChange={(e)=>updateArray('referencias', i, 'vop', Number(e.target.value))} className={`${numStyle} font-bold text-slate-700`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.limite_global ?? ""} onChange={(e)=>updateArray('referencias', i, 'limite_global', Number(e.target.value))} className={`${numStyle} text-indigo-700 font-bold bg-indigo-50/20`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.risco_total ?? ""} onChange={(e)=>updateArray('referencias', i, 'risco_total', Number(e.target.value))} className={`${numStyle} text-rose-600 font-bold bg-rose-50/20`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.risco_1 ?? ""} onChange={(e)=>updateArray('referencias', i, 'risco_1', Number(e.target.value))} className={`${numStyle} bg-indigo-50/50`} /></td>
                        <td className={tdStyle}><input value={ref.operacao_1} onChange={(e)=>updateArray('referencias', i, 'operacao_1', e.target.value)} className={`${cellStyle} bg-indigo-50/50`} /></td>
                        <td className={tdStyle}><input type="date" value={ref.vcto_1} onChange={(e)=>updateArray('referencias', i, 'vcto_1', e.target.value)} className={`${cellStyle} bg-indigo-50/50 text-center`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.risco_2 ?? ""} onChange={(e)=>updateArray('referencias', i, 'risco_2', Number(e.target.value))} className={`${numStyle} bg-amber-50/50`} /></td>
                        <td className={tdStyle}><input value={ref.operacao_2} onChange={(e)=>updateArray('referencias', i, 'operacao_2', e.target.value)} className={`${cellStyle} bg-amber-50/50`} /></td>
                        <td className={tdStyle}><input type="date" value={ref.vcto_2} onChange={(e)=>updateArray('referencias', i, 'vcto_2', e.target.value)} className={`${cellStyle} bg-amber-50/50 text-center`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.liquidez_pontual ?? ""} onChange={(e)=>updateArray('referencias', i, 'liquidez_pontual', Number(e.target.value))} className={numStyle} /></td>
                        <td className={tdStyle}><input type="number" value={ref.atraso_5_dias ?? ""} onChange={(e)=>updateArray('referencias', i, 'atraso_5_dias', Number(e.target.value))} className={numStyle} /></td>
                        <td className={`${tdStyle} bg-slate-100`}><input type="number" value={calcLiq5} disabled className={`${numStyle} bg-slate-100 font-bold text-indigo-700`} /></td>
                        <td className={tdStyle}><input type="number" value={ref.atraso_15_dias ?? ""} onChange={(e)=>updateArray('referencias', i, 'atraso_15_dias', Number(e.target.value))} className={numStyle} /></td>
                        <td className={tdStyle}><input value={ref.recompra} onChange={(e)=>updateArray('referencias', i, 'recompra', e.target.value)} className={cellStyle} /></td>
                        <td className={tdStyle}><input type="number" value={ref.concentracao ?? ""} onChange={(e)=>updateArray('referencias', i, 'concentracao', Number(e.target.value))} className={`${numStyle} text-center`} placeholder="%" /></td>
                        <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('referencias', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtiva === "restritivos" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl">
            
            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={`${sectionHeaderStyle} bg-slate-800 border-slate-800`}>Quadro Resumo de Apontamentos do Grupo (Serasa / Boa Vista)</div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thStyle}>PEFIN</th><th className={thStyle}>REFIN</th><th className={thStyle}>Protestos</th>
                    <th className={thStyle}>Dívidas Vencidas</th><th className={thStyle}>Ações Judiciais</th><th className={thStyle}>Cheques S/ Fundo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={tdStyle}><input type="number" value={analise.restritivos_quadro?.pefin ?? 0} onChange={(e) => updateNested("restritivos_quadro", "pefin", Number(e.target.value))} className={`${numStyle} text-center font-bold text-rose-700`} /></td>
                    <td className={tdStyle}><input type="number" value={analise.restritivos_quadro?.refin ?? 0} onChange={(e) => updateNested("restritivos_quadro", "refin", Number(e.target.value))} className={`${numStyle} text-center font-bold text-rose-700`} /></td>
                    <td className={tdStyle}><input type="number" value={analise.restritivos_quadro?.protesto ?? 0} onChange={(e) => updateNested("restritivos_quadro", "protesto", Number(e.target.value))} className={`${numStyle} text-center font-bold text-rose-700`} /></td>
                    <td className={tdStyle}><input type="number" value={analise.restritivos_quadro?.div_vencida ?? 0} onChange={(e) => updateNested("restritivos_quadro", "div_vencida", Number(e.target.value))} className={`${numStyle} text-center font-bold text-rose-700`} /></td>
                    <td className={tdStyle}><input type="number" value={analise.restritivos_quadro?.acao_judicial ?? 0} onChange={(e) => updateNested("restritivos_quadro", "acao_judicial", Number(e.target.value))} className={`${numStyle} text-center font-bold text-rose-700`} /></td>
                    <td className={tdStyle}><input type="number" value={analise.restritivos_quadro?.cheque_sem_fundo ?? 0} onChange={(e) => updateNested("restritivos_quadro", "cheque_sem_fundo", Number(e.target.value))} className={`${numStyle} text-center font-bold text-rose-700`} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {analise.empresas_serasa.map((empSerasa, empIndex) => (
              <div key={empIndex} className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className={sectionHeaderStyle}>
                    <span>⚠️ Detalhamento Consolidado de Apontamentos (Todas as Entidades)</span>
                    <button onClick={() => {
                      const novasEmp = [...analise.empresas_serasa];
                      novasEmp[empIndex].restritivos.push({tipo_restritivo:"Protesto", quantidade_somada:1, valor_somado:0, data_mais_recente:"", credores_resumo:""} as any);
                      setAnalise({...analise, empresas_serasa: novasEmp});
                    }} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Restritivo na Lista</button>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={`${thStyle} w-40 text-left pl-3`}>CNPJ / Empresa Alvo</th>
                      <th className={thStyle}>Natureza do Apontamento</th><th className={`${thStyle} w-16`}>Vol.</th>
                      <th className={`${thStyle} w-32 text-right`}>Valor Acumulado (R$)</th><th className={`${thStyle} w-28`}>Data Ocorrência</th>
                      <th className={`${thStyle} w-56`}>Credores ou Cartórios</th><th className={`${thStyle} w-8`}>-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empSerasa.restritivos.map((r: any, i) => (
                      <tr key={i}>
                        <td className={tdStyle}><input value={r.empresa_origem || ""} onChange={(e)=>updateArrayNested('empresas_serasa', empIndex, 'restritivos', i, 'empresa_origem', e.target.value)} className={`${cellStyle} text-slate-500`} placeholder="Qual CNPJ?" /></td>
                        <td className={tdStyle}><input value={r.tipo_restritivo || r.restritivo || ""} onChange={(e)=>updateArrayNested('empresas_serasa', empIndex, 'restritivos', i, 'tipo_restritivo', e.target.value)} className={`${cellStyle} font-bold text-rose-700`} /></td>
                        <td className={tdStyle}><input type="number" value={r.quantidade_somada ?? r.qtd ?? ""} onChange={(e)=>updateArrayNested('empresas_serasa', empIndex, 'restritivos', i, 'quantidade_somada', Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                        <td className={tdStyle}><input type="number" value={r.valor_somado ?? r.valor ?? ""} onChange={(e)=>updateArrayNested('empresas_serasa', empIndex, 'restritivos', i, 'valor_somado', Number(e.target.value))} className={`${numStyle} text-rose-600 font-bold bg-rose-50/20`} /></td>
                        <td className={tdStyle}><input type="date" value={r.data_mais_recente || r.data || ""} onChange={(e)=>updateArrayNested('empresas_serasa', empIndex, 'restritivos', i, 'data_mais_recente', e.target.value)} className={`${cellStyle} text-center`} /></td>
                        <td className={tdStyle}><input value={r.credores_resumo || r.observacao || ""} onChange={(e)=>updateArrayNested('empresas_serasa', empIndex, 'restritivos', i, 'credores_resumo', e.target.value)} className={cellStyle} /></td>
                        <td className={`${tdStyle} text-center`}><button onClick={()=>rmArrayNested('empresas_serasa', empIndex, 'restritivos', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={`${sectionHeaderStyle} bg-slate-900 border-slate-900 flex gap-3 items-center`}>
                  <span>⚖️ Dossier Jurídico Textual Consolidado do Grupo (Kappi / Jusbrasil)</span>
              </div>
              <textarea 
                  value={analise.dados_juridico?.relatorio_completo || ""} 
                  onChange={(e)=>updateNested("dados_juridico", "relatorio_completo", e.target.value)} 
                  className="w-full h-72 p-4 border-none outline-none text-[12px] text-slate-700 font-sans resize-none bg-slate-50/50 leading-relaxed focus:bg-white transition-colors" 
                  placeholder="Aguardando consolidação inteligente ou digite a síntese..."
              />
            </div>
            
            <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
              <div className={sectionHeaderStyle}>Radar de Mídia, Reputação e Compliance</div>
              {analise.noticias_mercado && analise.noticias_mercado.risco_midia_nivel ? (
                <div className="p-5 flex flex-col md:flex-row gap-6 bg-slate-50">
                  <div className="flex flex-col gap-3 w-full md:w-1/3">
                    <div className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center text-center shadow-inner h-full ${
                      analise.noticias_mercado.risco_midia_nivel === 'alto' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                      analise.noticias_mercado.risco_midia_nivel === 'medio' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Risco de Mídia</span>
                      <span className="text-2xl font-black uppercase mt-1">{analise.noticias_mercado.risco_midia_nivel}</span>
                      <span className="text-[11px] font-medium mt-2 leading-tight">{analise.noticias_mercado.parecer_analista}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 w-full md:w-2/3">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Alertas Graves Detectados</h4>
                      {analise.noticias_mercado.alertas_graves && analise.noticias_mercado.alertas_graves.length > 0 ? (
                        <ul className="space-y-2">
                          {analise.noticias_mercado.alertas_graves.map((alerta: string, idx: number) => (
                            <li key={idx} className="bg-rose-100 border border-rose-300 text-rose-900 text-[12px] font-medium px-3 py-2 rounded-lg flex items-start gap-2 shadow-sm">
                              <span className="mt-0.5">🚨</span> <span>{alerta}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="bg-white border border-slate-200 text-slate-500 text-[12px] px-3 py-2 rounded-lg flex items-center gap-2">
                          <span>✅ Nenhum alerta grave encontrado na mídia.</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Termômetro do Setor</h4>
                      <div className="bg-white border border-slate-200 text-slate-700 text-[12px] px-4 py-3 rounded-lg leading-relaxed shadow-sm">
                        {analise.noticias_mercado.panorama_setor}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <textarea 
                  value={analise.noticias_midia} 
                  onChange={(e)=>setAnalise({...analise, noticias_midia: e.target.value})} 
                  className="w-full h-24 p-4 border-none outline-none text-[12px] text-slate-700 font-sans resize-none bg-slate-50/50 focus:bg-white transition-colors"
                  placeholder="Insira links ou descrições curtas..."
                />
              )}
            </div>
          </div>
        )}

        {abaAtiva === "parecer" && (
          <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-md shadow-md border border-slate-200 overflow-hidden">
              <div className={`${sectionHeaderStyle} bg-indigo-900 border-indigo-900 pb-3 pt-3`}>
                <span className="text-sm">Voto e Justificativa Técnica da Mesa de Crédito (Analista)</span>
              </div>
              <textarea 
                value={analise.parecer_analista} 
                onChange={(e) => setAnalise({...analise, parecer_analista: e.target.value})}
                className="w-full p-6 border-none h-80 font-sans text-[13px] text-slate-800 outline-none resize-none bg-slate-50 focus:bg-white transition-colors leading-relaxed"
                placeholder="Redija a conclusão narrativa embasando a decisão comercial..."
              />
            </div>

            {analise.parecer_comite && (
              <div className="bg-indigo-50 rounded-md shadow-sm border-2 border-indigo-200 overflow-hidden">
                <div className="bg-indigo-100 border-b border-indigo-200 text-indigo-900 text-[11px] font-bold tracking-wide p-3 uppercase flex items-center gap-2">
                  <span>🛡️</span> Retorno Oficial do Comitê de Crédito
                </div>
                <div className="text-[13px] text-indigo-900 p-6 whitespace-pre-wrap leading-relaxed font-medium">
                  {analise.parecer_comite}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg border-2 border-indigo-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
              <div className="pl-4">
                <h3 className="text-[14px] font-bold text-slate-800 uppercase tracking-wide">Veredito Pré-Comitê (Recomendação)</h3>
                <p className="text-[12px] text-slate-500 mt-1">Este carimbo irá pautar a reunião colegiada. Escolha a sua recomendação final.</p>
              </div>
              <select 
                value={analise.recomendacao_analista || ""} 
                onChange={(e)=>setAnalise({...analise, recomendacao_analista: e.target.value})} 
                className="bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-900 font-bold px-5 py-3 text-[14px] rounded-lg outline-none cursor-pointer shadow-sm w-full md:w-80 transition-all focus:ring-4 focus:ring-indigo-500/20"
              >
                <option value="">Aguardando Definição...</option>
                <option value="Aprovado">✅ RECOMENDAR APROVAÇÃO</option>
                <option value="Reprovado">❌ RECOMENDAR DECLÍNIO</option>
                <option value="Em Análise">⏳ PENDENCIAR / DILIGÊNCIA EXT.</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </>
  );
}