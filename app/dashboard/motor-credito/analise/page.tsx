/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import GerarAnalise from "@/components/gerar-analise";
import GerarKappiViewer from "@/components/gerar-kappi";
import SistemaAnalise from "@/components/analise"; // Apontando pro arquivo correto
import { AnaliseData, FilaItem } from "@/app/types/analise"; // Apontando pra pasta app/types
import UploadDocs from "@/components/UploadDocs"; // Caso precise, adicione a importação se não estiver lá, já que vi você usando num outro arquivo semelhante. Retirei do render pois esse usa o modal de novos docs.

// Modelo default de inicialização para não dar erro
const DADOS_MODELO: AnaliseData = {
  id: null, cnpj: "00.000.000/0001-00", razao_social: "EMPRESA MODELO LTDA", comercial: "", dados_documentos: [], is_grupo_economico: false,
  empresas_principais: [{ razao_social: "EMPRESA MODELO LTDA", cnpj: "00.000.000/0001-00" }],
  data_analise: new Date().toISOString().split("T")[0], 
  relacionamento: "Prospect", analista: "Alyson", gerente: "Luiz", rating: "B - Risco médio", 
  fundacao: "", capital_social: 0, localizacao: "", ramo: "", licencas: "Não Informado", balanco_auditado: "Não", consultoria_gestao: "Não", site: "",
  propostas: [{ modalidade: "Desconto", limite: 0, prazo: "", tranche: 0, taxa: "", garantia: "" }],
  empresas_grupo: [],
  empresas_societario: [],
  empresas_faturamento: [],
  empresas_endividamento: [],
  empresas_serasa: [],
  socios: [{ nome: "", perc: 100, funcao: "Sócio", figura_contrato: "Sim" }],
  regra_assinatura: "( ) em conjunto (x) isolada", aval_societario: "", patrimonios: [],
  dados_faturamento: { "2024": {}, "2025": {}, "2026": {} }, 
  dados_potencial: { ticket_medio: 0, prazo_medio_dpls: "60 dias", prazo_medio_comissaria: "0 dias", prazo_medio_intercompany: "", forma_recebimento_vista: 0, forma_recebimento_prazo: 100, composicao_dpls: 100, composicao_comissaria: 0, composicao_intercompany: 0, composicao_outros: 0, potencial_estimado: 0 },
  endividamento_resumo: { renegociando: "Não" },
  endividamento_detalhado: [], referencias: [],
  restritivos_quadro: { pefin: 0, refin: 0, protesto: 0, div_vencida: 0, acao_judicial: 0, cheque_sem_fundo: 0 },
  restritivos: [],
  resumo_visita: "", noticias_midia: "", 
  noticias_mercado: { risco_midia_nivel: "baixo", alertas_graves: [], panorama_setor: "Aguardando processamento da IA...", parecer_analista: "Análise de mídia pendente." },
  parecer_analista: "", parecer_comite: "", recomendacao_analista: "",
  anexos: { organograma_url: "", fachada_url: "", satelite_url: "", fotos_visita_url: "" },
  dados_juridico: { relatorio_completo: "", entidades: [] },
  parecer_executivo: "",
  organograma_json: null
};

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

  const [fila, setFila] = useState<FilaItem[]>([]);
  const [analise, setAnalise] = useState<AnaliseData>(DADOS_MODELO);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  
  const [loadingFila, setLoadingFila] = useState(true);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [processandoDecisao, setProcessandoDecisao] = useState(false);

  const [modalDocsAberto, setModalDocsAberto] = useState(false);
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const [isKappiModalOpen, setIsKappiModalOpen] = useState(false);

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
        const razao_social = data.empresa_nome || dc.razao_social || "";
        const cnpj = data.cnpj || dc.cnpj || "";
        const empresas_principais = dc.empresas_principais?.length ? dc.empresas_principais : [{ razao_social, cnpj }];
        
        // Magia do Legado (Sustentando versões antigas do json do banco)
        const fatGroup: Record<string, Record<string, number>> = { "2024": {}, "2025": {}, "2026": {} };
        const rawFat = dc.empresas_faturamento?.length ? dc.empresas_faturamento : (dc.dados_faturamento ? [{ faturamento: dc.dados_faturamento }] : []);
        rawFat.forEach((emp: any) => {
            Object.entries(emp.faturamento || {}).forEach(([ano, meses]) => {
                if (!fatGroup[ano]) fatGroup[ano] = {};
                Object.entries(meses as any).forEach(([mes, val]) => {
                    const soma = (Number(fatGroup[ano][mes]) || 0) + (Number(val) || 0);
                    fatGroup[ano][mes] = Math.round(soma * 100) / 100;
                });
            });
        });
        const empFaturamentoUnico = [{ razao_social: "VISÃO CONSOLIDADA", cnpj, faturamento: fatGroup }];

        const endivFlat: any[] = [];
        const rawEndiv = dc.empresas_endividamento?.length ? dc.empresas_endividamento : (dc.endividamento_detalhado?.length ? [{ razao_social, cnpj, endividamento: dc.endividamento_detalhado }] : []);
        rawEndiv.forEach((emp: any) => {
            (emp.endividamento || []).forEach((d: any) => {
                endivFlat.push({ ...d, empresa_origem: d.empresa_origem || emp.razao_social || emp.cnpj || razao_social });
            });
        });
        const empEndividamentoUnico = [{ razao_social: "PASSIVO CONSOLIDADO", cnpj, saldo_total_empresa: 0, endividamento: endivFlat }];

        const restritivosFlat: any[] = [];
        const rawSerasa = dc.empresas_serasa?.length ? dc.empresas_serasa : (dc.restritivos?.length ? [{ nome_entidade: razao_social, restritivos: dc.restritivos }] : []);
        rawSerasa.forEach((emp: any) => {
            (emp.restritivos || []).forEach((r: any) => {
                restritivosFlat.push({ ...r, empresa_origem: r.empresa_origem || emp.nome_entidade || emp.documento || razao_social });
            });
        });
        const empSerasaUnico = [{ nome_entidade: "APONTAMENTOS CONSOLIDADOS", documento: cnpj, valor_total_entidade: 0, restritivos: restritivosFlat }];

        const sociosFlat: any[] = [];
        const rawSoc = dc.empresas_societario?.length ? dc.empresas_societario : [{ razao_social, socios: dc.socios || dc.dados_estrutura_societaria || [] }];
        rawSoc.forEach((emp: any) => {
            (emp.socios || []).forEach((s: any) => {
                sociosFlat.push({ ...s, empresa_origem: s.empresa_origem || emp.razao_social || razao_social });
            });
        });
        const empSocietarioUnico = [{ papel_no_grupo: "Grupo Consolidado", razao_social: "QUADRO SOCIETÁRIO CONSOLIDADO", cnpj, socios: sociosFlat }];

        setAnalise({ 
          ...DADOS_MODELO, 
          ...dc,  
          empresas_principais,
          empresas_societario: empSocietarioUnico,
          empresas_faturamento: empFaturamentoUnico,
          empresas_endividamento: empEndividamentoUnico,
          empresas_serasa: empSerasaUnico,
          anexos: { ...DADOS_MODELO.anexos, ...(dc.anexos || {}) }, 
          dados_potencial: { ...DADOS_MODELO.dados_potencial, ...(dc.dados_potencial || {}) }, 
          dados_juridico: { ...DADOS_MODELO.dados_juridico, ...(dc.dados_juridico || {}) }, 
          id: data.id, 
          cnpj: cnpj, 
          razao_social: razao_social, 
          status: data.status,
          comercial: data.comercial || "",
          dados_documentos: data.dados_documentos || [], 
          is_grupo_economico: data.is_grupo_economico || dc.is_grupo_economico || false
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
      
      // O child component agora mantém o potencial_estimado atualizado no state da 'analise'
      const { id, cnpj, razao_social, status, comercial, dados_documentos, is_grupo_economico, ...dadosParaCompactar } = analise;
      
      const { error } = await supabase.from("analises").update({ 
        dados_consolidados: dadosParaCompactar,
        empresa_nome: analise.razao_social,
        is_grupo_economico: analise.is_grupo_economico
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

      // 🛡️ Buscando o token JWT do usuário logado
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      for (let i = 0; i < novosArquivos.length; i++) {
        const file = novosArquivos[i];
        const pathDinamicoR2 = `analises/${idSelecionado}/adicionais/${Date.now()}`;

        // 🛡️ Enviando o token na autorização
        const resAuth = await fetch("/api/upload", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}) 
          },
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

      // 🛡️ Enviando o token na chamada pro motor V8
      const resIA = await fetch("/api/motor-ia", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
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
    const confirmacao = window.confirm(`Encaminhar para o Comitê com a sugestão de: [${analise.recomendacao_analista.toUpperCase()}]?`);
    if (!confirmacao) return;

    try {
      setProcessandoDecisao(true);
      await persistirNoBanco(false); 
      
      try {
        const { data: analiseDB } = await supabase.from("analises").select("dados_ia_brutos").eq("id", analise.id).single();

        if (analiseDB?.dados_ia_brutos) {
            const iaOriginal = analiseDB.dados_ia_brutos;
            if (JSON.stringify(iaOriginal.empresas_endividamento) !== JSON.stringify(analise.empresas_endividamento)) {
                await supabase.from("memoria_credito").insert({ analise_id: analise.id, cnpj: analise.cnpj, categoria: "endividamento", erro_ia: iaOriginal.empresas_endividamento, correcao_humana: analise.empresas_endividamento });
            }
            if (JSON.stringify(iaOriginal.empresas_faturamento) !== JSON.stringify(analise.empresas_faturamento)) {
                await supabase.from("memoria_credito").insert({ analise_id: analise.id, cnpj: analise.cnpj, categoria: "faturamento", erro_ia: iaOriginal.empresas_faturamento, correcao_humana: analise.empresas_faturamento });
            }
            if (JSON.stringify(iaOriginal.empresas_serasa) !== JSON.stringify(analise.empresas_serasa)) {
                await supabase.from("memoria_credito").insert({ analise_id: analise.id, cnpj: analise.cnpj, categoria: "serasa", erro_ia: iaOriginal.empresas_serasa, correcao_humana: analise.empresas_serasa });
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
      const { id, cnpj, razao_social, status, comercial, dados_documentos, ...dadosParaCompactar } = analise;
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

  const btnSecundario = "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 text-[11px] rounded shadow-sm transition-all cursor-pointer disabled:opacity-50";
  const btnPrimario = "bg-indigo-600 border border-indigo-700 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 text-[11px] rounded shadow-sm transition-all cursor-pointer disabled:opacity-50";

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start bg-slate-50 min-h-screen p-4 md:p-6 relative">
      
      {/* SIDEBAR DA FILA */}
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

      {/* WORKSPACE PRINCIPAL */}
      <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
        {loadingAnalise ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[12px] font-semibold text-slate-600 mt-4 tracking-wide">Carregando dados estruturados...</p>
          </div>
        ) : (
          <>
            {/* TOOLBAR */}
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
                    {analise.is_grupo_economico && <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 rounded-full border border-amber-300">🏢 GRUPO ECONÔMICO</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => setModalDocsAberto(true)} 
                  disabled={!idSelecionado || processandoDecisao || analise.status === "em_processamento_ia"} 
                  className={btnSecundario} 
                  title="Adicionar novos PDFs para mesclar com esta análise"
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
                    
                    <button 
                       onClick={() => setIsKappiModalOpen(true)}
                       className="bg-slate-900 hover:bg-black text-white font-semibold px-3 py-1.5 text-[11px] rounded shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        🕵️‍♂️ Auditoria Kappi
                    </button>
                    
                    <button onClick={encaminharParaComite} disabled={processandoDecisao || analise.status === "em_processamento_ia"} className={btnPrimario}>
                      ▶ Emitir Parecer Final
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AQUI ENTRA O COMPONENTE ISOLADO, CARREGANDO O ESQUELETO DA ANÁLISE! */}
            <SistemaAnalise analise={analise} setAnalise={setAnalise} />
            
          </>
        )}
      </div>

      {/* MODAL NOVOS DOCS */}
      {modalDocsAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-900 text-white p-4 font-bold text-sm flex justify-between items-center shadow-md">
              <span className="flex items-center gap-2">📄 Processar Novos Documentos (Merge IA)</span>
              <button onClick={() => { setModalDocsAberto(false); setNovosArquivos([]); }} className="text-indigo-200 hover:text-white transition-colors cursor-pointer text-xl">✕</button>
            </div>
            
            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50 border border-indigo-100 p-3 rounded">
                Selecione os novos arquivos. A IA irá extrair os dados e <strong>mesclar</strong> com a análise atual sem apagar o que você já editou manualmente.
              </p>
              
              <div className="border-2 border-dashed border-indigo-300 hover:border-indigo-400 hover:bg-indigo-50/70 transition-colors bg-indigo-50/30 rounded-xl p-8 text-center relative cursor-pointer">
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setNovosArquivos(Array.from(e.target.files || []))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="pointer-events-none flex flex-col items-center gap-2">
                  <span className="text-3xl">📤</span>
                  <span className="text-sm font-bold text-indigo-700">Clique ou arraste novos arquivos aqui</span>
                </div>
              </div>

              {novosArquivos.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <ul className="text-[11px] text-slate-700 max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300">
                    {novosArquivos.map((file, i) => (
                      <li key={i} className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded truncate shadow-sm">📎 {file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setModalDocsAberto(false); setNovosArquivos([]); }} className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-md transition-colors cursor-pointer">Cancelar</button>
              <button onClick={processarNovosDocumentos} disabled={uploadingDocs || novosArquivos.length === 0} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed">
                {uploadingDocs ? <><span className="animate-spin">⏳</span> Enviando R2...</> : "🚀 Enviar para Leitura IA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KAPPI VIEWER */}
      {isKappiModalOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px] bg-slate-900 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-slate-200 p-3 px-6 flex justify-between items-center shadow-lg border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xl">🕵️‍♂️</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Auditoria Restritiva e Compliance</span>
                <span className="text-sm font-bold text-white tracking-wide">{analise.empresa_nome || analise.razao_social}</span>
              </div>
            </div>
            <button onClick={() => setIsKappiModalOpen(false)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer uppercase tracking-wide flex items-center gap-2">
              ✕ Fechar Auditoria
            </button>
          </div>
          <div className="flex-1 flex overflow-hidden w-full bg-slate-100 relative">
             <div className="w-full h-full p-4">
                <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden relative">
                   <GerarKappiViewer urlsDocumentos={analise.dados_documentos || []} />
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}