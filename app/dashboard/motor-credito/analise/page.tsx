/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import GerarAnalise from "@/components/gerar-analise";

// =========================================================================
// INTERFACES
// =========================================================================
interface FilaItem {
  id: string;
  empresa_nome: string;
  cnpj: string;
  status: string;
}

interface EmpresaPrincipal {
  razao_social: string;
  cnpj: string;
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
  figure_contrato: string;
}

interface PatrimonioItem {
  socio: string;
  descricao: string;
  valor: number;
}

interface FaturamentoMes {
  [mes: string]: number | string;
}

interface EndividamentoItem {
  instituicao: string;
  modalidade: string;
  saldo: number;
  tipo: "Banco" | "Fundo";
  prazo: "Curto Prazo" | "Longo Prazo";
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

  // CAPA
  empresas_principais: EmpresaPrincipal[];
  data_analise: string;
  relacionamento: string;
  analista: string;
  gerente: string;
  rating: string;
  
  // DADOS DA EMPRESA (CADASTRO)
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
    ticket_medio: number; 
    prazo_medio_dpls: string; 
    prazo_medio_comissaria: string; 
    prazo_medio_intercompany: string;
    forma_recebimento_vista: number; 
    forma_recebimento_prazo: number; 
    composicao_dpls: number; 
    composicao_comissaria: number; 
    composicao_intercompany: number;
    composicao_outros: number;
    potencial_estimado: number; 
  };
  
  // ENDIVIDAMENTO E REFERÊNCIAS
  endividamento_resumo: { renegociando: string };
  endividamento_detalhado: EndividamentoItem[];
  referencias: ReferenciaItem[];
  
  // RESTRITIVOS E JURÍDICO
  restritivos_quadro: { pefin: number; refin: number; protesto: number; div_vencida: number; acao_judicial: number; cheque_sem_fundo: number };
  restritivos: RestritivoItem[];
  
  // TEXTOS E LINKS
  resumo_visita: string;
  noticias_midia: string;
  parecer_analista: string;
  parecer_comite?: string;
  recomendacao_analista?: string;
  anexos: { organograma_url: string; fachada_url: string; satelite_url: string; fotos_visita_url: string };

  // 🔥 NOVOS CAMPOS DO MOTOR V8
  dados_juridico: { relatorio_completo: string };
  parecer_executivo: string;

  // GRAFO DE GRUPO ECONÔMICO (JSON DAS BOLINHAS DA TEIA)
  organograma_json?: { nodes: any[], edges: any[] } | null;

  [key: string]: any;
}

const DADOS_MODELO: AnaliseData = {
  id: null, cnpj: "00.000.000/0001-00", razao_social: "EMPRESA MODELO LTDA",
  empresas_principais: [{ razao_social: "EMPRESA MODELO LTDA", cnpj: "00.000.000/0001-00" }],
  data_analise: new Date().toISOString().split("T")[0], 
  relacionamento: "Prospect", analista: "Alyson", gerente: "Luiz", rating: "B - Risco médio", 
  
  fundacao: "", capital_social: 0, localizacao: "", ramo: "", licencas: "Não Informado", balanco_auditado: "Não", consultoria_gestao: "Não", site: "",

  propostas: [{ modalidade: "Desconto", limite: 0, prazo: "", tranche: 0, taxa: "", garantia: "" }],
  empresas_grupo: [],
  
  socios: [{ nome: "", perc: 100, funcao: "Sócio", figure_contrato: "Sim" }],
  regra_assinatura: "( ) em conjunto (x) isolada", aval_societario: "", patrimonios: [],
  
  dados_faturamento: { "2024": {}, "2025": {}, "2026": {} }, 
  dados_potencial: { ticket_medio: 0, prazo_medio_dpls: "60 dias", prazo_medio_comissaria: "0 dias", prazo_medio_intercompany: "", forma_recebimento_vista: 0, forma_recebimento_prazo: 100, composicao_dpls: 100, composicao_comissaria: 0, composicao_intercompany: 0, composicao_outros: 0, potencial_estimado: 0 },
  
  endividamento_resumo: { renegociando: "Não" },
  endividamento_detalhado: [], referencias: [],
  
  restritivos_quadro: { pefin: 0, refin: 0, protesto: 0, div_vencida: 0, acao_judicial: 0, cheque_sem_fundo: 0 },
  restritivos: [],
  
  resumo_visita: "", noticias_midia: "", parecer_analista: "", parecer_comite: "", recomendacao_analista: "",
  anexos: { organograma_url: "", fachada_url: "", satelite_url: "", fotos_visita_url: "" },
  
  // 🔥 INICIALIZAÇÃO SEGURA PRO V8
  dados_juridico: { relatorio_completo: "" },
  parecer_executivo: "",
  
  organograma_json: null
};

