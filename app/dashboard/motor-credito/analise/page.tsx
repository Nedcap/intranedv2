"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";

interface FilaItem {
  id: string;
  razao_social: string;
  cnpj: string;
  status: string;
}

interface SócioItem {
  s_nome: string;
  s_perc: number;
  s_cargo: string;
  s_aval: boolean;
  b_bens: string;
  b_valor: number;
}

interface EndividamentoItem {
  instituicao: string;
  modalidade: string;
  saldo: number;
}

interface RestritivoItem {
  origem: string;
  tipo: string;
  qtd: number;
  valor: number;
  obs: string;
}

interface AnaliseData {
  id: string | null;
  cnpj: string;
  razao_social: string;
  uf: string;
  cidade: string;
  capital_social: number;
  dados_gerais: { fundacao?: string; ramo?: string; site?: string; relacionamento?: string; gerente?: string };
  proposta: { modalidade: string; limite: number; prazo: number; tranche: number; taxa: number; garantia: string; rating: string };
  dados_faturamento: Record<string, Record<string, number>>;
  dados_potencial: { ticket_medio: number; prazo_medio_vendas: number; vendas_prazo_perc: number };
  dados_endividamento: EndividamentoItem[];
  dados_restritivos: RestritivoItem[];
  dados_estrutura_societaria: SócioItem[];
  dados_juridico: { processos_tramitacao?: string; processos_arquivados?: string };
  parecer_comite: string;
}

const DADOS_MODELO_TOTALCAP: AnaliseData = {
  id: null,
  cnpj: "11.127.136/0001-83",
  razao_social: "TOTAL CAP RECAPADORA DE PNEUS LTDA",
  uf: "PR",
  cidade: "Curitiba",
  capital_social: 100000,
  dados_gerais: { fundacao: "2009-04-13", ramo: "Reforma de pneumáticos usados", site: "Não possui", relacionamento: "Prospect", gerente: "Luiz" },
  proposta: { modalidade: "Desconto", limite: 80000, prazo: 75, tranche: 20000, taxa: 0.035, garantia: "Aval", rating: "B" },
  dados_faturamento: { 
    "2024": { janeiro: 136775.4, fevereiro: 137554.95, marco: 173405.35, abril: 181967.9, maio: 466206.5, junho: 175069.47, julho: 225058, agosto: 193214.5, setembro: 148489.25, outubro: 206494.25, novembro: 177761, dezembro: 215325.4 },
    "2025": { janeiro: 133640.9, fevereiro: 200011.94, marco: 191317.75, abril: 174490.6, maio: 177024.18, junho: 154418.32, julho: 180621.28, agosto: 256984.2 },
    "2026": { janeiro: 186178.5, fevereiro: 260382.56, marco: 254413.54, abril: 237366.5, maio: 283254.2 }
  },
  dados_potencial: { ticket_medio: 3000, prazo_medio_vendas: 75, vendas_prazo_perc: 100 },
  dados_endividamento: [
    { instituicao: "Viacredi", modalidade: "Desconto de Duplicatas", saldo: 382000 }
  ],
  dados_restritivos: [
    { origem: "Totalcap (PJ)", tipo: "Refin", qtd: 1, valor: 4681.44, obs: "Caixa Econômica" },
    { origem: "Totalcap (PJ)", tipo: "Protesto", qtd: 30, valor: 1412847.78, obs: "Impostos Federais/Municipais" },
    { origem: "Sidnei (PF)", tipo: "Refin", qtd: 1, valor: 4681.44, obs: "Caixa Econômica" }
  ],
  dados_estrutura_societaria: [
    { s_nome: "Sidnei da Silva", s_perc: 100, s_cargo: "Sócio Administrador", s_aval: true, b_bens: "1 imóvel + 1 terreno (IRPF)", b_valor: 199425.89 }
  ],
  dados_juridico: {
    processos_tramitacao: "🔴 7 Processos em Tramitação / Suspensos\n- 4 Fiscal: Execuções Fiscais movidas pela União (ações de R$ 695k e R$ 288k) e Curitiba (R$ 75k).\n- 1 Cível: Ação Monitória do Banco Itaú cobrando CCB de R$ 410.878,49.\n- 2 Tributário: Ações de defesa atacando a União com créditos a receber.",
    processos_arquivados: "🟢 ~6 Processos Extintos / Arquivados Definitivamente\n- Cobranças bancárias antigas quitadas e encerradas junto ao Sicredi (R$ 37k)."
  },
  parecer_comite: "Conclusão técnica baseada no script de auditoria..."
};

