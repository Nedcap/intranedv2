"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import GerarAnalise from "@/components/gerar-analise";

// =========================================================================
// INTERFACES (ESPELHO DO NOVO EXCEL)
// =========================================================================
interface FilaItem {
  id: string;
  razao_social: string;
  cnpj: string;
  status: string;
}

interface PropostaItem {
  modalidade: string;
  limite: number;
  prazo: string;
  tranche: number;
  taxa: string;
  garantia: string;
}

interface EmpresaItem {
  empresa: string;
  cnpj: string;
  fundacao: string;
  idade: string;
}

interface SocioItem {
  nome: string;
  perc: number;
  funcao: string;
  figura_contrato: string;
}

interface PatrimonioItem {
  socio: string;
  descricao: string;
  valor: number;
}

interface FaturamentoMes {
  [mes: string]: number;
}

interface EndividamentoItem {
  instituicao: string;
  modalidade: string;
  risco_perc: number;
  saldo: number;
  liq_perc: number;
  vop: string;
}

interface ReferenciaItem {
  instituicao: string;
  rnx: string;
  cliente_desde: string;
  ultima_operacao: string;
  limite_global: number;
  risco_total: number;
  risco_1: number;
  operacao_1: string;
  vcto_1: string;
  risco_2: number;
  operacao_2: string;
  vcto_2: string;
  liquidez_5_dias: string;
  liquidez_pontual: string;
  atraso_5_dias: string;
  atraso_15_dias: string;
  recompra: string;
  concentracao: number;
}

interface RestritivoItem {
  empresa_socio: string; 
  restritivo: string;
  qtd: number;
  valor: number;
  data: string;
  observacao: string;
}

interface AnaliseData {
  id: string | null;
  cnpj: string; 
  razao_social: string; 
  status?: string;

  // CAPA / DADOS EMPRESA
  data_analise: string;
  relacionamento: string;
  analista: string;
  gerente: string;
  rating: string;
  
  fundacao: string;
  capital_social: number;
  localizacao: string;
  ramo: string;
  licencas: string;
  balanco_auditado: string;
  consultoria_gestao: string;
  site: string;

  propostas: PropostaItem[];
  empresas_grupo: EmpresaItem[];
  
  // SOCIETÁRIO E PATRIMÔNIO
  socios: SocioItem[];
  regra_assinatura: string;
  aval_societario: string;
  patrimonios: PatrimonioItem[];
  
  // FATURAMENTO E POTENCIAL
  dados_faturamento: Record<string, FaturamentoMes>;
  dados_potencial: { 
    ticket_medio: number; prazo_medio_dpls: string; prazo_medio_comissaria: string; 
    forma_recebimento_vista: number; forma_recebimento_prazo: number; 
    composicao_dpls: number; composicao_comissaria: number; potencial_estimado: number; 
  };
  
  // ENDIVIDAMENTO E REFERÊNCIAS
  endividamento_resumo: { curto_prazo: number; longo_prazo: number; dpls_curto_perc: number; fundos_perc: number; bancos_perc: number; renegociando: string };
  endividamento_detalhado: EndividamentoItem[];
  referencias: ReferenciaItem[];
  
  // RESTRITIVOS E JURÍDICO
  restritivos_quadro: { pefin: number; refin: number; protesto: number; div_vencida: number; acao_judicial: number; cheque_sem_fundo: number };
  restritivos: RestritivoItem[];
  
  // TEXTOS, JURÍDICO E MÍDIA
  resumo_visita: string;
  juridico_tramitacao: string;
  juridico_ia: string;
  noticias_midia: string;
  parecer_analista: string;
  parecer_diretor: string;

  anexos: { organograma_url: string; fachada_url: string; satelite_url: string; fotos_visita_url: string };

  recomendacao_analista?: string;
  [key: string]: any; // Permissivo para novos campos dinâmicos
}

