/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import UploadDocs from "@/components/UploadDocs";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import JSZip from "jszip"; 

interface Empresa {
  cnpj: string;
  razao_social: string;
  uf: string;
  cidadeExtenso?: string;
  capital_social?: number;
}

interface FilaItem {
  id: string;
  empresa_nome: string;
  cnpj: string;
  status: string;
  criado_em: string;
  ia_inicio?: string;
  ia_fim?: string;
  status_comite?: string;
  comercial?: string; 
  dados_documentos?: string[]; 
  dados_consolidados?: any;    
  checklist_ia?: any; 
}

export default function MotorCreditoPage() {
  const router = useRouter();
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusTexto, setStatusTexto] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [filaReal, setFilaReal] = useState<FilaItem[]>([]);

  // Estados do Modal de Documentos Mapeados (Visualização)
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [empresaParaDocs, setEmpresaParaDocs] = useState<FilaItem | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // 🔥 NOVOS ESTADOS: Modal de Envio Complementar
  const [isUploadExtraOpen, setIsUploadExtraOpen] = useState(false);
  const [analiseAlvoUpload, setAnaliseAlvoUpload] = useState<FilaItem | null>(null);

  useEffect(() => {
    carregarFilaComercial();
    return () => {
      setEmpresaSelecionada(null);
    };
  }, []);

  const carregarFilaComercial = async () => {
    try {
      const { data, error } = await supabase
        .from("analises")
        .select("id, empresa_nome, cnpj, status, criado_em, ia_inicio, ia_fim, status_comite, comercial, dados_documentos, dados_consolidados, checklist_ia")
        .in("status", ["aberta", "aguardando_docs", "em_revisao_humana", "em_comite"])
        .order("criado_em", { ascending: false });

      if (error) throw error;
      if (data) setFilaReal(data as any);
    } catch (err) {
      console.error("Erro ao carregar esteira comercial:", err);
    }
  };

  const handleBuscarPorCnpj = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjLimpo = cnpjBusca.replace(/\D/g, "");
    if (cnpjLimpo.length < 14) {
      alert("⚠️ Digite um CNPJ completo com 14 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/buscar-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpjLimpo }),
      });
      
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (data.found && data.empresa) {
        setEmpresas([data.empresa]);
      } else {
        alert("❌ CNPJ não localizado na base oficial.\n💡 Liberando modo de entrada manual.");
        setEmpresas([{
          cnpj: cnpjLimpo,
          razao_social: "EMPRESA DIGITADA MANUALMENTE",
          uf: "PR",
          cidadeExtenso: "Curitiba",
          capital_social: 0
        }]);
      }
    } catch (err: any) {
      console.error("Erro ao buscar CNPJ:", err);
      alert("❌ Falha na conexão: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 🚀 CRIAÇÃO DE NOVA ANÁLISE (LARGADA)
  // =========================================================================
  const registrarAnaliseNoSupabase = async (urlsDocumentos: string[], urlsImagens: string[] = []) => {
    if (!empresaSelecionada) return;

    setLoading(true);
    setStatusTexto("🔍 Verificando duplicidade na mesa de crédito...");
    
    try {
      const cnpjLimpo = empresaSelecionada.cnpj.replace(/\D/g, "");

      const { data: analiseAtiva, error: buscaError } = await supabase
        .from("analises")
        .select("id, status")
        .eq("cnpj", cnpjLimpo)
        .in("status", ["aberta", "em_revisao_humana", "em_comite", "aguardando_docs"])
        .maybeSingle(); 

      if (buscaError && buscaError.code !== 'PGRST116') {
        throw new Error("Erro ao verificar duplicidade no banco.");
      }

      if (analiseAtiva) {
         alert(`⛔ Operação Bloqueada: Já existe uma análise em andamento (Status: ${analiseAtiva.status}) para este CNPJ na mesa de crédito!`);
         setLoading(false);
         setStatusTexto("");
         return; 
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Usuário não autenticado. Faça login novamente.");
      }

      // 🔥 AUTO-VINCULAÇÃO INTELIGENTE DO COMERCIAL
      const userStr = localStorage.getItem("intraned_user");
      const localUser = userStr ? JSON.parse(userStr) : null;
      const nomeComercialLogado = localUser?.nome || "";

      setStatusTexto("🤖 Registrando lote virgem de entrada na mesa...");

      const { data: novaAnalise, error: insertError } = await supabase
        .from("analises")
        .insert({
          cnpj: cnpjLimpo,
          empresa_nome: empresaSelecionada.razao_social.toUpperCase(),
          caminho_local: "Upload via Motor V8 / R2",
          status: "em_revisao_humana", 
          status_comite: "pendente",
          ia_inicio: new Date().toISOString(),
          responsavel_id: user.id,
          comercial: nomeComercialLogado, // 👈 Registrando automaticamente!

          dados_documentos: urlsDocumentos,
          checklist_ia: {}, 
          dados_consolidados: {
            uf: empresaSelecionada.uf || "PR",
            cidade: empresaSelecionada.cidadeExtenso || "Curitiba",
            capital_social: empresaSelecionada.capital_social || 0,
            dados_gerais: { fundacao: "", ramo: "", site: "", relacionamento: "Prospect", gerente: "" },
            proposta: { modalidade: "Desconto", limite: 50000, prazo: 30, tranche: 10000, taxa: 0.04, garantia: "Aval", rating: "C" },
            dados_faturamento: { "2024": {}, "2025": {}, "2026": {} },
            dados_potencial: { ticket_medio: 0, prazo_medio_vendas: 0, vending_prazo_perc: 100 },
            dados_endividamento_resumo: { curto_prazo: 0, longo_prazo: 0 },
            endividamento_detalhado: [],
            restritivos: [],
            socios: [],
            anexos: { 
              organograma_url: "", 
              fachada_url: urlsImagens.length > 0 ? urlsImagens[0] : "",
              fotos_visita_url: urlsImagens.length > 1 ? urlsImagens[1] : (urlsImagens.length === 1 ? urlsImagens[0] : "")
            },
            parecer_comite: ""
          }
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error("Falha crítica ao gerar ID único da nova análise.");
      }

      if (novaAnalise && urlsDocumentos.length > 0) {
        setStatusTexto("🔮 Robô V8 processando os PDFs da nova análise em background...");
        
        await fetch("/api/motor-ia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analise_id: novaAnalise.id,
            urls_documentos: urlsDocumentos,
            modo_atualizacao: false // Largada inicial
          })
        });
      }

      alert("🚀 Nova análise registrada com segurança! O Motor V8 assumiu o processamento.");
      
      setEmpresaSelecionada(null);
      setEmpresas([]);
      setCnpjBusca("");
      await carregarFilaComercial();

    } catch (err: any) {
      console.error("Erro no fluxo de registro:", err);
      alert("⚠️ Erro ao registrar na esteira: " + err.message);
    } finally {
      setLoading(false);
      setStatusTexto("");
    }
  };

  // =========================================================================
  // ➕ ENVIO COMPLEMENTAR DE DOCUMENTOS
  // =========================================================================
  const abrirModalEnvioExtra = (item: FilaItem) => {
    setAnaliseAlvoUpload(item);
    setIsUploadExtraOpen(true);
  };

  const lidarUploadExtra = async (urlsDocumentosNovos: string[], urlsImagensNovas: string[]) => {
    if (!analiseAlvoUpload) return;
    if (urlsDocumentosNovos.length === 0 && urlsImagensNovas.length === 0) return;

    setLoading(true);
    setStatusTexto("🔄 Acoplando documentos complementares à base...");

    try {
      // 1. Busca o array de documentos atual que já estava na nuvem
      const { data: analiseAtual, error: fetchErr } = await supabase
        .from("analises")
        .select("dados_documentos")
        .eq("id", analiseAlvoUpload.id)
        .single();

      if (fetchErr) throw fetchErr;

      const docsAtuais = analiseAtual.dados_documentos || [];
      const todosDocsCombinados = [...docsAtuais, ...urlsDocumentosNovos]; // Merge dos links

      // 2. Atualiza o banco de dados da análise com o array somado
      const { error: updateErr } = await supabase
        .from("analises")
        .update({ dados_documentos: todosDocsCombinados })
        .eq("id", analiseAlvoUpload.id);

      if (updateErr) throw updateErr;

      // 3. Dispara a IA passando APENAS OS DOCUMENTOS NOVOS (modo merge)
      if (urlsDocumentosNovos.length > 0) {
        setStatusTexto("🧠 Robô V8 lendo arquivos extras...");
        
        await fetch("/api/motor-ia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analise_id: analiseAlvoUpload.id,
            urls_documentos: urlsDocumentosNovos, // Apenas os novos para economizar tokens
            modo_atualizacao: true // 👈 Essa flag avisa o Python para não sobrescrever e não zerar status
          })
        });
      }

      alert("✅ Documentos complementares injetados e processando com sucesso!");
      setIsUploadExtraOpen(false);
      setAnaliseAlvoUpload(null);
      await carregarFilaComercial();

    } catch (err: any) {
      console.error(err);
      alert("❌ Erro no envio complementar: " + err.message);
    } finally {
      setLoading(false);
      setStatusTexto("");
    }
  };

  const handleVincularComercial = async (id: string, comercialAtual?: string) => {
    const novoComercial = prompt("Digite o nome completo do Comercial responsável por esta empresa:", comercialAtual || "");
    if (novoComercial === null) return; 
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from("analises")
        .update({ comercial: novoComercial.trim() })
        .eq("id", id);
        
      if (error) throw error;
      
      setFilaReal(prev => prev.map(item => item.id === id ? { ...item, comercial: novoComercial.trim() } : item));
      alert("✅ Comercial vinculado com sucesso!");
    } catch (err: any) {
      alert("❌ Falha ao vincular o comercial: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirPainelDocumentos = (item: FilaItem) => {
    setEmpresaParaDocs(item);
    setIsDocsModalOpen(true);
  };

  const baixarTudoZip = async () => {
    if (!empresaParaDocs?.dados_documentos || empresaParaDocs.dados_documentos.length === 0) return;
    
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const nomePasta = empresaParaDocs.empresa_nome.replace(/[^a-zA-Z0-9]/g, "_"); 
      const folder = zip.folder(nomePasta);

      if (!folder) throw new Error("Erro ao criar diretório ZIP.");

      const fetchPromises = empresaParaDocs.dados_documentos.map(async (url, i) => {
        const res = await fetch(url);
        const blob = await res.blob();
        
        let fileName = `Anexo_${i+1}`;
        try {
          const urlPartes = url.split(/[?#]/)[0].split('/');
          fileName = decodeURIComponent(urlPartes[urlPartes.length - 1]);
        } catch (e) {
          const isPdf = url.toLowerCase().includes('.pdf');
          fileName = `Anexo_${i+1}${isPdf ? ".pdf" : ".jpg"}`;
        }
        
        folder.file(fileName, blob);
      });

      await Promise.all(fetchPromises);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Docs_${nomePasta}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      console.error("Erro ao gerar ZIP:", err);
      alert("⚠️ Erro ao empacotar arquivos. Verifique bloqueios de CORS do navegador.");
    } finally {
      setIsZipping(false);
    }
  };

  const formatarCnpj = (cnpj: string) => {
    if (!cnpj) return "";
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) return cnpj;
    return `${limpo.substring(0, 2)}.${limpo.substring(2, 5)}.${limpo.substring(5, 8)}/${limpo.substring(8, 12)}-${limpo.substring(12, 14)}`;
  };

  const aplicarMascaraCnpj = (val: string) => {
    const limpo = val.replace(/\D/g, "").substring(0, 14);
    let masc = limpo;
    if (limpo.length > 2) masc = `${limpo.substring(0, 2)}.${limpo.substring(2)}`;
    if (limpo.length > 5) masc = `${masc.substring(0, 6)}.${masc.substring(6)}`;
    if (limpo.length > 8) masc = `${masc.substring(0, 10)}/${masc.substring(10)}`;
    if (limpo.length > 12) masc = `${masc.substring(0, 15)}-${masc.substring(15)}`;
    setCnpjBusca(masc);
  };

  const formatarDataHora = (isoString?: string) => {
    if (!isoString) return "---";
    const data = new Date(isoString);
    return data.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-8 relative">
        
        {/* OVERLAY DE LOADING GLOBAL */}
        {statusTexto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center font-bold text-white text-sm gap-4 transition-all">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="tracking-wide uppercase text-xs">{statusTexto}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase shadow-sm">
                Cloudflare R2 Active
              </span>
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase shadow-sm">
                Mesa V8 Síncrona
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
              🚀 Motor de Análise <span className="text-indigo-600 font-bold">Esteira V8</span>
            </h1>
          </div>
        </div>

        {/* BLOCO DE BUSCA E UPLOAD LARGADA */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden group transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          
          {!empresaSelecionada ? (
            <form onSubmit={handleBuscarPorCnpj} className="space-y-5 pl-2">
              <div>
                <label className="block font-black text-slate-500 uppercase text-[11px] tracking-widest mb-3">
                  🔍 Iniciar Nova Análise (Busca Oficial de CNPJ)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={cnpjBusca}
                    onChange={(e) => aplicarMascaraCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="flex-1 p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all max-w-[350px] shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={loading || cnpjBusca.replace(/\D/g, "").length < 14}
                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-md cursor-pointer"
                  >
                    {loading ? "Processando..." : "Localizar Empresa"}
                  </button>
                </div>
              </div>

              {empresas.length > 0 && (
                <div className="border border-indigo-100 rounded-2xl divide-y divide-indigo-50 bg-white overflow-hidden mt-4 max-w-[700px] shadow-sm">
                  {empresas.map((emp) => (
                    <div
                      key={emp.cnpj}
                      className="p-5 flex justify-between items-center bg-white hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                      onClick={() => setEmpresaSelecionada(emp)}
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase group-hover:text-indigo-900 transition-colors">{emp.razao_social}</p>
                        <p className="text-[12px] font-mono font-medium text-slate-500 mt-1">
                          CNPJ: {formatarCnpj(emp.cnpj)} — {emp.cidadeExtenso || "MATRIZ"}/{emp.uf.toUpperCase()}
                        </p>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-indigo-100 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        Avançar →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-5 pl-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-5 border border-emerald-200 bg-emerald-50/50 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg block w-max mb-2 border border-emerald-200">
                    ✅ CNPJ Vinculado Ativo
                  </span>
                  <h3 className="text-lg font-black text-slate-900 uppercase leading-none">{empresaSelecionada.razao_social}</h3>
                  <span className="font-mono font-bold text-slate-600 text-sm mt-1.5 block">{formatarCnpj(empresaSelecionada.cnpj)}</span>
                </div>
                <button
                  onClick={() => { setEmpresaSelecionada(null); setEmpresas([]); setCnpjBusca(""); }}
                  className="bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl hover:bg-slate-50 text-[11px] shadow-sm cursor-pointer transition-colors uppercase tracking-wide"
                >
                  ✕ Trocar Empresa
                </button>
              </div>

              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-3 gap-3">
                  <span className="font-black text-slate-600 uppercase text-[12px] tracking-widest flex items-center gap-2">
                    📄 Painel de Documentação R2
                  </span>
                </div>
                <UploadDocs empresa={empresaSelecionada as any} onSucesso={registrarAnaliseNoSupabase} />
              </div>
            </div>
          )}
        </div>

        {/* TABELA DA ESTEIRA */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
            <span className="font-black text-slate-600 uppercase tracking-widest text-[12px]">
              📊 Retorno da Mesa de Risco <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg ml-2 border border-indigo-200">{filaReal.length}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white text-slate-500 uppercase text-[10px] font-extrabold tracking-widest border-b border-slate-200 h-12">
                  <th className="p-4 pl-6">Empresa & Comercial</th>
                  <th className="p-4 text-center">Largada IA</th>
                  <th className="p-4 text-center">Fim IA</th>
                  <th className="p-4 text-center">Status Análise</th>
                  <th className="p-4 text-center">Decisão Comitê</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[12px]">
                {filaReal.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400 font-bold bg-slate-50/50 italic">
                      Nenhum resultado em processamento pela mesa no momento.
                    </td>
                  </tr>
                ) : (
                  filaReal.map((item) => {
                    const statusComite = item.status_comite?.toLowerCase() || "pendente";
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4 pl-6">
                          <p className="font-extrabold text-slate-900 uppercase tracking-tight truncate max-w-[300px]" title={item.empresa_nome}>{item.empresa_nome}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className="font-mono font-bold text-slate-500 text-[11px]">{formatarCnpj(item.cnpj)}</p>
                            {item.comercial && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md truncate max-w-[150px] shadow-sm uppercase tracking-wide" title={`Resp: ${item.comercial}`}>
                                👤 {item.comercial}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="p-4 text-center font-mono text-slate-500 font-medium text-[11px]">
                          {item.ia_inicio ? formatarDataHora(item.ia_inicio) : "---"}
                        </td>
                        
                        <td className="p-4 text-center font-mono text-slate-500 font-medium text-[11px]">
                          {item.ia_fim 
                            ? formatarDataHora(item.ia_fim) 
                            : item.ia_inicio 
                              ? <span className="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md animate-pulse uppercase tracking-wider text-[9px] shadow-xs">⏳ Processando...</span>
                              : "---"}
                        </td>
                        
                        <td className="p-4 text-center">
                          {item.status === "aberta" ? (
                            <span className="bg-slate-50 text-slate-600 border border-slate-300 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              📄 Aberta
                            </span>
                          ) : item.status === "aguardando_docs" ? (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              📥 Devolvido req.
                            </span>
                          ) : item.status === "em_revisao_humana" ? (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs animate-pulse">
                              🔮 Em Análise (Mesa)
                            </span>
                          ) : item.status === "em_comite" ? (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              ⚖️ Comitê de Crédito
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              {item.status}
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          {statusComite === "aprovado" ? (
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              🟢 Aprovado
                            </span>
                          ) : statusComite === "reprovado" ? (
                            <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              🔴 Reprovado
                            </span>
                          ) : (
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-xs">
                              🟡 Pendente
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <div className="flex justify-center items-center gap-2">
                            {/* 🔥 BOTÃO DE ENVIO COMPLEMENTAR */}
                            <button
                              onClick={() => abrirModalEnvioExtra(item)}
                              className="bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 hover:text-blue-700 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wide shadow-sm cursor-pointer transition-all"
                              title="Anexar mais documentos a esta análise em andamento"
                            >
                              ➕ Anexar
                            </button>

                            <button
                              onClick={() => abrirPainelDocumentos(item)}
                              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wide shadow-sm cursor-pointer transition-all"
                              title="Visualizar documentos lidos pela IA"
                            >
                              📂 Docs
                            </button>
                            
                            <button
                              onClick={() => handleVincularComercial(item.id, item.comercial)}
                              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wide shadow-sm cursor-pointer transition-all"
                              title="Vincular ou alterar o Responsável Comercial"
                            >
                              👤 Vinc.
                            </button>
                            
                            <button
                              onClick={() => router.push(`/dashboard/motor-credito/analise?id=${item.id}`)}
                              className="bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wide flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                            >
                              👁️ Parecer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🔥 MODAL DE ENVIO DE DOCUMENTOS COMPLEMENTARES */}
        {isUploadExtraOpen && analiseAlvoUpload && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">➕ Envio Complementar de Documentos</h2>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{analiseAlvoUpload.empresa_nome} — {formatarCnpj(analiseAlvoUpload.cnpj)}</p>
                </div>
                <button 
                  onClick={() => { setIsUploadExtraOpen(false); setAnaliseAlvoUpload(null); }} 
                  className="p-2 bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg font-bold transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 bg-white space-y-4">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-xs font-medium leading-relaxed">
                  <strong>Atenção:</strong> Os documentos anexados aqui serão <strong>somados</strong> aos que já estão na nuvem. O Motor V8 será notificado para ler apenas os novos arquivos e atualizar a análise sem zerar o status da mesa!
                </div>
                
                {/* Reaproveitamos o componente UploadDocs mapeando os dados da análise! */}
                <UploadDocs 
                  empresa={{
                    cnpj: analiseAlvoUpload.cnpj,
                    razao_social: analiseAlvoUpload.empresa_nome,
                    uf: "PR"
                  } as any} 
                  onSucesso={lidarUploadExtra} 
                />
              </div>
            </div>
          </div>
        )}

        {/* 🔥 MODAL DE DOCUMENTOS E CHECKLIST */}
        {isDocsModalOpen && empresaParaDocs && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">📂 Base de Documentos Injetados</h2>
                  <p className="text-xs text-slate-500 font-medium font-mono mt-1">{empresaParaDocs.empresa_nome} — {formatarCnpj(empresaParaDocs.cnpj)}</p>
                </div>
                <button 
                  onClick={() => setIsDocsModalOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm font-bold"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6 bg-slate-50/50">
                <div className="space-y-3">
                  <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Leitura do Robô / Checklist Mapeado
                  </h3>
                  
                  {empresaParaDocs.checklist_ia && Object.keys(empresaParaDocs.checklist_ia).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                       {Object.entries(empresaParaDocs.checklist_ia).map(([chave, valor]) => (
                         <div key={chave} className={`p-3 rounded-xl border flex items-center justify-between shadow-sm ${valor ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                           <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{chave.replace(/_/g, ' ')}</span>
                           <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${valor ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                             {valor ? "✔️ LIDO" : "❌ PENDENTE"}
                           </span>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="p-5 bg-white border border-indigo-100 rounded-xl shadow-sm">
                      <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                        💡 <strong>Estrutura de Validação Pronta:</strong> Os arquivos processados com sucesso listarão seus checks automáticos de categoria aqui em breve.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 border-dashed pt-4"></div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Arquivos Brutos (Cloudflare R2) - {empresaParaDocs.dados_documentos?.length || 0} anexo(s)
                    </h3>
                    
                    {empresaParaDocs.dados_documentos && empresaParaDocs.dados_documentos.length > 0 && (
                      <button 
                        onClick={baixarTudoZip}
                        disabled={isZipping}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isZipping ? "⏳ Empacotando..." : "📦 Baixar Todos (.ZIP)"}
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {empresaParaDocs.dados_documentos && empresaParaDocs.dados_documentos.length > 0 ? (
                      empresaParaDocs.dados_documentos.map((url, i) => {
                        const isPdf = url.toLowerCase().includes('.pdf');
                        
                        let nomeRealArquivo = `Anexo_${i+1}`;
                        try {
                          const urlPartes = url.split(/[?#]/)[0].split('/'); 
                          let ultimoTrecho = urlPartes[urlPartes.length - 1];
                          nomeRealArquivo = decodeURIComponent(ultimoTrecho); 
                        } catch (e) {
                          nomeRealArquivo = `Anexo_Injetado_${i+1}${isPdf ? ".pdf" : ".jpg"}`;
                        }

                        return (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-3.5 border border-slate-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group"
                            title={nomeRealArquivo}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="text-xl shrink-0">{isPdf ? "📄" : "🖼️"}</span>
                              <span className="text-xs font-bold text-slate-600 truncate group-hover:text-blue-700 transition-colors">
                                {nomeRealArquivo}
                              </span>
                            </div>
                            <span className="text-[9px] bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-md text-slate-500 font-black uppercase tracking-wider group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors shrink-0">
                              Abrir ↗
                            </span>
                          </a>
                        )
                      })
                    ) : (
                      <div className="col-span-2 p-6 bg-slate-100 rounded-xl border border-slate-200 border-dashed text-center">
                        <p className="text-xs text-slate-400 italic font-bold">Nenhum arquivo físico de leitura atrelado a este envio.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}