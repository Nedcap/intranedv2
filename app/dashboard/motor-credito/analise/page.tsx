"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import GerarAnalise from "@/components/gerar-analise"; // 🚀 IMPORTAÇÃO DO GERADOR HTML AQUI

// =========================================================================
// INTERFACES (ESTRUTURA COMPLETA DO EXCEL)
// =========================================================================
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
  figura_contrato: boolean;
  assinatura: string;
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

interface ReferenciaFundo {
  fundo: string;
  rnx: string;
  cliente_desde: string;
  limite_global: number;
  risco_total: number;
  obs: string;
}

interface AnaliseData {
  id: string | null;
  cnpj: string;
  razao_social: string;
  uf: string;
  cidade: string;
  capital_social: number;
  status?: string;
  dados_gerais: { 
    fundacao?: string; ramo?: string; site?: string; relacionamento?: string; 
    gerente?: string; analista?: string; licencas?: string; balanco_auditado?: string; 
    consultoria?: string; unidades?: string;
  };
  proposta: { modalidade: string; limite: number; prazo: number; tranche: number; taxa: number; garantia: string; rating: string };
  dados_faturamento: Record<string, Record<string, number>>;
  dados_potencial: { ticket_medio: number; prazo_medio_vendas: number; vendas_prazo_perc: number };
  dados_endividamento: EndividamentoItem[];
  dados_restritivos: RestritivoItem[];
  dados_estrutura_societaria: SócioItem[];
  dados_referencias: ReferenciaFundo[];
  dados_qualitativos: { 
    processos_tramitacao?: string; processos_arquivados?: string; 
    noticias_midia?: string; relatorio_visita?: string; parecer_diretor?: string;
  };
  parecer_comite: string;
  recomendacao_analista?: string; // NOVO: Veredito sugerido
  [key: string]: any; // Flexibilidade para novos campos dinâmicos
}