const DADOS_MODELO: AnaliseData = {
  id: null, cnpj: "00.000.000/0001-00", razao_social: "EMPRESA MODELO LTDA",
  data_analise: new Date().toISOString().split("T")[0], 
  relacionamento: "Prospect", analista: "Alyson", gerente: "Luiz", rating: "B - Risco médio", 
  
  fundacao: "", capital_social: 0, localizacao: "", ramo: "", licencas: "Não Informado", balanco_auditado: "Não", consultoria_gestao: "Não", site: "",

  propostas: [{ modalidade: "Desconto", limite: 0, prazo: "", tranche: 0, taxa: "", garantia: "" }],
  empresas_grupo: [],
  
  socios: [{ nome: "", perc: 100, funcao: "Sócio", figura_contrato: "Sim" }],
  regra_assinatura: "( ) em conjunto (x) isolada", aval_societario: "", patrimonios: [],
  
  dados_faturamento: { "2024": {}, "2025": {}, "2026": {} }, 
  dados_potencial: { ticket_medio: 0, prazo_medio_dpls: "45 dias", prazo_medio_comissaria: "45 dias", forma_recebimento_vista: 10, forma_recebimento_prazo: 90, composicao_dpls: 70, composicao_comissaria: 30, potencial_estimado: 0 },
  
  endividamento_resumo: { curto_prazo: 0, longo_prazo: 0, dpls_curto_perc: 0, fundos_perc: 0, bancos_perc: 0, renegociando: "Não" },
  endividamento_detalhado: [], referencias: [],
  
  restritivos_quadro: { pefin: 0, refin: 0, protesto: 0, div_vencida: 0, acao_judicial: 0, cheque_sem_fundo: 0 },
  restritivos: [],
  
  resumo_visita: "", juridico_tramitacao: "", juridico_ia: "", noticias_midia: "", parecer_analista: "", parecer_diretor: "", recomendacao_analista: "",
  anexos: { organograma_url: "", fachada_url: "", satelite_url: "", fotos_visita_url: "" }
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function MesaAnalisePage() {
  return (
    <div className="font-sans antialiased text-slate-800">
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-xs text-indigo-500 animate-pulse">⚡ Inicializando Motor Excel V8...</div>}>
        <MesaAnaliseConteudo />
      </Suspense>
    </div>
  );
}

function MesaAnaliseConteudo() {
  const searchParams = useSearchParams();
  const idDaUrl = searchParams.get("id");

  const [fila, setFila] = useState<FilaItem[]>([]);
  const [analise, setAnalise] = useState<AnaliseData>(DADOS_MODELO);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  
  const [abaAtiva, setAbaAtiva] = useState("capa");
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
      const { data, error } = await supabase.from("analises_credito").select("id, razao_social, cnpj, status").eq("status", "em_revisao_humana").order("created_at", { ascending: false });
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
        if (data.status === "robo_processando") await supabase.from("analises_credito").update({ status: "em_revisao_humana" }).eq("id", id);
        
        // Merge profundo para não perder sub-objetos vazios
        setAnalise({ ...DADOS_MODELO, ...dc, anexos: { ...DADOS_MODELO.anexos, ...(dc.anexos || {}) }, dados_potencial: { ...DADOS_MODELO.dados_potencial, ...(dc.dados_potencial || {}) }, id: data.id, cnpj: data.cnpj, razao_social: data.razao_social, status: "em_revisao_humana" });
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
    if (!analise.recomendacao_analista || !analise.parecer_analista.trim()) {
      alert("⚠️ É obrigatório preencher o Parecer Técnico e escolher uma Recomendação antes de enviar ao comitê.");
      return;
    }
    const confirmacao = window.confirm(`Encaminhar para o Comitê de Crédito com parecer de: [${analise.recomendacao_analista.toUpperCase()}]?`);
    if (!confirmacao) return;

    try {
      setProcessandoDecisao(true);
      await persistirNoBanco(false); 
      const { error } = await supabase.from("analises_credito").update({ status: "concluido" }).eq("id", analise.id);
      if (error) throw error;
      alert(`🚀 Análise enviada com sucesso! Ela saiu da sua fila e o Motor Python já pode gerar o Relatório HTML.`);
      setIdSelecionado(null); setAnalise(DADOS_MODELO); await buscarFilaSupabase(true);
    } catch (err: any) { alert("Erro ao processar: " + err.message); } finally { setProcessandoDecisao(false); }
  };

  const devolverParaComercialPendente = async () => {
    if (!idSelecionado || !analise.id) return;
    const justificativa = prompt("Motivo da devolução para o Comercial:");
    if (!justificativa?.trim()) return; 
    try {
      setProcessandoDecisao(true);
      const { id, cnpj, razao_social, status, ...dadosParaCompactar } = analise;
      dadosParaCompactar.parecer_analista = `🚨 DEVOLVIDO:\nMotivo: ${justificativa}\n\n` + (dadosParaCompactar.parecer_analista || "");
      const { error } = await supabase.from("analises_credito").update({ status: "devolvido", dados_consolidados: dadosParaCompactar }).eq("id", analise.id);
      if (error) throw error;
      alert("📥 Empresa devolvida para a tela do Comercial!");
      setIdSelecionado(null); setAnalise(DADOS_MODELO); await buscarFilaSupabase(true);
    } catch (err: any) { alert("❌ Falha na devolução."); } finally { setProcessandoDecisao(false); }
  };

  // GERENCIAMENTO DE LINHAS GENÉRICO (Permissivo para qualquer nova tabela)
  const updateArray = (campo: keyof AnaliseData, index: number, subCampo: string, valor: any) => {
    const novoArray = [...(analise[campo] as any[])];
    novoArray[index][subCampo] = valor;
    setAnalise({ ...analise, [campo]: novoArray });
  };
  const addArray = (campo: keyof AnaliseData, obj: any) => setAnalise({ ...analise, [campo]: [...(analise[campo] as any[]), obj] });
  const rmArray = (campo: keyof AnaliseData, index: number) => setAnalise({ ...analise, [campo]: (analise[campo] as any[]).filter((_, i) => i !== index) });
  const updateNested = (campoPai: keyof AnaliseData, campoFilho: string, valor: any) => {
    setAnalise({ ...analise, [campoPai]: { ...(analise[campoPai] as any), [campoFilho]: valor } });
  };

  // CÁLCULOS
  const handleFat = (ano: string, mes: string, val: string) => {
    const fatAtual = { ...analise.dados_faturamento };
    if (!fatAtual[ano]) fatAtual[ano] = {};
    fatAtual[ano][mes] = Number(val || 0);
    setAnalise({ ...analise, dados_faturamento: fatAtual });
  };

  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const calcTotAno = (ano: string) => meses.reduce((acc, m) => acc + Number(analise.dados_faturamento[ano]?.[m] || 0), 0);
  const mesesPreenchidos = (ano: string) => meses.filter(m => analise.dados_faturamento[ano]?.[m] > 0).length;
  const calcMedia = (ano: string) => { const pre = mesesPreenchidos(ano); return pre === 0 ? 0 : calcTotAno(ano) / 12; }; 
  const calcMediaYTD = (ano: string, mesesCount: number) => { 
    if(mesesCount === 0) return 0;
    const totYTD = meses.slice(0, mesesCount).reduce((acc, m) => acc + Number(analise.dados_faturamento[ano]?.[m] || 0), 0);
    return totYTD / mesesCount;
  };
  const calcDelta = (m: string, aAt: string, aAnt: string) => { const at = Number(analise.dados_faturamento[aAt]?.[m] || 0); const ant = Number(analise.dados_faturamento[aAnt]?.[m] || 0); return !ant || ant === 0 ? 0 : ((at - ant) / ant) * 100; };

  const mesesYTD2026 = mesesPreenchidos("2026");
  const totLimites = analise.propostas.reduce((acc, p) => acc + Number(p.limite), 0);
  const totPatrimonio = analise.patrimonios.reduce((acc, p) => acc + Number(p.valor), 0);
  const totBancosDet = analise.endividamento_detalhado.reduce((acc, d) => acc + Number(d.saldo), 0);
  const totRestritivos = analise.restritivos.reduce((acc, r) => acc + Number(r.valor), 0);

  // CLASSES CSS (Padrão Excel)
  const cellStyle = "w-full h-full py-1 px-1.5 bg-transparent outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 font-sans text-[11px] transition-all";
  const numStyle = "w-full h-full py-1 px-1.5 bg-transparent outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-blue-500 font-mono text-[11px] text-right transition-all";
  const thStyle = "p-1.5 bg-[#e2e8f0] border border-[#94a3b8] font-bold text-[10px] text-slate-800 text-center";
  const tdStyle = "border border-[#94a3b8] p-0 bg-white hover:bg-slate-50 relative focus-within:bg-blue-50/30 transition-colors h-7";

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start bg-[#cbd5e1] min-h-screen p-2 md:p-4">
      
      {/* SIDEBAR */}
      <div className="w-full lg:w-64 shrink-0 bg-white border border-slate-400 rounded-sm shadow-md flex flex-col h-[calc(100vh-2rem)] sticky top-4 z-20">
        <div className="flex justify-between items-center border-b border-slate-400 bg-slate-200 p-2">
          <span className="font-bold text-slate-800 text-[11px] block">ESTEIRA ({fila.length})</span>
          <button onClick={() => buscarFilaSupabase(true)} className="text-blue-700 hover:text-blue-900 text-[10px] font-bold cursor-pointer">Atualizar</button>
        </div>
        <div className="space-y-0.5 overflow-y-auto p-1 flex-1">
          <div onClick={() => { setIdSelecionado(null); setAnalise(DADOS_MODELO); }} className={`p-2 border cursor-pointer ${idSelecionado === null ? "bg-blue-100 border-blue-500" : "bg-white border-transparent hover:bg-slate-100"}`}>
            <p className="text-[10px] font-bold text-slate-800">📄 NOVO / TEMPLATE</p>
          </div>
          {loadingFila ? (
            <div className="text-center py-4 text-slate-500 text-[10px]">Sincronizando...</div>
          ) : (
            fila.map((item) => (
              <div key={item.id} onClick={() => selecionarEmpresaDaEsteira(item.id)} className={`p-2 border cursor-pointer border-b-slate-200 ${idSelecionado === item.id ? "bg-blue-600 border-blue-700 text-white" : "bg-white hover:bg-slate-100"}`}>
                <p className={`text-[10px] font-bold truncate ${idSelecionado === item.id ? "text-white" : "text-slate-800"}`}>{item.razao_social}</p>
                <p className={`text-[9px] font-mono mt-0.5 ${idSelecionado === item.id ? "text-blue-200" : "text-slate-500"}`}>{item.cnpj}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* WORKSPACE ESTILO PLANILHA */}
      <div className="flex-1 w-full bg-white border border-slate-400 shadow-md flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
        {loadingAnalise ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="animate-spin text-2xl block text-green-600">⌛</span>
            <p className="text-[11px] font-bold text-slate-600 mt-2">Carregando Planilha...</p>
          </div>
        ) : (
          <>
            {/* TOOLBAR EXCEL */}
            <div className="p-2 border-b border-slate-400 bg-[#f1f5f9] flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="bg-green-700 text-white px-2 py-1 text-[10px] font-bold rounded-sm">AUTO-SAVE</div>
                <div className="flex flex-col">
                  <input type="text" value={analise.razao_social} onChange={(e)=>setAnalise({...analise, razao_social: e.target.value})} className="font-bold text-slate-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-blue-400 w-96 uppercase" />
                  <input type="text" value={analise.cnpj} onChange={(e)=>setAnalise({...analise, cnpj: e.target.value})} className="font-mono text-[10px] text-slate-500 bg-transparent outline-none w-96" />
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <select value={analise.recomendacao_analista || ""} onChange={(e)=>setAnalise({...analise, recomendacao_analista: e.target.value})} className="bg-yellow-100 border border-yellow-400 text-yellow-900 font-bold px-2 py-1 text-[10px] outline-none">
                  <option value="">Status / Decisão...</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Reprovado">Reprovado</option>
                  <option value="Em Análise">Em Análise</option>
                </select>
                <button onClick={() => persistirNoBanco(true)} disabled={processandoDecisao} className="bg-slate-200 border border-slate-400 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1 text-[10px] shadow-sm cursor-pointer">
                  💾 Salvar
                </button>
                {idSelecionado && (
                  <>
                    <button onClick={encaminharParaComite} disabled={processandoDecisao} className="bg-blue-600 border border-blue-800 hover:bg-blue-700 text-white font-bold px-3 py-1 text-[10px] cursor-pointer shadow-sm">
                      ▶ Enviar Parecer
                    </button>
                    <button onClick={devolverParaComercialPendente} disabled={processandoDecisao} className="bg-red-100 border border-red-300 text-red-800 hover:bg-red-200 font-bold px-3 py-1 text-[10px] cursor-pointer shadow-sm">
                      ✖ Devolver
                    </button>
                    <GerarAnalise analise={analise} />
                  </>
                )}
              </div>
            </div>

            {/* ABAS */}
            <div className="bg-[#e2e8f0] border-b border-slate-400 flex gap-0.5 px-1 pt-1 overflow-x-auto">
              {[
                { id: "capa", label: "Capa & Proposta" },
                { id: "societario", label: "Empresas & Societário" },
                { id: "fat", label: "Faturamento & Potencial" },
                { id: "endividamento", label: "Endividamento & Refs" },
                { id: "restritivos", label: "Restritivos & Jurídico" },
                { id: "parecer", label: "Parecer & Anexos" }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setAbaAtiva(tab.id)} className={`px-4 py-1.5 font-bold text-[10px] border border-b-0 cursor-pointer whitespace-nowrap ${abaAtiva === tab.id ? "bg-white text-slate-900 border-slate-400 border-t-2 border-t-green-600 shadow-[0_1px_0_white] z-10" : "bg-[#cbd5e1] border-[#94a3b8] text-slate-600 hover:bg-slate-300"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ÁREA DE TRABALHO DA PLANILHA */}
            <div className="flex-1 overflow-y-auto p-4 bg-white relative">
              
              {/* ========================================================= */}
              {/* ABA 1: CAPA E PROPOSTA */}
              {/* ========================================================= */}
              {abaAtiva === "capa" && (
                <div className="max-w-6xl space-y-6">
                  {/* CABEÇALHO */}
                  <table className="w-full border-collapse border border-slate-400">
                    <tbody>
                      <tr>
                        <td className={`${thStyle} w-1/6 text-right`}>Empresa Principal</td><td className={`${tdStyle} w-2/6`}><input value={analise.razao_social} readOnly className={`${cellStyle} font-bold bg-slate-50`} /></td>
                        <td className={`${thStyle} w-1/6 text-right`}>CNPJ</td><td className={`${tdStyle} w-2/6`}><input value={analise.cnpj} readOnly className={`${cellStyle} font-mono bg-slate-50`} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Relacionamento</td>
                        <td className={tdStyle}>
                          <select value={analise.relacionamento} onChange={(e)=>setAnalise({...analise, relacionamento: e.target.value})} className={cellStyle}>
                            <option value="Prospect">Prospect</option><option value="Cliente">Cliente</option>
                          </select>
                        </td>
                        <td className={`${thStyle} text-right`}>Data Análise</td><td className={tdStyle}><input type="date" value={analise.data_analise} onChange={(e)=>setAnalise({...analise, data_analise: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Gerente Comercial</td><td className={tdStyle}><input value={analise.gerente} onChange={(e)=>setAnalise({...analise, gerente: e.target.value})} className={cellStyle} /></td>
                        <td className={`${thStyle} text-right`}>Analista</td><td className={tdStyle}><input value={analise.analista} onChange={(e)=>setAnalise({...analise, analista: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>RATING</td>
                        <td className={tdStyle}>
                          <select value={analise.rating} onChange={(e)=>setAnalise({...analise, rating: e.target.value})} className={`${cellStyle} font-bold text-yellow-700 bg-yellow-50`}>
                            <option value="A - Risco reduzido">A - Risco reduzido</option><option value="B - Risco médio">B - Risco médio</option><option value="C - Risco elevado">C - Risco elevado</option><option value="D - Fora do perfil">D - Fora do perfil</option>
                          </select>
                        </td>
                        <td className={`${thStyle} text-right`}>Fundação / Idade</td><td className={tdStyle}><input value={analise.fundacao} onChange={(e)=>setAnalise({...analise, fundacao: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Capital Social (R$)</td><td className={tdStyle}><input type="number" value={analise.capital_social} onChange={(e)=>setAnalise({...analise, capital_social: Number(e.target.value)})} className={numStyle} /></td>
                        <td className={`${thStyle} text-right`}>Localização / Matriz</td><td className={tdStyle}><input value={analise.localizacao} onChange={(e)=>setAnalise({...analise, localizacao: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Ramo de Atividade</td><td className={tdStyle}><input value={analise.ramo} onChange={(e)=>setAnalise({...analise, ramo: e.target.value})} className={cellStyle} /></td>
                        <td className={`${thStyle} text-right`}>Licenças/Certificações</td><td className={tdStyle}><input value={analise.licencas} onChange={(e)=>setAnalise({...analise, licencas: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Balanço Auditado?</td>
                        <td className={tdStyle}>
                          <select value={analise.balanco_auditado} onChange={(e)=>setAnalise({...analise, balanco_auditado: e.target.value})} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                        </td>
                        <td className={`${thStyle} text-right`}>Consultoria/Gestão?</td>
                        <td className={tdStyle}>
                          <select value={analise.consultoria_gestao} onChange={(e)=>setAnalise({...analise, consultoria_gestao: e.target.value})} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                        </td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Site da Empresa</td><td colSpan={3} className={tdStyle}><input value={analise.site} onChange={(e)=>setAnalise({...analise, site: e.target.value})} className={cellStyle} /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* PROPOSTAS */}
                  <div>
                    <div className="flex justify-between items-center bg-blue-800 text-white text-[11px] font-bold p-1.5 border border-blue-900">
                      <span>Proposta e Condições Comerciais</span>
                      <button onClick={() => addArray('propostas', {modalidade:"", limite:0, prazo:"", tranche:0, taxa:"", garantia:""})} className="bg-blue-600 hover:bg-blue-500 border border-blue-400 px-2 rounded text-[9px]">+ Linha</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr>
                          <th className={thStyle}>Modalidade</th><th className={`${thStyle} w-28`}>Limite</th><th className={`${thStyle} w-24`}>Prazo Médio</th>
                          <th className={`${thStyle} w-28`}>Tranche</th><th className={`${thStyle} w-20`}>Taxa</th><th className={thStyle}>Garantia</th><th className={`${thStyle} w-8`}>-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.propostas.map((p, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={p.modalidade} onChange={(e)=>updateArray('propostas', i, 'modalidade', e.target.value)} className={cellStyle}/></td>
                            <td className={tdStyle}><input type="number" value={p.limite} onChange={(e)=>updateArray('propostas', i, 'limite', Number(e.target.value))} className={`${numStyle} font-bold text-blue-700 bg-blue-50`}/></td>
                            <td className={tdStyle}><input value={p.prazo} onChange={(e)=>updateArray('propostas', i, 'prazo', e.target.value)} className={cellStyle}/></td>
                            <td className={tdStyle}><input type="number" value={p.tranche} onChange={(e)=>updateArray('propostas', i, 'tranche', Number(e.target.value))} className={numStyle}/></td>
                            <td className={tdStyle}><input value={p.taxa} onChange={(e)=>updateArray('propostas', i, 'taxa', e.target.value)} className={`${cellStyle} text-center`}/></td>
                            <td className={tdStyle}><input value={p.garantia} onChange={(e)=>updateArray('propostas', i, 'garantia', e.target.value)} className={cellStyle}/></td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('propostas', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-200 border-t-2 border-slate-400">
                          <td className="p-1.5 text-right font-bold text-[10px]">LIMITE TOTAL</td>
                          <td className="p-1.5 text-right font-mono font-bold text-blue-800 text-[11px]">R$ {totLimites.toLocaleString('pt-BR')}</td>
                          <td colSpan={5}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 2: EMPRESAS E SOCIETÁRIO */}
              {/* ========================================================= */}
              {abaAtiva === "societario" && (
                <div className="space-y-6">
                  {/* EMPRESAS DO GRUPO */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">
                      <span>Background da Empresa (Grupo Econômico)</span>
                      <button onClick={() => addArray('empresas_grupo', {empresa:"", cnpj:"", fundacao:"", idade:""})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Empresa</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr><th className={thStyle}>Empresa</th><th className={`${thStyle} w-40`}>CNPJ</th><th className={`${thStyle} w-32`}>Fundação</th><th className={`${thStyle} w-24`}>Idade</th><th className={`${thStyle} w-8`}>-</th></tr>
                      </thead>
                      <tbody>
                        {analise.empresas_grupo.map((e, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={e.empresa} onChange={(e)=>updateArray('empresas_grupo', i, 'empresa', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input value={e.cnpj} onChange={(e)=>updateArray('empresas_grupo', i, 'cnpj', e.target.value)} className={`${cellStyle} font-mono`} /></td>
                            <td className={tdStyle}><input value={e.fundacao} onChange={(e)=>updateArray('empresas_grupo', i, 'fundacao', e.target.value)} className={`${cellStyle} text-center`} /></td>
                            <td className={tdStyle}><input value={e.idade} onChange={(e)=>updateArray('empresas_grupo', i, 'idade', e.target.value)} className={`${cellStyle} text-center`} /></td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('empresas_grupo', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* SOCIETÁRIO */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">
                      <span>Estrutura Societária</span>
                      <button onClick={() => addArray('socios', {nome:"", perc:0, funcao:"Sócio", figura_contrato:"Sim"})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Sócio</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr><th className={thStyle}>Nome | Diretores</th><th className={`${thStyle} w-20`}>%</th><th className={`${thStyle} w-48`}>Função | Cargo</th><th className={`${thStyle} w-32`}>Figura Contrato</th><th className={`${thStyle} w-8`}>-</th></tr>
                      </thead>
                      <tbody>
                        {analise.socios.map((s, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={s.nome} onChange={(e)=>updateArray('socios', i, 'nome', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input type="number" value={s.perc} onChange={(e)=>updateArray('socios', i, 'perc', Number(e.target.value))} className={numStyle} /></td>
                            <td className={tdStyle}><input value={s.funcao} onChange={(e)=>updateArray('socios', i, 'funcao', e.target.value)} className={cellStyle} /></td>
                            <td className={tdStyle}>
                              <select value={s.figura_contrato} onChange={(e)=>updateArray('socios', i, 'figura_contrato', e.target.value)} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                            </td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('socios', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {/* INFO ADICIONAL SOCIETÁRIA */}
                    <table className="w-full mt-2 border-collapse border border-slate-400">
                      <tbody>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right`}>Regra de Assinatura</td>
                          <td className={tdStyle}><input value={analise.regra_assinatura} onChange={(e)=>setAnalise({...analise, regra_assinatura: e.target.value})} className={cellStyle} placeholder="( ) em conjunto (x) isolada" /></td>
                        </tr>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right`}>Aval Societário</td>
                          <td className={tdStyle}><input value={analise.aval_societario} onChange={(e)=>setAnalise({...analise, aval_societario: e.target.value})} className={cellStyle} placeholder="Nome de quem assina como aval..." /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* PATRIMÔNIO */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">
                      <span>Patrimônio Informado (IRPF)</span>
                      <button onClick={() => addArray('patrimonios', {socio:"", descricao:"", valor:0})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Bem</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr><th className={thStyle}>Sócio Detentor</th><th className={thStyle}>Descrição do Bem</th><th className={`${thStyle} w-48`}>Valor (R$)</th><th className={`${thStyle} w-8`}>-</th></tr>
                      </thead>
                      <tbody>
                        {analise.patrimonios.map((p, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={p.socio} onChange={(e)=>updateArray('patrimonios', i, 'socio', e.target.value)} className={`${cellStyle} font-bold text-slate-600`} placeholder="Nome do Sócio" /></td>
                            <td className={tdStyle}><input value={p.descricao} onChange={(e)=>updateArray('patrimonios', i, 'descricao', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input type="number" value={p.valor} onChange={(e)=>updateArray('patrimonios', i, 'valor', Number(e.target.value))} className={`${numStyle} text-green-700 font-bold`} /></td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('patrimonios', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-200 border-t-2 border-slate-400">
                          <td colSpan={2} className="p-1.5 text-right font-bold text-[10px]">TOTAL BENS ARRESTÁVEIS</td>
                          <td className="p-1.5 text-right font-mono font-bold text-green-800 text-[11px]">R$ {totPatrimonio.toLocaleString('pt-BR')}</td>
                          <td></td>
                        </tr>
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
                  {/* FATURAMENTO CONSOLIDADO */}
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Faturamento Consolidado</div>
                    <div className="overflow-x-auto border border-slate-400">
                      <table className="w-full border-collapse text-left bg-white min-w-[700px]">
                        <thead>
                          <tr>
                            <th className={`${thStyle} w-24 text-left`}>Mês</th>
                            <th className={thStyle}>Realizado 2026</th><th className={`${thStyle} w-20`}>Var (%)</th>
                            <th className={thStyle}>Realizado 2025</th><th className={`${thStyle} w-20`}>Var (%)</th>
                            <th className={thStyle}>Realizado 2024</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meses.map((mes) => {
                            const d26 = calcDelta(mes, "2026", "2025");
                            const d25 = calcDelta(mes, "2025", "2024");
                            return (
                              <tr key={mes}>
                                <td className={`${tdStyle} bg-slate-100 font-bold uppercase text-[10px] pl-2`}>{mes}</td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2026"]?.[mes] || ""} onChange={(e) => handleFat("2026", mes, e.target.value)} className={numStyle} /></td>
                                <td className={`${tdStyle} text-center font-bold text-[10px] ${d26 > 0 ? 'text-green-600' : d26 < 0 ? 'text-red-600' : 'text-slate-400'}`}>{d26 === 0 ? "-" : `${d26.toFixed(1)}%`}</td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2025"]?.[mes] || ""} onChange={(e) => handleFat("2025", mes, e.target.value)} className={numStyle} /></td>
                                <td className={`${tdStyle} text-center font-bold text-[10px] ${d25 > 0 ? 'text-green-600' : d25 < 0 ? 'text-red-600' : 'text-slate-400'}`}>{d25 === 0 ? "-" : `${d25.toFixed(1)}%`}</td>
                                <td className={tdStyle}><input type="number" value={analise.dados_faturamento["2024"]?.[mes] || ""} onChange={(e) => handleFat("2024", mes, e.target.value)} className={numStyle} /></td>
                              </tr>
                            );
                          })}
                          {/* TOTAIS E MÉDIAS */}
                          <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-[10px]">
                            <td className="p-1.5 border border-slate-400">TOTAL ANO</td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-blue-700">{calcTotAno("2026").toLocaleString("pt-BR")}</td><td className="border border-slate-400"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono">{calcTotAno("2025").toLocaleString("pt-BR")}</td><td className="border border-slate-400"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono">{calcTotAno("2024").toLocaleString("pt-BR")}</td>
                          </tr>
                          <tr className="bg-slate-200 border-t border-slate-400 font-bold text-[10px]">
                            <td className="p-1.5 border border-slate-400">MÉDIA 12M</td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-blue-800">{calcMedia("2026").toLocaleString("pt-BR", {maximumFractionDigits:0})}</td><td className="border border-slate-400"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono">{calcMedia("2025").toLocaleString("pt-BR", {maximumFractionDigits:0})}</td><td className="border border-slate-400"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono">{calcMedia("2024").toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                          </tr>
                          <tr className="bg-slate-300 border-t border-slate-400 font-bold text-[10px]">
                            <td className="p-1.5 border border-slate-400">MÉDIA YTD ({mesesYTD2026}m)</td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-blue-900">{calcMediaYTD("2026", mesesYTD2026).toLocaleString("pt-BR", {maximumFractionDigits:0})}</td><td className="border border-slate-400"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono">{calcMediaYTD("2025", mesesYTD2026).toLocaleString("pt-BR", {maximumFractionDigits:0})}</td><td className="border border-slate-400"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono">{calcMediaYTD("2024", mesesYTD2026).toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* POTENCIAL */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Potencial de Negócios (Detalhado)</div>
                      <table className="w-full border-collapse border border-slate-400">
                        <tbody>
                          <tr><td className={`${thStyle} text-right w-1/2`}>Ticket Médio (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e)=>updateNested("dados_potencial", "ticket_medio", Number(e.target.value))} className={numStyle} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Dpls</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_dpls} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_dpls", e.target.value)} className={cellStyle} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Comissária</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_comissaria} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_comissaria", e.target.value)} className={cellStyle} /></td></tr>
                          
                          {/* Forma e Composição */}
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td className={`${thStyle} text-right`}>Forma Receb. (À Vista %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_vista} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_vista", Number(e.target.value))} className={`${numStyle} text-blue-700`} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Forma Receb. (A Prazo %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_prazo} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_prazo", Number(e.target.value))} className={`${numStyle} text-blue-700`} /></td>
                          </tr>
                          <tr className="bg-slate-100 border-t border-slate-300">
                            <td className={`${thStyle} text-right`}>Composição (Dpls %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_dpls} onChange={(e)=>updateNested("dados_potencial", "composicao_dpls", Number(e.target.value))} className={`${numStyle} text-green-700`} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Composição (Comissária %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_comissaria} onChange={(e)=>updateNested("dados_potencial", "composicao_comissaria", Number(e.target.value))} className={`${numStyle} text-green-700`} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-green-50 border border-green-300 p-4 flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-bold text-green-800 uppercase">Potencial Real Estimado</span>
                      <span className="font-mono text-3xl font-black text-green-700 mt-2">R$ {(analise.dados_potencial.potencial_estimado || 0).toLocaleString("pt-BR")}</span>
                      <input type="number" value={analise.dados_potencial.potencial_estimado} onChange={(e)=>updateNested("dados_potencial", "potencial_estimado", Number(e.target.value))} className="mt-4 text-center text-[10px] border border-green-200 p-1.5 bg-white outline-none w-32 shadow-sm" placeholder="Editar manual..." />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 4: ENDIVIDAMENTO E REFERÊNCIAS */}
              {/* ========================================================= */}
              {abaAtiva === "endividamento" && (
                <div className="space-y-6">
                  {/* RESUMO ENDIVIDAMENTO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Endividamento Bancos e Fundos</div>
                      <table className="w-full border-collapse border border-slate-400">
                        <tbody>
                          <tr><td className={`${thStyle} text-right w-1/2`}>Curto Prazo</td><td className={tdStyle}><input type="number" value={analise.endividamento_resumo.curto_prazo} onChange={(e)=>updateNested("endividamento_resumo", "curto_prazo", Number(e.target.value))} className={numStyle} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Longo Prazo</td><td className={tdStyle}><input type="number" value={analise.endividamento_resumo.longo_prazo} onChange={(e)=>updateNested("endividamento_resumo", "longo_prazo", Number(e.target.value))} className={numStyle} /></td></tr>
                          <tr className="bg-red-50 border-t-2 border-red-200">
                            <td className="p-1.5 text-right font-bold text-[10px] text-red-800">TOTAL GERAL</td>
                            <td className="p-1.5 text-right font-mono font-bold text-red-700 text-[11px]">R$ {(Number(analise.endividamento_resumo.curto_prazo || 0) + Number(analise.endividamento_resumo.longo_prazo || 0)).toLocaleString("pt-BR")}</td>
                          </tr>
                          <tr className="bg-slate-100 border-t border-slate-300">
                            <td className={`${thStyle} text-right`}>Curto Prazo DPLS (%)</td><td className={tdStyle}><input type="number" value={analise.endividamento_resumo.dpls_curto_perc} onChange={(e)=>updateNested("endividamento_resumo", "dpls_curto_perc", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Fundos (%)</td><td className={tdStyle}><input type="number" value={analise.endividamento_resumo.fundos_perc} onChange={(e)=>updateNested("endividamento_resumo", "fundos_perc", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Bancos (%)</td><td className={tdStyle}><input type="number" value={analise.endividamento_resumo.bancos_perc} onChange={(e)=>updateNested("endividamento_resumo", "bancos_perc", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr className="bg-slate-100 border-t border-slate-300">
                            <td className={`${thStyle} text-right`}>Renegociando?</td>
                            <td className={tdStyle}>
                               <select value={analise.endividamento_resumo.renegociando} onChange={(e)=>updateNested("endividamento_resumo", "renegociando", e.target.value)} className={cellStyle}><option value="Não">Não</option><option value="Sim">Sim</option></select>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="p-2 text-center text-[10px] text-slate-500 bg-slate-100 border-t border-slate-300">
                              Alavancagem Atual: <strong className="text-slate-800 text-xs">{calcMedia("2025") > 0 ? ((Number(analise.endividamento_resumo?.curto_prazo || 0) + Number(analise.endividamento_resumo?.longo_prazo || 0)) / calcMedia("2025")).toFixed(2) : "0.00"} x</strong> Faturamento
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* INSTITUIÇÕES DETALHADAS */}
                    <div>
                      <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold p-1.5 border border-slate-800">
                        <span>Detalhamento (Bancos Pelo Cedente)</span>
                        <button onClick={() => addArray('endividamento_detalhado', {instituicao:"", modalidade:"", risco_perc:0, saldo:0, liq_perc:0, vop:""})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Linha</button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-400 min-w-[500px]">
                          <thead>
                            <tr><th className={thStyle}>Instituição</th><th className={`${thStyle} w-32`}>Modalidade</th><th className={`${thStyle} w-16`}>Risco %</th><th className={`${thStyle} w-24 text-right`}>Saldo Devedor</th><th className={`${thStyle} w-16`}>LIQ %</th><th className={`${thStyle} w-16`}>VOP</th><th className={`${thStyle} w-8`}>-</th></tr>
                          </thead>
                          <tbody>
                            {analise.endividamento_detalhado.map((div, i) => (
                              <tr key={i}>
                                <td className={tdStyle}><input value={div.instituicao} onChange={(e)=>updateArray('endividamento_detalhado', i, 'instituicao', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                                <td className={tdStyle}><input value={div.modalidade} onChange={(e)=>updateArray('endividamento_detalhado', i, 'modalidade', e.target.value)} className={cellStyle} /></td>
                                <td className={tdStyle}><input type="number" value={div.risco_perc} onChange={(e)=>updateArray('endividamento_detalhado', i, 'risco_perc', Number(e.target.value))} className={numStyle} /></td>
                                <td className={tdStyle}><input type="number" value={div.saldo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'saldo', Number(e.target.value))} className={`${numStyle} font-bold text-red-600`} /></td>
                                <td className={tdStyle}><input type="number" value={div.liq_perc} onChange={(e)=>updateArray('endividamento_detalhado', i, 'liq_perc', Number(e.target.value))} className={numStyle} /></td>
                                <td className={tdStyle}><input value={div.vop} onChange={(e)=>updateArray('endividamento_detalhado', i, 'vop', e.target.value)} className={cellStyle} /></td>
                                <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('endividamento_detalhado', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                              </tr>
                            ))}
                            <tr className="bg-slate-200 border-t-2 border-slate-400">
                              <td colSpan={3} className="p-1.5 text-right font-bold text-[10px]">TOTAL</td>
                              <td className="p-1.5 text-right font-mono font-bold text-red-700 text-[11px]">R$ {totBancosDet.toLocaleString("pt-BR")}</td>
                              <td colSpan={3}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* REFERÊNCIAS COMPLETAS */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold p-1.5 border border-slate-800">
                      <span>Informações com Fundos / Referências</span>
                      <button onClick={() => addArray('referencias', {instituicao:"", rnx:"", cliente_desde:"", ultima_operacao:"", limite_global:0, risco_total:0, risco_1:0, operacao_1:"", vcto_1:"", risco_2:0, operacao_2:"", vcto_2:"", liquidez_5_dias:"", liquidez_pontual:"", atraso_5_dias:"", atraso_15_dias:"", recompra:"", concentracao:0})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Fundo</button>
                    </div>
                    <div className="overflow-x-auto border border-slate-400">
                      <table className="w-full border-collapse min-w-[1400px]">
                        <thead>
                          <tr>
                            <th className={thStyle}>Fundo</th><th className={thStyle}>RNX</th><th className={`${thStyle} w-20`}>Desde</th><th className={`${thStyle} w-24`}>Últ. Op</th>
                            <th className={`${thStyle} w-28 text-right`}>Limite</th><th className={`${thStyle} w-28 text-right`}>Risco Total</th>
                            <th className={`${thStyle} w-24 text-right bg-blue-100`}>Risco 1</th><th className={`${thStyle} bg-blue-100`}>Op 1</th><th className={`${thStyle} bg-blue-100`}>Vcto 1</th>
                            <th className={`${thStyle} w-24 text-right bg-yellow-100`}>Risco 2</th><th className={`${thStyle} bg-yellow-100`}>Op 2</th><th className={`${thStyle} bg-yellow-100`}>Vcto 2</th>
                            <th className={thStyle}>Liq 5d</th><th className={thStyle}>Liq Pontual</th><th className={thStyle}>Atraso 5d</th><th className={thStyle}>Atraso 15d</th>
                            <th className={thStyle}>Recompra</th><th className={thStyle}>Conc(%)</th><th className={`${thStyle} w-8`}>-</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analise.referencias.map((ref, i) => (
                            <tr key={i}>
                              <td className={tdStyle}><input value={ref.instituicao} onChange={(e)=>updateArray('referencias', i, 'instituicao', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                              <td className={tdStyle}><input value={ref.rnx} onChange={(e)=>updateArray('referencias', i, 'rnx', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input type="date" value={ref.cliente_desde} onChange={(e)=>updateArray('referencias', i, 'cliente_desde', e.target.value)} className={`${cellStyle} text-center`} /></td>
                              <td className={tdStyle}><input type="date" value={ref.ultima_operacao} onChange={(e)=>updateArray('referencias', i, 'ultima_operacao', e.target.value)} className={`${cellStyle} text-center`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.limite_global} onChange={(e)=>updateArray('referencias', i, 'limite_global', Number(e.target.value))} className={`${numStyle} text-blue-700 font-bold`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.risco_total} onChange={(e)=>updateArray('referencias', i, 'risco_total', Number(e.target.value))} className={`${numStyle} text-red-600 font-bold`} /></td>
                              
                              <td className={tdStyle}><input type="number" value={ref.risco_1} onChange={(e)=>updateArray('referencias', i, 'risco_1', Number(e.target.value))} className={`${numStyle} bg-blue-50`} /></td>
                              <td className={tdStyle}><input value={ref.operacao_1} onChange={(e)=>updateArray('referencias', i, 'operacao_1', e.target.value)} className={`${cellStyle} bg-blue-50`} /></td>
                              <td className={tdStyle}><input value={ref.vcto_1} onChange={(e)=>updateArray('referencias', i, 'vcto_1', e.target.value)} className={`${cellStyle} bg-blue-50 text-center`} /></td>
                              
                              <td className={tdStyle}><input type="number" value={ref.risco_2} onChange={(e)=>updateArray('referencias', i, 'risco_2', Number(e.target.value))} className={`${numStyle} bg-yellow-50`} /></td>
                              <td className={tdStyle}><input value={ref.operacao_2} onChange={(e)=>updateArray('referencias', i, 'operacao_2', e.target.value)} className={`${cellStyle} bg-yellow-50`} /></td>
                              <td className={tdStyle}><input value={ref.vcto_2} onChange={(e)=>updateArray('referencias', i, 'vcto_2', e.target.value)} className={`${cellStyle} bg-yellow-50 text-center`} /></td>
                              
                              <td className={tdStyle}><input value={ref.liquidez_5_dias} onChange={(e)=>updateArray('referencias', i, 'liquidez_5_dias', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input value={ref.liquidez_pontual} onChange={(e)=>updateArray('referencias', i, 'liquidez_pontual', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input value={ref.atraso_5_dias} onChange={(e)=>updateArray('referencias', i, 'atraso_5_dias', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input value={ref.atraso_15_dias} onChange={(e)=>updateArray('referencias', i, 'atraso_15_dias', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input value={ref.recompra} onChange={(e)=>updateArray('referencias', i, 'recompra', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input type="number" value={ref.concentracao} onChange={(e)=>updateArray('referencias', i, 'concentracao', Number(e.target.value))} className={numStyle} /></td>
                              
                              <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('referencias', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
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
                  {/* QUADRO GERAL RESTRITIVOS */}
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Restritivos (Quadro Resumo)</div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr><th className={thStyle}>Pefin</th><th className={thStyle}>Refin</th><th className={thStyle}>Protesto</th><th className={thStyle}>Div Vencida</th><th className={thStyle}>Ação Judicial</th><th className={thStyle}>Cheque s/ Fundo</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.pefin} onChange={(e)=>updateNested("restritivos_quadro", "pefin", Number(e.target.value))} className={numStyle} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.refin} onChange={(e)=>updateNested("restritivos_quadro", "refin", Number(e.target.value))} className={numStyle} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.protesto} onChange={(e)=>updateNested("restritivos_quadro", "protesto", Number(e.target.value))} className={numStyle} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.div_vencida} onChange={(e)=>updateNested("restritivos_quadro", "div_vencida", Number(e.target.value))} className={numStyle} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.acao_judicial} onChange={(e)=>updateNested("restritivos_quadro", "acao_judicial", Number(e.target.value))} className={numStyle} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.cheque_sem_fundo} onChange={(e)=>updateNested("restritivos_quadro", "cheque_sem_fundo", Number(e.target.value))} className={numStyle} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* RESTRITIVOS DETALHADOS */}
                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold p-1.5 border border-slate-800">
                      <span>Apontamentos Restritivos Detalhados</span>
                      <button onClick={() => addArray('restritivos', {empresa_socio:"", restritivo:"", qtd:1, valor:0, data:"", observacao:""})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Apontamento</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr>
                          <th className={thStyle}>Empresa / Sócio</th><th className={thStyle}>Restritivo</th>
                          <th className={`${thStyle} w-16`}>Qtd</th><th className={`${thStyle} w-32 text-right`}>Valor (R$)</th>
                          <th className={`${thStyle} w-24`}>Data</th><th className={`${thStyle} w-64`}>Observação</th>
                          <th className={`${thStyle} w-8`}>-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.restritivos.map((r, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={r.empresa_socio} onChange={(e)=>updateArray('restritivos', i, 'empresa_socio', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input value={r.restritivo} onChange={(e)=>updateArray('restritivos', i, 'restritivo', e.target.value)} className={cellStyle} /></td>
                            <td className={tdStyle}><input type="number" value={r.qtd} onChange={(e)=>updateArray('restritivos', i, 'qtd', Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                            <td className={tdStyle}><input type="number" value={r.valor} onChange={(e)=>updateArray('restritivos', i, 'valor', Number(e.target.value))} className={`${numStyle} text-red-600 font-bold`} /></td>
                            <td className={tdStyle}><input type="date" value={r.data} onChange={(e)=>updateArray('restritivos', i, 'data', e.target.value)} className={`${cellStyle} text-center`} /></td>
                            <td className={tdStyle}><input value={r.observacao} onChange={(e)=>updateArray('restritivos', i, 'observacao', e.target.value)} className={cellStyle} /></td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('restritivos', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-200 border-t-2 border-slate-400">
                          <td colSpan={3} className="p-1.5 text-right font-bold uppercase text-[10px] text-slate-800">Total Detalhado</td>
                          <td className="p-1.5 text-right font-mono font-bold text-red-700 text-[11px]">R$ {totRestritivos.toLocaleString("pt-BR")}</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* JURIDICO */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Pesquisa de Ações | Jurídico (Manual)</div>
                      <textarea value={analise.juridico_tramitacao} onChange={(e)=>setAnalise({...analise, juridico_tramitacao: e.target.value})} className="w-full h-24 p-2 border border-slate-400 outline-none text-[11px] font-sans resize-none" />
                    </div>
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Jurídico IA (Empresa, Sócios e Coligadas)</div>
                      <textarea value={analise.juridico_ia} onChange={(e)=>setAnalise({...analise, juridico_ia: e.target.value})} className="w-full h-24 p-2 border border-slate-400 outline-none text-[11px] font-sans resize-none" />
                    </div>
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Pesquisas e Notícias de Mídia</div>
                      <textarea value={analise.noticias_midia} onChange={(e)=>setAnalise({...analise, noticias_midia: e.target.value})} className="w-full h-20 p-2 border border-slate-400 outline-none text-[11px] font-sans resize-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 6: PARECER, VISITAS E ANEXOS */}
              {/* ========================================================= */}
              {abaAtiva === "parecer" && (
                <div className="space-y-6 max-w-5xl">
                  
                  {/* PARECERES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-slate-400 p-3">
                      <h3 className="text-[11px] font-bold text-slate-800 uppercase mb-2 border-b border-slate-300 pb-1">Parecer do Analista</h3>
                      <textarea 
                        value={analise.parecer_analista} 
                        onChange={(e) => setAnalise({...analise, parecer_analista: e.target.value})}
                        className="w-full p-2 border border-slate-300 h-64 font-sans text-[12px] outline-none resize-none bg-[#f8fafc]"
                      />
                    </div>
                    <div className="bg-white border-2 border-slate-400 p-3">
                      <h3 className="text-[11px] font-bold text-slate-800 uppercase mb-2 border-b border-slate-300 pb-1">Parecer do Diretor de Crédito</h3>
                      <textarea 
                        value={analise.parecer_diretor} 
                        onChange={(e) => setAnalise({...analise, parecer_diretor: e.target.value})}
                        className="w-full p-2 border border-slate-300 h-64 font-sans text-[12px] outline-none resize-none bg-[#f8fafc]"
                        placeholder="De acordo com o analista..."
                      />
                    </div>
                  </div>

                  {/* RESUMO DA VISITA */}
                  <div className="bg-white border-2 border-slate-400 p-3">
                    <h3 className="text-[11px] font-bold text-slate-800 uppercase mb-2 border-b border-slate-300 pb-1">Relatório de Visitas</h3>
                    <textarea 
                      value={analise.resumo_visita} 
                      onChange={(e) => setAnalise({...analise, resumo_visita: e.target.value})}
                      className="w-full p-2 border border-slate-300 h-32 font-sans text-[12px] outline-none resize-none bg-[#f8fafc]"
                    />
                  </div>

                  {/* ANEXOS / FOTOS */}
                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Organograma, Fotos e Fachadas (URLs)</div>
                    <table className="w-full border-collapse border border-[#cbd5e1]">
                      <tbody>
                        <tr><td className={`${thStyle} w-1/4 text-right`}>URL Organograma</td><td className={tdStyle}><input type="text" value={analise.anexos?.organograma_url || ""} onChange={(e) => updateNested("anexos", "organograma_url", e.target.value)} className={cellStyle} placeholder="Cole o link..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Fachada</td><td className={tdStyle}><input type="text" value={analise.anexos?.fachada_url || ""} onChange={(e) => updateNested("anexos", "fachada_url", e.target.value)} className={cellStyle} placeholder="Cole o link..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Satélite (Maps)</td><td className={tdStyle}><input type="text" value={analise.anexos?.satelite_url || ""} onChange={(e) => updateNested("anexos", "satelite_url", e.target.value)} className={cellStyle} placeholder="Cole o link..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Fotos da Visita</td><td className={tdStyle}><input type="text" value={analise.anexos?.fotos_visita_url || ""} onChange={(e) => updateNested("anexos", "fotos_visita_url", e.target.value)} className={cellStyle} placeholder="Cole o link..." /></td></tr>
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>
          </>
        )}
      </div>

    </div>
  );
}