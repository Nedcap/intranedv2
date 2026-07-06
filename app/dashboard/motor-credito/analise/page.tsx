"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import GerarAnalise from "@/components/gerar-analise"; 

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
  
  // NOVO: Endividamento Resumo (Curto/Longo Prazo)
  dados_endividamento_resumo: { curto_prazo: number; longo_prazo: number };
  dados_endividamento: EndividamentoItem[];
  
  dados_restritivos: RestritivoItem[];
  dados_estrutura_societaria: SócioItem[];
  dados_referencias: ReferenciaFundo[];
  
  // NOVO: Anexos e Organograma
  anexos: { organograma_url?: string; fachada_url?: string; satelite_url?: string; fotos_url?: string };

  dados_qualitativos: { 
    processos_tramitacao?: string; processos_arquivados?: string; 
    noticias_midia?: string; relatorio_visita?: string; parecer_diretor?: string;
  };
  parecer_comite: string;
  recomendacao_analista?: string; 
  [key: string]: any; 
}

const DADOS_MODELO: AnaliseData = {
  id: null, cnpj: "11.127.136/0001-83", razao_social: "TOTAL CAP RECAPADORA DE PNEUS LTDA", uf: "PR", cidade: "Curitiba", capital_social: 100000,
  recomendacao_analista: "Aprovação Integral", parecer_comite: "Preencha a análise detalhada...",
  dados_gerais: { fundacao: "2009-04-13", ramo: "Reforma de pneumáticos", site: "Não possui", gerente: "Luiz", analista: "Alyson", balanco_auditado: "Não", consultoria: "Não" },
  proposta: { modalidade: "Desconto", limite: 80000, prazo: 75, tranche: 20000, taxa: 0.035, garantia: "Aval", rating: "B" },
  dados_faturamento: { "2024": {}, "2025": {}, "2026": {} }, 
  dados_potencial: { ticket_medio: 3000, prazo_medio_vendas: 75, vendas_prazo_perc: 100 },
  dados_endividamento_resumo: { curto_prazo: 0, longo_prazo: 0 },
  dados_endividamento: [], 
  dados_restritivos: [], 
  dados_estrutura_societaria: [], 
  dados_referencias: [], 
  anexos: { organograma_url: "", fachada_url: "" },
  dados_qualitativos: {}
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
          dados_endividamento_resumo: dc.dados_endividamento_resumo || { curto_prazo: 0, longo_prazo: 0 },
          dados_endividamento: dc.dados_endividamento || [],
          dados_restritivos: dc.dados_restritivos?.map((r: any) => ({ ...r, origem: r.origem || r.origin })) || [],
          dados_estrutura_societaria: dc.dados_estrutura_societaria || [],
          dados_referencias: dc.dados_referencias || [],
          anexos: dc.anexos || { organograma_url: "", fachada_url: "" },
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
      await persistirNoBanco(false); 
      
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

  // GERENCIAMENTO DE LINHAS
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
  const totPatrimonio = analise.dados_estrutura_societaria.reduce((acc, s) => acc + Number(s.b_valor), 0) || 0;

  // =========================================================================
  // CONSTANTES VISUAIS EXCEL (Bordas duras, header cinza, fonte compacta)
  // =========================================================================
  const cellStyle = "w-full h-full py-1.5 px-2 bg-transparent outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 font-sans text-[11px] transition-all";
  const numStyle = "w-full h-full py-1.5 px-2 bg-transparent outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 font-mono text-[11px] text-right transition-all";
  const thStyle = "p-2 bg-[#e2e8f0] border border-[#cbd5e1] font-bold text-[10px] uppercase text-slate-700 text-center";
  const tdStyle = "border border-[#cbd5e1] p-0 bg-white hover:bg-slate-50 relative focus-within:bg-blue-50/30 transition-colors";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start bg-slate-100 min-h-screen p-4 md:p-6">
      
      {/* SIDEBAR */}
      <div className="lg:col-span-3">
        <div className="bg-white border border-slate-300 rounded shadow-sm flex flex-col min-h-[700px]">
          <div className="flex justify-between items-center border-b border-slate-300 bg-slate-200 p-3">
            <span className="font-bold text-slate-800 uppercase text-[11px] block">
              📥 Fila de Análise ({fila.length})
            </span>
            <button onClick={() => buscarFilaSupabase(true)} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold cursor-pointer">🔄 Atualizar</button>
          </div>
          
          <div className="space-y-1 overflow-y-auto max-h-[600px] p-2">
            <div onClick={() => { setIdSelecionado(null); setAnalise(DADOS_MODELO); }} className={`p-2 border cursor-pointer transition-all ${idSelecionado === null ? "bg-blue-50 border-blue-400 border-l-4" : "bg-white border-slate-200 hover:bg-slate-100"}`}>
              <p className="text-[11px] font-bold text-blue-700 uppercase">⭐ TEMPLATE MODELO</p>
            </div>
            {loadingFila ? (
              <div className="text-center py-6 text-slate-400 font-mono text-[11px]">Sincronizando...</div>
            ) : fila.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[11px] font-bold">Fila vazia.</div>
            ) : (
              fila.map((item) => (
                <div key={item.id} onClick={() => selecionarEmpresaDaEsteira(item.id)} className={`p-2 border cursor-pointer transition-all ${idSelecionado === item.id ? "bg-blue-600 border-blue-700 text-white shadow-md border-l-4 border-l-blue-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <p className={`text-[11px] font-bold uppercase truncate ${idSelecionado === item.id ? "text-white" : "text-slate-800"}`}>{item.razao_social}</p>
                  <p className={`text-[10px] font-mono mt-0.5 ${idSelecionado === item.id ? "text-blue-200" : "text-slate-500"}`}>{item.cnpj}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WORKSPACE ESTILO PLANILHA */}
      <div className="lg:col-span-9 space-y-4">
        {loadingAnalise ? (
          <div className="bg-white border border-slate-300 rounded shadow-sm min-h-[650px] flex flex-col items-center justify-center">
            <span className="animate-spin text-2xl block text-blue-500">⏳</span>
            <p className="text-xs font-bold uppercase text-slate-500 mt-4">Carregando Matriz...</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-300 shadow-sm overflow-hidden flex flex-col">
            
            {/* TOOLBAR EXCEL */}
            <div className="p-3 border-b border-slate-300 bg-[#f8fafc] flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border ${idSelecionado ? "bg-green-100 text-green-800 border-green-300" : "bg-slate-200 text-slate-600 border-slate-300"}`}>
                  {idSelecionado ? `Editando Banco de Dados` : "Modo Espelho (Template)"}
                </span>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight mt-1">{analise.razao_social}</h2>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">CNPJ: {analise.cnpj} | {analise.cidade}/{analise.uf}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => persistirNoBanco(true)} disabled={processandoDecisao} className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 text-[11px] uppercase shadow-sm cursor-pointer transition-all">
                  💾 Salvar
                </button>
                {idSelecionado && (
                  <>
                    <button onClick={encaminharParaComite} disabled={processandoDecisao} className="bg-blue-600 hover:bg-blue-700 border border-blue-800 text-white font-bold px-3 py-1.5 text-[11px] uppercase cursor-pointer shadow-sm transition-all flex items-center gap-1">
                      🚀 Enviar p/ Comitê
                    </button>
                    <button onClick={devolverParaComercialPendente} disabled={processandoDecisao} className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold px-3 py-1.5 text-[11px] uppercase cursor-pointer transition-all">
                      🚨 Devolver
                    </button>
                    
                    {/* BOTÃO DO GERADOR HTML AQUI */}
                    <GerarAnalise analise={analise} />
                  </>
                )}
              </div>
            </div>

            {/* ENGINE DE ABAS EXCEL */}
            <div className="bg-[#e2e8f0] border-b border-slate-400 px-1 pt-1 flex flex-wrap gap-0.5 overflow-x-auto">
              {[
                { id: "proposta", label: "Capa & Proposta" },
                { id: "estrutura", label: "Societário & Organograma" },
                { id: "fat", label: "Faturamento & Potencial" },
                { id: "endividamento", label: "Endividamento & Referências" },
                { id: "restritivos", label: "Restritivos & Jurídico" },
                { id: "parecer", label: "Parecer & Visitas" }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setAbaAtiva(tab.id)} className={`px-4 py-1.5 font-bold uppercase text-[10px] border border-b-0 transition-all cursor-pointer ${abaAtiva === tab.id ? "bg-white text-blue-700 border-slate-400 border-t-2 border-t-blue-600 shadow-[0_2px_0_white] z-10" : "bg-[#f1f5f9] border-[#cbd5e1] text-slate-600 hover:bg-slate-200"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ÁREA DE TRABALHO DA PLANILHA */}
            <div className="p-4 bg-white min-h-[500px]">
              
              {/* ========================================================= */}
              {/* ABA 1: CAPA E PROPOSTA */}
              {/* ========================================================= */}
              {abaAtiva === "proposta" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="bg-blue-800 text-white text-[10px] font-bold uppercase p-1.5 border border-blue-900">1. Condições da Proposta</div>
                    <table className="w-full border-collapse border border-[#cbd5e1]">
                      <tbody>
                        <tr><td className={`${thStyle} w-1/3 text-right`}>Analista</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.analista || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, analista: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Gerente / Hub</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.gerente || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, gerente: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Modalidade</td><td className={tdStyle}><input type="text" value={analise.proposta.modalidade} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, modalidade: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right bg-blue-50`}>Limite (R$)</td><td className={`${tdStyle} bg-blue-50`}><input type="number" value={analise.proposta.limite} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, limite: Number(e.target.value) } })} className={`${numStyle} text-blue-700 font-bold`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Prazo (Dias)</td><td className={tdStyle}><input type="number" value={analise.proposta.prazo} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, prazo: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Taxa (%)</td><td className={tdStyle}><input type="number" step="0.001" value={analise.proposta.taxa} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, taxa: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Garantia</td><td className={tdStyle}><input type="text" value={analise.proposta.garantia} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, garantia: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right bg-yellow-100`}>Rating V8</td>
                          <td className={tdStyle}>
                            <select value={analise.proposta.rating} onChange={(e) => setAnalise({ ...analise, proposta: { ...analise.proposta, rating: e.target.value } })} className={`${cellStyle} font-bold text-yellow-800 bg-yellow-50`}>
                              <option value="A">Rating A</option><option value="B">Rating B</option><option value="C">Rating C</option><option value="D">Rating D</option>
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">2. Dados da Empresa</div>
                    <table className="w-full border-collapse border border-[#cbd5e1]">
                      <tbody>
                        <tr><td className={`${thStyle} w-1/3 text-right`}>Fundação</td><td className={tdStyle}><input type="date" value={analise.dados_gerais.fundacao || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, fundacao: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Capital (R$)</td><td className={tdStyle}><input type="number" value={analise.capital_social} onChange={(e) => setAnalise({ ...analise, capital_social: Number(e.target.value) })} className={numStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Atividade</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.ramo || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, ramo: e.target.value } })} className={`${cellStyle} uppercase`} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Unidades</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.unidades || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, unidades: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Site/URL</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.site || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, site: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Licenças</td><td className={tdStyle}><input type="text" value={analise.dados_gerais.licencas || ""} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, licencas: e.target.value } })} className={cellStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Bal. Auditado</td>
                          <td className={tdStyle}>
                            <select value={analise.dados_gerais.balanco_auditado || "Não"} onChange={(e) => setAnalise({ ...analise, dados_gerais: { ...analise.dados_gerais, balanco_auditado: e.target.value } })} className={cellStyle}><option value="Não">Não</option><option value="Sim">Sim</option></select>
                          </td>
                        </tr>
                        <tr><td className={`${thStyle} text-right`}>Consultoria</td>
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
              {/* ABA 2: SOCIETÁRIO E ORGANOGRAMA */}
              {/* ========================================================= */}
              {abaAtiva === "estrutura" && (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">
                      <span>3. Estrutura Societária e Patrimônio Informado</span>
                      <button onClick={addSocio} className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded text-[9px] border border-slate-500">+ Linha</button>
                    </div>
                    <div className="overflow-x-auto border border-t-0 border-[#cbd5e1]">
                      <table className="w-full text-left border-collapse min-w-[1000px] bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>Sócio / Avalista</th>
                            <th className={`${thStyle} w-16`}>%</th>
                            <th className={`${thStyle} w-20`}>Assina?</th>
                            <th className={`${thStyle} w-24`}>Regra</th>
                            <th className={`${thStyle} w-16`}>Aval</th>
                            <th className={thStyle}>Descrição de Bens (PJ/PF)</th>
                            <th className={`${thStyle} w-32`}>Valor Bens (R$)</th>
                            <th className={`${thStyle} w-10`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_estrutura_societaria.map((s, idx) => (
                            <tr key={idx}>
                              <td className={tdStyle}><input type="text" value={s.s_nome} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].s_nome = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} font-bold uppercase`} /></td>
                              <td className={tdStyle}><input type="number" value={s.s_perc} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].s_perc = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={numStyle} /></td>
                              <td className={`${tdStyle} text-center`}><input type="checkbox" checked={s.figura_contrato} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].figura_contrato = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className="cursor-pointer h-3 w-3" /></td>
                              <td className={tdStyle}>
                                <select value={s.assinatura || "Isolada"} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].assinatura = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${cellStyle} text-center`}>
                                  <option value="Isolada">Isolada</option><option value="Conjunta">Conjunta</option>
                                </select>
                              </td>
                              <td className={`${tdStyle} text-center`}><input type="checkbox" checked={s.s_aval} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].s_aval = e.target.checked; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className="cursor-pointer h-3 w-3" /></td>
                              <td className={tdStyle}><input type="text" value={s.b_bens} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].b_bens = e.target.value; setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={cellStyle} /></td>
                              <td className={tdStyle}><input type="number" value={s.b_valor} onChange={(e) => { const a = [...analise.dados_estrutura_societaria]; a[idx].b_valor = Number(e.target.value); setAnalise({ ...analise, dados_estrutura_societaria: a }); }} className={`${numStyle} text-green-700 font-bold`} /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmSocio(idx)} className="text-red-500 font-bold px-2 py-0.5 hover:bg-red-50 text-[10px]">X</button></td>
                            </tr>
                          ))}
                          <tr className="bg-slate-200 border-t-2 border-slate-400">
                            <td colSpan={6} className="p-1.5 text-right font-bold uppercase text-[10px] text-slate-800">Total Patrimônio Avaliado</td>
                            <td className="p-1.5 text-right font-mono font-bold text-green-700 text-[11px]">R$ {totPatrimonio.toLocaleString("pt-BR")}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ORGANOGRAMA E ANEXOS */}
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">4. Anexos e Organograma (Links de Imagem)</div>
                    <table className="w-full border-collapse border border-[#cbd5e1]">
                      <tbody>
                        <tr><td className={`${thStyle} w-1/4 text-right`}>URL Organograma</td><td className={tdStyle}><input type="text" value={analise.anexos?.organograma_url || ""} onChange={(e) => setAnalise({ ...analise, anexos: { ...analise.anexos, organograma_url: e.target.value } })} className={cellStyle} placeholder="Cole o link da imagem..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Fachada</td><td className={tdStyle}><input type="text" value={analise.anexos?.fachada_url || ""} onChange={(e) => setAnalise({ ...analise, anexos: { ...analise.anexos, fachada_url: e.target.value } })} className={cellStyle} placeholder="Cole o link da imagem..." /></td></tr>
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
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">5. Faturamento Bruto Consolidado</div>
                    <div className="overflow-x-auto border border-t-0 border-[#cbd5e1]">
                      <table className="w-full border-collapse text-left min-w-[800px] bg-white">
                        <thead>
                          <tr>
                            <th className={`${thStyle} w-32 text-left`}>Mês</th>
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
                                <td className={`${tdStyle} bg-slate-100 font-bold uppercase text-[10px] text-slate-700 pl-2`}>{mes.substring(0,3)}</td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2024"]?.[mes] || ""} onChange={(e) => handleFat("2024", mes, e.target.value)} className={numStyle} /></td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2025"]?.[mes] || ""} onChange={(e) => handleFat("2025", mes, e.target.value)} className={numStyle} /></td>
                                <td className={`${tdStyle} text-center font-bold text-[11px] bg-slate-50 ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>{delta === 0 ? "-" : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}</td>
                                <td className={`${tdStyle} bg-blue-50`}><input type="number" value={analise.dados_faturamento["2026"]?.[mes] || ""} onChange={(e) => handleFat("2026", mes, e.target.value)} className={`${numStyle} text-blue-800 font-bold`} /></td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-200 border-t-2 border-slate-400 font-bold text-[11px]">
                            <td className="p-1.5 border border-[#cbd5e1] text-slate-800">SOMA TOTAL</td>
                            <td className="p-1.5 border border-[#cbd5e1] text-right font-mono">{calcTotAno("2024").toLocaleString("pt-BR")}</td>
                            <td className="p-1.5 border border-[#cbd5e1] text-right font-mono">{calcTotAno("2025").toLocaleString("pt-BR")}</td>
                            <td className="p-1.5 border border-[#cbd5e1] text-center text-blue-700">{(((calcTotAno("2025") - calcTotAno("2024")) / (calcTotAno("2024") || 1)) * 100).toFixed(1)}%</td>
                            <td className="p-1.5 border border-[#cbd5e1] text-right font-mono text-blue-800">{calcTotAno("2026").toLocaleString("pt-BR")}</td>
                          </tr>
                          <tr className="bg-slate-300 border-t border-slate-400 font-bold text-[11px]">
                            <td className="p-1.5 border border-[#cbd5e1] text-slate-800">MÉDIA MENSAL</td>
                            <td className="p-1.5 border border-[#cbd5e1] text-right font-mono">{calcMedia("2024").toLocaleString("pt-BR")}</td>
                            <td className="p-1.5 border border-[#cbd5e1] text-right font-mono">{calcMedia("2025").toLocaleString("pt-BR")}</td>
                            <td className="p-1.5 border border-[#cbd5e1]"></td>
                            <td className="p-1.5 border border-[#cbd5e1] text-right font-mono text-blue-900">{calcMedia("2026").toLocaleString("pt-BR")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">6. Parâmetros de Potencial e Rotação</div>
                    <table className="w-full border-collapse border border-[#cbd5e1]">
                      <tbody>
                        <tr><td className={`${thStyle} text-right w-1/4`}>Ticket Médio (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, ticket_medio: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.prazo_medio_vendas} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, prazo_medio_vendas: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>% Vendas a Prazo</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.vendas_prazo_perc} onChange={(e) => setAnalise({ ...analise, dados_potencial: { ...analise.dados_potencial, vendas_prazo_perc: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr>
                          <td className={`${thStyle} text-right bg-green-100 text-green-800`}>Potencial Estimado (R$)</td>
                          <td className={`${tdStyle} bg-green-50 p-2 text-right font-mono font-black text-green-700 text-sm`}>{(fatMedioAtual * 2.5).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 4: ENDIVIDAMENTO E REFERÊNCIAS */}
              {/* ========================================================= */}
              {abaAtiva === "endividamento" && (
                <div className="space-y-6">
                  
                  {/* RESUMO ENDIVIDAMENTO GERAL */}
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">7. Endividamento Geral Consolidado (Curto x Longo Prazo)</div>
                    <table className="w-full border-collapse border border-[#cbd5e1]">
                      <tbody>
                        <tr><td className={`${thStyle} text-right w-1/4`}>Curto Prazo (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_endividamento_resumo?.curto_prazo || 0} onChange={(e) => setAnalise({ ...analise, dados_endividamento_resumo: { ...analise.dados_endividamento_resumo, curto_prazo: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>Longo Prazo (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_endividamento_resumo?.longo_prazo || 0} onChange={(e) => setAnalise({ ...analise, dados_endividamento_resumo: { ...analise.dados_endividamento_resumo, longo_prazo: Number(e.target.value) } })} className={numStyle} /></td></tr>
                        <tr>
                          <td className={`${thStyle} text-right bg-red-50 text-red-800`}>Total (Geral + Detalhado)</td>
                          <td className={`${tdStyle} bg-red-50 p-1.5 text-right font-mono font-bold text-red-700 text-[11px]`}>R$ {totBancos.toLocaleString("pt-BR")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* INSTITUIÇÕES / SCR DETALHADO */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">
                      <span>8. Detalhamento SCR e Instituições (Bancos Tradicionais)</span>
                      <button onClick={addBanco} className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded text-[9px] border border-slate-500">+ Linha</button>
                    </div>
                    <div className="overflow-x-auto border border-t-0 border-[#cbd5e1]">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>Instituição Financeira</th>
                            <th className={thStyle}>Modalidade do Risco</th>
                            <th className={`${thStyle} w-44 text-right`}>Saldo Devedor (R$)</th>
                            <th className={`${thStyle} w-8`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_endividamento.map((div, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input type="text" value={div.instituicao} onChange={(e) => { const a = [...analise.dados_endividamento]; a[i].instituicao = e.target.value; setAnalise({ ...analise, dados_endividamento: a }); }} className={`${cellStyle} uppercase font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={div.modalidade} onChange={(e) => { const a = [...analise.dados_endividamento]; a[i].modalidade = e.target.value; setAnalise({ ...analise, dados_endividamento: a }); }} className={cellStyle} /></td>
                              <td className={tdStyle}><input type="number" value={div.saldo} onChange={(e) => { const a = [...analise.dados_endividamento]; a[i].saldo = Number(e.target.value); setAnalise({ ...analise, dados_endividamento: a }); }} className={`${numStyle} text-red-700 font-bold`} /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmBanco(i)} className="text-red-500 font-bold px-1 py-0.5 hover:bg-red-50 text-[10px]">X</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FUNDOS FIDC E REFERENCIAS */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">
                      <span>9. Referências de Mercado (Fundos e Securitizadoras)</span>
                      <button onClick={addFundo} className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded text-[9px] border border-slate-500">+ Linha</button>
                    </div>
                    <div className="overflow-x-auto border border-t-0 border-[#cbd5e1]">
                      <table className="w-full text-left border-collapse min-w-[900px] bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>Fundo / Parceiro</th>
                            <th className={`${thStyle} w-20`}>RNX</th>
                            <th className={`${thStyle} w-20`}>Desde</th>
                            <th className={`${thStyle} w-28 text-right`}>Limite (R$)</th>
                            <th className={`${thStyle} w-28 text-right`}>Risco (R$)</th>
                            <th className={thStyle}>Comportamento / Observação</th>
                            <th className={`${thStyle} w-8`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_referencias.map((ref, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input type="text" value={ref.fundo} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].fundo = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} font-bold uppercase`} /></td>
                              <td className={tdStyle}><input type="text" value={ref.rnx} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].rnx = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} text-center uppercase`} /></td>
                              <td className={tdStyle}><input type="text" value={ref.cliente_desde} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].cliente_desde = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={`${cellStyle} text-center`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.limite_global} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].limite_global = Number(e.target.value); setAnalise({ ...analise, dados_referencias: a }); }} className={`${numStyle} text-blue-700 font-bold`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.risco_total} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].risco_total = Number(e.target.value); setAnalise({ ...analise, dados_referencias: a }); }} className={`${numStyle} text-red-700 font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={ref.obs} onChange={(e) => { const a = [...analise.dados_referencias]; a[i].obs = e.target.value; setAnalise({ ...analise, dados_referencias: a }); }} className={cellStyle} /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmFundo(i)} className="text-red-500 font-bold px-1 py-0.5 hover:bg-red-50 text-[10px]">X</button></td>
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
                <div className="space-y-6">
                  {/* RESTRITIVOS FINANCEIROS */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">
                      <span>10. Registros Restritivos (Pefin, Protestos, etc)</span>
                      <button onClick={addRest} className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded text-[9px] border border-slate-500">+ Linha</button>
                    </div>
                    <div className="overflow-x-auto border border-t-0 border-[#cbd5e1]">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr>
                            <th className={thStyle}>CNPJ/CPF Ofensor</th>
                            <th className={thStyle}>Natureza</th>
                            <th className={`${thStyle} w-16 text-center`}>Qtd</th>
                            <th className={`${thStyle} w-32 text-right`}>Valor (R$)</th>
                            <th className={thStyle}>Órgão / Observação</th>
                            <th className={`${thStyle} w-8`}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.dados_restritivos.map((rest, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input type="text" value={rest.origem || ""} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].origem = e.target.value; setAnalise({ ...analise, dados_restritivos: a }); }} className={`${cellStyle} uppercase font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={rest.tipo} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].tipo = e.target.value; setAnalise({ ...analise, dados_restritivos: a }); }} className={`${cellStyle} text-yellow-700 font-bold uppercase`} /></td>
                              <td className={tdStyle}><input type="number" value={rest.qtd} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].qtd = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: a }); }} className={`${numStyle} text-center`} /></td>
                              <td className={tdStyle}><input type="number" value={rest.valor} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].valor = Number(e.target.value); setAnalise({ ...analise, dados_restritivos: a }); }} className={`${numStyle} text-red-600 font-bold`} /></td>
                              <td className={tdStyle}><input type="text" value={rest.obs} onChange={(e) => { const a = [...analise.dados_restritivos]; a[i].obs = e.target.value; setAnalise({ ...analise, dados_restritivos: a }); }} className={cellStyle} /></td>
                              <td className={`${tdStyle} text-center`}><button onClick={() => rmRest(i)} className="text-red-500 font-bold px-1 py-0.5 hover:bg-red-50 text-[10px]">X</button></td>
                            </tr>
                          ))}
                          <tr className="bg-slate-200 border-t-2 border-slate-400">
                            <td colSpan={3} className="p-1.5 text-right font-bold uppercase text-[10px] text-slate-800">Total Exposto</td>
                            <td className="p-1.5 text-right font-mono font-bold text-red-700 text-[11px]">R$ {totRest.toLocaleString("pt-BR")}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* JURIDICO E NOTICIAS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="bg-red-800 text-white text-[10px] font-bold uppercase p-1.5 border border-red-900">11. Processos em Tramitação (Ativos)</div>
                      <textarea value={analise.dados_qualitativos?.processos_tramitacao || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, processos_tramitacao: e.target.value } })} className="w-full h-32 p-2 bg-white border border-[#cbd5e1] border-t-0 text-[11px] outline-none resize-none font-sans" />
                    </div>
                    <div>
                      <div className="bg-green-800 text-white text-[10px] font-bold uppercase p-1.5 border border-green-900">12. Processos Arquivados / Extintos</div>
                      <textarea value={analise.dados_qualitativos?.processos_arquivados || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, processos_arquivados: e.target.value } })} className="w-full h-32 p-2 bg-white border border-[#cbd5e1] border-t-0 text-[11px] outline-none resize-none font-sans" />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">13. Pesquisa Reputacional (Notícias, Mídia, Reclame Aqui)</div>
                      <textarea value={analise.dados_qualitativos?.noticias_midia || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, noticias_midia: e.target.value } })} className="w-full h-20 p-2 bg-white border border-[#cbd5e1] border-t-0 text-[11px] outline-none resize-none font-sans" />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 6: PARECER FINAL E VISITAS */}
              {/* ========================================================= */}
              {abaAtiva === "parecer" && (
                <div className="space-y-6">
                  
                  {/* RECOMENDAÇÃO DO ANALISTA */}
                  <div className="bg-white border-2 border-blue-400 p-4 shadow-sm">
                    <h3 className="text-[11px] font-bold text-blue-900 uppercase tracking-widest mb-3 border-b border-blue-200 pb-1">14. Veredito e Parecer Técnico</h3>
                    
                    <div className="mb-4">
                      <select 
                        value={analise.recomendacao_analista || ""} 
                        onChange={(e) => setAnalise({...analise, recomendacao_analista: e.target.value})} 
                        className="w-full p-2 border-2 border-blue-300 font-bold text-blue-900 bg-blue-50 outline-none text-sm cursor-pointer"
                      >
                        <option value="Aprovação Integral">APROVAÇÃO INTEGRAL</option>
                        <option value="Aprovação com Condicionantes">APROVAÇÃO COM CONDICIONANTES</option>
                        <option value="Reprovação">REPROVAÇÃO TÉCNICA (FORA DO PERFIL)</option>
                      </select>
                    </div>

                    <div>
                      <textarea 
                        value={analise.parecer_comite || ""} 
                        onChange={(e) => setAnalise({...analise, parecer_comite: e.target.value})}
                        className="w-full p-3 border border-[#cbd5e1] h-64 font-sans text-[12px] outline-none resize-none leading-relaxed text-slate-800 bg-[#f8fafc]"
                        placeholder="Escreva a justificativa da sua análise aqui..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">15. Relatório de Visitas In-loco</div>
                      <textarea value={analise.dados_qualitativos?.relatorio_visita || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, relatorio_visita: e.target.value } })} className="w-full h-32 p-2 bg-white border border-[#cbd5e1] border-t-0 text-[11px] outline-none resize-none font-sans" />
                    </div>
                    <div>
                      <div className="bg-slate-900 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-950">16. Parecer Diretoria / Comitê Final</div>
                      <textarea value={analise.dados_qualitativos?.parecer_diretor || ""} onChange={(e) => setAnalise({ ...analise, dados_qualitativos: { ...analise.dados_qualitativos, parecer_diretor: e.target.value } })} className="w-full h-32 p-2 bg-slate-100 border border-[#cbd5e1] border-t-0 text-[11px] outline-none resize-none font-sans" />
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
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-xs text-blue-500 animate-pulse">⚡ Inicializando Motor Excel V8...</div>}>
        <MesaAnaliseConteudo />
      </Suspense>
    </div>
  );
}