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
  // Estruturas JSONB espelhando as abas do Excel
  dados_gerais: { fundacao?: string; ramo?: string; site?: string; relacionamento?: string; gerente?: string };
  proposta: { modalidade: string; limite: number; prazo: number; tranche: number; taxa: number; garantia: string; rating: string };
  dados_faturamento: Record<string, Record<string, number>>; // { "2024": { "janeiro": 136754, ... } }
  dados_potencial: { ticket_medio: number };
  dados_endividamento: Array<{ instituicao: string; modalidade: string; saldo: number }>;
  dados_restritivos: Array<{ origem: string; tipo: string; qtd: number; valor: number; obs: string }>;
  dados_estrutura_societaria: Array<{ s_nome: string; s_perc: number; s_cargo: string; s_aval: boolean; b_bens: string; b_valor: number }>;
  dados_juridico: { processos_tramitacao?: string; processos_arquivados?: string };
  parecer_comite: string;
}

export default function MesaAnalisePage() {
  const searchParams = useSearchParams();
  const analiseId = searchParams.get("id");

  const [abaAtiva, setAbaAtiva] = useState("proposta");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [analise, setAnalise] = useState<AnaliseData | null>(null);

  useEffect(() => {
    if (analiseId) carregarAnaliseDoBanco();
  }, [analiseId]);

  const carregarAnaliseDoBanco = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("analises_credito").select("*").eq("id", analiseId).single();
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
          dados_gerais: data.dados_gerais || {},
          proposta: data.proposta || { modalidade: "Desconto", limite: 80000, prazo: 75, tranche: 20000, taxa: 0.035, garantia: "Aval", rating: "B" },
          dados_faturamento: data.dados_faturamento || { "2024": {}, "2025": {}, "2026": {} },
          dados_potencial: data.dados_potencial || { ticket_medio: 3000 },
          dados_endividamento: data.dados_endividamento || [{ instituicao: "Viacredi", modalidade: "Desconto", saldo: 382000 }],
          dados_restritivos: data.dados_restritivos || [
            { origem: "Totalcap", tipo: "Protesto", qtd: 30, valor: 1412847.78, obs: "Imposto" },
            { origem: "Totalcap", tipo: "Refin", qtd: 1, valor: 4681.44, obs: "Caixa" }
          ],
          dados_estrutura_societaria: data.dados_estrutura_societaria || [{ s_nome: "Sidnei da Silva", s_perc: 100, s_cargo: "Sócio", s_aval: true, b_bens: "1 imóvel + 1 terreno", b_valor: 199425.89 }],
          dados_juridico: data.dados_juridico || {},
          parecer_comite: data.parecer_comite || ""
        });
      }
    } catch (err) {
      console.error(err);
      alert("❌ Falha ao inicializar a Mesa de Crédito V8.");
    } finally {
      setLoading(false);
    }
  };

  const persistirNoBanco = async () => {
    if (!analise) return;
    try {
      setSalvando(true);
      const { error } = await supabase.from("analises_credito").update({ ...analise }).eq("id", analise.id);
      if (error) throw error;
      alert("✅ Excel Virtual V8 sincronizado com sucesso no Supabase!");
    } catch (err: any) {
      alert("❌ Erro de persistência: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // =========================================================================
  // 🧮 MOTOR DE FÓRMULAS DO EXCEL (CÁLCULOS EM TEMPO REAL)
  // =========================================================================
  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  
  const calcularTotalAno = (ano: string) => {
    if (!analise) return 0;
    return meses.reduce((acc, mes) => acc + Number(analise.dados_faturamento[ano]?.[mes] || 0), 0);
  };

  const calcularMediaMensal = (ano: string) => {
    if (!analise) return 0;
    const preenchidos = meses.filter(mes => analise.dados_faturamento[ano]?.[mes] !== undefined && analise.dados_faturamento[ano]?.[mes] !== 0).length;
    return preEnglish === 0 ? 0 : calcularTotalAno(ano) / preenchidos;
  };

  const calcularVariacaoPercentual = (v1: number, v2: number) => {
    if (!v1) return 0;
    return ((v2 - v1) / v1) * 100;
  };

  const totalEndividamentoBancos = analise?.dados_endividamento.reduce((acc, d) => acc + Number(d.saldo), 0) || 0;
  const totalRestritivos = analise?.dados_restritivos.reduce((acc, r) => acc + Number(r.valor), 0) || 0;
  
  const fatMedioAtual = calcularMediaMensal("2026") || calcularMediaMensal("2025");
  const multiplicadorFat = fatMedioAtual > 0 ? totalEndividamentoBancos / fatMedioAtual : 0;

  if (loading) return <div className="p-12 text-center font-mono font-bold animate-pulse text-xs text-slate-500">⏳ CARREGANDO PLANILHAS INTEGRADAS...</div>;
  if (!analise) return <div className="p-12 text-center text-red-500 font-bold">❌ Registro ou ID inválido na esteira.</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1800px] mx-auto space-y-4">
        
        {/* TOP COMMAND BAR */}
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <div>
            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">Mesa de Auditoria V8 (Planilha Consolidada)</span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase mt-1">{analise.razao_social}</h1>
            <p className="text-xs font-mono font-bold text-slate-500">CNPJ: {analise.cnpj} | RATING ATUAL: <span className="text-indigo-600 font-black">{analise.proposta.rating}</span></p>
          </div>
          <div className="flex gap-2">
            <button onClick={persistirNoBanco} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2 rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-md cursor-pointer">
              {salvando ? "Salvando..." : "💾 Gravar Alterações (Ctrl+S)"}
            </button>
          </div>
        </div>

        {/* CONTÊINER PRINCIPAL DO EXCEL VIRTUAL */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          
          {/* TAB STRIP (AS ABAS DO EXCELZÃO ORIGINAL) */}
          <div className="bg-slate-100 border-b border-slate-200 flex flex-wrap p-1 gap-0.5">
            {[
              { id: "proposta", label: "📋 1. Proposta & Rating" },
              { id: "dados_gerais", label: "🏢 2. Dados Gerais" },
              { id: "estrutura", label: "👥 3. Sócios & Patrimônio" },
              { id: "fat", label: "📊 4. Faturamento Consolidado" },
              { id: "endividamento", label: "🏦 5. Endividamento Bancos" },
              { id: "restritivos", label: "🚨 6. Restritivos (Pefin/Protesto)" },
              { id: "juridico", label: "⚖️ 7. Pesquisas de Ações" },
              { id: "parecer", label: "📝 8. Parecer Analista" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`px-3 py-2 font-black uppercase text-[10px] tracking-wider rounded transition-all cursor-pointer ${
                  abaAtiva === tab.id ? "bg-white text-indigo-600 shadow-sm border-t-2 border-t-indigo-500 font-black" : "text-slate-500 hover:bg-slate-200/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ÁREA DE TRABALHO DAS ABAS */}
          <div className="p-5 flex-1">

            {/* TAB 1: PROPOSTA & RATING */}
            {abaAtiva === "proposta" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Condições Estruturadas do Limite</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Modalidade Cedida</label>
                      <input type="text" value={analise.proposta.modalidade} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, modalidade: e.target.value } })} className="w-full p-2 border border-slate-300 bg-white rounded font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Limite Máximo Concedido (R$)</label>
                      <input type="number" value={analise.proposta.limite} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, limite: Number(e.target.value) } })} className="w-full p-2 border border-slate-300 bg-white rounded font-mono font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Taxa de Compra Mensal (%)</label>
                      <input type="number" step="0.001" value={analise.proposta.taxa} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, taxa: Number(e.target.value) } })} className="w-full p-2 border border-slate-300 bg-white rounded font-mono font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Prazo Médio Alvo (Dias)</label>
                      <input type="number" value={analise.proposta.prazo} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, prazo: Number(e.target.value) } })} className="w-full p-2 border border-slate-300 bg-white rounded font-mono font-bold text-xs" />
                    </div>
                  </div>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block border-b border-indigo-200/60 pb-1">Rating de Risco Calculado</span>
                    <div className="text-center py-6">
                      <span className="text-5xl font-black text-indigo-600 block">{analise.proposta.rating}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1 block">Risco Médio da Operação</span>
                    </div>
                  </div>
                  <select value={analise.proposta.rating} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, rating: e.target.value } })} className="w-full p-2 border border-indigo-200 bg-white rounded text-xs font-black text-indigo-700 outline-none cursor-pointer uppercase">
                    <option value="A">Rating A — Perfil Reduzido</option>
                    <option value="B">Rating B — Perfil Médio</option>
                    <option value="C">Rating C — Perfil Elevado</option>
                    <option value="D">Rating D — Fora do Perfil</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 2: DADOS GERAIS */}
            {abaAtiva === "dados_gerais" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 max-w-[800px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b pb-1">Ficha Cadastral Cadente</span>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div><span className="text-slate-400 font-bold block mb-1">Data de Fundação</span><input type="date" value={analise.dados_gerais.fundacao || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, fundacao: e.target.value } })} className="w-full p-2 border bg-white rounded" /></div>
                  <div><span className="text-slate-400 font-bold block mb-1">Ramo de Atividade</span><input type="text" value={analise.dados_gerais.ramo || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, ramo: e.target.value } })} className="w-full p-2 border bg-white rounded uppercase" /></div>
                  <div><span className="text-slate-400 font-bold block mb-1">Capital Social Integralizado (R$)</span><input type="number" value={analise.capital_social} onChange={(e) => setAnalise({ ...analise, capital_social: Number(e.target.value) })} className="w-full p-2 border bg-white rounded font-mono font-bold" /></div>
                  <div><span className="text-slate-400 font-bold block mb-1">Plataforma / Gerente</span><input type="text" value={analise.dados_gerais.gerente || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, gerente: e.target.value } })} className="w-full p-2 border bg-white rounded uppercase" /></div>
                </div>
              </div>
            )}

            {/* TAB 3: SÓCIOS & PATRIMÔNIO */}
            {abaAtiva === "estrutura" && (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Composição Societária & Bens Arrestáveis</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-2.5">Nome do Sócio / Diretor</th>
                        <th className="p-2.5 text-center">% Part.</th>
                        <th className="p-2.5">Cargo</th>
                        <th className="p-2.5 text-center">Assina Isolado?</th>
                        <th className="p-2.5">Bens Declarados (IRPF)</th>
                        <th className="p-2.5 text-right">Valor Avaliado (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold font-mono">
                      {analise.dados_estrutura_societaria.map((socio, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          <td className="p-1 font-sans font-black uppercase text-slate-900">{socio.s_nome}</td>
                          <td className="p-1 text-center"><input type="number" value={socio.s_perc} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].s_perc = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-16 p-1.5 border text-center rounded bg-transparent font-bold" /></td>
                          <td className="p-1 font-sans"><input type="text" value={socio.s_cargo} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].s_cargo = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-full p-1.5 border rounded bg-transparent font-bold uppercase" /></td>
                          <td className="p-1 text-center"><input type="checkbox" checked={socio.s_aval} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].s_aval = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="cursor-pointer" /></td>
                          <td className="p-1 font-sans"><input type="text" value={socio.b_bens} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].b_bens = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-full p-1.5 border rounded bg-transparent font-medium" /></td>
                          <td className="p-1 text-right"><input type="number" value={socio.b_valor} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].b_valor = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-32 p-1.5 border text-right rounded bg-transparent font-bold text-emerald-600" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: FATURAMENTO CONSOLIDADO (O CORE DO EXCEL) */}
            {abaAtiva === "fat" && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-xs text-slate-500 font-medium">✏️ Insira o faturamento bruto mensal. O robô preenche isso ao ler os PDFs das declarações, e você audita em tempo real.</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-w-[1200px]">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <th className="p-2.5 border-r">Mês Calendário</th>
                        <th className="p-2.5 border-r text-center">Ano 2024 (R$)</th>
                        <th className="p-2.5 border-r text-center">Ano 2025 (R$)</th>
                        <th className="p-2.5 text-center">Ano 2026 (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {meses.map((mes) => (
                        <tr key={mes} className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-black uppercase text-slate-700 border-r bg-slate-50/40 w-[180px]">{mes}</td>
                          {["2024", "2025", "2026"].map((ano) => (
                            <td key={ano} className="p-1 border-r last:border-r-0">
                              <input
                                type="number"
                                value={analise.dados_faturamento[ano]?.[mes] || ""}
                                onChange={(e) => handleSalvarCelulaFat(ano, mes, e.target.value)}
                                className="w-full p-1.5 bg-transparent font-bold text-slate-800 text-center outline-none focus:bg-indigo-50/50 focus:ring-1 focus:ring-indigo-400 rounded transition-all"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* TOTAIS CALCULADOS AUTOMATICAMENTE */}
                      <tr className="bg-indigo-50/30 font-black border-t-2 border-slate-200">
                        <td className="p-2.5 font-sans uppercase font-black text-indigo-700 border-r bg-indigo-50/20">TOTAL ANUAL (R$)</td>
                        <td className="p-2.5 text-center border-r text-slate-900">{calcularTotalAno("2024").toLocaleString("pt-BR")}</td>
                        <td className="p-2.5 text-center border-r text-slate-900">{calcularTotalAno("2025").toLocaleString("pt-BR")}</td>
                        <td className="p-2.5 text-center text-slate-900">{calcularTotalAno("2026").toLocaleString("pt-BR")}</td>
                      </tr>
                      {/* MÉDIAS MENSAIS CALCULADAS */}
                      <tr className="bg-emerald-50/30 font-black">
                        <td className="p-2.5 font-sans uppercase font-black text-emerald-700 border-r bg-emerald-50/20">MÉDIA MENSAL (R$)</td>
                        <td className="p-2.5 text-center border-r text-slate-900">{calcularMediaMensal("2024").toLocaleString("pt-BR")}</td>
                        <td className="p-2.5 text-center border-r text-slate-900">{calcularMediaMensal("2025").toLocaleString("pt-BR")}</td>
                        <td className="p-2.5 text-center text-slate-900">{calcularMediaMensal("2026").toLocaleString("pt-BR")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: ENDIVIDAMENTO BANCOS */}
            {abaAtiva === "endividamento" && (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Volume de Linhas Ativas (SCR Banco Central)</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-w-[800px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-2.5">Instituição Credora</th>
                        <th className="p-2.5">Modalidade Gravada</th>
                        <th className="p-2.5 text-right">Saldo Devedor Ativo (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold font-mono">
                      {analise.dados_endividamento.map((div, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-1 font-sans font-black uppercase"><input type="text" value={div.instituicao} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].instituicao = e.target.value; setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded w-full bg-transparent font-black" /></td>
                          <td className="p-1 font-sans uppercase"><input type="text" value={div.modalidade} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].modalidade = e.target.value; setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded w-full bg-transparent text-slate-500" /></td>
                          <td className="p-1 text-right"><input type="number" value={div.saldo} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].saldo = Number(e.target.value); setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded text-right w-44 bg-transparent font-bold text-red-600" /></td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-black border-t">
                        <td colSpan={2} className="p-2.5 font-sans uppercase text-slate-900">Total Consolidado da Dívida</td>
                        <td className="p-2.5 text-right text-red-600 font-bold font-mono">R$ {totalEndividamentoBancos.toLocaleString("pt-BR")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ALERTA DE ALAVANCAGEM - FÓRMULA DO EXCEL */}
                <div className="p-3 border border-indigo-100 bg-indigo-50/40 rounded-xl max-w-[800px] flex justify-between items-center font-semibold">
                  <span className="text-slate-500">📉 Índice de Alavancagem Global (Dívida / Fat. Médio Mensal):</span>
                  <span className="font-mono font-black text-indigo-700 bg-white border px-2 py-0.5 rounded shadow-sm">{multiplicadorFat.toFixed(2)}x Faturamento</span>
                </div>
              </div>
            )}

            {/* TAB 6: RESTRITIVOS */}
            {abaAtiva === "restritivos" && (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Apontamentos de Inadimplência</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-w-[900px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-2.5">Empresa / Sócio Ofensor</th>
                        <th className="p-2.5">Classe de Restritivo</th>
                        <th className="p-2.5 text-center">Quantidade</th>
                        <th className="p-2.5 text-right">Valor Global (R$)</th>
                        <th className="p-2.5">Observações / Origem</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-semibold font-mono">
                      {analise.dados_restritivos.map((rest, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-1 font-sans font-black uppercase"><input type="text" value={rest.origem} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].origem = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1.5 border rounded w-full bg-transparent font-black" /></td>
                          <td className="p-1 font-sans uppercase"><input type="text" value={rest.tipo} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].tipo = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1.5 border rounded w-full bg-transparent font-bold text-amber-600" /></td>
                          <td className="p-1 text-center"><input type="number" value={rest.qtd} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].qtd = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1.5 border text-center rounded w-16 bg-transparent" /></td>
                          <td className="p-1 text-right"><input type="number" value={rest.valor} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].valor = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1.5 border text-right rounded w-36 bg-transparent text-red-600 font-bold" /></td>
                          <td className="p-1 font-sans"><input type="text" value={rest.obs} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].obs = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1.5 border rounded w-full bg-transparent text-slate-400 lowercase" /></td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-black border-t">
                        <td colSpan={3} className="p-2.5 font-sans uppercase text-slate-900">Exposição Financeira em Restritivos</td>
                        <td className="p-2.5 text-right text-red-600 font-bold font-mono">R$ {totalRestritivos.toLocaleString("pt-BR")}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 7: PESQUISAS DE AÇÕES */}
            {abaAtiva === "juridico" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-black text-red-600 uppercase text-[10px] tracking-widest">🔴 Processos em Tramitação / Execuções Fiscais</label>
                  <textarea value={analise.dados_juridico.processos_tramitacao || ""} onChange={(e) => setAnalise({ ...analise, dados_juridico: { ...analise.dados_juridico, processos_tramitacao: e.target.value } })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-red-500 transition-all min-h-[250px]" placeholder="Ex: 4 Processos Fiscais movidos pela União somando R$ 1 Milhão..." />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-black text-emerald-600 uppercase text-[10px] tracking-widest">🟢 Arquivados Definitivamente / Extintos</label>
                  <textarea value={analise.dados_juridico.processos_arquivados || ""} onChange={(e) => setAnalise({ ...analise, dados_juridico: { ...analise.dados_juridico, processos_arquivados: e.target.value } })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 transition-all min-h-[250px]" placeholder="Ex: Cobranças comerciais encerradas e pagas..." />
                </div>
              </div>
            )}

            {/* TAB 8: PARECER ANALISTA */}
            {abaAtiva === "parecer" && (
              <div className="space-y-3">
                <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest">Redigir Relatório do Comitê de Crédito V8</label>
                <textarea value={analise.parecer_comite} onChange={(e) => setAnalise({ ...analise, parecer_comite: e.target.value })} placeholder="Escreva aqui os mitigadores de risco, pontos fortes do faturamento e a sua recomendação técnica final..." className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[300px]" />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}