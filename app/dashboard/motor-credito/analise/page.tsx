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
  vop?: number; // NOVO CAMPO: Volume de Operação
  limite_global: number;
  risco_total: number;
  risco_1: number;
  operacao_1: string;
  vcto_1: string;
  risco_2: number;
  operacao_2: string;
  vcto_2: string;
  liquidez_5_dias: string | number; // Agora calculado
  liquidez_pontual: string | number;
  atraso_5_dias: string | number;
  atraso_15_dias: string | number;
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
  comercial?: string; 

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

  // CAMPOS DO MOTOR V8
  dados_juridico: { relatorio_completo: string };
  parecer_executivo: string;

  // GRAFO DE GRUPO ECONÔMICO (JSON DAS BOLINHAS DA TEIA)
  organograma_json?: { nodes: any[], edges: any[] } | null;

  [key: string]: any;
}

const DADOS_MODELO: AnaliseData = {
  id: null, cnpj: "00.000.000/0001-00", razao_social: "EMPRESA MODELO LTDA", comercial: "",
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
    <div className="font-sans antialiased text-slate-800 bg-slate-50">
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-sm text-indigo-500 animate-pulse">⚡ Inicializando Motor V8...</div>}>
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

  const [modalDocsAberto, setModalDocsAberto] = useState(false);
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

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
          dados_juridico: { ...DADOS_MODELO.dados_juridico, ...(dc.dados_juridico || {}) }, 
          id: data.id, 
          cnpj: cnpj, 
          razao_social: razao_social, 
          status: data.status,
          comercial: data.comercial || ""
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
      const { id, cnpj, razao_social, status, comercial, ...dadosParaCompactar } = analise;
      dadosParaCompactar.dados_potencial.potencial_estimado = potencialRealCalculado;
      
      const { error } = await supabase.from("analises").update({ 
        dados_consolidados: dadosParaCompactar,
        empresa_nome: analise.razao_social
      }).eq("id", analise.id);
      
      if (error) throw error;
      if (mostrarAlerta) alert("✅ Matriz salva com sucesso no banco de dados!");
      return true;
    } catch (err: any) { 
      alert("❌ Erro ao salvar dados: " + err.message); return false; 
    } finally { 
      setProcessandoDecisao(false); 
    }
  };

  const vincularComercial = async () => {
    if (!idSelecionado || !analise.id) {
      alert("💡 Selecione uma análise real na esteira antes de vincular o Comercial.");
      return;
    }
    const novoComercial = prompt("Digite o nome completo do Comercial para vincular a esta conta:", analise.comercial || "");
    if (novoComercial === null) return; 
    
    try {
      setProcessandoDecisao(true);
      const { error } = await supabase.from("analises").update({ comercial: novoComercial.trim() }).eq("id", analise.id);
      if (error) throw error;
      
      setAnalise({ ...analise, comercial: novoComercial.trim() });
      alert("✅ Comercial vinculado com sucesso à análise!");
    } catch (err: any) {
      alert("❌ Falha ao vincular o comercial: " + err.message);
    } finally {
      setProcessandoDecisao(false);
    }
  };

  const processarNovosDocumentos = async () => {
    if (!idSelecionado || novosArquivos.length === 0) return;

    try {
      setUploadingDocs(true);
      
      const urlsNovosDocs: string[] = [];
      const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://sua-url-r2-publica.com";

      for (let i = 0; i < novosArquivos.length; i++) {
        const file = novosArquivos[i];
        const pathDinamicoR2 = `analises/${idSelecionado}/adicionais/${Date.now()}`;

        const resAuth = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            analiseId: pathDinamicoR2
          }),
        });

        const dataAuth = await resAuth.json().catch(() => ({}));

        if (!resAuth.ok || dataAuth.error) {
          throw new Error(dataAuth.error || `Erro ao autorizar arquivo ${file.name}`);
        }

        const { url, path } = dataAuth;

        const uploadRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Cloudflare rejeitou o arquivo ${file.name} (Erro ${uploadRes.status}).`);
        }

        const pathCodificado = path.split('/').map((segment: string) => encodeURIComponent(segment)).join('/');
        urlsNovosDocs.push(`${r2BaseUrl}/${pathCodificado}`);
      }
      
      if (urlsNovosDocs.length === 0) {
        throw new Error("Nenhuma URL foi gerada no upload.");
      }

      const { data: analiseDB } = await supabase.from("analises").select("dados_documentos").eq("id", idSelecionado).single();
      const docsAtuais = analiseDB?.dados_documentos || [];
      const docsAtualizados = [...docsAtuais, ...urlsNovosDocs];

      await supabase.from("analises").update({ dados_documentos: docsAtualizados }).eq("id", idSelecionado);

      const resIA = await fetch("/api/motor-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analise_id: idSelecionado,
          urls_documentos: urlsNovosDocs,
          modo_atualizacao: true
        })
      });

      if (!resIA.ok) throw new Error("Falha ao acionar o Motor V8 no Render");

      setAnalise(prev => ({ ...prev, status: "em_processamento_ia" }));
      await supabase.from("analises").update({ status: "em_processamento_ia" }).eq("id", idSelecionado);

      alert("🤖 Documentos enviados com sucesso! A IA está processando e os dados serão mesclados em breve.");
      setModalDocsAberto(false);
      setNovosArquivos([]);
      
    } catch (err: any) {
      alert("❌ Erro: " + err.message);
    } finally {
      setUploadingDocs(false);
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
      
      try {
        const { data: analiseDB } = await supabase.from("analises").select("dados_ia_brutos").eq("id", analise.id).single();

        if (analiseDB?.dados_ia_brutos) {
            const iaOriginal = analiseDB.dados_ia_brutos;
            if (JSON.stringify(iaOriginal.endividamento_detalhado) !== JSON.stringify(analise.endividamento_detalhado)) {
                await supabase.from("memoria_credito").insert({ analise_id: analise.id, cnpj: analise.cnpj, categoria: "endividamento", erro_ia: iaOriginal.endividamento_detalhado, correcao_humana: analise.endividamento_detalhado });
            }
            if (JSON.stringify(iaOriginal.dados_faturamento) !== JSON.stringify(analise.dados_faturamento)) {
                await supabase.from("memoria_credito").insert({ analise_id: analise.id, cnpj: analise.cnpj, categoria: "faturamento", erro_ia: iaOriginal.dados_faturamento, correcao_humana: analise.dados_faturamento });
            }
        }
      } catch (memError) {
        console.error("Erro na rotina de memória da IA (não impede o envio):", memError);
      }
      
      const { error } = await supabase.from("analises").update({ status: "aberta" }).eq("id", analise.id);
      if (error) throw error;
      
      alert(`🚀 Análise finalizada com sucesso! Se houve correções, a IA foi notificada para aprender com o erro.`);
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
      const { id, cnpj, razao_social, status, comercial, ...dadosParaCompactar } = analise;
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
    } else setAnalise({ ...analise, [campo]: novoArray });
  };
  const addArray = (campo: keyof AnaliseData, obj: any) => setAnalise({ ...analise, [campo]: [...(analise[campo] as any[]), obj] });
  const rmArray = (campo: keyof AnaliseData, index: number) => setAnalise({ ...analise, [campo]: (analise[campo] as any[]).filter((_, i) => i !== index) });
  const updateNested = (campoPai: keyof AnaliseData, campoFilho: string, valor: any) => setAnalise({ ...analise, [campoPai]: { ...(analise[campoPai] as any), [campoFilho]: valor } });

  const handleFat = (ano: string, mes: string, val: string) => {
    const fatAtual = { ...analise.dados_faturamento };
    if (!fatAtual[ano]) fatAtual[ano] = {};
    fatAtual[ano][mes] = val; 
    setAnalise({ ...analise, dados_faturamento: fatAtual });
  };

  // =========================================================================
  // FÓRMULAS DE FATURAMENTO E POTENCIAL YTD E GERAL
  // =========================================================================
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  
  let lastFilledIndex26 = -1;
  for (let i = 11; i >= 0; i--) {
      if (Number(analise.dados_faturamento["2026"]?.[meses[i]] || 0) > 0) { lastFilledIndex26 = i; break; }
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
      return calcTotAno(ano) / (ano === "2026" ? pre : 12); 
  }; 
  
  const calcDelta = (m: string, aAt: string, aAnt: string) => { const at = Number(analise.dados_faturamento[aAt]?.[m] || 0); const ant = Number(analise.dados_faturamento[aAnt]?.[m] || 0); return !ant || ant === 0 ? 0 : ((at - ant) / ant) * 100; };

  const varYTD26_25 = mediaYTD25 > 0 ? ((mediaYTD26 - mediaYTD25) / mediaYTD25) * 100 : 0;
  const varYTD25_24 = mediaYTD24 > 0 ? ((mediaYTD25 - mediaYTD24) / mediaYTD24) * 100 : 0;

  // Calculando variações para o TOTAL ANO
  const totAno26 = calcTotAno("2026");
  const totAno25 = calcTotAno("2025");
  const totAno24 = calcTotAno("2024");
  const varTot26_25 = totAno25 > 0 ? ((totAno26 - totAno25) / totAno25) * 100 : 0;
  const varTot25_24 = totAno24 > 0 ? ((totAno25 - totAno24) / totAno24) * 100 : 0;

  // Calculando variações para a MÉDIA GERAL (Mês)
  const medGeral26 = calcMediaGeralAno("2026");
  const medGeral25 = calcMediaGeralAno("2025");
  const medGeral24 = calcMediaGeralAno("2024");
  const varMedGeral26_25 = medGeral25 > 0 ? ((medGeral26 - medGeral25) / medGeral25) * 100 : 0;
  const varMedGeral25_24 = medGeral24 > 0 ? ((medGeral25 - medGeral24) / medGeral24) * 100 : 0;

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

  // =========================================================================
  // NOVOS ESTILOS REFINADOS (UI/UX)
  // =========================================================================
  const cellStyle = "w-full h-full py-1.5 px-2 bg-transparent outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500 font-sans text-[11px] text-slate-700 transition-all placeholder-slate-400";
  const numStyle = "w-full h-full py-1.5 px-2 bg-transparent outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500 font-mono text-[11px] text-right text-slate-800 transition-all placeholder-slate-400";
  const thStyle = "p-2 bg-slate-100 border border-slate-200 font-semibold text-[10px] text-slate-600 uppercase tracking-wider text-center";
  const tdStyle = "border border-slate-200 p-0 bg-white hover:bg-slate-50 relative focus-within:bg-indigo-50/40 transition-colors h-8";
  const sectionHeaderStyle = "flex justify-between items-center bg-indigo-950 text-white text-[11px] font-semibold tracking-wide p-2.5 rounded-t-md shadow-sm border border-indigo-950";
  const btnSecundario = "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 text-[11px] rounded shadow-sm transition-all cursor-pointer disabled:opacity-50";
  const btnPrimario = "bg-indigo-600 border border-indigo-700 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 text-[11px] rounded shadow-sm transition-all cursor-pointer disabled:opacity-50";

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start bg-slate-50 min-h-screen p-4 md:p-6 relative">
      
      {/* SIDEBAR REFINADA */}
      <div className="w-full xl:w-72 shrink-0 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col h-[calc(100vh-3rem)] sticky top-6 z-20 overflow-hidden">
        <div className="flex justify-between items-center bg-slate-100/80 p-4 border-b border-slate-200">
          <span className="font-bold text-slate-800 text-xs tracking-wide">ESTEIRA DE ANÁLISES <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">{fila.length}</span></span>
          <button onClick={() => buscarFilaSupabase(true)} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer transition-colors">Atualizar</button>
        </div>
        <div className="space-y-1 overflow-y-auto p-2 flex-1 scrollbar-thin scrollbar-thumb-slate-300">
          <div onClick={() => { setIdSelecionado(null); setAnalise(DADOS_MODELO); }} className={`p-3 rounded-lg cursor-pointer transition-all ${idSelecionado === null ? "bg-indigo-50 border-indigo-500 border shadow-sm" : "bg-transparent border border-transparent hover:bg-slate-50"}`}>
            <p className="text-[11px] font-bold text-indigo-900 flex items-center gap-2">📄 Novo Template Vazio</p>
          </div>
          {loadingFila ? (
            <div className="text-center py-6 text-slate-400 text-[11px] animate-pulse">Sincronizando esteira...</div>
          ) : (
            fila.map((item) => (
              <div 
                key={item.id} 
                onClick={() => selecionarEmpresaDaEsteira(item.id)} 
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  idSelecionado === item.id 
                    ? "bg-indigo-600 border-indigo-700 text-white shadow-md" 
                    : item.status === "em_processamento_ia" 
                    ? "bg-purple-50 border-purple-200 hover:bg-purple-100" 
                    : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className={`text-[11px] font-bold truncate flex-1 ${idSelecionado === item.id ? "text-white" : "text-slate-800"}`} title={item.empresa_nome}>{item.empresa_nome}</p>
                  {item.status === "em_processamento_ia" && idSelecionado !== item.id && (
                    <span className="bg-purple-200 text-purple-800 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm animate-pulse uppercase shrink-0">ROBÔ LENDO</span>
                  )}
                </div>
                <p className={`text-[10px] font-mono mt-1 ${idSelecionado === item.id ? "text-indigo-200" : "text-slate-500"}`}>{item.cnpj}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* WORKSPACE PRINCIPAL REFINADO */}
      <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
        {loadingAnalise ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[12px] font-semibold text-slate-600 mt-4 tracking-wide">Carregando dados estruturados...</p>
          </div>
        ) : (
          <>
            {/* TOOLBAR MODERNA */}
            <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                {analise.status === "em_processamento_ia" ? (
                  <div className="bg-purple-100 border border-purple-300 text-purple-800 px-2 py-1 text-[10px] font-bold rounded shadow-sm animate-pulse">⚙️ IA EM AÇÃO</div>
                ) : (
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-2 py-1 text-[10px] font-bold rounded shadow-sm">✅ AUTO-SAVE</div>
                )}
                <div className="flex flex-col">
                  <input type="text" value={analise.razao_social} onChange={(e)=>setAnalise({...analise, razao_social: e.target.value})} className="font-bold text-slate-900 text-lg bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-400 w-full min-w-[300px] xl:w-[450px] uppercase transition-colors" placeholder="NOME DA EMPRESA" />
                  <div className="flex gap-4 mt-0.5">
                    <input type="text" value={analise.cnpj} onChange={(e)=>setAnalise({...analise, cnpj: e.target.value})} className="font-mono text-xs text-slate-500 bg-transparent outline-none w-36" placeholder="00.000.000/0001-00" />
                    {analise.comercial && <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 rounded-full border border-indigo-100">🤝 Resp: {analise.comercial}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => setModalDocsAberto(true)} 
                  disabled={!idSelecionado || processandoDecisao || analise.status === "em_processamento_ia"} 
                  className={btnSecundario} 
                  title="Adicionar novos PDFs (Balanço, Endividamento) para mesclar com esta análise"
                >
                  🤖 Add e Ler Novos Docs
                </button>
                <button onClick={vincularComercial} disabled={!idSelecionado || processandoDecisao} className={btnSecundario}>
                  👤 Vincular Comercial
                </button>
                <button onClick={() => persistirNoBanco(true)} disabled={processandoDecisao} className={btnSecundario}>
                  💾 Salvar Manual
                </button>
                {idSelecionado && (
                  <>
                    <button onClick={devolverParaComercialPendente} disabled={processandoDecisao} className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold px-3 py-1.5 text-[11px] rounded shadow-sm transition-all cursor-pointer disabled:opacity-50">
                      ✖ Devolver Req.
                    </button>
                    <GerarAnalise analise={analise} />
                    <button onClick={encaminharParaComite} disabled={processandoDecisao || analise.status === "em_processamento_ia"} className={btnPrimario}>
                      ▶ Emitir Parecer Final
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ABAS ESTILO PILLS */}
            <div className="bg-slate-50 border-b border-slate-200 flex gap-1.5 px-4 pt-3 pb-3 overflow-x-auto scrollbar-none">
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

            {/* ÁREA DA PLANILHA */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 relative scrollbar-thin scrollbar-thumb-slate-300">
              
              {/* ABA 1: CAPA E PROPOSTA */}
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
                          <td className="p-2 text-right font-mono font-bold text-indigo-800 text-[12px]">R$ {totLimites.toLocaleString('pt-BR')}</td>
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
                      placeholder="Insira detalhes qualitativos da visita, impressões sobre a sede, maquinário, gestão..."
                    />
                  </div>
                </div>
              )}

              {/* ABA 2: DADOS DA EMPRESA */}
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

              {/* ABA 3: SOCIETÁRIO E PATRIMÔNIO */}
              {abaAtiva === "societario" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl">
                  <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                    <div className={sectionHeaderStyle}>
                      <span>Background do Grupo Econômico</span>
                      <button onClick={() => addArray('empresas_grupo', {empresa:"", cnpj:"", fundacao:"", idade:""})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Nova Empresa</button>
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr><th className={thStyle}>Razão Social</th><th className={`${thStyle} w-44`}>CNPJ</th><th className={`${thStyle} w-32`}>Data Fundação</th><th className={`${thStyle} w-24`}>Idade Aprox.</th><th className={`${thStyle} w-8`}>-</th></tr>
                      </thead>
                      <tbody>
                        {analise.empresas_grupo.map((e, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={e.empresa} onChange={(e)=>updateArray('empresas_grupo', i, 'empresa', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input value={e.cnpj} onChange={(e)=>updateArray('empresas_grupo', i, 'cnpj', e.target.value)} className={`${cellStyle} font-mono`} /></td>
                            <td className={tdStyle}><input value={e.fundacao} onChange={(e)=>updateArray('empresas_grupo', i, 'fundacao', e.target.value)} className={`${cellStyle} text-center`} /></td>
                            <td className={tdStyle}><input value={e.idade} onChange={(e)=>updateArray('empresas_grupo', i, 'idade', e.target.value)} className={`${cellStyle} text-center`} /></td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('empresas_grupo', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-md shadow-sm border border-slate-200 p-1">
                    <div className="rounded border border-slate-200 overflow-hidden mb-2">
                        <div className={sectionHeaderStyle}>
                        <span>Quadro Societário Atual</span>
                        <button onClick={() => addArray('socios', {nome:"", perc:0, funcao:"Sócio", figure_contrato:"Sim"})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Adicionar Sócio</button>
                        </div>
                        <table className="w-full border-collapse">
                        <thead>
                            <tr><th className={thStyle}>Nome Civil / PJ Associada</th><th className={`${thStyle} w-24`}>Cotas (%)</th><th className={`${thStyle} w-64`}>Papel / Cargo</th><th className={`${thStyle} w-36`}>Figura no Contrato?</th><th className={`${thStyle} w-8`}>-</th></tr>
                        </thead>
                        <tbody>
                            {analise.socios.map((s, i) => (
                            <tr key={i}>
                                <td className={tdStyle}><input value={s.nome} onChange={(e)=>updateArray('socios', i, 'nome', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                                <td className={tdStyle}><input type="number" value={s.perc} onChange={(e)=>updateArray('socios', i, 'perc', Number(e.target.value))} className={`${numStyle} font-bold text-indigo-700 bg-indigo-50/20`} /></td>
                                <td className={tdStyle}><input value={s.funcao} onChange={(e)=>updateArray('socios', i, 'funcao', e.target.value)} className={cellStyle} /></td>
                                <td className={tdStyle}>
                                <select value={s.figure_contrato} onChange={(e)=>updateArray('socios', i, 'figure_contrato', e.target.value)} className={cellStyle}><option value="Sim">Sim</option><option value="Não">Não</option></select>
                                </td>
                                <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('socios', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    <table className="w-full border-collapse rounded border border-slate-200 overflow-hidden">
                      <tbody>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right`}>Regra de Assinatura Consolidada</td>
                          <td className={tdStyle}><input value={analise.regra_assinatura} onChange={(e)=>setAnalise({...analise, regra_assinatura: e.target.value})} className={cellStyle} placeholder="( ) em conjunto (x) isolada" /></td>
                        </tr>
                        <tr>
                          <td className={`${thStyle} w-1/4 text-right`}>Aval Societário Coletado</td>
                          <td className={tdStyle}><input value={analise.aval_societario} onChange={(e)=>setAnalise({...analise, aval_societario: e.target.value})} className={cellStyle} /></td>
                        </tr>
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
                            <td className={tdStyle}><input type="number" value={p.valor} onChange={(e)=>updateArray('patrimonios', i, 'valor', Number(e.target.value))} className={`${numStyle} text-emerald-700 font-bold bg-emerald-50/20`} /></td>
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

              {/* ABA 4: FATURAMENTO E POTENCIAL */}
              {abaAtiva === "fat" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                    <div className={sectionHeaderStyle}>Matriz de Faturamento Histórico Consolidado</div>
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
                                  <MathInput value={analise.dados_faturamento["2026"]?.[mes]} onChange={(val) => handleFat("2026", mes, val)} className={numStyle} />
                                </td>
                                <td className={`${tdStyle} text-center font-bold text-[10px] ${d26 > 0 ? 'text-emerald-600 bg-emerald-50/30' : d26 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>{d26 === 0 ? "-" : `${d26.toFixed(1)}%`}</td>
                                <td className={tdStyle}>
                                  <MathInput value={analise.dados_faturamento["2025"]?.[mes]} onChange={(val) => handleFat("2025", mes, val)} className={numStyle} />
                                </td>
                                <td className={`${tdStyle} text-center font-bold text-[10px] ${d25 > 0 ? 'text-emerald-600 bg-emerald-50/30' : d25 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>{d25 === 0 ? "-" : `${d25.toFixed(1)}%`}</td>
                                <td className={tdStyle}>
                                  <MathInput value={analise.dados_faturamento["2024"]?.[mes]} onChange={(val) => handleFat("2024", mes, val)} className={numStyle} />
                                </td>
                              </tr>
                            );
                          })}

                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-[11px]">
                            <td className="p-2 border border-slate-200 text-slate-700 text-right">TOTAL ANO</td>
                            <td className="p-2 border border-slate-200 text-right font-mono text-indigo-700">{totAno26.toLocaleString("pt-BR")}</td>
                            <td className={`border border-slate-200 text-center font-mono ${varTot26_25 > 0 ? 'text-emerald-600 bg-emerald-50/30' : varTot26_25 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>
                                {varTot26_25 === 0 ? "-" : `${varTot26_25.toFixed(1)}%`}
                            </td>
                            <td className="p-2 border border-slate-200 text-right font-mono text-slate-800">{totAno25.toLocaleString("pt-BR")}</td>
                            <td className={`border border-slate-200 text-center font-mono ${varTot25_24 > 0 ? 'text-emerald-600 bg-emerald-50/30' : varTot25_24 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>
                                {varTot25_24 === 0 ? "-" : `${varTot25_24.toFixed(1)}%`}
                            </td>
                            <td className="p-2 border border-slate-200 text-right font-mono text-slate-800">{totAno24.toLocaleString("pt-BR")}</td>
                          </tr>
                          
                          <tr className="bg-slate-200/50 border-t border-slate-300 font-bold text-[11px]">
                            <td className="p-2 border border-slate-200 text-slate-700 text-right">MÉDIA GERAL (Mês)</td>
                            <td className="p-2 border border-slate-200 text-right font-mono text-indigo-800">{medGeral26.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className={`border border-slate-200 text-center font-mono ${varMedGeral26_25 > 0 ? 'text-emerald-600 bg-emerald-50/30' : varMedGeral26_25 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>
                                {varMedGeral26_25 === 0 ? "-" : `${varMedGeral26_25.toFixed(1)}%`}
                            </td>
                            <td className="p-2 border border-slate-200 text-right font-mono text-slate-800">{medGeral25.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className={`border border-slate-200 text-center font-mono ${varMedGeral25_24 > 0 ? 'text-emerald-600 bg-emerald-50/30' : varMedGeral25_24 < 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400 bg-slate-50/30'}`}>
                                {varMedGeral25_24 === 0 ? "-" : `${varMedGeral25_24.toFixed(1)}%`}
                            </td>
                            <td className="p-2 border border-slate-200 text-right font-mono text-slate-800">{medGeral24.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                          </tr>

                          <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-bold text-[11px]">
                            <td className="p-2 border border-indigo-100 text-indigo-900 text-right" title="Média pareada apenas dos meses preenchidos no ano corrente">
                                {labelMascaraYTD}
                            </td>
                            <td className="p-2 border border-indigo-100 text-right font-mono text-indigo-900">{mediaYTD26.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className={`border border-indigo-100 text-center font-mono ${varYTD26_25 > 0 ? 'text-emerald-700 bg-emerald-100/50' : varYTD26_25 < 0 ? 'text-rose-700 bg-rose-100/50' : 'text-indigo-600'}`}>
                              {varYTD26_25 === 0 ? "-" : `${varYTD26_25.toFixed(1)}%`}
                            </td>
                            <td className="p-2 border border-indigo-100 text-right font-mono text-indigo-900/80">{mediaYTD25.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                            <td className={`border border-indigo-100 text-center font-mono ${varYTD25_24 > 0 ? 'text-emerald-700 bg-emerald-100/50' : varYTD25_24 < 0 ? 'text-rose-700 bg-rose-100/50' : 'text-indigo-600'}`}>
                              {varYTD25_24 === 0 ? "-" : `${varYTD25_24.toFixed(1)}%`}
                            </td>
                            <td className="p-2 border border-indigo-100 text-right font-mono text-indigo-900/80">{mediaYTD24.toLocaleString("pt-BR", {maximumFractionDigits:0})}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                      <div className={sectionHeaderStyle}>Parâmetros e Prazos Operacionais</div>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr><td className={`${thStyle} text-right w-1/2`}>Ticket Médio da Base (R$)</td><td className={tdStyle}><input type="number" value={analise.dados_potencial.ticket_medio} onChange={(e)=>updateNested("dados_potencial", "ticket_medio", Number(e.target.value))} className={`${numStyle} text-indigo-700 font-bold`} /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Duplicatas</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_dpls} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_dpls", e.target.value)} className={cellStyle} placeholder="Ex: 45 dias" /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Comissária</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_comissaria} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_comissaria", e.target.value)} className={cellStyle} placeholder="Ex: 15 dias" /></td></tr>
                          <tr><td className={`${thStyle} text-right`}>Prazo Médio Vendas Intercompany</td><td className={tdStyle}><input type="text" value={analise.dados_potencial.prazo_medio_intercompany || ""} onChange={(e)=>updateNested("dados_potencial", "prazo_medio_intercompany", e.target.value)} className={cellStyle} /></td></tr>
                          
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td className={`${thStyle} text-right font-bold text-slate-800`}>Volume de Recebimento (À Vista %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_vista} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_vista", Number(e.target.value))} className={`${numStyle} font-semibold`} /></td>
                          </tr>
                          <tr className="bg-indigo-50/30">
                            <td className={`${thStyle} text-right font-bold text-indigo-900 bg-indigo-50/50`}>Volume de Recebimento (A Prazo %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.forma_recebimento_prazo} onChange={(e)=>updateNested("dados_potencial", "forma_recebimento_prazo", Number(e.target.value))} className={`${numStyle} text-indigo-700 font-bold bg-indigo-100/30`} /></td>
                          </tr>
                          <tr className="border-t border-slate-200">
                            <td className={`${thStyle} text-right`}>Natureza do Prazo (Duplicatas %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_dpls} onChange={(e)=>updateNested("dados_potencial", "composicao_dpls", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Natureza do Prazo (Comissária %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_comissaria} onChange={(e)=>updateNested("dados_potencial", "composicao_comissaria", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Natureza do Prazo (Intercompany %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_intercompany || 0} onChange={(e)=>updateNested("dados_potencial", "composicao_intercompany", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                          <tr>
                            <td className={`${thStyle} text-right`}>Natureza do Prazo (Outros %)</td>
                            <td className={tdStyle}><input type="number" value={analise.dados_potencial.composicao_outros || 0} onChange={(e)=>updateNested("dados_potencial", "composicao_outros", Number(e.target.value))} className={numStyle} /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="bg-indigo-600 rounded-xl shadow-md p-8 flex flex-col justify-center items-center text-center text-white relative overflow-hidden border border-indigo-700">
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                      <span className="text-[12px] font-bold uppercase tracking-widest text-indigo-100 mb-1 z-10">Potencial Real de Antecipação (Mensal)</span>
                      <span className="font-mono text-4xl font-black drop-shadow-md z-10 my-3">R$ {potencialRealCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      
                      <div className="text-[10px] text-indigo-200 mt-6 space-y-1.5 z-10 bg-black/10 p-3 rounded backdrop-blur-sm w-full max-w-sm text-left">
                          <p><strong>Base de Faturamento (YTD/Parcial):</strong> R$ {faturamentoMedioReferencia.toLocaleString("pt-BR", {maximumFractionDigits:2})}</p>
                          <p className="border-t border-indigo-400/30 pt-1.5"><strong>Modelo:</strong> (Fat.Base ÷ 30) × Prazo × Compos(%) × APrazo(%)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 5: ENDIVIDAMENTO E REFERÊNCIAS */}
              {abaAtiva === "endividamento" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                    <div className={`${sectionHeaderStyle} bg-slate-900 border-slate-900`}>Radar de Alavancagem Global (Visão Cedente)</div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thStyle}>Passivo Curto Prazo</th>
                          <th className={thStyle}>Passivo Longo Prazo</th>
                          <th className={`${thStyle} bg-rose-50 text-rose-800 border-rose-200`}>ENDIVIDAMENTO TOTAL</th>
                          <th className={thStyle}>Pressão Antecipação DPLS (CP)</th>
                          <th className={thStyle}>Concentração Fundos</th>
                          <th className={thStyle}>Concentração Bancos</th>
                          <th className={thStyle}>Conta em Renegociação?</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-slate-50 font-mono text-[12px] text-center">
                          <td className="p-3 border border-slate-200 text-slate-700">R$ {endivCurtoPrazo.toLocaleString("pt-BR")}</td>
                          <td className="p-3 border border-slate-200 text-slate-700">R$ {endivLongoPrazo.toLocaleString("pt-BR")}</td>
                          <td className="p-3 border border-slate-200 text-rose-700 bg-rose-50 font-bold">R$ {totEndivGeral.toLocaleString("pt-BR")}</td>
                          <td className="p-3 border border-slate-200 text-slate-600">{percDplsCP.toFixed(1)}%</td>
                          <td className="p-3 border border-slate-200 text-slate-600">{percFundos.toFixed(1)}%</td>
                          <td className="p-3 border border-slate-200 text-slate-600">{percBancos.toFixed(1)}%</td>
                          <td className="p-0 border border-slate-200 bg-white">
                             <select value={analise.endividamento_resumo.renegociando} onChange={(e)=>updateNested("endividamento_resumo", "renegociando", e.target.value)} className="w-full h-full p-2 text-center font-sans font-bold text-[11px] bg-transparent outline-none cursor-pointer hover:bg-slate-50 transition-colors"><option value="Não">Não</option><option value="Sim">Sim</option></select>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={7} className="p-3 text-center text-[11px] text-slate-600 bg-slate-100/50 font-sans border-t border-slate-200">
                            Multiplicador de Alavancagem base faturamento: <strong className="text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 ml-1 shadow-sm">{faturamentoMedioReferencia > 0 ? (totEndivGeral / faturamentoMedioReferencia).toFixed(2) : "0.00"} x</strong> o faturamento médio.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                    <div className={sectionHeaderStyle}>
                      <span>Mapa de Dívidas Declaradas (Balancete/Documentos)</span>
                      <button onClick={() => addArray('endividamento_detalhado', {instituicao:"", modalidade:"", saldo:0, tipo:"Banco", prazo:"Curto Prazo"})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Nova Instituição</button>
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thStyle}>Credor Oficial</th>
                          <th className={thStyle}>Linha / Modalidade</th>
                          <th className={`${thStyle} w-48 text-right`}>Saldo Aberto Estimado (R$)</th>
                          <th className={`${thStyle} w-32`}>Categoria Mercado</th>
                          <th className={`${thStyle} w-32`}>Vencimento Original</th>
                          <th className={`${thStyle} w-8`}>-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.endividamento_detalhado.map((div, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={div.instituicao} onChange={(e)=>updateArray('endividamento_detalhado', i, 'instituicao', e.target.value)} className={`${cellStyle} font-bold`} placeholder="Nome do Banco/FIDC..." /></td>
                            <td className={tdStyle}><input value={div.modalidade} onChange={(e)=>updateArray('endividamento_detalhado', i, 'modalidade', e.target.value)} className={cellStyle} placeholder="Ex: Capital de Giro, Antecipação..." /></td>
                            <td className={tdStyle}><input type="number" value={div.saldo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'saldo', Number(e.target.value))} className={`${numStyle} font-bold text-rose-600 bg-rose-50/10`} /></td>
                            <td className={tdStyle}>
                              <select value={div.tipo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'tipo', e.target.value)} className={cellStyle}>
                                <option value="Banco">Banco</option><option value="Fundo">FIDC/SEC</option>
                              </select>
                            </td>
                            <td className={tdStyle}>
                              <select value={div.prazo} onChange={(e)=>updateArray('endividamento_detalhado', i, 'prazo', e.target.value)} className={cellStyle}>
                                <option value="Curto Prazo">Curto Prazo (CP)</option><option value="Longo Prazo">Longo Prazo (LP)</option>
                              </select>
                            </td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('endividamento_detalhado', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 border-t-2 border-slate-300">
                          <td colSpan={2} className="p-2 text-right font-bold text-[11px] text-slate-700 tracking-wide">SOMA TOTAL MAPEADA ACIMA</td>
                          <td className="p-2 text-right font-mono font-bold text-rose-700 text-[12px]">R$ {totEndivGeral.toLocaleString("pt-BR")}</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

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
                            <th className={`${thStyle} w-28 text-right`}>VOP (R$)</th> {/* NOVO CAMPO */}
                            <th className={`${thStyle} w-28 text-right`}>Limite Aprovado</th><th className={`${thStyle} w-28 text-right`}>Carteira Total</th>
                            <th className={`${thStyle} w-24 text-right bg-indigo-50 border-indigo-200`}>Risco 1 (R$)</th><th className={`${thStyle} bg-indigo-50 border-indigo-200`}>Tipo Op 1</th><th className={`${thStyle} bg-indigo-50 border-indigo-200`}>Vcto Final 1</th>
                            <th className={`${thStyle} w-24 text-right bg-amber-50 border-amber-200`}>Risco 2 (R$)</th><th className={`${thStyle} bg-amber-50 border-amber-200`}>Tipo Op 2</th><th className={`${thStyle} bg-amber-50 border-amber-200`}>Vcto Final 2</th>
                            
                            {/* COLUNAS DE LIQUIDEZ REORDENADAS */}
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
                              
                              {/* NOVO CAMPO VOP */}
                              <td className={tdStyle}><input type="number" value={ref.vop || ""} onChange={(e)=>updateArray('referencias', i, 'vop', Number(e.target.value))} className={`${numStyle} font-bold text-slate-700`} /></td>
                              
                              <td className={tdStyle}><input type="number" value={ref.limite_global} onChange={(e)=>updateArray('referencias', i, 'limite_global', Number(e.target.value))} className={`${numStyle} text-indigo-700 font-bold bg-indigo-50/20`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.risco_total} onChange={(e)=>updateArray('referencias', i, 'risco_total', Number(e.target.value))} className={`${numStyle} text-rose-600 font-bold bg-rose-50/20`} /></td>
                              
                              <td className={tdStyle}><input type="number" value={ref.risco_1} onChange={(e)=>updateArray('referencias', i, 'risco_1', Number(e.target.value))} className={`${numStyle} bg-indigo-50/50`} /></td>
                              <td className={tdStyle}><input value={ref.operacao_1} onChange={(e)=>updateArray('referencias', i, 'operacao_1', e.target.value)} className={`${cellStyle} bg-indigo-50/50`} /></td>
                              <td className={tdStyle}><input type="date" value={ref.vcto_1} onChange={(e)=>updateArray('referencias', i, 'vcto_1', e.target.value)} className={`${cellStyle} bg-indigo-50/50 text-center`} /></td>
                              
                              <td className={tdStyle}><input type="number" value={ref.risco_2} onChange={(e)=>updateArray('referencias', i, 'risco_2', Number(e.target.value))} className={`${numStyle} bg-amber-50/50`} /></td>
                              <td className={tdStyle}><input value={ref.operacao_2} onChange={(e)=>updateArray('referencias', i, 'operacao_2', e.target.value)} className={`${cellStyle} bg-amber-50/50`} /></td>
                              <td className={tdStyle}><input type="date" value={ref.vcto_2} onChange={(e)=>updateArray('referencias', i, 'vcto_2', e.target.value)} className={`${cellStyle} bg-amber-50/50 text-center`} /></td>
                              
                              {/* LIQUIDEZ CALCULADA */}
                              <td className={tdStyle}><input type="number" value={ref.liquidez_pontual || ""} onChange={(e)=>updateArray('referencias', i, 'liquidez_pontual', Number(e.target.value))} className={numStyle} /></td>
                              <td className={tdStyle}><input type="number" value={ref.atraso_5_dias || ""} onChange={(e)=>updateArray('referencias', i, 'atraso_5_dias', Number(e.target.value))} className={numStyle} /></td>
                              <td className={`${tdStyle} bg-slate-100`}><input type="number" value={calcLiq5} disabled className={`${numStyle} bg-slate-100 font-bold text-indigo-700`} /></td>
                              <td className={tdStyle}><input type="number" value={ref.atraso_15_dias || ""} onChange={(e)=>updateArray('referencias', i, 'atraso_15_dias', Number(e.target.value))} className={numStyle} /></td>
                              
                              <td className={tdStyle}><input value={ref.recompra} onChange={(e)=>updateArray('referencias', i, 'recompra', e.target.value)} className={cellStyle} /></td>
                              <td className={tdStyle}><input type="number" value={ref.concentracao} onChange={(e)=>updateArray('referencias', i, 'concentracao', Number(e.target.value))} className={`${numStyle} text-center`} placeholder="%" /></td>
                              
                              <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('referencias', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 6: RESTRITIVOS E JURÍDICO */}
              {abaAtiva === "restritivos" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl">
                  <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                    <div className={sectionHeaderStyle}>Painel de Apontamentos do Bureau (Serasa/Boa Vista)</div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr><th className={thStyle}>Pefin</th><th className={thStyle}>Refin</th><th className={thStyle}>Protestos</th><th className={thStyle}>Dívidas Vencidas</th><th className={thStyle}>Ações Judiciais (Cíveis/Trab)</th><th className={thStyle}>Cheques Devolvidos</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.pefin} onChange={(e)=>updateNested("restritivos_quadro", "pefin", Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.refin} onChange={(e)=>updateNested("restritivos_quadro", "refin", Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.protesto} onChange={(e)=>updateNested("restritivos_quadro", "protesto", Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.div_vencida} onChange={(e)=>updateNested("restritivos_quadro", "div_vencida", Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.acao_judicial} onChange={(e)=>updateNested("restritivos_quadro", "acao_judicial", Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                          <td className={tdStyle}><input type="number" value={analise.restritivos_quadro.cheque_sem_fundo} onChange={(e)=>updateNested("restritivos_quadro", "cheque_sem_fundo", Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                    <div className={sectionHeaderStyle}>
                      <span>Extrato Restritivo Detalhado</span>
                      <button onClick={() => addArray('restritivos', {empresa_socio:"", restritivo:"", qtd:1, valor:0, data:"", observacao:""})} className="bg-indigo-800 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] transition-colors shadow">+ Incluir Apontamento</button>
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thStyle}>Requerido (CNPJ / Sócio)</th><th className={thStyle}>Natureza do Apontamento</th>
                          <th className={`${thStyle} w-16`}>Vol.</th><th className={`${thStyle} w-40 text-right`}>Valor Acumulado (R$)</th>
                          <th className={`${thStyle} w-28`}>Data Ocorrência</th><th className={`${thStyle} w-64`}>Observações Relevantes</th>
                          <th className={`${thStyle} w-8`}>-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.restritivos.map((r, i) => (
                          <tr key={i}>
                            <td className={tdStyle}><input value={r.empresa_socio} onChange={(e)=>updateArray('restritivos', i, 'empresa_socio', e.target.value)} className={`${cellStyle} font-bold`} /></td>
                            <td className={tdStyle}><input value={r.restritivo} onChange={(e)=>updateArray('restritivos', i, 'restritivo', e.target.value)} className={cellStyle} placeholder="Ex: Ação Trabalhista, Protesto Cartório..." /></td>
                            <td className={tdStyle}><input type="number" value={r.qtd} onChange={(e)=>updateArray('restritivos', i, 'qtd', Number(e.target.value))} className={`${numStyle} text-center`} /></td>
                            <td className={tdStyle}><input type="number" value={r.valor} onChange={(e)=>updateArray('restritivos', i, 'valor', Number(e.target.value))} className={`${numStyle} text-rose-600 font-bold bg-rose-50/20`} /></td>
                            <td className={tdStyle}><input type="date" value={r.data} onChange={(e)=>updateArray('restritivos', i, 'data', e.target.value)} className={`${cellStyle} text-center`} /></td>
                            <td className={tdStyle}><input value={r.observacao} onChange={(e)=>updateArray('restritivos', i, 'observacao', e.target.value)} className={cellStyle} /></td>
                            <td className={`${tdStyle} text-center`}><button onClick={()=>rmArray('restritivos', i)} className="text-red-500 font-bold hover:bg-red-50 w-full h-full transition-colors">X</button></td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 border-t-2 border-slate-300">
                          <td colSpan={3} className="p-2 text-right font-bold tracking-wide uppercase text-[10px] text-slate-700">Risco Restritivo Total Calculado</td>
                          <td className="p-2 text-right font-mono font-bold text-rose-700 text-[12px]">R$ {totRestritivos.toLocaleString("pt-BR")}</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                      <div className={`${sectionHeaderStyle} bg-slate-900 border-slate-900 flex gap-3 items-center`}>
                         <span>⚖️ Dossier Jurídico Textual (Crawler Jusbrasil / Kappi)</span>
                         {analise.status === "em_processamento_ia" && <span className="bg-purple-500 text-white font-bold text-[9px] px-2 py-0.5 rounded animate-pulse">EXTRAINDO PROCESSOS...</span>}
                      </div>
                      <textarea 
                         value={analise.dados_juridico?.relatorio_completo || ""} 
                         onChange={(e)=>updateNested("dados_juridico", "relatorio_completo", e.target.value)} 
                         className="w-full h-72 p-4 border-none outline-none text-[12px] text-slate-700 font-sans resize-none bg-slate-50/50 leading-relaxed focus:bg-white transition-colors" 
                         placeholder="Aguardando consolidação inteligente ou digite a síntese dos principais litígios trabalhistas, cíveis e tributários..."
                      />
                    </div>
                    <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
                      <div className={sectionHeaderStyle}>Clipping, Pesquisas Reputacionais e Mídia</div>
                      <textarea 
                        value={analise.noticias_midia} 
                        onChange={(e)=>setAnalise({...analise, noticias_midia: e.target.value})} 
                        className="w-full h-24 p-4 border-none outline-none text-[12px] text-slate-700 font-sans resize-none bg-slate-50/50 focus:bg-white transition-colors"
                        placeholder="Insira links ou descrições curtas de matérias vinculadas ao grupo ou sócios na mídia..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 7: PARECER FINAL */}
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
                      placeholder="Redija a conclusão narrativa embasando a decisão comercial e os riscos atenuados mapeados. Use a súmula executiva como trampolim de contexto..."
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
        )}
      </div>

      {/* 🔥 MODAL DE UPLOAD DE NOVOS DOCUMENTOS (MERGE/ATUALIZAÇÃO IA) */}
      {modalDocsAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-900 text-white p-4 font-bold text-sm flex justify-between items-center shadow-md">
              <span className="flex items-center gap-2">📄 Processar Novos Documentos (Merge IA)</span>
              <button onClick={() => { setModalDocsAberto(false); setNovosArquivos([]); }} className="text-indigo-200 hover:text-white transition-colors cursor-pointer text-xl">✕</button>
            </div>
            
            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50 border border-indigo-100 p-3 rounded">
                Selecione os novos arquivos (PDFs de faturamento, balancetes atualizados, etc). 
                A IA irá extrair os dados e <strong>mesclar</strong> com a análise atual sem apagar o que você já editou manualmente.
              </p>
              
              <div className="border-2 border-dashed border-indigo-300 hover:border-indigo-400 hover:bg-indigo-50/70 transition-colors bg-indigo-50/30 rounded-xl p-8 text-center relative cursor-pointer">
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf,.png,.jpg,.jpeg" 
                  onChange={(e) => setNovosArquivos(Array.from(e.target.files || []))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none flex flex-col items-center gap-2">
                  <span className="text-3xl">📤</span>
                  <span className="text-sm font-bold text-indigo-700">Clique ou arraste novos arquivos aqui</span>
                  <span className="text-xs text-slate-500 font-medium">Aceita PDF, PNG, JPG</span>
                </div>
              </div>

              {novosArquivos.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Arquivos Selecionados:</span>
                  <ul className="text-[11px] text-slate-700 max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300">
                    {novosArquivos.map((file, i) => (
                      <li key={i} className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded truncate shadow-sm">
                        📎 {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3">
              <button 
                onClick={() => { setModalDocsAberto(false); setNovosArquivos([]); }} 
                className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={processarNovosDocumentos} 
                disabled={uploadingDocs || novosArquivos.length === 0}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingDocs ? (
                  <>
                    <span className="animate-spin">⏳</span> Enviando R2...
                  </>
                ) : "🚀 Enviar para Leitura IA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}