const DADOS_MODELO: AnaliseData = {
  id: null, cnpj: "11.127.136/0001-83", razao_social: "TOTAL CAP RECAPADORA DE PNEUS LTDA", uf: "PR", cidade: "Curitiba", capital_social: 100000,
  recomendacao_analista: "Aprovação Integral", parecer_comite: "Preencha a análise detalhada...",
  dados_gerais: { fundacao: "2009-04-13", ramo: "Reforma de pneumáticos", site: "Não possui", gerente: "Luiz", analista: "Alyson", balanco_auditado: "Não", consultoria: "Não" },
  proposta: { modalidade: "Desconto", limite: 80000, prazo: 75, tranche: 20000, taxa: 0.035, garantia: "Aval", rating: "B" },
  dados_faturamento: { "2024": {}, "2025": {}, "2026": {} }, 
  dados_potencial: { ticket_medio: 3000, prazo_medio_vendas: 75, vendas_prazo_perc: 100 },
  dados_endividamento: [], dados_restritivos: [], dados_estrutura_societaria: [], dados_referencias: [], dados_qualitativos: {}
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
function MesaAnaliseConteudo() {
  const searchParams = useSearchParams();
  const idDaUrl = searchParams.get("id");

  const [fila, setFila] = useState<FilaItem[]>([]);
  const [analise, setAnalise] = useState<AnaliseData>(DADOS_MODELO);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  
  const [abaAtiva, setAbaAtiva] = useState("proposta");
  const [loadingFila, setLoadingFila] = useState(true);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [processandoDecisao, setProcessandoDecisao] = useState(false);

  useEffect(() => {
    buscarFilaSupabase(true);
    const intervalo = setInterval(() => { buscarFilaSupabase(false); }, 10000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (idDaUrl) selecionarEmpresaDaEsteira(idDaUrl);
  }, [idDaUrl]);

  const buscarFilaSupabase = async (comSpinner = false) => {
    try {
      if (comSpinner) setLoadingFila(true);
      // Puxa APENAS o que está na mesa do analista
      const { data, error } = await supabase
        .from("analises_credito")
        .select("id, razao_social, cnpj, status")
        .eq("status", "em_revisao_humana")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      if (data) setFila(data as any);
    } catch (err) { console.error(err); } finally { if (comSpinner) setLoadingFila(false); }
  };

  const selecionarEmpresaDaEsteira = async (id: string) => {
    try {
      setLoadingAnalise(true);
      setIdSelecionado(id);
      const { data, error } = await supabase.from("analises_credito").select("*").eq("id", id).single();
      if (error) throw error;
      if (data) {
        const dc = data.dados_consolidados || {};
        if (data.status === "robo_processando") {
          await supabase.from("analises_credito").update({ status: "em_revisao_humana" }).eq("id", id);
        }
        setAnalise({
          id: data.id, cnpj: data.cnpj, razao_social: data.razao_social, status: "em_revisao_humana",
          uf: dc.uf || "PR", cidade: dc.cidade || "Curitiba", capital_social: Number(dc.capital_social || 0),
          dados_gerais: dc.dados_gerais || {},
          proposta: dc.proposta || { modalidade: "Desconto", limite: 0, prazo: 30, tranche: 0, taxa: 0.00, garantia: "Aval", rating: "C" },
          dados_faturamento: dc.dados_faturamento || { "2024": {}, "2025": {}, "2026": {} },
          dados_potencial: dc.dados_potencial || { ticket_medio: 0, prazo_medio_vendas: 0, vendas_prazo_perc: 100 },
          dados_endividamento: dc.dados_endividamento || [],
          dados_restritivos: dc.dados_restritivos?.map((r: any) => ({ ...r, origem: r.origem || r.origin })) || [],
          dados_estrutura_societaria: dc.dados_estrutura_societaria || [],
          dados_referencias: dc.dados_referencias || [],
          dados_qualitativos: dc.dados_qualitativos || {},
          parecer_comite: dc.parecer_comite || "",
          recomendacao_analista: dc.recomendacao_analista || "Aprovação Integral"
        });
      }
    } catch (err) { console.error(err); } finally { setLoadingAnalise(false); }
  };

  const persistirNoBanco = async (mostrarAlerta = true) => {
    if (!idSelecionado || !analise.id) {
      if (mostrarAlerta) alert("💡 Você está no Template. Selecione uma análise real para salvar.");
      return false;
    }
    try {
      setProcessandoDecisao(true);
      const { id, cnpj, razao_social, status, ...dadosParaCompactar } = analise;
      const { error } = await supabase.from("analises_credito").update({ dados_consolidados: dadosParaCompactar }).eq("id", analise.id);
      if (error) throw error;
      if (mostrarAlerta) alert("✅ Matriz Excel salva com sucesso no banco de dados!");
      return true;
    } catch (err: any) { alert("❌ Erro ao salvar dados: " + err.message); return false; } finally { setProcessandoDecisao(false); }
  };

  // 🔥 FLUXO NOVO: Enviar para Comitê
  const encaminharParaComite = async () => {
    if (!idSelecionado || !analise.id) return;
    if (!analise.recomendacao_analista || !analise.parecer_comite.trim()) {
      alert("⚠️ É obrigatório preencher o Parecer Técnico e escolher uma Recomendação antes de enviar ao comitê.");
      return;
    }
    
    const confirmacao = window.confirm(`Encaminhar para o Comitê de Crédito com parecer de: [${analise.recomendacao_analista.toUpperCase()}]?`);
    if (!confirmacao) return;

    try {
      setProcessandoDecisao(true);
      await persistirNoBanco(false); // Salva os dados primeiro
      
      const { error } = await supabase.from("analises_credito").update({ status: "aguardando_comite" }).eq("id", analise.id);
      if (error) throw error;

      alert(`🚀 Análise enviada com sucesso! Ela saiu da sua fila e o Motor Python já pode gerar o Relatório HTML.`);
      setIdSelecionado(null);
      setAnalise(DADOS_MODELO);
      await buscarFilaSupabase(true);
    } catch (err: any) { alert("Erro ao processar: " + err.message); } finally { setProcessandoDecisao(false); }
  };

  const devolverParaComercialPendente = async () => {
    if (!idSelecionado || !analise.id) return;
    const justificativa = prompt("Motivo da devolução para o Comercial (Ex: Falta balanço 2025):");
    if (!justificativa?.trim()) return; 
    try {
      setProcessandoDecisao(true);
      const { id, cnpj, razao_social, status, ...dadosParaCompactar } = analise;
      dadosParaCompactar.parecer_comite = `🚨 DEVOLVIDO (PENDÊNCIA COMERCIAL):\nMotivo: ${justificativa}\n\n` + (dadosParaCompactar.parecer_comite || "");
      
      const { error } = await supabase.from("analises_credito").update({ status: "aguardando_docs", dados_consolidados: dadosParaCompactar }).eq("id", analise.id);
      if (error) throw error;
      
      alert("📥 Empresa devolvida para a tela do Comercial!");
      setIdSelecionado(null); setAnalise(DADOS_MODELO); await buscarFilaSupabase(true);
    } catch (err: any) { alert("❌ Falha na devolução."); } finally { setProcessandoDecisao(false); }
  };

  // GERENCIAMENTO DE LINHAS (ESTILO EXCEL)
  const addSocio = () => setAnalise({ ...analise, dados_estrutura_societaria: [...analise.dados_estrutura_societaria, { s_nome: "", s_perc: 0, s_cargo: "Sócio", s_aval: true, figura_contrato: true, assinatura: "Isolada", b_bens: "", b_valor: 0 }] });
  const rmSocio = (i: number) => setAnalise({ ...analise, dados_estrutura_societaria: analise.dados_estrutura_societaria.filter((_, idx) => idx !== i) });

  const addBanco = () => setAnalise({ ...analise, dados_endividamento: [...analise.dados_endividamento, { instituicao: "", modalidade: "", saldo: 0 }] });
  const rmBanco = (i: number) => setAnalise({ ...analise, dados_endividamento: analise.dados_endividamento.filter((_, idx) => idx !== i) });

  const addFundo = () => setAnalise({ ...analise, dados_referencias: [...analise.dados_referencias, { fundo: "", rnx: "", cliente_desde: "", limite_global: 0, risco_total: 0, obs: "" }] });
  const rmFundo = (i: number) => setAnalise({ ...analise, dados_referencias: analise.dados_referencias.filter((_, idx) => idx !== i) });

  const addRest = () => setAnalise({ ...analise, dados_restritivos: [...analise.dados_restritivos, { origem: "", tipo: "", qtd: 1, valor: 0, obs: "" }] });
  const rmRest = (i: number) => setAnalise({ ...analise, dados_restritivos: analise.dados_restritivos.filter((_, idx) => idx !== i) });

  const handleFat = (ano: string, mes: string, val: string) => {
    const fatAtual = { ...analise.dados_faturamento };
    if (!fatAtual[ano]) fatAtual[ano] = {};
    fatAtual[ano][mes] = Number(val || 0);
    setAnalise({ ...analise, dados_faturamento: fatAtual });
  };

  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const calcTotAno = (ano: string) => meses.reduce((acc, m) => acc + Number(analise.dados_faturamento[ano]?.[m] || 0), 0);
  const calcMedia = (ano: string) => { const pre = meses.filter(m => analise.dados_faturamento[ano]?.[m]).length; return pre === 0 ? 0 : calcTotAno(ano) / pre; };
  const calcDelta = (m: string, aAt: string, aAnt: string) => { const at = Number(analise.dados_faturamento[aAt]?.[m] || 0); const ant = Number(analise.dados_faturamento[aAnt]?.[m] || 0); return !ant ? 0 : ((at - ant) / ant) * 100; };

  const fatMedioAtual = calcMedia("2025") || 0;
  const totBancos = analise.dados_endividamento.reduce((acc, d) => acc + Number(d.saldo), 0) || 0;
  const totRest = analise.dados_restritivos.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

  // =========================================================================
  // CONSTANTES VISUAIS EXCEL (Classes Tailwind reutilizáveis)
  // =========================================================================
  const cellStyle = "w-full h-full p-2 bg-transparent outline-none focus:bg-indigo-50 focus:ring-inset focus:ring-2 focus:ring-indigo-500 font-sans text-xs transition-all";
  const thStyle = "p-2.5 bg-slate-100 border border-slate-300 font-black text-[10px] uppercase text-slate-600 text-center tracking-widest";
  const tdStyle = "border border-slate-300 p-0 bg-white hover:bg-slate-50 relative focus-within:bg-indigo-50/30 transition-colors";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start bg-slate-50 min-h-screen p-4 md:p-6">
      
      {/* SIDEBAR */}
      <div className="lg:col-span-3">
        <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col min-h-[700px]">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
            <span className="font-black text-slate-800 uppercase text-[11px] tracking-widest block">
              📥 Esteira do Analista ({fila.length})
            </span>
            <button onClick={() => buscarFilaSupabase(true)} className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold cursor-pointer">🔄 Atualizar</button>
          </div>
          
          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
            <div onClick={() => { setIdSelecionado(null); setAnalise(DADOS_MODELO); }} className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${idSelecionado === null ? "bg-indigo-50 border-indigo-400" : "bg-white border-slate-200 hover:bg-slate-100"}`}>
              <p className="text-xs font-black text-indigo-700 uppercase">⭐ TEMPLATE MODELO ESTÁTICO</p>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">Visão Completa dos Campos</p>
            </div>
            {loadingFila ? (
              <div className="text-center py-6 text-slate-400 font-mono text-[11px]">Sincronizando...</div>
            ) : fila.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">Fila de análise vazia.</div>
            ) : (
              fila.map((item) => (
                <div key={item.id} onClick={() => selecionarEmpresaDaEsteira(item.id)} className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${idSelecionado === item.id ? "bg-indigo-600 border-indigo-700 text-white shadow-md" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <p className={`text-xs font-black uppercase truncate ${idSelecionado === item.id ? "text-white" : "text-slate-900"}`}>{item.razao_social}</p>
                  <p className={`text-[10px] font-mono mt-1 ${idSelecionado === item.id ? "text-indigo-200" : "text-slate-400"}`}>CNPJ: {item.cnpj}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WORKSPACE ESTILO PLANILHA */}
      <div className="lg:col-span-9 space-y-4">
        {loadingAnalise ? (
          <div className="bg-white border border-slate-300 rounded-xl p-12 text-center shadow-sm min-h-[650px] flex flex-col items-center justify-center">
            <span className="animate-spin text-2xl block text-indigo-500">⏳</span>
            <p className="text-xs font-black uppercase text-slate-500 mt-4">Carregando Matriz de Dados...</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden flex flex-col">
            
            {/* TOOLBAR EXCEL */}
            <div className="p-4 border-b border-slate-300 bg-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${idSelecionado ? "bg-emerald-600 text-white" : "bg-slate-400 text-white"}`}>
                  {idSelecionado ? `Card Ativo` : "Modo Edição Base"}
                </span>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-1.5 leading-none">{analise.razao_social}</h2>
                <p className="text-xs font-mono font-bold text-slate-500 mt-1">CNPJ: {analise.cnpj} | LOCALIZAÇÃO: {analise.cidade}/{analise.uf}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => persistirNoBanco(true)} disabled={processandoDecisao} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-md text-xs uppercase tracking-widest shadow-sm cursor-pointer transition-all">
                  💾 Salvar Planilha
                </button>
                {idSelecionado && (
                  <>
                    <button onClick={encaminharParaComite} disabled={processandoDecisao} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-md text-xs uppercase tracking-widest cursor-pointer shadow-sm transition-all flex items-center gap-1">
                      🚀 Enviar Parecer p/ Comitê
                    </button>
                    <button onClick={devolverParaComercialPendente} disabled={processandoDecisao} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-black px-3 py-2 rounded-md text-[10px] uppercase tracking-widest cursor-pointer transition-all">
                      🚨 Devolver Analise
                    </button>
                    
                    {/* BOTÃO DO GERADOR HTML AQUI */}
                    <GerarAnalise analise={analise} />
                  </>
                )}
              </div>
            </div>

            {/* ENGINE DE ABAS */}
            <div className="bg-slate-100 border-b border-slate-300 px-2 pt-2 flex flex-wrap gap-1 overflow-x-auto">
              {[
                { id: "proposta", label: "📋 1. Proposta & Cadastro" },
                { id: "estrutura", label: "👥 2. Societário" },
                { id: "fat", label: "📊 3. Faturamento & Potencial" },
                { id: "endividamento", label: "🏦 4. Bancos & Fundos" },
                { id: "restritivos", label: "🚨 5. Restritivos & Jurídico" },
                { id: "parecer", label: "📝 6. Parecer Final & Envio" }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setAbaAtiva(tab.id)} className={`px-4 py-2.5 font-black uppercase text-[10px] tracking-wider rounded-t-md border border-b-0 transition-all cursor-pointer ${abaAtiva === tab.id ? "bg-white text-indigo-700 border-slate-300 border-t-2 border-t-indigo-500 shadow-[0_4px_0_white] z-10" : "bg-transparent border-transparent text-slate-500 hover:bg-slate-200"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ÁREA DE TRABALHO DA PLANILHA */}
            <div className="p-6 bg-slate-50 min-h-[500px]">
              
              {/* ========================================================= */}
              {/* ABA 1: PROPOSTA E CADASTRO */}
              {/* ========================================================= */}
              {abaAtiva === "proposta" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-300 pb-1">Detalhes da Operação Comercial</span>
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr><td className={`${thStyle} w-1/3 text-right`}>Analista</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.analista || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, analista: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Gerente / Hub</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.gerente || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, gerente: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Modalidade</td><td className={tdStyle}><input type="text" value={analise.proposta.modalidade} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, modalidade: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right bg-indigo-50`}>Limite (R$)</td><td className={`${tdStyle} bg-indigo-50/30`}><input type="number" value={analise.proposta.limite} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, limite: Number(e.target.value) } })} className={`${cellStyle} font-mono font-bold text-indigo-700`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Prazo (Dias)</td><td className={tdStyle}><input type="number" value={analise.proposta.prazo} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, prazo: Number(e.target.value) } })} className={`${cellStyle} font-mono`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Taxa (%)</td><td className={tdStyle}><input type="number" step="0.001" value={analise.proposta.taxa} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, taxa: Number(e.target.value) } })} className={`${cellStyle} font-mono`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Garantia</td><td className={tdStyle}><input type="text" value={analise.proposta.garantia} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, garantia: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right bg-amber-50`}>Rating V8</td>
                          <td className={tdStyle}>
                            <select value={analise.proposta.rating} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, rating: e.target.value } })} className={`${cellStyle} font-black text-amber-700`}>
                              <option value="A">Rating A (Baixo Risco)</option><option value="B">Rating B (Risco Aceitável)</option><option value="C">Rating C (Risco Moderado)</option><option value="D">Rating D (Fora do Perfil)</option>
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-300 pb-1">Ficha Cadastral Complementar</span>
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr><td className={`${thStyle} w-1/3 text-right`}>Fundação</td><td className={tdStyle}><input type="date" value={analise.dados_gerais.fundacao || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, fundacao: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Capital (R$)</td><td className={tdStyle}><input type="number" value={analise.capital_social} onChange={(e) => setAnalise({ ...analise, capital_social: Number(e.target.value) })} className={`${cellStyle} font-mono`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Atividade Principal</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.ramo || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, ramo: e.target.value } })} className={`${cellStyle} uppercase`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Unidades Locais</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.unidades || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, unidades: e.target.value } })} className={cellStyle} placeholder="Ex: Matriz e 2 Filiais" /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Licenças Especiais</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.licencas || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, licencas: e.target.value } })} className={cellStyle} placeholder="Ex: ANVISA, SIF, ISO" /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Balanço Auditado</td>
                          <td className={tdStyle}>
                            <select value={analise.dados_gerais.balanco_auditado || "Não"} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, balanco_auditado: e.target.value } })} className={cellStyle}><option value="Não">Não</option><option value="Sim">Sim (Big 4)</option><option value="Sim (Outras)">Sim (Outras Auditorias)</option></select>
                          </td>
                        </tr>
                        <tr><td className={`${thStyle} text-right`}>Consultoria Ativa</td>
                          <td className={tdStyle}>
                            <select value={analise.dados_gerais.consultoria || "Não"} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, consultoria: e.target.value } })} className={cellStyle}><option value="Não">Não</option><option value="FDC / Falconi">FDC / Falconi</option><option value="Outras">Sim (Outras)</option></select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 2: SOCIETÁRIO E IRPF */}
              {/* ========================================================= */}
              {abaAtiva === "estrutura" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-1 border-b border-slate-300 pb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Matriz Societária e Capacidade Patrimonial</span>
                    <button onClick={addSocio} className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-black px-3 py-1 rounded-md text-[10px] uppercase hover:bg-indigo-100">+ Add Sócio / Avalista</button>
                  </div>
                  <div className="overflow-x-auto shadow-sm rounded border border-slate-300">
                    <table className="w-full text-left border-collapse min-w-[1000px] bg-white">
                      <thead>
                        <tr>
                          <th className={thStyle}>Nome Completo / Empresa</th>
                          <th className={`${thStyle} w-16`}>%</th>
                          <th className={`${thStyle} w-24`}>Assina?</th>
                          <th className={`${thStyle} w-28`}>Regra</th>
                          <th className={`${thStyle} w-16`}>Aval</th>
                          <th className={thStyle}>Descrição de Bens (IRPF/PJ)</th>
                          <th className={`${thStyle} w-32`}>Valor Avaliado</th>
                          <th className={`${thStyle} w-10`}>Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.dados_estrutura_societaria.map((s, idx) => (
                          <tr key={idx}>
                            <td className={tdStyle}><input type="text" value={s.s_nome} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].s_nome = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} font-bold uppercase`} /></td>
                            <td className={tdStyle}><input type="number" value={s.s_perc} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].s_perc = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} text-center font-mono`} /></td>
                            <td className={`${tdStyle} text-center`}><input type="checkbox" checked={s.figura_contrato} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].figura_contrato = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className="cursor-pointer h-4 w-4 accent-indigo-600" /></td>
                            <td className={tdStyle}>
                              <select value={s.assinatura || "Isolada"} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].assinatura = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} text-center`}>
                                <option value="Isolada">Isolada</option><option value="Conjunta">Conjunta</option>
                              </select>
                            </td>
                            <td className={`${tdStyle} text-center`}><input type="checkbox" checked={s.s_aval} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].s_aval = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className="cursor-pointer h-4 w-4 accent-indigo-600" /></td>
                            <td className={tdStyle}><input type="text" value={s.b_bens} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].b_bens = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} text-slate-600`} placeholder="Ex: 2 Imóveis Comerciais SP" /></td>
                            <td className={tdStyle}><input type="number" value={s.b_valor} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].b_valor = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} text-right text-emerald-600 font-bold`} /></td>
                            <td className={`${tdStyle} text-center`}><button onClick={() => rmSocio(idx)} className="text-red-500 font-black px-2 py-1 hover:bg-red-100 rounded">✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 3: FATURAMENTO E POTENCIAL */}
              {/* ========================================================= */}
              {abaAtiva === "fat" && (
                <div className="space-y-6">
                  {/* TABELA DE FATURAMENTO */}
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-300 pb-1 mb-3">Tabela Dinâmica de Faturamento Anual</span>
                    <div className="overflow-x-auto shadow-sm rounded border border-slate-300">
                      <table className="w-full border-collapse text-left min-w-[800px] bg-white">
                        <thead>
                          <tr>
                            <th className={`${thStyle} w-32 text-left`}>Mês Referência</th>
                            <th className={thStyle}>Realizado 2024</th>
                            <th className={thStyle}>Realizado 2025</th>
                            <th className={thStyle}>Delta YoY %</th>
                            <th className={thStyle}>Projeção 2026</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meses.map((mes) => {
                            const delta = calcDelta(mes, "2025", "2024");
                            return (
                              <tr key={mes}>
                                <td className={`${tdStyle} bg-slate-50 font-black uppercase text-[10px] text-slate-600 pl-3`}>{mes.substring(0,3)}</td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2024"]?.[mes] || ""} onChange={(e) => handleFat("2024", mes, e.target.value)} className={`${cellStyle} text-center font-mono`} /></td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2025"]?.[mes] || ""} onChange={(e) => handleFat("2025", mes, e.target.value)} className={`${cellStyle} text-center font-mono`} /></td>
                                <td className={`${tdStyle} text-center font-black text-xs ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>{delta === 0 ? "-" : `${delta > 0 ? '↑' : '↓'} ${delta.toFixed(1)}%`}</td>
                                <td className={`${tdStyle} bg-indigo-50/20`}><input type="number" value={analise.dados_faturamento["2026"]?.[mes] || ""} onChange={(e) => handleFat("2026", mes, e.target.value)} className={`${cellStyle} text-center font-mono text-indigo-700 font-bold`} /></td>
                              </tr>
                            );
                          })}
                          {/* TOTAIS */}
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs">
                            <td className="p-2 border border-slate-300 text-slate-800">SOMA TOTAL</td>
                            <td className="p-2 border border-slate-300 text-center">{calcTotAno("2024").toLocaleString("pt-BR")}</td>
                            <td className="p-2 border border-slate-300 text-center">{calcTotAno("2025").toLocaleString("pt-BR")}</td>
                            <td className="p-2 border border-slate-300 text-center text-indigo-600">{(((calcTotAno("2025") - calcTotAno("2024")) / (calcTotAno("2024") || 1)) * 100).toFixed(1)}%</td>
                            <td className="p-2 border border-slate-300 text-center text-indigo-700">{calcTotAno("2026").toLocaleString("pt-BR")}</td>
                          </tr>
                          <tr className="bg-slate-200 border-t border-slate-300 font-black text-xs">
                            <td className="p-2 border border-slate-300 text-slate-700">MÉDIA MENSAL</td>
                            <td className="p-2 border border-slate-300 text-center text-slate-600">{calcMedia("2024").toLocaleString("pt-BR")}</td>
                            <td className="p-2 border border-slate-300 text-center text-slate-600">{calcMedia("2025").toLocaleString("pt-BR")}</td>
                            <td className="p-2 border border-slate-300"></td>
                            <td className="p-2 border border-slate-300 text-center text-indigo-800">{calcMedia("2026").toLocaleString("pt-BR")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BLOCO DE POTENCIAL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-300 rounded shadow-sm p-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Modelagem de Capacidade / Cessão</span>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr><td className={`${thStyle} text-right w-1/2`}>Ticket Médio (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, ticket_medio: Number(e.target.value) } })} className={`${cellStyle} font-mono`} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.prazo_medio_vendas} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, prazo_medio_vendas: Number(e.target.value) } })} className={`${cellStyle} font-mono`} /></td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded shadow-sm p-4 flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-2">📈 Potencial Real Estimado (Mensal)</span>
                      <span className="font-mono text-3xl font-black text-emerald-600 tracking-tighter">R$ {(fatMedioAtual * 2.5).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[9px] font-bold text-emerald-600/70 uppercase mt-1">Baseado na média de 2025 x Rotatividade</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 4: BANCOS E FUNDOS */}
              {/* ========================================================= */}
              {abaAtiva === "endividamento" && (
                <div className="space-y-8">
                  {/* SCR BANCOS */}
                  <div>
                    <div className="flex justify-between items-center mb-1 border-b border-slate-300 pb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">SCR Centralizado Bancos Tradicionais</span>
                      <button onClick={addBanco} className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-black px-3 py-1 rounded-md text-[10px] uppercase hover:bg-indigo-100">+ Add Credor</button>
                    </div>
                    <div className="overflow-x-auto shadow-sm rounded border border-slate-300">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>Instituição Financeira</th>
                            <th className={thStyle}>Modalidade do Risco</th>
                            <th className={`${thStyle} w-44 text-right`}>Saldo Devedor (R$)</th>
                            <th className={`${thStyle} w-10`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_endividamento.map((div, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input type="text" value={div.instituicao} onChange={(e) => { const a = [...analise.dados_endividamento]; a[i].instituicao = e.target.value; setAnalise({ ...analise, dados_endividamento: a }); }} className={`${cellStyle} uppercase font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={div.modalidade} onChange={(e) => { const a = [...analise.dados_endividamento]; a[i].modalidade = e.target.value; setAnalise({ ...analise, dados_endividamento: a }); }} className={cellStyle} /></td>
                              <td className={tdStyle}><input type="number" value={div.saldo} onChange={(e) => { const a = [...analise.dados_endividamento]; a[i].saldo = Number(e.target.value); setAnalise({ ...analise, dados_endividamento: a }); }} className={`${cellStyle} text-right text-red-600 font-mono font-bold`} /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmBanco(i)} className="text-red-500 font-black px-2 py-1 hover:bg-red-100 rounded">✕</button></td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td colSpan={2} className="p-3 text-right font-black uppercase text-[10px] text-slate-700 tracking-widest">Alavancagem Bancária Total</td>
                            <td className="p-3 text-right font-mono font-black text-red-600">R$ {totBancos.toLocaleString("pt-BR")}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FUNDOS FIDC */}
                  <div>
                    <div className="flex justify-between items-center mb-1 border-b border-slate-300 pb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Referências de Mercado (Fundos e FIDCs)</span>
                      <button onClick={addFundo} className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-black px-3 py-1 rounded-md text-[10px] uppercase hover:bg-indigo-100">+ Add Referência</button>
                    </div>
                    <div className="overflow-x-auto shadow-sm rounded border border-slate-300">
                      <table className="w-full text-left border-collapse min-w-[900px] bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>Fundo / Parceiro</th>
                            <th className={`${thStyle} w-20`}>RNX</th>
                            <th className={`${thStyle} w-24`}>Desde</th>
                            <th className={`${thStyle} w-32 text-right`}>Limite (R$)</th>
                            <th className={`${thStyle} w-32 text-right`}>Risco (R$)</th>
                            <th className={thStyle}>Comportamento (Atrasos/Liq)</th>
                            <th className={`${thStyle} w-10`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_referencias.map((ref, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input type="text" value={ref.fundo} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].fundo = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} font-bold uppercase`} /></td>
                              <td className={tdStyle}><input type="text" value={ref.rnx} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].rnx = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} text-center uppercase`} placeholder="Ex: Opera" /></td>
                              <td className={tdStyle}><input type="text" value={ref.cliente_desde} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].cliente_desde = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} text-center`} placeholder="Ano" /></td>
                              <td className={tdStyle}><input type="number" value={ref.limite_global} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].limite_global = Number(e.target.value); setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} text-right font-mono text-indigo-600 font-bold`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.risco_total} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].risco_total = Number(e.target.value); setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} text-right font-mono text-red-600 font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={ref.obs} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].obs = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={cellStyle} placeholder="Ex: Liquidez alta, recompra OK" /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmFundo(i)} className="text-red-500 font-black px-2 py-1 hover:bg-red-100 rounded">✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 5: RESTRITIVOS E JURÍDICO */}
              {/* ========================================================= */}
              {abaAtiva === "restritivos" && (
                <div className="space-y-8">
                  {/* RESTRITIVOS FINANCEIROS */}
                  <div>
                    <div className="flex justify-between items-center mb-1 border-b border-slate-300 pb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Registros Ofensores Financeiros (Serasa, Pefin, Protestos)</span>
                      <button onClick={addRest} className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-black px-3 py-1 rounded-md text-[10px] uppercase hover:bg-indigo-100">+ Add Registro</button>
                    </div>
                    <div className="overflow-x-auto shadow-sm rounded border border-slate-300">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>CNPJ/CPF Ofensor</th>
                            <th className={thStyle}>Natureza</th>
                            <th className={`${thStyle} w-16 text-center`}>Qtd</th>
                            <th className={`${thStyle} w-36 text-right`}>Valor (R$)</th>
                            <th className={thStyle}>Órgão / Observação</th>
                            <th className={`${thStyle} w-10`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_restritivos.map((rest, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input type="text" value={rest.origem || ""} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].origem = e.target.value; setAnalise({ ...analise, dados_restritivos: a }); }} className={`${cellStyle} uppercase font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={rest.tipo} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].tipo = e.target.value; setAnalise({ ...analise, dados_restritivos: a }); }} className={`${cellStyle} text-amber-700 font-bold uppercase`} placeholder="Protesto, Refin..." /></td>
                              <td className={tdStyle}><input type="number" value={rest.qtd} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].qtd = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: a }); }} className={`${cellStyle} text-center`} /></td>
                              <td className={tdStyle}><input type="number" value={rest.valor} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].valor = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: a }); }} className={`${cellStyle} text-right text-red-600 font-mono font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={rest.obs} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].obs = e.target.value; setAnalise({ ...analise, dados_restritivos: a }); }} className={cellStyle} placeholder="Ex: Cartório SP" /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmRest(i)} className="text-red-500 font-black px-2 py-1 hover:bg-red-100 rounded">✕</button></td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td colSpan={3} className="p-3 text-right font-black uppercase text-[10px] text-slate-700 tracking-widest">Total Financeiro Exposto</td>
                            <td className="p-3 text-right font-mono font-black text-red-600">R$ {totRest.toLocaleString("pt-BR")}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PESQUISA DE MÍDIA E PROCESSOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-red-700 uppercase tracking-widest mb-1 border-b border-red-200 pb-1">🔴 Em Tramitação (Fiscais, Cíveis, Rec. Jud.)</label>
                      <textarea value={analise.dados_qualitativos?.processos_tramitacao || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, processos_tramitacao: e.target.value } })} className="w-full h-32 p-3 bg-white border border-slate-300 rounded shadow-sm text-xs focus:border-red-400 outline-none resize-none font-sans" placeholder="Cole aqui o resumo do Kappi/Datajud..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1 border-b border-emerald-200 pb-1">🟢 Arquivados e Extintos</label>
                      <textarea value={analise.dados_qualitativos?.processos_arquivados || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, processos_arquivados: e.target.value } })} className="w-full h-32 p-3 bg-white border border-slate-300 rounded shadow-sm text-xs focus:border-emerald-400 outline-none resize-none font-sans" placeholder="Processos quitados e resolvidos..." />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 border-b border-slate-300 pb-1">📰 Pesquisa de Mídia e Notícias (Reputacional)</label>
                      <textarea value={analise.dados_qualitativos?.noticias_midia || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, noticias_midia: e.target.value } })} className="w-full h-20 p-3 bg-white border border-slate-300 rounded shadow-sm text-xs focus:border-indigo-400 outline-none resize-none font-sans" placeholder="Ataques ambientais, fraudes em portais, reclame aqui..." />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 6: PARECER FINAL */}
              {/* ========================================================= */}
              {abaAtiva === "parecer" && (
                <div className="max-w-5xl mx-auto space-y-6">
                  
                  {/* RECOMENDAÇÃO DO ANALISTA */}
                  <div className="bg-white border-2 border-indigo-200 p-6 rounded-xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                    <h3 className="text-[11px] font-black text-indigo-800 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-2">Veredito Sugerido ao Comitê</h3>
                    
                    <div className="mb-6">
                      <select 
                        value={analise.recomendacao_analista || ""} 
                        onChange={(e) => setAnalise({...analise, recomendacao_analista: e.target.value})} 
                        className="w-full p-4 border-2 border-indigo-300 rounded-lg font-black text-indigo-900 bg-indigo-50/50 outline-none text-base cursor-pointer focus:ring-4 focus:ring-indigo-500/20 transition-all"
                      >
                        <option value="Aprovação Integral">✅ APROVAÇÃO INTEGRAL</option>
                        <option value="Aprovação com Condicionantes">⚠️ APROVAÇÃO COM CONDICIONANTES (Redução de Limite/Garantia)</option>
                        <option value="Reprovação">❌ REPROVAÇÃO TÉCNICA (Fora do Perfil)</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-2 font-medium">Esta recomendação será o grande destaque do relatório HTML lido pela Diretoria.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest">Parecer Analítico Consolidado</label>
                      <textarea 
                        value={analise.parecer_comite || ""} 
                        onChange={(e) => setAnalise({...analise, parecer_comite: e.target.value})}
                        className="w-full p-5 border border-slate-300 rounded-lg h-72 font-sans text-sm focus:border-indigo-500 outline-none resize-none leading-relaxed text-slate-700 shadow-inner"
                        placeholder="Elabore a justificativa técnica. Explique os pontos fortes (rating, evolução de fat), pontos de atenção (alavancagem, processos) e conclua justificando o veredito acima..."
                      />
                    </div>
                  </div>

                  {/* PARECER DIRETOR / VISITA (OPCIONAL) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white border border-slate-300 p-5 rounded-xl shadow-sm">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">📍 Relatório de Visitas In-loco</label>
                      <textarea value={analise.dados_qualitativos?.relatorio_visita || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, relatorio_visita: e.target.value } })} className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded text-xs outline-none resize-none" placeholder="Aparência da fachada, maquinário visto operando..." />
                    </div>
                    <div className="bg-slate-800 border border-slate-900 p-5 rounded-xl shadow-sm">
                      <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">👨‍💼 Espaço Reservado: Comitê / Diretoria</label>
                      <textarea value={analise.dados_qualitativos?.parecer_diretor || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, parecer_diretor: e.target.value } })} className="w-full h-32 p-3 bg-slate-700 border border-slate-600 text-slate-200 rounded text-xs outline-none resize-none placeholder-slate-500" placeholder="Este campo geralmente é preenchido pós-comitê pela diretoria. Se houver pré-aprovação, digite aqui." />
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function MesaAnalisePage() {
  return (
    <div className="font-sans antialiased text-slate-800">
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-xs text-indigo-500 animate-pulse">⚡ Inicializando Motor de Análise V8...</div>}>
        <MesaAnaliseConteudo />
      </Suspense>
    </div>
  );
}