"use client";

import { useState, useEffect, Suspense } from "react";
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
  dados_gerais: { fundacao?: string; ramo?: string; site?: string; relacionamento?: string; gerente?: string };
  proposta: { modalidade: string; limite: number; prazo: number; tranche: number; taxa: number; garantia: string; rating: string };
  dados_faturamento: Record<string, Record<string, number>>;
  dados_potencial: { ticket_medio: number; prazo_medio_vendas: number; vendas_prazo_perc: number };
  dados_endividamento: Array<{ instituicao: string; modalidade: string; saldo: number }>;
  dados_restritivos: Array<{ origem: string; tipo: string; qtd: number; valor: number; obs: string }>;
  dados_estrutura_societaria: Array<{ s_nome: string; s_perc: number; s_cargo: string; s_aval: boolean; b_bens: string; b_valor: number }>;
  dados_juridico: { processos_tramitacao?: string; processos_arquivados?: string };
  parecer_comite: string;
}

function MesaAnaliseConteudo() {
  const searchParams = useSearchParams();
  const analiseId = searchParams.get("id");

  const [abaAtiva, setAbaAtiva] = useState("proposta");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
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
      const { data, error } = await supabase.from("analises_credito").select("*").eq("id", analiseId).single();
      if (error) throw error;
      if (data) {
        setAnalise({
          id: data.id,
          cnpj: data.cnpj,
          razao_social: data.razao_social,
          uf: data.uf,
          cidade: data.cidade || "",
          capital_social: Number(data.capital_social || 100000),
          status: data.status,
          dados_gerais: data.dados_gerais || { fundacao: "2009-04-13", ramo: "Reforma de pneumáticos usados", site: "Não possui", relacionamento: "Prospect", gerente: "Luiz" },
          proposta: data.proposta || { modalidade: "Desconto", limite: 80000, prazo: 75, tranche: 20000, taxa: 0.035, garantia: "Aval", rating: "B" },
          dados_faturamento: data.dados_faturamento || { 
            "2024": { janeiro: 136775.4, fevereiro: 137554.95, marco: 173405.35, abril: 181967.9, maio: 466206.5, junho: 175069.47, julho: 225058, agosto: 193214.5, setembro: 148489.25, outubro: 206494.25, novembro: 177761, dezembro: 215325.4 },
            "2025": { janeiro: 133640.9, fevereiro: 200011.94, marco: 191317.75, abril: 174490.6, maio: 177024.18, junho: 154418.32, julho: 180621.28, agosto: 256984.2 },
            "2026": { janeiro: 186178.5, fevereiro: 260382.56, marco: 254413.54, abril: 237366.5, maio: 283254.2 }
          },
          dados_potencial: data.dados_potencial || { ticket_medio: 3000, prazo_medio_vendas: 75, vendas_prazo_perc: 100 },
          dados_endividamento: data.dados_endividamento || [{ instituicao: "Viacredi", modalidade: "Desconto", saldo: 382000 }],
          dados_restritivos: data.dados_restritivos || [
            { origem: "Totalcap", tipo: "Refin", qtd: 1, valor: 4681.44, obs: "Caixa" },
            { origem: "Totalcap", tipo: "Protesto", qtd: 30, valor: 1412847.78, obs: "Imposto" },
            { origem: "Sidnei", tipo: "Refin", qtd: 1, valor: 4681.44, obs: "Caixa" }
          ],
          dados_estrutura_societaria: data.dados_estrutura_societaria || [{ s_nome: "Sidnei da Silva", s_perc: 100, s_cargo: "Sócio", s_aval: true, b_bens: "1 imóvel + 1 terreno", b_valor: 199425.89 }],
          dados_juridico: data.dados_juridico || {
            processos_tramitacao: "🔴 7 Processos em Tramitação\n4 Fiscal / Tributário (Execuções Fiscais movidas pela União somando R$ 983k, além de cobranças do Município de Curitiba que passam dos R$ 75k).\n1 Cível (O Banco Itaú abriu uma Ação Monitória cobrando uma CCB de R$ 410.878,49).",
            processos_arquivados: "🟢 ~6 Processos Arquivados Definitivamente/Extintos (Cobranças Bancárias e Comerciais encerradas e pagas com o Sicredi)."
          },
          parecer_comite: data.parecer_comite || "Conclusão: Empresa apresenta faturamento em crescimento, com 39% de incremento nos 5 primeiros meses de 2025 em comparação ao ano anterior..."
        });
      }
    } catch (err) {
      console.error(err);
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
      alert("✅ Sincronizado com sucesso!");
    } catch (err: any) {
      alert("❌ Erro: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarCelulaFat = (ano: string, mes: string, valor: string) => {
    if (!analise) return;
    const fatAtual = { ...analise.dados_faturamento };
    if (!fatAtual[ano]) fatAtual[ano] = {};
    fatAtual[ano][mes] = Number(valor || 0);
    setAnalise({ ...analise, dados_faturamento: fatAtual });
  };

  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const calcularTotalAno = (ano: string) => meses.reduce((acc, mes) => acc + Number(analise?.dados_faturamento[ano]?.[mes] || 0), 0);
  const calcularMediaMensal = (ano: string) => {
    const preenchidos = meses.filter(m => analise?.dados_faturamento[ano]?.[m] !== undefined && analise?.dados_faturamento[ano]?.[m] !== 0).length;
    return preenchidos === 0 ? 0 : calcularTotalAno(ano) / preenchidos;
  };

  // Cálculos de Variação de Faturamento Delta % entre meses específicos
  const calcularDeltaMensal = (mes: string, anoAtual: string, anoAnterior: string) => {
    const atual = Number(analise?.dados_faturamento[anoAtual]?.[mes] || 0);
    const anterior = Number(analise?.dados_faturamento[anoAnterior]?.[mes] || 0);
    if (!anterior) return 0;
    return ((atual - anterior) / anterior) * 100;
  };

  const fatMedioAtual = calcularMediaMensal("2026") || calcularMediaMensal("2025") || 244319.06;
  const totalEndividamento = analise?.dados_endividamento.reduce((acc, d) => acc + Number(d.saldo), 0) || 0;
  const totalRestritivos = analise?.dados_restritivos.reduce((acc, r) => acc + Number(r.valor), 0) || 0;
  const potencialRealCalculado = fatMedioAtual * (analise?.dados_potencial.vendas_prazo_perc ? analise.dados_potencial.vendas_prazo_perc / 100 : 1) * 2.5;

  if (loading) return <div className="p-12 text-center font-mono text-xs text-slate-500 animate-pulse">⏳ CONSTRUINDO MESA DE CRÉDITO FINANCEIRA V8...</div>;
  if (!analise) return <div className="p-12 text-center text-red-500 font-bold">❌ ID de análise inválido na URL (?id=uuid)</div>;

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR DE COMANDOS */}
      <div className="border-b border-slate-200 pb-3 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <div>
          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">Mesa de Crédito — Modo Auditoria Consolidada</span>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase mt-1">{analise.razao_social}</h1>
          <p className="text-xs font-mono font-bold text-slate-500">CNPJ: {analise.cnpj} | RATING ATUAL: <span className="text-indigo-600 font-black">{analise.proposta.rating}</span></p>
        </div>
        <button onClick={persistirNoBanco} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2 rounded-lg text-xs uppercase tracking-widest disabled:opacity-50 shadow-md cursor-pointer">
          {salvando ? "Sincronizando..." : "💾 Gravar Alterações (Ctrl+S)"}
        </button>
      </div>

      {/* VIEW LADO A LADO SPLIT SCREEN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUNA ESQUERDA: DOCUMENTAÇÃO ASSINADA R2 & EVIDÊNCIAS */}
        <div className="lg:col-span-5 space-y-4 sticky top-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest block border-b border-slate-100 pb-1.5">
              📁 Repositório de Documentos da Análise (Cofre Cloudflare R2)
            </span>
            <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center">
              <p className="text-xs font-bold text-slate-600">Visualizador Dinâmico de PDF Integrado</p>
              <p className="text-[10px] text-slate-400 mt-1">Carregando Contrato Social / Faturamento Carimbado</p>
              <div className="mt-3 w-full bg-slate-200 h-64 rounded-md flex items-center justify-center text-slate-400 font-mono text-[11px]">
                [Embed Documento Protegido R2]
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: O EXCELZÃO FINANCEIRO INTEGRAVÉL */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* ABAS ESTILO SPREADSHEET */}
          <div className="bg-slate-100 border-b border-slate-200 flex flex-wrap p-1 gap-0.5">
            {[
              { id: "proposta", label: "📋 1. Proposta & Rating" },
              { id: "dados_gerais", label: "🏢 2. Dados Empresa" },
              { id: "estrutura", label: "👥 3. Estrutura Societária" },
              { id: "fat", label: "📊 4. Faturamento (FAT)" },
              { id: "potencial", label: "📈 5. Potencial" },
              { id: "endividamento", label: "🏦 6. Endiv Geral" },
              { id: "restritivos", label: "🚨 7. Restritivos" },
              { id: "juridico", label: "⚖️ 8. Jurídico" },
              { id: "parecer", label: "📝 9. Parecer Final" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`px-2.5 py-2 font-black uppercase text-[10px] tracking-wider rounded transition-all cursor-pointer ${
                  abaAtiva === tab.id ? "bg-white text-indigo-600 shadow-sm border-t-2 border-t-indigo-500" : "text-slate-500 hover:bg-slate-200/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* WORKSPACE SELECIONADO */}
          <div className="p-5 min-h-[480px]">

            {/* ABA 1: PROPOSTA */}
            {abaAtiva === "proposta" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Condições Gerais da Operação</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Modalidade Cedida</label>
                      <input type="text" value={analise.proposta.modalidade} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, modalidade: e.target.value } })} className="w-full p-2 border bg-white rounded font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Limite Concedido (R$)</label>
                      <input type="number" value={analise.proposta.limite} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, limite: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Taxa do Fundo Mensal (%)</label>
                      <input type="number" step="0.001" value={analise.proposta.taxa} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, taxa: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Prazo Alvo da Carteira (Dias)</label>
                      <input type="number" value={analise.proposta.prazo} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, prazo: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold text-xs" />
                    </div>
                  </div>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between">
                  <div className="text-center py-4">
                    <span className="text-5xl font-black text-indigo-600 block">{analise.proposta.rating}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1 block">Rating Calculado V8</span>
                  </div>
                  <select value={analise.proposta.rating} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, rating: e.target.value } })} className="w-full p-2 border bg-white rounded text-xs font-black text-indigo-700 uppercase">
                    <option value="A">Rating A - Risco Reduzido</option>
                    <option value="B">Rating B - Risco Médio</option>
                    <option value="C">Rating C - Risco Alto</option>
                  </select>
                </div>
              </div>
            )}

            {/* ABA 2: DADOS EMPRESA */}
            {abaAtiva === "dados_generais" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 max-w-[800px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b pb-1">Ficha da Empresa (Dados Gerais)</span>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div><span className="text-slate-400 font-bold block mb-1">Fundação Oficial</span><input type="date" value={analise.dados_gerais.fundacao || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, fundacao: e.target.value } })} className="w-full p-2 border bg-white rounded font-bold" /></div>
                  <div><span className="text-slate-400 font-bold block mb-1">Ramo de Atividade</span><input type="text" value={analise.dados_gerais.ramo || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, ramo: e.target.value } })} className="w-full p-2 border bg-white rounded uppercase text-slate-800 font-black" /></div>
                  <div><span className="text-slate-400 font-bold block mb-1">Capital Social Contratual (R$)</span><input type="number" value={analise.capital_social} onChange={(e) => setAnalise({ ...analise, capital_social: Number(e.target.value) })} className="w-full p-2 border bg-white rounded font-mono font-bold text-emerald-600" /></div>
                  <div><span className="text-slate-400 font-bold block mb-1">Gerente Comercial Alocado</span><input type="text" value={analise.dados_gerais.gerente || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, gerente: e.target.value } })} className="w-full p-2 border bg-white rounded uppercase" /></div>
                </div>
              </div>
            )}

            {/* ABA 3: ESTRUTURA SOCIETÁRIA & PATRIMÔNIO */}
            {abaAtiva === "estrutura" && (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Sócios, Diretores e Bens Declarados (IRPF)</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                        <th className="p-2.5">Nome Completo do Sócio</th>
                        <th className="p-2.5 text-center">% Quota</th>
                        <th className="p-2.5 text-center">Avalista?</th>
                        <th className="p-2.5">Bens Imóveis / Terrenos Garantidores</th>
                        <th className="p-2.5 text-right">Avaliação Real (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono font-bold">
                      {analise.dados_estrutura_societaria.map((socio, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-sans font-black uppercase text-slate-900">{socio.s_nome}</td>
                          <td className="p-1 text-center"><input type="number" value={socio.s_perc} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].s_perc = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-16 p-1 border text-center rounded bg-white font-bold" /></td>
                          <td className="p-1 text-center"><input type="checkbox" checked={socio.s_aval} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].s_aval = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="cursor-pointer h-4 w-4" /></td>
                          <td className="p-1 font-sans"><input type="text" value={socio.b_bens} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].b_bens = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-full p-1 border rounded bg-white text-slate-600" /></td>
                          <td className="p-1 text-right"><input type="number" value={socio.b_valor} onChange={(e) => { const clone = [...analise.dados_estrutura_societaria]; clone[idx].b_valor = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: clone }); }} className="w-32 p-1 border text-right rounded bg-white text-emerald-600 font-black" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 4: FATURAMENTO CONSOLIDADO COM FORMULA DELTA % */}
            {abaAtiva === "fat" && (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                        <th className="p-2.5 border-r w-[110px]">Mês Ref</th>
                        <th className="p-2.5 border-r text-center">Ano 2024 (R$)</th>
                        <th className="p-2.5 border-r text-center">Ano 2025 (R$)</th>
                        <th className="p-2.5 border-r text-center">$\Delta\%$ (25 vs 24)</th>
                        <th className="p-2.5 text-center">Ano 2026 (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {meses.map((mes) => (
                        <tr key={mes} className="hover:bg-slate-50">
                          <td className="p-2 font-sans font-black uppercase text-slate-700 border-r bg-slate-50/40">{mes.substring(0,3)}</td>
                          {["2024", "2025"].map((ano) => (
                            <td key={ano} className="p-1 border-r">
                              <input type="number" value={analise.dados_faturamento[ano]?.[mes] || ""} onChange={(e) => handleSalvarCelulaFat(ano, mes, e.target.value)} className="w-full p-1.5 bg-transparent font-bold text-slate-800 text-center outline-none" />
                            </td>
                          ))}
                          {/* Coluna da Fórmula de Variação % do Excel */}
                          <td className="p-2 text-center border-r font-bold">
                            {(() => {
                              const delta = calcularDeltaMensal(mes, "2025", "2024");
                              return delta === 0 ? <span className="text-slate-400">-</span> : (
                                <span className={delta >= 0 ? "text-emerald-600 font-black" : "text-red-500 font-black"}>
                                  {delta >= 0 ? "↑" : "↓"} {delta.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-1">
                            <input type="number" value={analise.dados_faturamento["2026"]?.[mes] || ""} onChange={(e) => handleSalvarCelulaFat("2026", mes, e.target.value)} className="w-full p-1.5 bg-transparent font-bold text-indigo-600 text-center outline-none" />
                          </td>
                        </tr>
                      ))}
                      {/* TOTAIS ANUAIS EXCEL */}
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-200">
                        <td className="p-2.5 font-sans text-slate-900 border-r">TOTAL</td>
                        <td className="text-center border-r text-slate-700">{calcularTotalAno("2024").toLocaleString("pt-BR")}</td>
                        <td className="text-center border-r text-slate-700">{calcularTotalAno("2025").toLocaleString("pt-BR")}</td>
                        <td className="text-center border-r font-black text-indigo-600">
                          {(((calcularTotalAno("2025") - calcularTotalAno("2024")) / (calcularTotalAno("2024") || 1)) * 100).toFixed(1)}%
                        </td>
                        <td className="text-center text-indigo-700">{calcularTotalAno("2026").toLocaleString("pt-BR")}</td>
                      </tr>
                      {/* MÉDIAS MENSAIS EXCEL */}
                      <tr className="bg-indigo-50/40 font-black">
                        <td className="p-2.5 font-sans text-indigo-700 border-r">MÉDIA</td>
                        <td className="text-center border-r text-slate-600">{calcularMediaMensal("2024").toLocaleString("pt-BR")}</td>
                        <td className="text-center border-r text-slate-600">{calcularMediaMensal("2025").toLocaleString("pt-BR")}</td>
                        <td className="border-r"></td>
                        <td className="text-center text-indigo-700 font-black">{calcularMediaMensal("2026").toLocaleString("pt-BR")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 5: POTENCIAL DE NEGÓCIOS */}
            {abaAtiva === "potencial" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-[700px] space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Cálculo de Capacidade de Cessão / Duplicatas</span>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Ticket Médio Operado (R$)</label>
                    <input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, ticket_medio: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Composição Prazo Vendas (Dias)</label>
                    <input type="number" value={analise.dados_potencial.prazo_medio_vendas} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, prazo_medio_vendas: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold" />
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex justify-between items-center font-black">
                  <span className="text-emerald-800">📈 POTENCIAL REAL ESTIMADO (Vendas a Prazo s/ Média):</span>
                  <span className="font-mono text-sm text-emerald-600 bg-white border px-3 py-1 rounded shadow-sm">R$ {potencialRealCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {/* ABA 6: ENDIVIDAMENTO GERAL (SCR) */}
            {abaAtiva === "endividamento" && (
              <div className="space-y-4 max-w-[800px]">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Risco Ativo Centralizado (Bancos e Fundos)</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                        <th className="p-2.5">Instituição Bancária</th>
                        <th className="p-2.5">Modalidade</th>
                        <th className="p-2.5 text-right">Saldo Devedor Gravado (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono font-bold">
                      {analise.dados_endividamento.map((div, i) => (
                        <tr key={i}>
                          <td className="p-1"><input type="text" value={div.instituicao} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].instituicao = e.target.value; setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded w-full font-sans uppercase font-black" /></td>
                          <td className="p-1"><input type="text" value={div.modalidade} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].modalidade = e.target.value; setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded w-full font-sans uppercase text-slate-400" /></td>
                          <td className="p-1"><input type="number" value={div.saldo} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].saldo = Number(e.target.value); setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded text-right w-44 text-red-600 font-black" /></td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black border-t">
                        <td colSpan={2} className="p-2.5 font-sans text-slate-900">Total Endividamento</td>
                        <td className="p-2.5 text-right text-red-600 font-mono font-black">R$ {totalEndividamento.toLocaleString("pt-BR")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Índice de Alavancagem Global */}
                <div className="p-3 border border-indigo-100 bg-indigo-50/40 rounded-xl flex justify-between items-center font-bold">
                  <span className="text-slate-500">📉 Índice de Alavancagem Global (Dívida / Faturamento Médio):</span>
                  <span className="font-mono font-black text-indigo-700 bg-white border px-2 py-0.5 rounded shadow-sm">
                    {(fatMedioAtual > 0 ? totalEndividamento / fatMedioAtual : 0).toFixed(2)}x Faturamento Mensal
                  </span>
                </div>
              </div>
            )}

            {/* ABA 7: RESTRITIVOS */}
            {abaAtiva === "restritivos" && (
              <div className="space-y-4 max-w-[900px]">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Apontamentos Comerciais, Protestos e Refins</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                        <th className="p-2.5">Empresa / Sócio Ofensor</th>
                        <th className="p-2.5">Tipo Restrição</th>
                        <th className="p-2.5 text-center">Qtd</th>
                        <th className="p-2.5 text-right">Valor Global (R$)</th>
                        <th className="p-2.5">Observação / Órgão</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono font-bold">
                      {analise.dados_restritivos.map((rest, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-1 font-sans uppercase font-black"><input type="text" value={rest.origem} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].origem = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border rounded w-full bg-white font-black" /></td>
                          <td className="p-1 font-sans uppercase text-amber-600"><input type="text" value={rest.tipo} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].tipo = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border rounded w-full bg-white text-amber-600 font-bold" /></td>
                          <td className="p-1 text-center"><input type="number" value={rest.qtd} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].qtd = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border text-center rounded w-16 bg-white" /></td>
                          <td className="p-1 text-right text-red-600 font-bold"><input type="number" value={rest.valor} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].valor = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border text-right rounded w-36 bg-white text-red-600" /></td>
                          <td className="p-1 font-sans text-slate-400 lowercase"><input type="text" value={rest.obs} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].obs = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border rounded w-full bg-white text-slate-400" /></td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black border-t">
                        <td colSpan={3} className="p-2.5 font-sans text-slate-900">Total Ofensores Financeiros</td>
                        <td className="p-2.5 text-right text-red-600 font-mono font-black">R$ {totalRestritivos.toLocaleString("pt-BR")}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 8: JURÍDICO */}
            {abaAtiva === "juridico" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-black text-red-600 uppercase text-[10px] tracking-widest">静态 🔴 Em Tramitação / Execuções Fiscais</label>
                  <textarea value={analise.dados_juridico.processos_tramitacao || ""} onChange={(e) => setAnalise({ ...analise, dados_juridico: { ...analise.dados_juridico, processos_tramitacao: e.target.value } })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 min-h-[220px] font-sans" />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-black text-emerald-600 uppercase text-[10px] tracking-widest">静态 🟢 Arquivados Definitivamente / Extintos</label>
                  <textarea value={analise.dados_juridico.processos_arquivados || ""} onChange={(e) => setAnalise({ ...analise, dados_juridico: { ...analise.dados_juridico, processos_arquivados: e.target.value } })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 min-h-[220px] font-sans" />
                </div>
              </div>
            )}

            {/* ABA 9: PARECER ANALISTA */}
            {abaAtiva === "parecer" && (
              <div className="space-y-2">
                <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest">Laudo Técnico de Comitê Executivo</label>
                <textarea value={analise.parecer_comite} onChange={(e) => setAnalise({ ...analise, parecer_comite: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 min-h-[280px] font-sans" />
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default function MesaAnalisePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-2 font-sans">
      <Suspense fallback={<div className="p-12 text-center font-mono text-xs text-slate-400">⚡ Inicializando Ambiente de Suspensão CSR...</div>}>
        <MesaAnaliseConteudo />
      </Suspense>
    </div>
  );
}