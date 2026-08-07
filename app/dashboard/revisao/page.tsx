/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext"; // 🛡️ O Crachá Global

// =========================================================================
// 🚀 COMPONENTE MINI VIEWER DO DRIVE (COM PREVIEW E NAVEGAÇÃO)
// =========================================================================
const PASTA_RAIZ_ID = "1hgVuaxj0iCvwi2vfrGfm8nxBINgwOBbS"; // 👈 SEU LINK OFICIAL DA RAIZ

function MiniViewerDrive({ folderIdAtual, onFolderSelected }: { folderIdAtual: string | null, onFolderSelected: (id: string | null) => void }) {
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pastaAlvo, setPastaAlvo] = useState(folderIdAtual || PASTA_RAIZ_ID);
  
  const [historicoPastas, setHistoricoPastas] = useState<string[]>([]);
  const [previewArquivo, setPreviewArquivo] = useState<{nome: string, url: string} | null>(null);

  const carregarArquivos = useCallback(async (idDaPasta: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/drive?folderId=${idDaPasta}`, {
        headers: { "Authorization": `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (data.files) setArquivos(data.files);
    } catch (err) {
      console.error("Erro ao carregar drive", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarArquivos(pastaAlvo);
  }, [pastaAlvo, carregarArquivos]);

  const entrarNaPasta = (id: string) => {
    setHistoricoPastas(prev => [...prev, pastaAlvo]);
    setPastaAlvo(id);
  };

  const subirNivel = () => {
    const novoHistorico = [...historicoPastas];
    const pastaAnterior = novoHistorico.pop();
    if (pastaAnterior) {
      setHistoricoPastas(novoHistorico);
      setPastaAlvo(pastaAnterior);
    }
  };

  const abrirVisualizador = (arq: any) => {
    let urlEmbed = arq.webViewLink;
    if (urlEmbed.includes("/view")) {
      urlEmbed = urlEmbed.replace(/\/view(\?.*)?$/, "/preview");
    }
    setPreviewArquivo({ nome: arq.name, url: urlEmbed });
  };

  const renderPreviewModal = () => {
    if (!previewArquivo) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
        <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative border border-slate-700">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-black text-slate-800 flex items-center gap-2 truncate pr-4">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5M9.73 3.5h13.12l-3.43 6H6.28l3.45-6zm.56 12.5l3.43 6h10.28l-3.43-6H10.29z"/></svg>
              {previewArquivo.nome}
            </h3>
            <button onClick={() => setPreviewArquivo(null)} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 shadow-sm rounded-lg px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer">
              X Fechar Visualização
            </button>
          </div>
          <div className="flex-1 bg-slate-200/50">
            <iframe src={previewArquivo.url} className="w-full h-full border-none" allow="autoplay" title="Preview" />
          </div>
        </div>
      </div>
    );
  };

  // MODO 1: SELETOR
  if (!folderIdAtual) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-4 rounded-xl border border-slate-200">
        {renderPreviewModal()}
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            Selecione a Pasta do Cedente
          </h4>
          {historicoPastas.length > 0 && (
            <button onClick={subirNivel} className="text-xs font-bold bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer">
              ⬅ Subir Nível
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 animate-pulse mt-2 flex items-center gap-2">Sincronizando Drive...</p>
        ) : (
          <div className="max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {arquivos.filter(f => f.mimeType === "application/vnd.google-apps.folder").map(pasta => (
              <div key={pasta.id} className="flex flex-col border border-slate-200 hover:border-emerald-300 rounded-lg p-2 hover:bg-emerald-50 transition-colors group">
                <button 
                  onClick={() => entrarNaPasta(pasta.id)}
                  className="w-full text-left flex items-center gap-2 text-[11px] font-bold text-slate-700 mb-2 truncate cursor-pointer"
                  title="Dar duplo clique ou abrir pasta"
                >
                  <img src={pasta.iconLink} alt="icon" className="w-4 h-4 shrink-0" />
                  <span className="truncate">{pasta.name}</span>
                </button>
                <button 
                  onClick={() => onFolderSelected(pasta.id)}
                  className="w-full mt-auto text-[10px] uppercase tracking-widest font-black bg-emerald-600 text-white py-1.5 rounded shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Vincular Aqui
                </button>
              </div>
            ))}
            {arquivos.filter(f => f.mimeType === "application/vnd.google-apps.folder").length === 0 && (
              <p className="text-xs text-slate-400 p-4 col-span-full text-center">Nenhuma subpasta encontrada aqui.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // MODO 2: VIEWER
  return (
    <div className="flex flex-col h-full bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      {renderPreviewModal()}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5M9.73 3.5h13.12l-3.43 6H6.28l3.45-6zm.56 12.5l3.43 6h10.28l-3.43-6H10.29z"/></svg>
            Dossiê de Documentos
          </h4>
          {historicoPastas.length > 0 && (
            <button onClick={subirNivel} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200 transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer">
              ⬅ Subir Nível
            </button>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <a href={`https://drive.google.com/drive/folders/${pastaAlvo}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors uppercase border border-blue-200 shadow-sm flex items-center gap-1" title="Abrir pasta no próprio Google Drive">
            Abrir Externo ↗
          </a>
          <button 
            onClick={() => {
              onFolderSelected(null);
              setPastaAlvo(PASTA_RAIZ_ID);
              setHistoricoPastas([]);
            }} 
            className="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline cursor-pointer ml-2"
          >
            Desvincular
          </button>
        </div>
      </div>

      <div className="flex-1 max-h-64 min-h-[160px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-slate-500 font-medium">
            <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Sincronizando Drive...
          </div>
        ) : arquivos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-slate-100 m-2">
            A pasta está vazia.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-1">
            {arquivos.map(arq => {
              const isPasta = arq.mimeType === "application/vnd.google-apps.folder";
              return (
                <button 
                  key={arq.id} 
                  onClick={() => isPasta ? entrarNaPasta(arq.id) : abrirVisualizador(arq)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all border group text-left cursor-pointer
                    ${isPasta ? "bg-slate-50 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300" : "bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm"}
                  `}
                >
                  <img src={arq.iconLink} alt="icon" className="w-6 h-6 shrink-0" />
                  <span className={`text-xs font-semibold truncate ${isPasta ? "text-slate-700" : "text-slate-600 group-hover:text-blue-700"}`}>
                    {arq.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================================
// 🎨 TIPAGENS E INTERFACES DA REVISÃO
// ==========================================================================
interface RevisaoCedente {
  id: string; 
  cedente: string;
  comercial: string | null;
  data_ultima_renovacao: string | null;
  data_proxima_renovacao: string | null;
  pendencias: string | null;
  ultimo_email_enviado: string | null;
  renovado: boolean | null;
  drive_folder_id?: string | null; // 👈 Adicionamos a prop aqui
  _isEditado?: boolean;
}

export default function RevisaoPage() {
  const { user } = useAuth();

  const [revisoes, setRevisoes] = useState<RevisaoCedente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "EM_DIA" | "ALERTA" | "VENCIDO">("TODOS");
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});

  const [gmailConectado, setGmailConectado] = useState(false);
  const [templatesEmail, setTemplatesEmail] = useState<any[]>([]);
  const [modalDisparoAberto, setModalDisparoAberto] = useState(false);
  const [tipoDisparoAtual, setTipoDisparoAtual] = useState<"ALERTA_VENCIMENTO" | "PENDENCIA" | null>(null);
  const [selecionadosParaDisparo, setSelecionadosParaDisparo] = useState<string[]>([]);
  const [templateSelecionadoId, setTemplateSelecionadoId] = useState<string>("");
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [logsDisparo, setLogsDisparo] = useState<string[]>([]);
  const [buscaModalDisparo, setBuscaModalDisparo] = useState("");

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);

      if (user?.email) {
        const emailTratado = user.email.toLowerCase().trim();
        const { data: integracoes } = await supabase
          .from("usuarios_integracoes")
          .select("id")
          .eq("email_usuario", emailTratado)
          .limit(1); 
        setGmailConectado(!!(integracoes && integracoes.length > 0));
      }

      const { data: tpls } = await supabase.from("crm_email_templates").select("*").order("created_at", { ascending: false });
      if (tpls) setTemplatesEmail(tpls);

      const { data, error } = await supabase.from("revisao_cedentes").select("*");
      if (error) throw error;
      
      if (data) {
        setRevisoes(data.map(item => ({ ...item, _isEditado: false })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [user]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const aplicarTagsDinamicas = (texto: string, item: RevisaoCedente) => {
    if (!texto) return "";
    const primeiroNomeComercial = item.comercial ? item.comercial.split(' ')[0] : "Equipe";
    
    return texto
      .replace(/\{empresa\}/gi, item.cedente || "Empresa Não Informada")
      .replace(/\{contato\}/gi, primeiroNomeComercial)
      .replace(/\{comercial\}/gi, item.comercial || "Comercial")
      .replace(/\{vencimento\}/gi, fData(item.data_proxima_renovacao))
      .replace(/\{pendencias\}/gi, item.pendencias || "Nenhuma pendência anotada.");
  };

  const abrirModalDisparo = (tipo: "ALERTA_VENCIMENTO" | "PENDENCIA") => {
    setTipoDisparoAtual(tipo);
    setSelecionadosParaDisparo([]);
    setLogsDisparo([]);
    setTemplateSelecionadoId(""); 
    setBuscaModalDisparo(""); 
    setModalDisparoAberto(true);
  };

  const toggleSelecaoDisparo = (id: string) => {
    setSelecionadosParaDisparo(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const executarDisparoEmLote = async () => {
    if (selecionadosParaDisparo.length === 0 || !user?.email || !templateSelecionadoId) return;
    
    const templateAtivo = templatesEmail.find(t => t.id === templateSelecionadoId);
    if (!templateAtivo) return;

    setEnviandoLote(true);
    setLogsDisparo(["🚀 Iniciando notificações aos comerciais:", `- Template: ${templateAtivo.nome}`]);

    const itensParaEnviar = revisoes.filter(c => selecionadosParaDisparo.includes(c.id));
    
    const { data: { session } } = await supabase.auth.getSession();
    const tokenJwt = session?.access_token;

    for (const item of itensParaEnviar) {
      try {
        setLogsDisparo(prev => [...prev, `⏳ Buscando contato do comercial ${item.comercial || "..."} para a empresa ${item.cedente}...`]);
        
        let emailDestino = "";
        if (item.comercial) {
          const { data: usuNome } = await supabase.from('usuarios').select('email').ilike('nome', `%${item.comercial}%`).single();
          if (usuNome) emailDestino = usuNome.email;
        }

        if (!emailDestino) {
          setLogsDisparo(prev => [...prev, `❌ Pulando ${item.cedente}: E-mail do comercial não encontrado no banco.`]);
          continue; 
        }

        const assuntoFinal = aplicarTagsDinamicas(templateAtivo.assunto, item);
        const textoFinal = aplicarTagsDinamicas(templateAtivo.corpo, item);

        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${tokenJwt}`
          },
          body: JSON.stringify({
            userEmail: user.email,
            para: emailDestino,
            cc: templateAtivo.cc || "", 
            assunto: assuntoFinal,
            textoResposta: textoFinal
          })
        });

        if (!res.ok) throw new Error(`Falha na API Gmail`);
        
        const hojeIso = new Date().toISOString().split("T")[0];
        await supabase.from("revisao_cedentes").update({ ultimo_email_enviado: hojeIso }).eq("id", item.id);

        setLogsDisparo(prev => [...prev, `✅ Enviado com sucesso para ${item.comercial} (${emailDestino}) -> ${item.cedente}`]);
        await new Promise(r => setTimeout(r, 1000));

      } catch (err: any) {
        setLogsDisparo(prev => [...prev, `❌ Falha ao notificar sobre ${item.cedente}: ${err.message}`]);
      }
    }

    setLogsDisparo(prev => [...prev, "🎉 Processo finalizado!"]);
    setEnviandoLote(false);
    await carregarDados(); 
  };

  const toggleExpandirLinha = (id: string) => setLinhasExpandidas(prev => ({ ...prev, [id]: !prev[id] }));

  const handleInputChange = (index: number, campo: keyof RevisaoCedente, valor: any) => {
    const novos = [...revisoes];
    novos[index] = { ...novos[index], [campo]: valor, _isEditado: true };
    setRevisoes(novos);
  };

  const handleDataUltimaChange = (index: number, novaData: string) => {
    if (!novaData) return handleInputChange(index, "data_ultima_renovacao", "");

    const novos = [...revisoes];
    const dataProxima = new Date(new Date(novaData).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    novos[index] = { 
      ...novos[index], 
      data_ultima_renovacao: novaData, 
      data_proxima_renovacao: dataProxima, 
      _isEditado: true 
    };
    setRevisoes(novos);
  };

  const renovarRapido = async (item: RevisaoCedente) => {
    if (!confirm(`🚀 Confirmar a renovação automática de ${item.cedente} por +180 dias?`)) return;
    try {
      setSalvando(true);
      const hoje = new Date();
      const dataUltima = hoje.toISOString().split("T")[0];
      const dataProxima = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const { error } = await supabase
        .from("revisao_cedentes")
        .update({ 
          data_ultima_renovacao: dataUltima, 
          data_proxima_renovacao: dataProxima, 
          ultimo_email_enviado: null,
          pendencias: null,
          renovado: true
        })
        .eq("id", item.id);

      if (error) throw error;
      alert(`✅ Limite de ${item.cedente} renovado com sucesso!`); 
      await carregarDados();
    } catch (err: any) { alert(`❌ Erro ao renovar: ${err.message}`); } finally { setSalvando(false); }
  };

  const salvarLinha = async (item: RevisaoCedente) => {
    try {
      setSalvando(true);
      const { error } = await supabase.from("revisao_cedentes").update({
        data_ultima_renovacao: item.data_ultima_renovacao,
        data_proxima_renovacao: item.data_proxima_renovacao,
        pendencias: item.pendencias,
        renovado: item.renovado,
        drive_folder_id: item.drive_folder_id // 👈 Salva o ID da pasta
      }).eq("id", item.id);

      if (error) throw error;
      alert(`✅ Alterações de ${item.cedente} salvas!`);
      await carregarDados();
    } catch (err: any) { alert(`❌ Erro: ${err.message}`); } finally { setSalvando(false); }
  };

  const salvarTodasAlteracoes = async () => {
    const editados = revisoes.filter(r => r._isEditado);
    if (editados.length === 0) return alert("💡 Nenhuma alteração pendente para salvar.");
    try {
      setSalvando(true);
      for (const item of editados) {
        await supabase.from("revisao_cedentes").update({
          data_ultima_renovacao: item.data_ultima_renovacao,
          data_proxima_renovacao: item.data_proxima_renovacao,
          pendencias: item.pendencias,
          renovado: item.renovado,
          drive_folder_id: item.drive_folder_id // 👈 Salva o ID da pasta
        }).eq("id", item.id);
      }
      alert("🎉 Todas as alterações foram gravadas!");
      setLinhasExpandidas({});
      await carregarDados();
    } catch (err: any) { alert(`❌ Erro no salvamento: ${err.message}`); } finally { setSalvando(false); }
  };

  const fData = (str: string | null) => str ? str.split("-").reverse().join("/") : "Não definida";

  const analiseVencimento = (dataStr: string | null) => {
    if (!dataStr) return { status: "SEM_DATA", cor: "bg-slate-100 text-slate-600 border-slate-200", icone: "⚪", diffDias: 0, percent: 0 };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(dataStr + "T12:00:00");
    const diffDias = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    let percent = ((180 - diffDias) / 180) * 100;
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;

    if (diffDias < 0) return { status: "VENCIDO", cor: "bg-rose-50 text-rose-700 border-rose-200", icone: "🔴", diffDias, percent };
    if (diffDias <= 30) return { status: "ALERTA", cor: "bg-amber-50 text-amber-700 border-amber-200", icone: "🟡", diffDias, percent };
    return { status: "EM_DIA", cor: "bg-emerald-50 text-emerald-700 border-emerald-200", icone: "🟢", diffDias, percent };
  };

  const kpis = useMemo(() => {
    let emDia = 0, alerta = 0, vencido = 0;
    revisoes.forEach(r => {
      const { status } = analiseVencimento(r.data_proxima_renovacao);
      if (status === "EM_DIA") emDia++;
      if (status === "ALERTA") alerta++;
      if (status === "VENCIDO") vencido++;
    });
    return { total: revisoes.length, emDia, alerta, vencido };
  }, [revisoes]);

  const revisoesFiltradasEOrdenadas = useMemo(() => {
    let filtrado = revisoes.filter(r => {
      if (busca && !r.cedente.toLowerCase().includes(busca.toLowerCase())) return false;
      const { status } = analiseVencimento(r.data_proxima_renovacao);
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "EM_DIA" && status === "EM_DIA") return true;
      if (filtroStatus === "ALERTA" && status === "ALERTA") return true;
      if (filtroStatus === "VENCIDO" && status === "VENCIDO") return true;
      return false;
    });

    filtrado.sort((a, b) => {
      const comercialA = (a.comercial || "Sem Comercial").toUpperCase();
      const comercialB = (b.comercial || "Sem Comercial").toUpperCase();
      if (comercialA !== comercialB) return comercialA.localeCompare(comercialB);
      const dateA = new Date(a.data_proxima_renovacao || "2099-01-01").getTime();
      const dateB = new Date(b.data_proxima_renovacao || "2099-01-01").getTime();
      return dateA - dateB;
    });

    return filtrado;
  }, [revisoes, busca, filtroStatus]);

  const cedentesModalFiltrados = useMemo(() => {
    return revisoes.filter(c => {
      if (buscaModalDisparo && !c.cedente.toLowerCase().includes(buscaModalDisparo.toLowerCase())) return false;
      const { status } = analiseVencimento(c.data_proxima_renovacao);
      if (tipoDisparoAtual === "ALERTA_VENCIMENTO") return status === "ALERTA" || status === "VENCIDO";
      if (tipoDisparoAtual === "PENDENCIA") return !!(c.pendencias && c.pendencias.trim().length > 0);
      return true;
    });
  }, [revisoes, buscaModalDisparo, tipoDisparoAtual]);

  const linkAuthGoogle = `/api/auth/google?user=${user?.email || ""}&origin=/dashboard/revisao`;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Visão Geral - Revisão de Cedentes</h2>
            </div>
            <span className="text-sm text-slate-500 font-medium ml-12">Painel de controle de vencimentos e pendências documentais (Uso Interno).</span>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button onClick={carregarDados} disabled={carregando || salvando} className="flex-1 md:flex-none px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              🔄 Atualizar
            </button>
            <button onClick={salvarTodasAlteracoes} disabled={salvando || carregando} className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {salvando ? "Salvando..." : "💾 Salvar Tudo"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <button onClick={() => setFiltroStatus("TODOS")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "TODOS" ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}>
            <span className={`text-[11px] font-bold uppercase tracking-widest block mb-2 ${filtroStatus === "TODOS" ? "text-slate-400" : "text-slate-500"}`}>Carteira Total (Global)</span>
            <span className="text-4xl font-black">{kpis.total}</span>
          </button>
          
          <button onClick={() => setFiltroStatus("VENCIDO")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "VENCIDO" ? "bg-rose-50 border-rose-200 shadow-md shadow-rose-100" : "bg-white border-slate-200 hover:border-rose-200 shadow-sm"}`}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Limites Vencidos</span>
            <span className="text-4xl font-black text-slate-800">{kpis.vencido}</span>
          </button>

          <button onClick={() => setFiltroStatus("ALERTA")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "ALERTA" ? "bg-amber-50 border-amber-200 shadow-md shadow-amber-100" : "bg-white border-slate-200 hover:border-amber-200 shadow-sm"}`}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Vence em {'<'} 30 dias</span>
            <span className="text-4xl font-black text-slate-800">{kpis.alerta}</span>
          </button>

          <button onClick={() => setFiltroStatus("EM_DIA")} className={`p-5 rounded-2xl text-left transition-all duration-300 border cursor-pointer ${filtroStatus === "EM_DIA" ? "bg-emerald-50 border-emerald-200 shadow-md shadow-emerald-100" : "bg-white border-slate-200 hover:border-emerald-200 shadow-sm"}`}>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Limites em Dia</span>
            <span className="text-4xl font-black text-slate-800">{kpis.emDia}</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Notificações aos Comerciais</h3>
              <p className="text-[10px] text-slate-500">Cobrar limites vencendo e pendências</p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0 items-center">
            {!gmailConectado ? (
              <a href={linkAuthGoogle} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-black transition-colors whitespace-nowrap flex items-center gap-2 uppercase tracking-wide shadow-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.333.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                Conectar Conta Google
              </a>
            ) : (
              <>
                <button onClick={() => abrirModalDisparo("ALERTA_VENCIMENTO")} className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Cobrar Vencimento
                </button>
                <button onClick={() => abrirModalDisparo("PENDENCIA")} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Cobrar Pendências
                </button>
                <a href={linkAuthGoogle} title="Reconectar Google" className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs">
                  🔄 Reconectar Google
                </a>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <svg className="w-5 h-5 text-slate-400 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Buscar por nome do Cedente..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-slate-700 font-medium p-2"
          />
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="w-14 px-4 text-center">Ação</th>
                  <th className="px-4 w-72">Cedente</th>
                  <th className="px-4 w-32">Comercial</th>
                  <th className="px-4 text-center w-40">Última Renovação</th>
                  <th className="px-4 w-52">Cronograma (180 dias)</th>
                  <th className="px-4 flex-1 min-w-[250px]">Status / Pendências</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {carregando && revisoes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-medium animate-pulse">Carregando cronograma...</td></tr>
                ) : revisoesFiltradasEOrdenadas.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-medium">Nenhum cedente encontrado. 🎉</td></tr>
                ) : revisoesFiltradasEOrdenadas.map((item, mapIndex, array) => {
                  
                  const index = revisoes.findIndex(r => r.id === item.id);
                  const isOpen = !!linhasExpandidas[item.id];
                  const infoData = analiseVencimento(item.data_proxima_renovacao);
                  const temPendencia = item.pendencias && item.pendencias.trim().length > 0;

                  const comercialAtual = item.comercial || "Sem Comercial";
                  const comercialAnterior = mapIndex > 0 ? (array[mapIndex - 1].comercial || "Sem Comercial") : null;
                  const showGroupHeader = comercialAtual !== comercialAnterior;

                  return (
                    <React.Fragment key={item.id}>
                      
                      {/* HEADER DO BLOCO COMERCIAL */}
                      {showGroupHeader && (
                        <tr>
                          <td colSpan={6} className="bg-indigo-50/80 border-t-4 border-indigo-200 px-4 py-2.5">
                            <div className="flex items-center gap-2 text-indigo-900">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              <span className="text-xs font-black uppercase tracking-widest">Carteira: {comercialAtual}</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* LINHA PRINCIPAL */}
                      <tr className={`group transition-all duration-200 ${isOpen ? "bg-indigo-50/30" : "hover:bg-slate-50"} ${item._isEditado ? "bg-amber-50/30" : ""} border-l-4 border-l-indigo-400`}>
                        
                        <td className="px-4 py-4 text-center align-top">
                          <button onClick={() => toggleExpandirLinha(item.id)} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-all border cursor-pointer ${isOpen ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30" : "bg-white text-slate-400 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 shadow-sm"}`}>
                            <svg className={`w-4 h-4 transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col">
                            {/* 👇 NOVO: ÍCONE DO DRIVE NA LINHA PRINCIPAL */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-800 tracking-tight block truncate" title={item.cedente}>{item.cedente}</span>
                              {item.drive_folder_id && (
                                <a href={`https://drive.google.com/drive/folders/${item.drive_folder_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1 rounded-md transition-all cursor-pointer shadow-sm border border-blue-100" title="Abrir Pasta no Google Drive">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5l-2-2z" /></svg>
                                </a>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              {item.renovado && <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Ciclo Ativo</span>}
                              {item.ultimo_email_enviado && <span className="text-[9px] text-slate-400 font-medium border border-slate-200 rounded px-1.5 py-0.5" title="Último aviso de cobrança enviado">Cobrado: {fData(item.ultimo_email_enviado)}</span>}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span className="text-slate-500 text-xs font-bold uppercase block mt-0.5">{item.comercial || "-"}</span>
                        </td>

                        <td className="px-4 py-4 align-top text-center relative group/edit">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-slate-500 font-mono text-xs font-semibold block mt-0.5">{fData(item.data_ultima_renovacao)}</span>
                            <button onClick={() => toggleExpandirLinha(item.id)} className="opacity-0 group-hover/edit:opacity-100 text-indigo-500 hover:bg-indigo-50 p-1 rounded transition-all cursor-pointer" title="Editar data de renovação">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-1.5 mt-0.5">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                              <span className={infoData.status === "VENCIDO" ? "text-rose-600" : "text-slate-500"}>
                                {infoData.status === "VENCIDO" ? `Vencido há ${Math.abs(infoData.diffDias)}d` : `Expira em ${infoData.diffDias}d`}
                              </span>
                              <span className="text-slate-500 font-mono">{fData(item.data_proxima_renovacao)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-500 ${infoData.status === 'VENCIDO' ? 'bg-rose-500' : infoData.status === 'ALERTA' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${infoData.percent}%` }} />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          {temPendencia ? (
                            <div className="flex gap-2 items-start text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 shadow-sm text-xs font-medium cursor-pointer" onClick={() => !isOpen && toggleExpandirLinha(item.id)}>
                              <span>⚠️</span>
                              <span className="truncate max-w-[200px]" title={item.pendencias || ""}>{item.pendencias}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-600/70 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 w-max">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                              Sem pendências
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* AREA EXPANDIDA (Detalhes e Edição) */}
                      {isOpen && (
                        <tr>
                          <td colSpan={6} className={`bg-indigo-50/20 border-b-2 border-indigo-100 p-6 shadow-inner`}>
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                              <div className="xl:col-span-4 space-y-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">Controle de Ciclo</span>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[10px] text-slate-500 font-bold uppercase">Última Renovação (Início)</label>
                                      <input type="date" value={item.data_ultima_renovacao || ""} 
                                        onChange={(e) => handleDataUltimaChange(index, e.target.value)} 
                                        className="w-full p-2.5 border border-indigo-300 rounded-lg text-sm font-mono font-black text-indigo-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all bg-white shadow-inner cursor-text" 
                                      />
                                      <p className="text-[9px] text-slate-400 mt-1">Ao alterar esta data, a próxima expiração (+180 dias) será recalculada automaticamente.</p>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[10px] text-slate-500 font-bold uppercase">Próxima Expiração (Teto +180d)</label>
                                      <input type="date" value={item.data_proxima_renovacao || ""} onChange={(e) => handleInputChange(index, "data_proxima_renovacao", e.target.value)} 
                                        className={`w-full p-2.5 border rounded-lg text-sm font-mono font-bold outline-none transition-all focus:ring-2 ${infoData.status === 'VENCIDO' ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300 text-slate-700 bg-slate-50 hover:bg-white focus:border-indigo-500 focus:ring-indigo-100'}`} />
                                    </div>
                                    
                                    <button onClick={() => renovarRapido(item)} disabled={salvando} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                                      🚀 Renovar Automático (+180 Dias)
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="xl:col-span-8">
                                <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100 shadow-sm h-full flex flex-col">
                                  <label className="flex items-center gap-2 mb-3 text-xs text-amber-900 font-bold uppercase tracking-wider">
                                    <span className="text-base">⚠️</span> Registro de Pendências (Docs/Comitê)
                                  </label>
                                  <textarea 
                                    value={item.pendencias || ""} 
                                    onChange={(e) => handleInputChange(index, "pendencias", e.target.value)} 
                                    className="flex-1 w-full p-4 border border-amber-200 rounded-xl text-sm resize-none outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 bg-white hover:border-amber-300 transition-all text-slate-700 font-medium" 
                                    placeholder="Descreva aqui os documentos faltando, certidões pendentes ou restrições de comitê..." 
                                  />
                                </div>
                              </div>

                              {/* 👇 NOVO: GIGANTE EMBAIXO OCUPANDO A LINHA INTEIRA */}
                              <div className="xl:col-span-12 mt-2">
                                <MiniViewerDrive 
                                  folderIdAtual={item.drive_folder_id || null} 
                                  onFolderSelected={(idDaPasta) => handleInputChange(index, "drive_folder_id", idDaPasta)} 
                                />
                              </div>

                              <div className="xl:col-span-12 flex justify-end pt-4 border-t border-slate-200/60 mt-2">
                                <button 
                                  onClick={() => salvarLinha(item)} 
                                  disabled={salvando || !item._isEditado} 
                                  className={`px-6 py-2.5 font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer
                                    ${salvando || !item._isEditado 
                                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30"
                                    }`}
                                >
                                  {salvando ? "Processando..." : (item._isEditado ? "Salvar Alterações desta Linha" : "Nenhuma alteração")}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================== */}
      {/* 📧 MODAL DE DISPARO DE E-MAILS */}
      {/* ========================================================================== */}
      {modalDisparoAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Disparo: {tipoDisparoAtual === "ALERTA_VENCIMENTO" ? "Limites Vencendo/Vencidos" : "Cobrança de Pendências"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure o aviso automático para a equipe comercial.</p>
              </div>
              <button onClick={() => !enviandoLote && setModalDisparoAberto(false)} disabled={enviandoLote} className="text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-white space-y-6">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-900 mb-2 uppercase">1. Selecione o Template de E-mail:</label>
                <select 
                  value={templateSelecionadoId}
                  onChange={(e) => setTemplateSelecionadoId(e.target.value)}
                  disabled={enviandoLote || templatesEmail.length === 0}
                  className="w-full p-3 bg-white border border-indigo-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all cursor-pointer"
                >
                  <option value="" disabled>-- Selecione um template da base --</option>
                  {templatesEmail.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
                {templatesEmail.length === 0 && <p className="text-[10px] text-rose-500 mt-1">Nenhum template cadastrado em "crm_email_templates".</p>}
              </div>

              {cedentesModalFiltrados.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">Nenhum cliente está apto para esta notificação no momento.</div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase">2. Selecione as Empresas ({cedentesModalFiltrados.length}):</label>
                    <button 
                      onClick={() => setSelecionadosParaDisparo(selecionadosParaDisparo.length === cedentesModalFiltrados.length ? [] : cedentesModalFiltrados.map(c => c.id))} 
                      disabled={enviandoLote}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
                    >
                      {selecionadosParaDisparo.length === cedentesModalFiltrados.length ? "Desmarcar Todos" : "Selecionar Todos"}
                    </button>
                  </div>

                  <div className="mb-3 relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="text" 
                      placeholder="🔍 Filtrar cedente na lista..." 
                      value={buscaModalDisparo}
                      onChange={(e) => setBuscaModalDisparo(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:bg-white focus:border-indigo-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {cedentesModalFiltrados.map(c => (
                      <div key={c.id} className={`flex flex-col p-3 border rounded-xl transition-colors cursor-pointer ${selecionadosParaDisparo.includes(c.id) ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:bg-slate-50"}`} onClick={() => !enviandoLote && toggleSelecaoDisparo(c.id)}>
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={selecionadosParaDisparo.includes(c.id)} 
                            readOnly
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer pointer-events-none"
                          />
                          <div className="flex-1">
                            <p className="font-bold text-sm text-slate-800">{c.cedente}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Comercial Responsável: {c.comercial || "Sem nome"}</p>
                          </div>
                          {c.ultimo_email_enviado && <span className="text-[9px] px-2 py-1 bg-slate-200 text-slate-500 font-bold rounded">Cobrado: {fData(c.ultimo_email_enviado)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {logsDisparo.length > 0 && (
                <div className="p-3 bg-slate-900 rounded-xl max-h-32 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 border border-slate-700">
                  {logsDisparo.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">{selecionadosParaDisparo.length} selecionado(s)</span>
              <div className="flex gap-2">
                <button onClick={() => setModalDisparoAberto(false)} disabled={enviandoLote} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">Fechar</button>
                <button onClick={executarDisparoEmLote} disabled={enviandoLote || selecionadosParaDisparo.length === 0 || !templateSelecionadoId} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50">
                  {enviandoLote ? "Processando..." : "Disparar E-mails"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}