// =========================================================================
// COMPONENTES AUXILIARES
// =========================================================================
function MathInput({ value, onChange, className }: { value: any, onChange: (v: string) => void, className: string }) {
  const [localVal, setLocalVal] = useState(value || "");
  useEffect(() => { setLocalVal(value || ""); }, [value]);

  const handleBlur = () => {
    try {
      const valStr = String(localVal).replace(/\s/g, '').replace(',', '.');
      if (/[\+\-\*\/]/.test(valStr)) {
        const sanitized = valStr.replace(/[^\d\.\+\-\*\/\(\)]/g, '');
        const result = new Function(`'use strict'; return (${sanitized})`)();
        onChange(result.toString());
        setLocalVal(result.toString());
      } else {
        onChange(localVal);
      }
    } catch {
      onChange(localVal);
    }
  };

  return (
    <input
      type="text"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
}

// =========================================================================
// PÁGINA PRINCIPAL
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
  const uploadJsonRef = useRef<HTMLInputElement>(null);

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

      let query = supabase
        .from("analises")
        .select("id, empresa_nome, cnpj, status")
        .in("status", ["em_processamento_ia", "em_revisao_humana"])
        .order("criado_em", { ascending: false });

      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();
        
        if (cargoUser === "comercial" && user.nome) {
          query = query.ilike("comercial", `%${user.nome}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setFila(data as any);
    } catch (err) { 
      console.error(err); 
    } finally { 
      if (comSpinner) setLoadingFila(false); 
    }
  };

  const selecionarEmpresaDaEsteira = async (id: string) => {
    try {
      setLoadingAnalise(true);
      setIdSelecionado(id);
      const { data, error } = await supabase.from("analises").select("*").eq("id", id).single();
      if (error) throw error;
      if (data) {
        const dc = data.dados_consolidados || {};
        const listaSocios = dc.socios?.length ? dc.socios : (dc.dados_estrutura_societaria || []);
        const listaEndividamento = dc.endividamento_detalhado?.length ? dc.endividamento_detalhado : (dc.dados_endividamento || []);
        const listaRestritivos = dc.restritivos?.length ? dc.restritivos : (dc.dados_restritivos || []);
        const razao_social = data.empresa_nome || dc.razao_social || "";
        const cnpj = data.cnpj || dc.cnpj || "";
        const empresas_principais = dc.empresas_principais?.length ? dc.empresas_principais : [{ razao_social, cnpj }];
        
        setAnalise({ 
          ...DADOS_MODELO, 
          ...dc,  
          empresas_principais,
          socios: listaSocios,
          endividamento_detalhado: listaEndividamento,
          restritivos: listaRestritivos,
          anexos: { ...DADOS_MODELO.anexos, ...(dc.anexos || {}) }, 
          dados_potencial: { ...DADOS_MODELO.dados_potencial, ...(dc.dados_potencial || {}) }, 
          dados_juridico: { ...DADOS_MODELO.dados_juridico, ...(dc.dados_juridico || {}) }, // Blindagem extra
          id: data.id, 
          cnpj: cnpj, 
          razao_social: razao_social, 
          status: data.status 
        });
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoadingAnalise(false); 
    }
  };

  const persistirNoBanco = async (mostrarAlerta = true) => {
    if (!idSelecionado || !analise.id) {
      if (mostrarAlerta) alert("💡 Você está no Template. Selecione uma análise real para salvar.");
      return false;
    }
    try {
      setProcessandoDecisao(true);
      const { id, cnpj, razao_social, status, ...dadosParaCompactar } = analise;
      dadosParaCompactar.dados_potencial.potencial_estimado = potencialRealCalculado;
      
      const { error } = await supabase.from("analises").update({ 
        dados_consolidados: dadosParaCompactar,
        empresa_nome: analise.razao_social
      }).eq("id", analise.id);
      
      if (error) throw error;
      if (mostrarAlerta) alert("✅ Matriz Excel salva com sucesso no banco de dados!");
      return true;
    } catch (err: any) { 
      alert("❌ Erro ao salvar dados: " + err.message); return false; 
    } finally { 
      setProcessandoDecisao(false); 
    }
  };

  const encaminharParaComite = async () => {
    if (!idSelecionado || !analise.id) return;
    if (!analise.recomendacao_analista || !analise.parecer_analista.trim()) {
      alert("⚠️ É obrigatório preencher o Parecer Técnico e escolher uma Recomendação Final (na aba Parecer) antes de enviar ao comitê.");
      return;
    }
    const confirmacao = window.confirm(`Encaminhar para o Comitê de Crédito com a sugestão de: [${analise.recomendacao_analista.toUpperCase()}]?`);
    if (!confirmacao) return;

    try {
      setProcessandoDecisao(true);
      await persistirNoBanco(false); 
      
      const novoStatus = "aberta";
      const { error } = await supabase.from("analises").update({ status: novoStatus }).eq("id", analise.id);
      if (error) throw error;
      
      alert(`🚀 Análise finalizada com sucesso! A empresa foi enviada para a Mesa de Comitê.`);
      setIdSelecionado(null); 
      setAnalise(DADOS_MODELO); 
      await buscarFilaSupabase(true);
    } catch (err: any) { 
      alert("Erro ao processar: " + err.message); 
    } finally { 
      setProcessandoDecisao(false); 
    }
  };

  const devolverParaComercialPendente = async () => {
    if (!idSelecionado || !analise.id) return;
    const justificativa = prompt("Motivo da devolução para o Comercial:");
    if (!justificativa?.trim()) return; 
    try {
      setProcessandoDecisao(true);
      const { id, cnpj, razao_social, status, ...dadosParaCompactar } = analise;
      dadosParaCompactar.parecer_analista = `🚨 DEVOLVIDO:\nMotivo: ${justificativa}\n\n` + (dadosParaCompactar.parecer_analista || "");
      const { error } = await supabase.from("analises").update({ status: "aguardando_docs", dados_consolidados: dadosParaCompactar }).eq("id", analise.id);
      if (error) throw error;
      alert("📥 Empresa devolvida para a tela do Comercial!");
      setIdSelecionado(null); setAnalise(DADOS_MODELO); await buscarFilaSupabase(true);
    } catch (err: any) { 
      alert("❌ Falha na devolução."); 
    } finally { 
      setProcessandoDecisao(false); 
    }
  };

  const updateArray = (campo: keyof AnaliseData, index: number, subCampo: string, valor: any) => {
    const novoArray = [...(analise[campo] as any[])];
    novoArray[index][subCampo] = valor;
    
    if (campo === 'empresas_principais' && index === 0) {
       if (subCampo === 'razao_social') setAnalise({ ...analise, [campo]: novoArray, razao_social: valor });
       else if (subCampo === 'cnpj') setAnalise({ ...analise, [campo]: novoArray, cnpj: valor });
       else setAnalise({ ...analise, [campo]: novoArray });
    } else {
       setAnalise({ ...analise, [campo]: novoArray });
    }
  };
  const addArray = (campo: keyof AnaliseData, obj: any) => setAnalise({ ...analise, [campo]: [...(analise[campo] as any[]), obj] });
  const rmArray = (campo: keyof AnaliseData, index: number) => setAnalise({ ...analise, [campo]: (analise[campo] as any[]).filter((_, i) => i !== index) });
  
  const updateNested = (campoPai: keyof AnaliseData, campoFilho: string, valor: any) => {
    setAnalise({ ...analise, [campoPai]: { ...(analise[campoPai] as any), [campoFilho]: valor } });
  };

  const handleFat = (ano: string, mes: string, val: string) => {
    const fatAtual = { ...analise.dados_faturamento };
    if (!fatAtual[ano]) fatAtual[ano] = {};
    fatAtual[ano][mes] = val; 
    setAnalise({ ...analise, dados_faturamento: fatAtual });
  };

  // =========================================================================
  // FÓRMULAS DE FATURAMENTO E POTENCIAL YTD
  // =========================================================================
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  
  let lastFilledIndex26 = -1;
  for (let i = 11; i >= 0; i--) {
      if (Number(analise.dados_faturamento["2026"]?.[meses[i]] || 0) > 0) {
          lastFilledIndex26 = i;
          break;
      }
  }
  
  const has26Data = lastFilledIndex26 >= 0;
  const limitIndex = has26Data ? lastFilledIndex26 : 11; 
  const mesesYTD = meses.slice(0, limitIndex + 1);
  const labelMascaraYTD = has26Data ? `MÉDIA ATÉ ${meses[lastFilledIndex26].toUpperCase()}` : "MÉDIA YTD";

  const calcMediaYTD = (ano: string) => {
      if (mesesYTD.length === 0) return 0;
      const soma = mesesYTD.reduce((acc, m) => acc + Number(analise.dados_faturamento[ano]?.[m] || 0), 0);
      return soma / mesesYTD.length;
  };

  const mediaYTD26 = has26Data ? calcMediaYTD("2026") : 0;
  const mediaYTD25 = calcMediaYTD("2025");
  const mediaYTD24 = calcMediaYTD("2024");
  
  const calcTotAno = (ano: string) => meses.reduce((acc, m) => acc + Number(analise.dados_faturamento[ano]?.[m] || 0), 0);
  const mesesPreenchidosGeral = (ano: string) => meses.filter(m => Number(analise.dados_faturamento[ano]?.[m] || 0) > 0).length;
  
  const calcMediaGeralAno = (ano: string) => { 
      const pre = mesesPreenchidosGeral(ano); 
      if (pre === 0) return 0;
      const divisor = ano === "2026" ? pre : 12;
      return calcTotAno(ano) / divisor; 
  }; 
  
  const calcDelta = (m: string, aAt: string, aAnt: string) => { const at = Number(analise.dados_faturamento[aAt]?.[m] || 0); const ant = Number(analise.dados_faturamento[aAnt]?.[m] || 0); return !ant || ant === 0 ? 0 : ((at - ant) / ant) * 100; };

  const varYTD26_25 = mediaYTD25 > 0 ? ((mediaYTD26 - mediaYTD25) / mediaYTD25) * 100 : 0;
  const varYTD25_24 = mediaYTD24 > 0 ? ((mediaYTD25 - mediaYTD24) / mediaYTD24) * 100 : 0;

  const faturamentoMedioReferencia = has26Data ? mediaYTD26 : (mediaYTD25 > 0 ? mediaYTD25 : mediaYTD24);

  const prazoDiasDpls = parseInt(String(analise.dados_potencial.prazo_medio_dpls).replace(/\D/g, "")) || 0;
  const prazoDiasComissaria = parseInt(String(analise.dados_potencial.prazo_medio_comissaria).replace(/\D/g, "")) || 0;
  
  const percAPrazo = Number(analise.dados_potencial.forma_recebimento_prazo || 0) / 100;
  const percDpls = Number(analise.dados_potencial.composicao_dpls || 0) / 100;
  const percComissaria = Number(analise.dados_potencial.composicao_comissaria || 0) / 100;

  const potDpls = (faturamentoMedioReferencia / 30) * prazoDiasDpls * percDpls * percAPrazo;
  const potComissaria = (faturamentoMedioReferencia / 30) * prazoDiasComissaria * percComissaria * percAPrazo;
  const potencialRealCalculado = potDpls + potComissaria;

  const totLimites = analise.propostas.reduce((acc, p) => acc + Number(p.limite), 0);
  const totPatrimonio = analise.patrimonios.reduce((acc, p) => acc + Number(p.valor), 0);
  const totRestritivos = analise.restritivos.reduce((acc, r) => acc + Number(r.valor), 0);

  const totEndivGeral = analise.endividamento_detalhado.reduce((acc, d) => acc + Number(d.saldo || 0), 0);
  const endivCurtoPrazo = analise.endividamento_detalhado.filter(d => d.prazo === "Curto Prazo").reduce((acc, d) => acc + Number(d.saldo || 0), 0);
  const endivLongoPrazo = analise.endividamento_detalhado.filter(d => d.prazo === "Longo Prazo").reduce((acc, d) => acc + Number(d.saldo || 0), 0);
  
  const totalBancos = analise.endividamento_detalhado.filter(d => d.tipo === "Banco").reduce((acc, d) => acc + Number(d.saldo || 0), 0);
  const totalFundos = analise.endividamento_detalhado.filter(d => d.tipo === "Fundo").reduce((acc, d) => acc + Number(d.saldo || 0), 0);
  
  const percBancos = totEndivGeral > 0 ? (totalBancos / totEndivGeral) * 100 : 0;
  const percFundos = totEndivGeral > 0 ? (totalFundos / totEndivGeral) * 100 : 0;
  
  const totalDplsCP = analise.endividamento_detalhado.filter(d => d.prazo === "Curto Prazo" && (d.modalidade.toLowerCase().includes("desc") || d.modalidade.toLowerCase().includes("dupl"))).reduce((acc, d) => acc + Number(d.saldo || 0), 0);
  const percDplsCP = totEndivGeral > 0 ? (totalDplsCP / totEndivGeral) * 100 : 0;

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
              <div 
                key={item.id} 
                onClick={() => selecionarEmpresaDaEsteira(item.id)} 
                className={`p-2 border cursor-pointer border-b-slate-200 ${
                  idSelecionado === item.id 
                    ? "bg-blue-600 border-blue-700 text-white" 
                    : item.status === "em_processamento_ia" 
                    ? "bg-purple-50/70 border-purple-200 hover:bg-purple-100" 
                    : "bg-white hover:bg-slate-100"
                }`}
              >
                <div className="flex justify-between items-start gap-1">
                  <p className={`text-[10px] font-bold truncate flex-1 ${idSelecionado === item.id ? "text-white" : "text-slate-800"}`}>{item.empresa_nome}</p>
                  {item.status === "em_processamento_ia" && idSelecionado !== item.id && (
                    <span className="bg-purple-100 text-purple-700 font-black text-[8px] px-1 py-0.5 rounded animate-pulse uppercase shrink-0">ROBÔ</span>
                  )}
                </div>
                <p className={`text-[9px] font-mono mt-0.5 ${idSelecionado === item.id ? "text-blue-200" : "text-slate-500"}`}>{item.cnpj}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 w-full bg-white border border-slate-400 shadow-md flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
        {loadingAnalise ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="animate-spin text-2xl block text-green-600">⌛</span>
            <p className="text-[11px] font-bold text-slate-600 mt-2">Carregando Planilha...</p>
          </div>
        ) : (
          <>
            {/* TOOLBAR */}
            <div className="p-2 border-b border-slate-400 bg-[#f1f5f9] flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                {analise.status === "em_processamento_ia" ? (
                  <div className="bg-purple-600 text-white px-2 py-1 text-[10px] font-bold rounded-sm animate-pulse">IA PROCESSANDO</div>
                ) : (
                  <div className="bg-green-700 text-white px-2 py-1 text-[10px] font-bold rounded-sm">AUTO-SAVE</div>
                )}
                <div className="flex flex-col">
                  <input type="text" value={analise.razao_social} onChange={(e)=>setAnalise({...analise, razao_social: e.target.value})} className="font-bold text-slate-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-blue-400 w-96 uppercase" />
                  <input type="text" value={analise.cnpj} onChange={(e)=>setAnalise({...analise, cnpj: e.target.value})} className="font-mono text-[10px] text-slate-500 bg-transparent outline-none w-96" />
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button onClick={() => alert("Acionando extração em lote dos documentos mais recentes...")} className="bg-slate-800 border border-slate-900 hover:bg-slate-700 text-white font-bold px-3 py-1 text-[10px] shadow-sm cursor-pointer">
                  🤖 Ler Novos Docs
                </button>
                <button onClick={() => persistirNoBanco(true)} disabled={processandoDecisao} className="bg-slate-200 border border-slate-400 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1 text-[10px] shadow-sm cursor-pointer">
                  💾 Salvar
                </button>
                {idSelecionado && (
                  <>
                    <button onClick={encaminharParaComite} disabled={processandoDecisao || analise.status === "em_processamento_ia"} className="bg-blue-600 border border-blue-800 hover:bg-blue-700 text-white font-bold px-3 py-1 text-[10px] cursor-pointer shadow-sm disabled:opacity-40">
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
                { id: "cadastro", label: "Dados da Empresa" },
                { id: "societario", label: "Societário & Patrimônio" },
                { id: "fat", label: "Faturamento & Potencial" },
                { id: "endividamento", label: "Endividamento & Refs" },
                { id: "restritivos", label: "Restritivos & Jurídico" },
                { id: "parecer", label: "Parecer Final" }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setAbaAtiva(tab.id)} className={`px-4 py-1.5 font-bold text-[10px] border border-b-0 cursor-pointer whitespace-nowrap ${abaAtiva === tab.id ? "bg-white text-slate-900 border-slate-400 border-t-2 border-t-green-600 shadow-[0_1px_0_white] z-10" : "bg-[#cbd5e1] border-[#94a3b8] text-slate-600 hover:bg-slate-300"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* CONTEÚDO DA PLANILHA */}
            <div className="flex-1 overflow-y-auto p-4 bg-white relative">
              
              {/* ABA 1: CAPA E PROPOSTA */}
              {abaAtiva === "capa" && (
                <div className="max-w-6xl space-y-6">
                  {analise.status === "em_processamento_ia" && (
                    <div className="p-3 border border-purple-200 bg-purple-50 text-purple-900 font-bold text-xs rounded-sm flex items-center gap-2">
                      <span>🔮 O Motor Python V8 está lendo e estruturando os arquivos anexados a essa conta. Os dados abaixo vão atualizar dinamicamente!</span>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">
                      <span>Empresas (Principal e Coobrigados Base)</span>
                      <button onClick={() => addArray('empresas_principais', {razao_social:"", cnpj:""})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Linha Empresa</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <tbody>
                        {analise.empresas_principais?.map((emp, i) => (
                          <tr key={i}>
                            <td className={`${thStyle} w-1/6 text-right`}>{i === 0 ? "Empresa Principal" : "Coobrigado"}</td>
                            <td className={`${tdStyle} w-2/6`}><input value={emp.razao_social} onChange={(e)=>updateArray('empresas_principais', i, 'razao_social', e.target.value)} className={`${cellStyle} font-bold bg-slate-50`} /></td>
                            <td className={`${thStyle} w-1/6 text-right`}>CNPJ</td>
                            <td className={`${tdStyle} w-2/6 relative`}>
                              <input value={emp.cnpj} onChange={(e)=>updateArray('empresas_principais', i, 'cnpj', e.target.value)} className={`${cellStyle} font-mono bg-slate-50`} />
                              {i > 0 && <button onClick={()=>rmArray('empresas_principais', i)} className="absolute right-0 top-0 text-red-500 font-bold hover:bg-red-50 px-2 h-full border-l border-slate-300">X</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <table className="w-full border-collapse border border-slate-400">
                    <tbody>
                      <tr>
                        <td className={`${thStyle} text-right w-1/6`}>Relacionamento</td>
                        <td className={`${tdStyle} w-2/6`}>
                          <select value={analise.relacionamento} onChange={(e)=>setAnalise({...analise, relacionamento: e.target.value})} className={cellStyle}>
                            <option value="Prospect">Prospect</option><option value="Cliente">Cliente</option>
                          </select>
                        </td>
                        <td className={`${thStyle} text-right w-1/6`}>Data Análise</td><td className={`${tdStyle} w-2/6`}><input type="date" value={analise.data_analise} onChange={(e)=>setAnalise({...analise, data_analise: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>Gerente Comercial</td><td className={tdStyle}><input value={analise.gerente} onChange={(e)=>setAnalise({...analise, gerente: e.target.value})} className={cellStyle} /></td>
                        <td className={`${thStyle} text-right`}>Analista</td><td className={tdStyle}><input value={analise.analista} onChange={(e)=>setAnalise({...analise, analista: e.target.value})} className={cellStyle} /></td>
                      </tr>
                      <tr>
                        <td className={`${thStyle} text-right`}>RATING FINAL</td>
                        <td colSpan={3} className={tdStyle}>
                          <select value={analise.rating} onChange={(e)=>setAnalise({...analise, rating: e.target.value})} className={`${cellStyle} font-bold text-yellow-700 bg-yellow-50`}>
                            <option value="A - Risco reduced">A - Risco reduzido</option><option value="B - Risco médio">B - Risco médio</option><option value="C - Risco elevado">C - Risco elevado</option><option value="D - Fora do perfil">D - Fora do perfil</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>

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

                  <div>
                    <div className="bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">Relatório de Visitas</div>
                    <textarea 
                      value={analise.resumo_visita} 
                      onChange={(e) => setAnalise({...analise, resumo_visita: e.target.value})}
                      className="w-full p-2 border border-slate-400 h-40 font-sans text-[12px] outline-none resize-none bg-[#f8fafc]"
                      placeholder="Detalhes da visita corporativa..."
                    />
                  </div>
                </div>
              )}

              {/* ABA 2: DADOS DA EMPRESA */}
              {abaAtiva === "cadastro" && (
                <div className="max-w-6xl space-y-6">
                  <div>
                    <div className="bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">Dados Cadastrais e Financeiros Básicos</div>
                    <table className="w-full border-collapse border border-slate-400">
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
                          <td className={`${thStyle} text-right`}>Licenças/Certificações</td><td className={tdStyle}><input value={analise.licencas} onChange={(e)=>setAnalise({...analise, licencas: e.target.value})} className={cellStyle} /></td>
                          <td className={`${thStyle} text-right`}>Balanço Auditado?</td>
                          <td className={tdStyle}>
                            <select value={analise.balanco_auditado} onChange={(e)=>setAnalise({...analise, balanco_auditado: e.target.value})} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                          </td>
                        </tr>
                        <tr>
                          <td className={`${thStyle} text-right`}>Consultoria/Gestão?</td>
                          <td className={tdStyle}>
                            <select value={analise.consultoria_gestao} onChange={(e)=>setAnalise({...analise, consultoria_gestao: e.target.value})} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                          </td>
                          <td className={`${thStyle} text-right`}>Site da Empresa</td><td className={tdStyle}><input value={analise.site} onChange={(e)=>setAnalise({...analise, site: e.target.value})} className={cellStyle} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Organograma, Fotos e Endereços Externos (URLs)</div>
                    <table className="w-full border-collapse border border-slate-400">
                      <tbody>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right bg-purple-50 text-purple-900 border-purple-200`}>Organograma Interativo (Teia JSON)</td>
                          <td className={`${tdStyle} bg-purple-50/30`}>
                            <div className="flex gap-2 items-center h-full px-2">
                              <button
                                onClick={() => {
                                  if(!analise.id) return alert("💡 Salve a análise no banco antes de gerar a teia!");
                                  const cnpjLimpo = analise.cnpj.replace(/\D/g, '');
                                  window.open(`/dashboard/busca-grupo?analise_id=${analise.id}&cnpj=${cnpjLimpo}`, '_blank');
                                }}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 text-[10px] rounded shadow-sm flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                🕸️ Abrir Gerador de Teia
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
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-1 px-3 text-[10px] rounded border border-slate-400 shadow-sm whitespace-nowrap"
                              >
                                📎 Anexar JSON
                              </button>
                              
                              {analise.organograma_json && analise.organograma_json.nodes?.length > 0 ? (
                                <span className="text-green-600 font-bold text-[10px] flex items-center gap-1 ml-2">
                                  ✅ Teia vinculada! ({analise.organograma_json.nodes.length} nós)
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px] italic ml-2">Sem teia mapeada</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        <tr><td className={`${thStyle} w-1/4 text-right`}>URL Organograma (Imagem estática)</td><td className={tdStyle}><input type="text" value={analise.anexos?.organograma_url || ""} onChange={(e) => updateNested("anexos", "organograma_url", e.target.value)} className={cellStyle} placeholder="Link da Imagem..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Fachada</td><td className={tdStyle}><input type="text" value={analise.anexos?.fachada_url || ""} onChange={(e) => updateNested("anexos", "fachada_url", e.target.value)} className={cellStyle} placeholder="Link do Google Street View..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Satélite (Maps)</td><td className={tdStyle}><input type="text" value={analise.anexos?.satelite_url || ""} onChange={(e) => updateNested("anexos", "satelite_url", e.target.value)} className={cellStyle} placeholder="Link da Visão do Satélite..." /></td></tr>
                        <tr><td className={`${thStyle} text-right`}>URL Fotos da Visita</td><td className={tdStyle}><input type="text" value={analise.anexos?.fotos_visita_url || ""} onChange={(e) => updateNested("anexos", "fotos_visita_url", e.target.value)} className={cellStyle} placeholder="Pasta de Evidências Fotográficas..." /></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ABA 3: SOCIETÁRIO E PATRIMÔNIO */}
              {abaAtiva === "societario" && (
                <div className="space-y-6">
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

                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[11px] font-bold p-1.5 border border-slate-800">
                      <span>Estrutura Societária</span>
                      <button onClick={() => addArray('socios', {nome:"", perc:0, funcao:"Sócio", figure_contrato:"Sim"})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Sócio</button>
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
                              <select value={s.figure_contrato} onChange={(e)=>updateArray('socios', i, 'figure_contrato', e.target.value)} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                            </td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('socios', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <table className="w-full mt-2 border-collapse border border-slate-400">
                      <tbody>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right`}>Regra de Assinatura</td>
                          <td className={tdStyle}><input value={analise.regra_assinatura} onChange={(e)=>setAnalise({...analise, regra_assinatura: e.target.value})} className={cellStyle} placeholder="( ) em conjunto (x) isolada" /></td>
                        </tr>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right`}>Aval Societário</td>
                          <td className={tdStyle}><input value={analise.aval_societario} onChange={(e)=>setAnalise({...analise, aval_societario: e.target.value})} className={cellStyle} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

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
                            <td className={tdStyle}><input value={p.socio} onChange={(e)=>updateArray('patrimonios', i, 'socio', e.target.value)} className={`${cellStyle} font-bold text-slate-600`} /></td>
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

              {/* ABA 4: FATURAMENTO E POTENCIAL */}
              {abaAtiva === "fat" && (
                <div className="space-y-6">
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
                                <td className={tdStyle}>
                                  <MathInput value={analise.dados_faturamento["2026"]?.[mes]} onChange={(val) => handleFat("2026", mes, val)} className={numStyle} />
                                </td>
                                <td className={`${tdStyle} text-center font-bold text-[10px] ${d26 > 0 ? 'text-green-600' : d26 < 0 ? 'text-red-600' : 'text-slate-400'}`}>{d26 === 0 ? "-" : `${d26.toFixed(1)}%`}</td>
                                <td className={tdStyle}>
                                  <MathInput value={analise.dados_faturamento["2025"]?.[mes]} onChange={(val) => handleFat("2025", mes, val)} className={numStyle} />
                                </td>
                                <td className={`${tdStyle} text-center font-bold text-[10px] ${d25 > 0 ? 'text-green-600' : d25 < 0 ? 'text-red-600' : 'text-slate-400'}`}>{d25 === 0 ? "-" : `${d25.toFixed(1)}%`}</td>
                                <td className={tdStyle}>
                                  <MathInput value={analise.dados_faturamento["2024"]?.[mes]} onChange={(val) => handleFat("2024", mes, val)} className={numStyle} />
                                </td>
                              </tr>
                            );
                          })}

                          <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-[10px]">
                            <td className="p-1.5 border border-slate-400 text-slate-800">TOTAL ANO</td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-blue-700">{calcTotAno("2026").toLocaleString("pt-BR")}</td>
                            <td className="border border-slate-400 bg-white"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-slate-700">{calcTotAno("2025").toLocaleString("pt-BR")}</td>
                            <td className="border border-slate-400 bg-white"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-slate-700">{calcTotAno("2024").toLocaleString("pt-BR")}</td>
                          </tr>
                          
                          <tr className="bg-slate-200 border-t border-slate-400 font-bold text-[10px]">
                            <td className="p-1.5 border border-slate-400 text-slate-800">MÉDIA GERAL ANO</td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-blue-800">{calcMediaGeralAno("2026").toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className="border border-slate-400 bg-white"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-slate-700">{calcMediaGeralAno("2025").toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className="border border-slate-400 bg-white"></td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-slate-700">{calcMediaGeralAno("2024").toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                          </tr>

                          <tr className="bg-blue-50 border-t-2 border-blue-300 font-bold text-[10px]">
                            <td className="p-1.5 border border-slate-400 text-blue-900 uppercase" title="Média apenas dos meses correspondentes preenchidos">
                                {labelMascaraYTD}
                            </td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-blue-900">{mediaYTD26.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className={`border border-slate-400 text-center ${varYTD26_25 > 0 ? 'text-green-600' : varYTD26_25 < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                              {varYTD26_25 === 0 ? "-" : `${varYTD26_25.toFixed(1)}%`}
                            </td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-slate-800">{mediaYTD25.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className={`border border-slate-400 text-center ${varYTD25_24 > 0 ? 'text-green-600' : varYTD25_24 < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                              {varYTD25_24 === 0 ? "-" : `${varYTD25_24.toFixed(1)}%`}
                            </td>
                            <td className="p-1.5 border border-slate-400 text-right font-mono text-slate-800">{mediaYTD24.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Parâmetros de Recebimento e Prazos</div>
                      <table className="w-full border-collapse border border-slate-400">
                        <tbody>
                          <tr><td className={`${thStyle} text-right w-1/2`}>Ticket Médio (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e)=>updateNested("dados_potencial", "ticket_medio", Number(e.target.value))} className={numStyle} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Dpls</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_dpls} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_dpls", e.target.value)} className={cellStyle} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Comissária</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_comissaria} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_comissaria", e.target.value)} className={cellStyle} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Intercompany</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_intercompany || ""} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_intercompany", e.target.value)} className={cellStyle} /></td></tr>
                          
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td className={`${thStyle} text-right font-bold`}>Forma Receb. (À Vista %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_vista} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_vista", Number(e.target.value))} className={`${numStyle} text-blue-700`} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right font-bold`}>Forma Receb. (A Prazo %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_prazo} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_prazo", Number(e.target.value))} className={`${numStyle} text-blue-700 font-bold bg-yellow-50`} /></td>
                          </tr>
                          <tr className="bg-slate-100 border-t border-slate-300">
                            <td className={`${thStyle} text-right`}>Composição (Duplicatas %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_dpls} onChange={(e)=>updateNested("dados_potencial", "composicao_dpls", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Composição (Comissária %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_comissaria} onChange={(e)=>updateNested("dados_potencial", "composicao_comissaria", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Composição (Intercompany %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_intercompany || 0} onChange={(e)=>updateNested("dados_potencial", "composicao_intercompany", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Composição (Outros %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_outros || 0} onChange={(e)=>updateNested("dados_potencial", "composicao_outros", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-blue-50 border border-blue-300 p-6 flex flex-col justify-center items-center text-center rounded-sm">
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Potencial Real Estimado (Ciclo a Prazo)</span>
                      <span className="font-mono text-3xl font-black text-blue-700 mt-2">R$ {potencialRealCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      
                      <div className="text-[9px] text-slate-500 mt-4 space-y-1">
                          <p><strong>Faturamento Base (Média Parcial/YTD):</strong> R$ {faturamentoMedioReferencia.toLocaleString("pt-BR", {maximumFractionDigits:2})}</p>
                          <p><strong>Cálculo Realizado:</strong> ((Fat. Base ÷ 30) × Prazo) × Composição(%) × Receb. a Prazo(%)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 5: ENDIVIDAMENTO E REFERÊNCIAS */}
              {abaAtiva === "endividamento" && (
                <div className="space-y-6">
                  <div>
                    <div className="bg-slate-800 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-900">Endividamento Bancos e Fundos (Visão Resumida Geral)</div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr>
                          <th className={thStyle}>Curto Prazo</th>
                          <th className={thStyle}>Longo Prazo</th>
                          <th className={`${thStyle} bg-red-100 text-red-900`}>TOTAL GERAL CEDENTE</th>
                          <th className={thStyle}>Curto Prazo DPLS (%)</th>
                          <th className={thStyle}>Fundos (%)</th>
                          <th className={thStyle}>Bancos (%)</th>
                          <th className={thStyle}>Renegociando?</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-slate-50 font-mono text-[11px] text-right font-bold">
                          <td className="p-1.5 border border-slate-400 text-slate-700">R$ {endivCurtoPrazo.toLocaleString("pt-BR")}</td>
                          <td className="p-1.5 border border-slate-400 text-slate-700">R$ {endivLongoPrazo.toLocaleString("pt-BR")}</td>
                          <td className="p-1.5 border border-slate-400 text-red-700 bg-red-50/50">R$ {totEndivGeral.toLocaleString("pt-BR")}</td>
                          <td className="p-1.5 border border-slate-400 text-center text-slate-600">{percDplsCP.toFixed(1)}%</td>
                          <td className="p-1.5 border border-slate-400 text-center text-slate-600">{percFundos.toFixed(1)}%</td>
                          <td className="p-1.5 border border-slate-400 text-center text-slate-600">{percBancos.toFixed(1)}%</td>
                          <td className="p-0 border border-slate-400 text-center bg-white">
                             <select value={analise.endividamento_resumo.renegociando} onChange={(e)=>updateNested("endividamento_resumo", "renegociando", e.target.value)} className="w-full h-full p-1 text-center font-sans text-[11px] bg-transparent outline-none"><option value="Não">Não</option><option value="Sim">Sim</option></select>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={7} className="p-2 text-center text-[10px] text-slate-500 bg-slate-100 font-sans border border-slate-400">
                            Alavancagem Cedente / Faturamento Base Oficial: <strong className="text-slate-800 text-xs">{faturamentoMedioReferencia > 0 ? (totEndivGeral / faturamentoMedioReferencia).toFixed(2) : "0.00"} x</strong> o faturamento médio.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold p-1.5 border border-slate-800">
                      <span>Detalhamento Informado (Dívidas no Documento)</span>
                      <button onClick={() => addArray('endividamento_detalhado', {instituicao:"", modalidade:"", saldo:0, tipo:"Banco", prazo:"Curto Prazo"})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Instituição</button>
                    </div>
                    <table className="w-full border-collapse border border-slate-400">
                      <thead>
                        <tr>
                          <th className={thStyle}>Credor / Instituição</th>
                          <th className={thStyle}>Modalidade</th>
                          <th className={`${thStyle} w-40 text-right`}>Saldo Devedor (R$)</th>
                          <th className={`${thStyle} w-28`}>Tipo Fundo/Banco</th>
                          <th className={`${thStyle} w-28`}>Prazo CP/LP</th>
                          <th className={`${thStyle} w-8`}>-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.endividamento_detalhado.map((div, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={div.instituicao} onChange={(e)=>updateArray('endividamento_detalhado', i, 'instituicao', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input value={div.modalidade} onChange={(e)=>updateArray('endividamento_detalhado', i, 'modalidade', e.target.value)} className={cellStyle} placeholder="Ex: Capital de Giro, Desconto..." /></td>
                            <td className={tdStyle}><input type="number" value={div.saldo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'saldo', Number(e.target.value))} className={`${numStyle} font-bold text-red-600`} /></td>
                            <td className={tdStyle}>
                              <select value={div.tipo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'tipo', e.target.value)} className={cellStyle}>
                                <option value="Banco">Banco</option><option value="Fundo">Fundo</option>
                              </select>
                            </td>
                            <td className={tdStyle}>
                              <select value={div.prazo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'prazo', e.target.value)} className={cellStyle}>
                                <option value="Curto Prazo">Curto Prazo</option><option value="Longo Prazo">Longo Prazo</option>
                              </select>
                            </td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('endividamento_detalhado', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full">X</button></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-200 border-t-2 border-slate-400">
                          <td colSpan={2} className="p-1.5 text-right font-bold text-[10px]">SOMA TOTAL DETALHADA</td>
                          <td className="p-1.5 text-right font-mono font-bold text-red-700 text-[11px]">R$ {totEndivGeral.toLocaleString("pt-BR")}</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold p-1.5 border border-slate-800">
                      <span>Informações com Fundos de Investimentos / Referências (Com Risco, Liq e VOP)</span>
                      <button onClick={() => addArray('referencias', {instituicao:"", rnx:"", cliente_desde:"", ultima_operacao:"", limite_global:0, risco_total:0, risco_1:0, operacao_1:"", vcto_1:"", risco_2:0, operacao_2:"", vcto_2:"", liquidez_5_dias:"", liquidez_pontual:"", atraso_5_dias:"", atraso_15_dias:"", recompra:"", concentracao:0})} className="bg-slate-600 hover:bg-slate-500 border border-slate-400 px-2 rounded text-[9px]">+ Referência</button>
                    </div>
                    <div className="overflow-x-auto border border-slate-400">
                      <table className="w-full border-collapse min-w-[1400px]">
                        <thead>
                          <tr>
                            <th className={thStyle}>Fundo</th><th className={thStyle}>RNX</th><th className={`${thStyle} w-20`}>Desde</th><th className={`${thStyle} w-24`}>Últ. Op</th>
                            <th className={`${thStyle} w-28 text-right`}>Limite</th><th className={`${thStyle} w-28 text-right`}>Risco Total</th>
                            <th className={`${thStyle} w-24 text-right bg-blue-100`}>Risco 1 (R$)</th><th className={`${thStyle} bg-blue-100`}>Op 1</th><th className={`${thStyle} bg-blue-100`}>Vcto 1</th>
                            <th className={`${thStyle} w-24 text-right bg-yellow-100`}>Risco 2 (R$)</th><th className={`${thStyle} bg-yellow-100`}>Op 2</th><th className={`${thStyle} bg-yellow-100`}>Vcto 2</th>
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

              {/* ABA 6: RESTRITIVOS E JURÍDICO */}
              {abaAtiva === "restritivos" && (
                <div className="space-y-6">
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

                  <div>
                    <div className="flex justify-between items-center bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">
                      <span>Apontamentos Restritivos Detalhados (Serasa/Boa Vista)</span>
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

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      {/* 🔥 AQUI ENTRA O NOVO PARECER DO KAPPI */}
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800 flex gap-2 items-center">
                         <span>⚖️ Parecer Jurídico Consolidado (Kappi / Jusbrasil)</span>
                         {analise.status === "em_processamento_ia" && <span className="bg-purple-600 px-1 rounded animate-pulse">LENDO PROCESSOS...</span>}
                      </div>
                      <textarea 
                         value={analise.dados_juridico?.relatorio_completo || ""} 
                         onChange={(e)=>updateNested("dados_juridico", "relatorio_completo", e.target.value)} 
                         className="w-full h-64 p-3 border border-slate-400 outline-none text-[11px] font-sans resize-none bg-slate-50 leading-relaxed" 
                         placeholder="Aguardando dados da IA ou digite manualmente..."
                      />
                    </div>
                    <div>
                      <div className="bg-slate-700 text-white text-[10px] font-bold uppercase p-1.5 border border-slate-800">Pesquisas e Notícias de Mídia</div>
                      <textarea value={analise.noticias_midia} onChange={(e)=>setAnalise({...analise, noticias_midia: e.target.value})} className="w-full h-20 p-2 border border-slate-400 outline-none text-[11px] font-sans resize-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 7: PARECER FINAL */}
              {abaAtiva === "parecer" && (
                <div className="space-y-6 max-w-5xl">
                
                  <div className="bg-white border-2 border-slate-400 p-3">
                    <h3 className="text-[11px] font-bold text-slate-800 uppercase mb-2 border-b border-slate-300 pb-1">Parecer Técnico do Analista (Humano)</h3>
                    <textarea 
                      value={analise.parecer_analista} 
                      onChange={(e) => setAnalise({...analise, parecer_analista: e.target.value})}
                      className="w-full p-3 border border-slate-300 h-64 font-sans text-[12px] outline-none resize-none bg-[#f8fafc]"
                      placeholder="Conclusão final da mesa de análise. Use a súmula da IA acima como base..."
                    />
                  </div>

                  {analise.parecer_comite && (
                    <div className="bg-white border-2 border-blue-400 p-3 mt-4">
                      <h3 className="text-[11px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Votos e Deliberação do Comitê</h3>
                      <div className="text-[12px] text-slate-700 bg-blue-50 p-2 whitespace-pre-wrap">
                        {analise.parecer_comite}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-100 border-2 border-slate-400 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-[12px] font-bold text-slate-800 uppercase">Sugestão de Veredito / Recomendação Final:</h3>
                      <p className="text-[10px] text-slate-500">Essa escolha definirá o parecer enviado para a validação final do comitê.</p>
                    </div>
                    <select 
                      value={analise.recomendacao_analista || ""} 
                      onChange={(e)=>setAnalise({...analise, recomendacao_analista: e.target.value})} 
                      className="bg-yellow-100 border border-yellow-500 text-yellow-900 font-bold px-4 py-2 text-[12px] outline-none cursor-pointer shadow-sm w-full md:w-64"
                    >
                      <option value="">Escolha o Veredito...</option>
                      <option value="Aprovado">✅ Aprovado</option>
                      <option value="Reprovado">❌ Reprovado</option>
                      <option value="Em Análise">⏳ Em Análise / Pendente</option>
                    </select>
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