function MesaAnaliseConteudo() {
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [analise, setAnalise] = useState<AnaliseData>(DADOS_MODELO_TOTALCAP);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  
  const [abaAtiva, setAbaAtiva] = useState("proposta");
  const [loadingFila, setLoadingFila] = useState(true);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    buscarFilaSupabase();
  }, []);

  const buscarFilaSupabase = async () => {
    try {
      setLoadingFila(true);
      const { data, error } = await supabase.from("analises_credito").select("id, razao_social, cnpj, status").order("criado_em", { ascending: false });
      if (error) throw error;
      if (data) setFila(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFila(false);
    }
  };

  const selecionarEmpresaDaEsteira = async (id: string) => {
    try {
      setLoadingAnalise(true);
      setIdSelecionado(id);
      const { data, error } = await supabase.from("analises_credito").select("*").eq("id", id).single();
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
          proposta: data.proposta || { modalidade: "Desconto", limite: 50000, prazo: 30, tranche: 10000, taxa: 0.04, garantia: "Aval", rating: "C" },
          dados_faturamento: data.dados_faturamento || { "2024": {}, "2025": {}, "2026": {} },
          dados_potencial: data.dados_potencial || { ticket_medio: 0, prazo_medio_vendas: 0, vendas_prazo_perc: 100 },
          dados_endividamento: data.dados_endividamento || [],
          dados_restritivos: data.dados_restritivos || [],
          dados_estrutura_societaria: data.dados_estrutura_societaria || [],
          dados_juridico: data.dados_juridico || {},
          parecer_comite: data.parecer_comite || ""
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalise(false);
    }
  };

  const persistirNoBanco = async () => {
    if (!idSelecionado || !analise.id) {
      alert("💡 Você está editando o Template Estático. Envie uma análise real pelo comercial para salvar.");
      return;
    }
    try {
      setSalvando(true);
      const { error } = await supabase.from("analises_credito").update({ ...analise }).eq("id", analise.id);
      if (error) throw error;
      alert("✅ Excel v8 persistido no Supabase!");
      buscarFilaSupabase();
    } catch (err: any) {
      alert("❌ Erro: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // =========================================================================
  // 🎛️ GERENCIADOR DE GRADES DINÂMICAS (INSERÇÃO / REMOÇÃO ESTILO EXCEL)
  // =========================================================================
  const adicionarLinhaSocios = () => {
    const nova = { s_nome: "Novo Sócio", s_perc: 0, s_cargo: "Diretor", s_aval: true, b_bens: "", b_valor: 0 };
    setAnalise({ ...analise, dados_estrutura_societaria: [...analise.dados_estrutura_societaria, nova] });
  };
  const removerLinhaSocios = (index: number) => {
    setAnalise({ ...analise, dados_estrutura_societaria: analise.dados_estrutura_societaria.filter((_, i) => i !== index) });
  };

  const adicionarLinhaEndividamento = () => {
    const nova = { item: "", instituicao: "Novo Banco", modalidade: "Giro", saldo: 0 };
    setAnalise({ ...analise, dados_endividamento: [...analise.dados_endividamento, nova] });
  };
  const removerLinhaEndividamento = (index: number) => {
    setAnalise({ ...analise, dados_endividamento: analise.dados_endividamento.filter((_, i) => i !== index) });
  };

  const adicionarLinhaRestritivos = () => {
    const nova = { origem: "Nome Alvo", tipo: "Protesto", qtd: 1, valor: 0, obs: "" };
    setAnalise({ ...analise, dados_restritivos: [...analise.dados_restritivos, nova] });
  };
  const removerLinhaRestritivos = (index: number) => {
    setAnalise({ ...analise, dados_restritivos: analise.dados_restritivos.filter((_, i) => i !== index) });
  };

  const handleSalvarCelulaFat = (ano: string, mes: string, valor: string) => {
    const fatAtual = { ...analise.dados_faturamento };
    if (!fatAtual[ano]) fatAtual[ano] = {};
    fatAtual[ano][mes] = Number(valor || 0);
    setAnalise({ ...analise, dados_faturamento: fatAtual });
  };

  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const calcularTotalAno = (ano: string) => meses.reduce((acc, mes) => acc + Number(analise.dados_faturamento[ano]?.[mes] || 0), 0);
  const calcularMediaMensal = (ano: string) => {
    const preenchidos = meses.filter(m => analise.dados_faturamento[ano]?.[m] !== undefined && analise.dados_faturamento[ano]?.[m] !== 0).length;
    return preenchidos === 0 ? 0 : calcularTotalAno(ano) / preenchidos;
  };

  const calcularDeltaMensal = (mes: string, anoAtual: string, anoAnterior: string) => {
    const atual = Number(analise.dados_faturamento[anoAtual]?.[mes] || 0);
    const anterior = Number(analise.dados_faturamento[anoAnterior]?.[mes] || 0);
    if (!anterior) return 0;
    return ((atual - anterior) / anterior) * 100;
  };

  const fatMedioAtual = calcularMediaMensal("2025") || 244319.06;
  const totalEndividamento = analise.dados_endividamento.reduce((acc, d) => acc + Number(d.saldo), 0) || 0;
  const totalRestritivos = analise.dados_restritivos.reduce((acc, r) => acc + Number(r.valor), 0) || 0;
  const potencialRealCalculado = fatMedioAtual * 2.5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      
      {/* SIDEBAR DA FILA */}
      <div className="lg:col-span-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[680px]">
          <span className="font-black text-slate-800 uppercase text-[10px] tracking-widest block border-b pb-2 mb-3">
            📥 Fila do Comitê de Risco ({fila.length})
          </span>
          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
            <div 
              onClick={() => { setIdSelecionado(null); setAnalise(DADOS_MODELO_TOTALCAP); }}
              className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${idSelecionado === null ? "bg-indigo-50 border-indigo-400" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}
            >
              <p className="text-xs font-black text-indigo-700 uppercase">⭐ TEMPLATE MODELO ESTÁTICO</p>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">Planilha TOTALCAP Completa</p>
            </div>

            {fila.map((item) => (
              <div
                key={item.id}
                onClick={() => selecionarEmpresaDaEsteira(item.id)}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${idSelecionado === item.id ? "bg-indigo-600 border-indigo-700 text-white" : "bg-white border-slate-200 hover:border-slate-300"}`}
              >
                <p className={`text-xs font-black uppercase truncate ${idSelecionado === item.id ? "text-white" : "text-slate-900"}`}>{item.razao_social}</p>
                <p className={`text-[10px] font-mono mt-0.5 ${idSelecionado === item.id ? "text-indigo-200" : "text-slate-400"}`}>CNPJ: {item.cnpj}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW PRINCIPAL DA MESA */}
      <div className="lg:col-span-9 space-y-4">
        {loadingAnalise ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm min-h-[650px] flex flex-col items-center justify-center">
            <span className="animate-spin text-xl block">⏳</span>
            <p className="text-xs font-black uppercase text-slate-400 mt-2">Carregando Grade JSONB...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* COMMAND HEAD BAR */}
            <div className="border-b border-slate-200 pb-3 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
              <div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${idSelecionado ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"}`}>
                  {idSelecionado ? "Planilha de Registro Ativo (Supabase)" : "Visualização de Estrutura Técnica (Estático)"}
                </span>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-1">{analise.razao_social}</h2>
                <p className="text-xs font-mono font-bold text-slate-500">CNPJ: {analise.cnpj} | CEP LOCAL: {analise.cidade}/{analise.uf}</p>
              </div>
              <button onClick={persistirNoBanco} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2 rounded-lg text-xs uppercase tracking-widest shadow-md cursor-pointer transition-all">
                {salvando ? "Sincronizando..." : idSelecionado ? "💾 Salvar Planilha (Supabase)" : "💡 Testar Fórmulas e Inserções"}
              </button>
            </div>

            {/* ABAS EXCEL ENGINE */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
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
                    className={`px-3 py-2 font-black uppercase text-[10px] tracking-wider rounded transition-all cursor-pointer ${abaAtiva === tab.id ? "bg-white text-indigo-600 shadow-sm border-t-2 border-t-indigo-500 font-black" : "text-slate-500 hover:bg-slate-200/60"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-5 min-h-[480px]">
                {/* ABA 1: PROPOSTA */}
                {abaAtiva === "proposta" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Condições Gerais da Operação</span>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Modalidade</label><input type="text" value={analise.proposta.modalidade} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, modalidade: e.target.value } })} className="w-full p-2 border bg-white rounded font-bold text-xs" /></div>
                        <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Limite (R$)</label><input type="number" value={analise.proposta.limite} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, limite: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold text-xs" /></div>
                        <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Taxa Mensal (%)</label><input type="number" step="0.001" value={analise.proposta.taxa} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, taxa: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold text-xs" /></div>
                        <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Prazo Médio (Dias)</label><input type="number" value={analise.proposta.prazo} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, prazo: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold text-xs" /></div>
                      </div>
                    </div>
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between text-center">
                      <div className="py-4"><span className="text-5xl font-black text-indigo-600 block">{analise.proposta.rating}</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1 block">Rating Calculado V8</span></div>
                      <select value={analise.proposta.rating} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, rating: e.target.value } })} className="w-full p-2 border bg-white rounded text-xs font-black text-indigo-700 uppercase"><option value="A">Rating A</option><option value="B">Rating B</option><option value="C">Rating C</option></select>
                    </div>
                  </div>
                )}

                {/* ABA 2: DADOS EMPRESA */}
                {abaAtiva === "dados_gerais" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 max-w-[800px]">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b pb-1">Ficha Cadastral Oficiais</span>
                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div><span className="text-slate-400 font-bold block mb-1">Fundação</span><input type="date" value={analise.dados_gerais.fundacao || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, fundacao: e.target.value } })} className="w-full p-2 border bg-white rounded" /></div>
                      <div><span className="text-slate-400 font-bold block mb-1">Ramo Atividade</span><input type="text" value={analise.dados_gerais.ramo || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, ramo: e.target.value } })} className="w-full p-2 border bg-white rounded uppercase" /></div>
                      <div><span className="text-slate-400 font-bold block mb-1">Capital Social (R$)</span><input type="number" value={analise.capital_social} onChange={(e) => setAnalise({ ...analise, capital_social: Number(e.target.value) })} className="w-full p-2 border bg-white rounded font-mono font-bold" /></div>
                      <div><span className="text-slate-400 font-bold block mb-1">Gerente Plataforma</span><input type="text" value={analise.dados_gerais.gerente || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, gerente: e.target.value } })} className="w-full p-2 border bg-white rounded uppercase" /></div>
                    </div>
                  </div>
                )}

                {/* ABA 3: SÓCIOS DINÂMICO (INSERÇÃO COMPLETA) */}
                {abaAtiva === "estrutura" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Quadro Societário & Bens de IRPF</span>
                      <button onClick={adicionarLinhaSocios} className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-black px-3 py-1 rounded text-[11px] hover:bg-indigo-100 cursor-pointer">+ Inserir Novo Sócio</button>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                            <th className="p-2.5">Nome do Sócio</th>
                            <th className="p-2.5 text-center w-20">% Part.</th>
                            <th className="p-2.5 text-center w-16">Aval?</th>
                            <th className="p-2.5">Bens IRPF Arrestáveis</th>
                            <th className="p-2.5 text-right w-36">Valor IRPF (R$)</th>
                            <th className="p-2.5 text-center w-12">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-mono font-bold">
                          {analise.dados_estrutura_societaria.map((socio, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-1"><input type="text" value={socio.s_nome} onChange={(e) => { const c = [...analise.dados_estrutura_societaria]; c[idx].s_nome = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: c }); }} className="w-full p-1.5 border bg-transparent font-black uppercase font-sans" /></td>
                              <td className="p-1 text-center"><input type="number" value={socio.s_perc} onChange={(e) => { const c = [...analise.dados_estrutura_societaria]; c[idx].s_perc = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: c }); }} className="w-16 p-1.5 border text-center rounded bg-transparent font-bold" /></td>
                              <td className="p-1 text-center"><input type="checkbox" checked={socio.s_aval} onChange={(e) => { const c = [...analise.dados_estrutura_societaria]; c[idx].s_aval = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: c }); }} className="cursor-pointer h-4 w-4" /></td>
                              <td className="p-1"><input type="text" value={socio.b_bens} onChange={(e) => { const c = [...analise.dados_estrutura_societaria]; c[idx].b_bens = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: c }); }} className="w-full p-1.5 border rounded bg-transparent font-sans text-slate-500 font-medium" /></td>
                              <td className="p-1 text-right"><input type="number" value={socio.b_valor} onChange={(e) => { const c = [...analise.dados_estrutura_societaria]; c[idx].b_valor = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: c }); }} className="w-32 p-1.5 border text-right rounded bg-transparent text-emerald-600" /></td>
                              <td className="p-1 text-center"><button onClick={() => removerLinhaSocios(idx)} className="text-red-500 hover:text-red-700 font-bold px-1 text-xs cursor-pointer">✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ABA 4: FATURAMENTO (EXCELZÃO) */}
                {abaAtiva === "fat" && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-w-[1200px]">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                          <th className="p-2.5 border-r w-[110px]">Mês Ref</th>
                          <th className="p-2.5 border-r text-center">Ano 2024 (R$)</th>
                          <th className="p-2.5 border-r text-center">Ano 2025 (R$)</th>
                          <th className="p-2.5 border-r text-center">Delta % (25 vs 24)</th>
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
                            <td className="p-2 text-center border-r font-bold">
                              {(() => {
                                const delta = calcularDeltaMensal(mes, "2025", "2024");
                                return delta === 0 ? <span className="text-slate-400">-</span> : (
                                  <span className={delta >= 0 ? "text-emerald-600 font-black" : "text-red-500 font-black"}>{delta >= 0 ? "↑" : "↓"} {delta.toFixed(1)}%</span>
                                );
                              })()}
                            </td>
                            <td className="p-1"><input type="number" value={analise.dados_faturamento["2026"]?.[mes] || ""} onChange={(e) => handleSalvarCelulaFat("2026", mes, e.target.value)} className="w-full p-1.5 bg-transparent font-bold text-indigo-600 text-center outline-none" /></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-200">
                          <td className="p-2.5 font-sans border-r">TOTAL</td>
                          <td className="text-center border-r">{calcularTotalAno("2024").toLocaleString("pt-BR")}</td>
                          <td className="text-center border-r">{calcularTotalAno("2025").toLocaleString("pt-BR")}</td>
                          <td className="text-center border-r text-indigo-600">{(((calcularTotalAno("2025") - calcularTotalAno("2024")) / (calcularTotalAno("2024") || 1)) * 100).toFixed(1)}%</td>
                          <td className="text-center text-indigo-700">{calcularTotalAno("2026").toLocaleString("pt-BR")}</td>
                        </tr>
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
                )}

                {/* ABA 5: POTENCIAL */}
                {abaAtiva === "potencial" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-[700px] space-y-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b pb-1">Capacidade Operacional de Cessão</span>
                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div><label className="block text-slate-400 font-bold mb-1">Ticket Médio (R$)</label><input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, ticket_medio: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold" /></div>
                      <div><label className="block text-slate-400 font-bold mb-1">Prazo de Vendas (Dias)</label><input type="number" value={analise.dados_potencial.prazo_medio_vendas} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, prazo_medio_vendas: Number(e.target.value) } })} className="w-full p-2 border bg-white rounded font-mono font-bold" /></div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex justify-between items-center font-black">
                      <span className="text-emerald-800">📈 POTENCIAL REAL ESTIMADO:</span>
                      <span className="font-mono text-sm text-emerald-600 bg-white border px-3 py-1 rounded shadow-sm">R$ {potencialRealCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                {/* ABA 6: ENDIVIDAMENTO DINÂMICO (INSERÇÃO COMPLETA) */}
                {abaAtiva === "endividamento" && (
                  <div className="space-y-4 max-w-[850px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">SCR Centralizado Bancos / Fundos / FIDCs</span>
                      <button onClick={adicionarLinhaEndividamento} className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-black px-3 py-1 rounded text-[11px] hover:bg-indigo-100 cursor-pointer">+ Inserir Linha de Dívida</button>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                            <th className="p-2.5">Instituição Financeira</th>
                            <th className="p-2.5">Modalidade do Risco</th>
                            <th className="p-2.5 text-right w-44">Saldo Ativo (R$)</th>
                            <th className="p-2.5 text-center w-12">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-mono font-bold">
                          {analise.dados_endividamento.map((div, i) => (
                            <tr key={i}>
                              <td className="p-1"><input type="text" value={div.instituicao} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].instituicao = e.target.value; setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded w-full font-sans font-black uppercase bg-transparent" /></td>
                              <td className="p-1"><input type="text" value={div.modalidade} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].modalidade = e.target.value; setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded w-full font-sans text-slate-400 uppercase bg-transparent" /></td>
                              <td className="p-1"><input type="number" value={div.saldo} onChange={(e) => { const c = [...analise.dados_endividamento]; c[i].saldo = Number(e.target.value); setAnalise({ ...analise, dados_endividamento: c }); }} className="p-1.5 border rounded text-right w-44 text-red-600 bg-transparent font-black" /></td>
                              <td className="p-1 text-center"><button onClick={() => removerLinhaEndividamento(i)} className="text-red-500 hover:text-red-700 font-bold px-1 text-xs cursor-pointer">✕</button></td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 font-black border-t">
                            <td colSpan={2} className="p-2.5 font-sans text-slate-900">Total Bancos/Fundos</td>
                            <td className="p-2.5 text-right text-red-600 font-mono font-black">R$ {totalEndividamento.toLocaleString("pt-BR")}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex justify-between items-center font-bold">
                      <span className="text-slate-500">📉 Índice de Alavancagem Global:</span>
                      <span className="font-mono font-black text-indigo-700 bg-white border px-2 py-0.5 rounded shadow-sm">{(fatMedioAtual > 0 ? totalEndividamento / fatMedioAtual : 0).toFixed(2)}x Faturamento Mensal</span>
                    </div>
                  </div>
                )}

                {/* ABA 7: RESTRITIVOS DINÂMICO (INSERÇÃO COMPLETA) */}
                {abaAtiva === "restritivos" && (
                  <div className="space-y-4 max-w-[950px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Apontamentos Comerciais, Protestos de Cartórios e Serasa</span>
                      <button onClick={adicionarLinhaRestritivos} className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-black px-3 py-1 rounded text-[11px] hover:bg-indigo-100 cursor-pointer">+ Inserir Registro Ofensor</button>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                            <th className="p-2.5">Empresa / Sócio Ofensor</th>
                            <th className="p-2.5">Tipo Restrição</th>
                            <th className="p-2.5 text-center w-20">Qtd</th>
                            <th className="p-2.5 text-right w-36">Valor Global (R$)</th>
                            <th className="p-2.5">Observação / Órgão</th>
                            <th className="p-2.5 text-center w-12">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-mono font-bold">
                          {analise.dados_restritivos.map((rest, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-1"><input type="text" value={rest.origem} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].origem = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border rounded w-full bg-transparent font-black font-sans uppercase" /></td>
                              <td className="p-1"><input type="text" value={rest.tipo} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].tipo = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border rounded w-full bg-transparent text-amber-600 font-bold font-sans uppercase" /></td>
                              <td className="p-1 text-center"><input type="number" value={rest.qtd} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].qtd = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border text-center rounded w-16 bg-transparent" /></td>
                              <td className="p-1 text-right"><input type="number" value={rest.valor} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].valor = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border text-right rounded w-36 bg-transparent text-red-600 font-black" /></td>
                              <td className="p-1"><input type="text" value={rest.obs} onChange={(e) => { const c = [...analise.dados_restritivos]; c[i].obs = e.target.value; setAnalise({ ...analise, dados_restritivos: c }); }} className="p-1 border rounded w-full bg-transparent text-slate-400 font-sans" /></td>
                              <td className="p-1 text-center"><button onClick={() => removerLinhaRestritivos(i)} className="text-red-500 hover:text-red-700 font-bold px-1 text-xs cursor-pointer">✕</button></td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 font-black border-t">
                            <td colSpan={3} className="p-2.5 font-sans text-slate-900">Total Restritivos Expostos</td>
                            <td className="p-2.5 text-right text-red-600 font-mono font-black">R$ {totalRestritivos.toLocaleString("pt-BR")}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {abaAtiva === "juridico" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-black text-red-600 uppercase text-[10px] tracking-widest">🔴 Em Tramitação / Execuções</label>
                      <textarea value={analise.dados_juridico.processos_tramitacao || ""} onChange={(e) => setAnalise({ ...analise, dados_juridico: { ...analise.dados_juridico, processos_tramitacao: e.target.value } })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 min-h-[220px] font-sans" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-black text-emerald-600 uppercase text-[10px] tracking-widest">🟢 Arquivados / Extintos</label>
                      <textarea value={analise.dados_juridico.processos_arquivados || ""} onChange={(e) => setAnalise({ ...analise, dados_juridico: { ...analise.dados_juridico, processos_arquivados: e.target.value } })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 min-h-[220px] font-sans" />
                    </div>
                  </div>
                )}

                {abaAtiva === "parecer" && (
                  <div className="space-y-2">
                    <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest">Parecer Consolidado do Comitê de Crédito</label>
                    <textarea value={analise.parecer_comite} onChange={(e) => setAnalise({ ...analise, parecer_comite: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 min-h-[280px] font-sans" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function MesaAnalisePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans antialiased">
      <Suspense fallback={<div className="p-12 text-center font-mono text-xs text-slate-400 animate-pulse">⚡ Inicializando Ambiente de Auditoria...</div>}>
        <MesaAnaliseConteudo />
      </Suspense>
    </div>
  );
}