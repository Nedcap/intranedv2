/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { gerarHtmlDossie } from "@/components/gerar-analise";

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ComitePage() {
  const [analises, setAnalises] = useState<any[]>([]);
  const [empresasAnalise, setEmpresasAnalise] = useState<any[]>([]); 
  const [carregando, setCarregando] = useState(true);
  
  // 🎛️ CONTROLES DE FOCO E EXPANSÃO INTEGRADA
  const [idEmpresaExpandida, setIdEmpresaExpandida] = useState<string | null>(null);
  const [modoFocoComite, setModoFocoComite] = useState(false);
  const [empresaFocoAtivo, setEmpresaFocoAtivo] = useState<any>(null);
  const [htmlDossieRenderizado, setHtmlDossieRenderizado] = useState<string>("");

  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [diretoresBanco, setDiretoresBanco] = useState<string[]>([]);

  // Perfis de voto
  const [opcaoVoto, setOpcaoVoto] = useState("");
  const [justificativaVoto, setJustificativaVoto] = useState("");
  const [votoComoDecisao, setVotoComoDecisao] = useState(false); 
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = useState("");

  const [isMaster, setIsMaster] = useState(false);
  const [isDiretor, setIsDiretor] = useState(false); 
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("");

  const carregarDiretores = async () => {
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("nome")
        .ilike("cargo", "Diretor");
      if (data) setDiretoresBanco(data.map(u => u.nome));
    } catch (err) {
      console.error("Erro ao buscar diretores:", err);
    }
  };

  const carregarVotosIniciais = useCallback(async (empresaNome: string) => {
    if (!empresaNome) return;
    const { data } = await supabase.from("votos").select("*").eq("empresa_nome", empresaNome);
    if (data) {
      setVotosAoVivo(prev => ({ ...prev, [empresaNome]: data }));
    }
  }, []);

  // 🔥 VASCULHADOR R2 PARA O COMITÊ (Roda transparente no fundo)
  const vasculharImagensR2 = async (analiseItem: any) => {
    let prefixoPasta = `clientes/${analiseItem.id}/`; 
    
    if (analiseItem.dados_documentos && analiseItem.dados_documentos.length > 0) {
      try {
        const urlBase = new URL(analiseItem.dados_documentos[0]);
        const parts = urlBase.pathname.split('/'); 
        const idxClientes = parts.indexOf('clientes');
        if (idxClientes !== -1 && parts.length > idxClientes + 1) {
          prefixoPasta = `${parts[idxClientes]}/${parts[idxClientes + 1]}/`;
        }
      } catch(e) { /* ignora */ }
    }

    try {
      const res = await fetch('/api/listar-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: prefixoPasta })
      });
      if (res.ok) {
        const data = await res.json();
        const regexImagem = /\.(jpeg|jpg|gif|png|webp)/i;
        if (data.urls) {
          return data.urls.filter((url: string) => regexImagem.test(url));
        }
      }
    } catch (e) {
       console.error("Erro vasculhador R2", e);
    }
    return [];
  };

  const carregarComite = async () => {
    try {
      setCarregando(true);
      const userStr = localStorage.getItem("intraned_user");
      
      let queryComite = supabase.from("analises").select("*");
      let queryEsteira = supabase.from("analises").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

        if (cargoUser === "comercial" && user.nome) {
          queryComite = queryComite.ilike("comercial", `%${user.nome}%`);
          queryEsteira = queryEsteira.ilike("comercial", `%${user.nome}%`);
        }
      }
      
      const { data: dataComite } = await queryComite.eq("status", "aberta").order("criado_em", { ascending: false });
      if (dataComite) {
        const analisesComImagensR2 = await Promise.all(dataComite.map(async (item) => {
           const urlsR2 = await vasculharImagensR2(item);
           return { ...item, todas_as_imagens_r2: urlsR2 };
        }));

        setAnalises(analisesComImagensR2);
        for (const item of analisesComImagensR2) {
          await carregarVotosIniciais(item.empresa_nome);
        }
      }

      const { data: dataAnalise } = await queryEsteira.in("status", ["em_processamento_ia", "aguardando_docs"]).order("criado_em", { ascending: false });
      if (dataAnalise) setEmpresasAnalise(dataAnalise);

    } catch (err) {
      console.error("Erro ao carregar dados do comitê:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDiretores();
    carregarComite(); 

    try {
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setNomeUsuarioLogado(parsed.nome || "Membro Ned");
        
        const cargoLimpo = String(parsed.cargo || parsed.perfil || "").toLowerCase().trim();
        if (cargoLimpo === "master") setIsMaster(true);
        if (cargoLimpo === "diretor") setIsDiretor(true);
      }
    } catch (e) { console.error(e); }

    const canalVotos = supabase
      .channel("votos-live-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, (payload: any) => {
        const nomeEmp = payload.new?.empresa_nome || payload.old?.empresa_nome;
        if (nomeEmp) carregarVotosIniciais(nomeEmp);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalVotos);
    };
  }, [carregarVotosIniciais]);

  useEffect(() => {
    if (!idEmpresaExpandida) return;
    const empresaAlvo = analises.find(a => a.id === idEmpresaExpandida);
    if (!empresaAlvo) return;

    const canalChat = supabase
      .channel(`chat-live-${idEmpresaExpandida}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_comite", filter: `empresa_nome=eq.${empresaAlvo.empresa_nome}` }, (payload) => {
        setChatMsgs(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalChat);
    };
  }, [idEmpresaExpandida, analises]);

  const obter_emails_notificacao = async (empresaNome: string) => {
    const emails = new Set<string>();
    try {
      const { data: masters } = await supabase.from("usuarios").select("email").eq("cargo", "Master");
      masters?.forEach(m => m.email && emails.add(m.email));
    } catch {
      emails.add("diego@nedcapital.com.br");
    }
    return Array.from(emails).sort();
  };

  const dispararEmailResend = async (subject: string, html: string, listaEmails: string[]) => {
    if (!listaEmails.length) return;
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          from: "Sistema Ned <sistema@nedcapital.com.br>", 
          to: [listaEmails[0]], 
          cc: listaEmails.slice(1), 
          subject, 
          html 
        }),
      });
    } catch (err) { console.error("Erro na API de e-mail Resend:", err); }
  };

  const forcarDecisaoMaster = async (empresaItem: any, decisaoFinal: "Aprovado" | "Reprovado") => {
    const conf = confirm(`⚠️ DECISÃO EXECUTIVA: Deseja mover a empresa ${empresaItem.empresa_nome} para ${decisaoFinal}?`);
    if (!conf) return;

    try {
      setCarregando(true);
      const e = empresaItem.empresa_nome;

      const dcAtual = empresaItem.dados_consolidados || {};
      dcAtual.parecer_comite = `Decisão Executiva Master: Processo encerrado diretamente como [${decisaoFinal.toUpperCase()}] em ${new Date().toLocaleDateString('pt-BR')}.`;

      const { error } = await supabase
        .from("analises")
        .update({ 
          status: decisaoFinal.toLowerCase(),
          dados_consolidados: dcAtual 
        })
        .eq("id", empresaItem.id);

      if (error) throw error;

      const emailsAlvo = await obter_emails_notificacao(e);
      const htmlAta = `<html><body><h2>Ata de Comitê Encerrada: ${e}</h2><p>Veredito Final: <b>${decisaoFinal}</b></p></body></html>`;
      await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);

      alert(`✅ Orquestração concluída! Empresa movida para ${decisaoFinal}.`);
      if (modoFocoComite) desativarModoLupaExecutiva();
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro no painel Master: ${err.message}`);
    } finally { 
      setCarregando(false);
    }
  };

  const processarVotoWeb = async (empresaItem: any) => {
    if (!isMaster && !isDiretor) {
      alert("🚫 ACESSO NEGADO: Registro restrito a Diretores.");
      return;
    }
    if (!opcaoVoto || !justificativaVoto) {
      alert("Por favor, selecione o seu voto e preencha o parecer/justificativa.");
      return;
    }
    try {
      setEnviandoVoto(true);
      const e = empresaItem.empresa_nome;
      const autorDoVoto = (isMaster && votoComoDecisao) ? "Decisão" : nomeUsuarioLogado;

      await supabase.from("votos").upsert({ 
        empresa_nome: e, 
        membro_nome: autorDoVoto, 
        voto: opcaoVoto, 
        justificativa: justificativaVoto, 
        email_enviado: autorDoVoto === "Decisão"
      }, { onConflict: 'membro_nome,empresa_nome' });
      
      const { data: listaVotos } = await supabase.from("votos").select("*").eq("empresa_nome", e);
      const totalSim = listaVotos?.filter(v => v.voto === "Aprovado").length || 0;
      const totalNao = listaVotos?.filter(v => v.voto === "Reprovado").length || 0;
      
      const dcAtual = empresaItem.dados_consolidados || {};
      dcAtual.parecer_comite = `Placar do Comitê: ${totalSim} SIM / ${totalNao} NÃO. Detalhamento de Pareceres: ` + 
        listaVotos?.map(v => `[${v.membro_nome}: ${v.voto} - Parecer: ${v.justificativa}]`).join(" | ");

      let statusDestino = empresaItem.status;
      if (autorDoVoto === "Decisão") {
        statusDestino = opcaoVoto.toLowerCase();
      }

      const { error } = await supabase
        .from("analises")
        .update({ 
          dados_consolidados: dcAtual,
          status: statusDestino
        })
        .eq("id", empresaItem.id);

      if (error) throw error;
      
      if (autorDoVoto === "Decisão") {
        const emailsAlvo = await obter_emails_notificacao(e);
        const htmlAta = `<html><body><h2>Ata de Comitê Finalizada: ${e}</h2><p>Status Final: <b>${opcaoVoto}</b></p></body></html>`;
        await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);
        if (modoFocoComite) desativarModoLupaExecutiva();
      }
      
      alert(autorDoVoto === "Decisão" ? "🏁 Comitê encerrado e Ata salva!" : "🗳️ Seu voto foi computado e injetado no dossiê!");
      setJustificativaVoto(""); 
      setVotoComoDecisao(false);
      await carregarVotosIniciais(e);
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro ao computar voto: ${err.message}`);
    } finally { 
      setEnviandoVoto(false); 
    }
  };

  const handleCriarAnalise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaEmpresa.trim()) return;
    
    try {
      setCarregando(true);
      const { error } = await supabase.from("analises").insert({
        empresa_nome: nomeNovaEmpresa.trim().toUpperCase(),
        caminho_local: "INCLUSAO_MANUAL", 
        cnpj: `MANUAL-${Date.now()}`,
        status: "aguardando_docs"
      });
      if (error) throw error;
      setNomeNovaEmpresa("");
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleDeletarAnalise = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta empresa?")) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("analises").delete().eq("id", id);
      if (error) throw error;
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro: ${err.message}`);
    } finally { setCarregando(false); }
  };

  const handleForcarDecisaoPrompt = (item: any) => {
    const res = prompt(`Forçar Decisão Executiva para ${item.empresa_nome}\n\nDigite "Aprovar" ou "Reprovar":`);
    if (!res) return;
    const cleanRes = res.trim().toLowerCase();
    if (cleanRes === "aprovar" || cleanRes === "aprovado") {
      forcarDecisaoMaster(item, "Aprovado");
    } else if (cleanRes === "reprovar" || cleanRes === "reprovado") {
      forcarDecisaoMaster(item, "Reprovado");
    } else {
      alert("Comando inválido. Operação cancelada.");
    }
  };

  const activarModoLupaExecutiva = async (empresa: any) => {
    setCarregando(true);
    try {
      setEmpresaFocoAtivo(empresa);
      setIdEmpresaExpandida(empresa.id); 
      setModoFocoComite(true);
      
      const htmlMontado = await gerarHtmlDossie(empresa);
      setHtmlDossieRenderizado(htmlMontado);
      
      const { data } = await supabase
        .from("chat_comite")
        .select("*")
        .eq("empresa_nome", empresa.empresa_nome)
        .order("id", { ascending: true });
      if (data) setChatMsgs(data);
    } catch (err) {
      console.error("Erro ao carregar chat ou HTML:", err);
    } finally {
      setCarregando(false);
    }
  };

  const desativarModoLupaExecutiva = () => {
    setModoFocoComite(false);
    setEmpresaFocoAtivo(null);
    setIdEmpresaExpandida(null); 
    setHtmlDossieRenderizado("");
    setChatMsgs([]);
  };

  const enviarMensagemChat = async (empresaNome: string) => {
    if (!novaMsg.trim()) return;
    const { data } = await supabase.from("chat_comite").insert({ 
      empresa_nome: empresaNome, 
      usuario: nomeUsuarioLogado || "Membro (Web)", 
      mensagem: novaMsg.trim() 
    }).select();
    if (data) setChatMsgs([...chatMsgs, data[0]]);
    setNovaMsg("");
  };

  // 🔮 MODO COMITÊ TELA CHEIA ATIVO (VISUAL LIGHT & CLEAN)
  if (modoFocoComite && empresaFocoAtivo) {
    const listaDeVotos = votosAoVivo[empresaFocoAtivo.empresa_nome] || [];

    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px]">
        {/* CABEÇALHO DO COMITÊ (CLARO) */}
        <div className="bg-white text-slate-800 p-3 px-6 flex justify-between items-center shadow-sm border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black tracking-tight text-blue-600">🏛️ COMITÊ DE CRÉDITO</span>
            <span className="text-slate-300">|</span>
            <h2 className="text-base font-black uppercase tracking-wide">{empresaFocoAtivo.empresa_nome}</h2>
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-full uppercase ml-2">{empresaFocoAtivo.status || "Em análise"}</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={desativarModoLupaExecutiva} className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-md shadow-sm transition-all cursor-pointer uppercase tracking-wide">
              ✕ Sair da Mesa
            </button>
          </div>
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden w-full bg-slate-50">
          
          {/* DOSSIÊ HTML (ESQUERDA) */}
          <div className="w-[70%] h-full p-4 flex flex-col">
            <div className="flex-1 bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 relative">
              <iframe 
                srcDoc={htmlDossieRenderizado} 
                className="w-full h-full border-0 bg-white" 
                sandbox="allow-scripts allow-same-origin" 
              />
            </div>
          </div>

          {/* PAINEL DE CONTROLE (DIREITA) */}
          <div className="w-[30%] h-full p-4 pl-0 flex flex-col space-y-4">
            
            {/* PAINEL DE VOTAÇÃO */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3 shrink-0 text-left">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-[12px] font-black text-slate-600 uppercase tracking-wider">🗳️ Painel de Voto</span>
                <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  👤 {votoComoDecisao ? "Decisão Final" : nomeUsuarioLogado}
                </span>
              </div>
              
              {(!isMaster && !isDiretor) ? (
                <div className="p-3 bg-slate-50 text-slate-500 font-bold text-xs rounded-lg border border-slate-200 text-center">
                  🔒 Seu perfil ({nomeUsuarioLogado}) é operacional. Voto desabilitado.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  <select value={opcaoVoto} onChange={(e) => setOpcaoVoto(e.target.value)} className="w-full p-2.5 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 transition-all">
                    <option value="">Selecione o seu Veredito...</option>
                    <option value="Aprovado">🟢 Aprovado</option>
                    <option value="Reprovado">🔴 Reprovado</option>
                  </select>

                  {isMaster && (
                    <label className="flex items-center gap-2 p-2.5 text-slate-700 font-bold text-xs bg-amber-50 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors select-none shadow-sm">
                      <input type="checkbox" checked={votoComoDecisao} onChange={(e) => setVotoComoDecisao(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer" />
                      Assegurar como <span className="text-amber-700 uppercase tracking-wide">Decisão Final (Master)</span>
                    </label>
                  )}

                  <textarea value={justificativaVoto} onChange={(e) => setJustificativaVoto(e.target.value)} placeholder="Escreva sua justificativa técnica ou ressalvas..." className="w-full p-2.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 h-16 resize-none transition-all" />
                  
                  <button onClick={() => processarVotoWeb(empresaFocoAtivo)} disabled={enviandoVoto} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer shadow-md uppercase tracking-wide">
                    {enviandoVoto ? "Computando..." : "Confirmar Voto"}
                  </button>
                </div>
              )}
            </div>

            {/* HISTÓRICO DE PARECERES */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden text-left">
              <span className="text-[12px] font-black text-slate-600 uppercase block tracking-wider mb-3 border-b border-slate-100 pb-2">📋 Pareceres Registrados</span>
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {listaDeVotos.length === 0 ? (
                  <p className="text-slate-400 italic text-xs py-8 text-center">A mesa ainda não possui votos computados.</p>
                ) : (
                  listaDeVotos.map((v: any, idx: number) => (
                    <div key={idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex flex-col gap-1.5 text-xs shadow-sm">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-800">{v.membro_nome}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-black tracking-wide ${v.voto === "Aprovado" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"}`}>{v.voto}</span>
                      </div>
                      <span className="text-slate-600 font-medium leading-relaxed">"{v.justificativa}"</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CHAT / MESA DE DEBATES */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden text-left">
              <span className="text-[12px] font-black text-slate-600 uppercase block tracking-wider mb-3 border-b border-slate-100 pb-2">💬 Mesa de Debates (Ao Vivo)</span>
              <div className="flex-1 overflow-y-auto rounded-lg p-1 space-y-2.5 custom-scrollbar">
                {chatMsgs.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-xs italic">Nenhum comentário registrado no chat.</p>
                ) : (
                  chatMsgs.map((m: any) => {
                    const ehMeu = m.usuario === nomeUsuarioLogado;
                    return (
                      <div key={m.id} className={`flex flex-col text-xs ${ehMeu ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] font-bold text-slate-400 mb-0.5 px-1">{m.usuario}</span>
                        <div className={`p-2.5 rounded-xl max-w-[90%] shadow-sm ${ehMeu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-bl-none'}`}>
                          <span className="font-medium whitespace-pre-wrap break-words">{m.mensagem}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex gap-2 mt-3 shrink-0 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <input type="text" value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagemChat(empresaFocoAtivo.empresa_nome)} placeholder="Digite sua mensagem..." className="flex-1 p-2 bg-transparent text-slate-800 text-xs outline-none font-medium placeholder-slate-400" />
                <button onClick={() => enviarMensagemChat(empresaFocoAtivo.empresa_nome)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 rounded-md cursor-pointer transition-all shadow-sm">Enviar</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // 🏛️ RENDERIZAÇÃO DA VISÃO PADRÃO (CAPA)
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 text-[13px]">
      {carregando && <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center font-bold text-slate-600 text-lg tracking-wide">Sincronizando esteira...</div>}
      
      <div className="space-y-3">
        <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            📋 Análises Em Comitê <span className="text-sm font-semibold text-slate-400 font-normal">(Mesa V8)</span>
          </h2>
          {isMaster && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md">⚡ Perfil Master</span>}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
                <th className="p-3.5 pl-4">Empresa / Cedente</th>
                <th className="p-3.5">CNPJ</th>
                <th className="p-3.5 text-center">Data Entrada</th>
                <th className="p-3.5 text-center">Status Atual</th>
                <th className="p-3.5 text-center">Ações</th>
                {isMaster && <th className="p-3.5 text-center text-amber-700 bg-amber-50/50 border-l border-slate-200">Ação Executiva</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {analises.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5 pl-4 font-bold text-slate-900 uppercase">{item.empresa_nome}</td>
                  <td className="p-3.5 font-mono text-slate-500 text-xs">{item.cnpj}</td>
                  <td className="p-3.5 text-center text-slate-500 font-mono text-xs">{new Date(item.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider ${item.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : item.status === 'reprovado' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{item.status}</span>
                  </td>
                  <td className="p-3.5 text-center">
                    <button onClick={() => activarModoLupaExecutiva(item)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition-colors uppercase tracking-wide">
                      🏛️ Entrar na Mesa
                    </button>
                  </td>
                  {isMaster && (
                    <td className="p-3.5 bg-amber-50/20 border-l border-slate-200 text-center">
                      <button onClick={() => handleForcarDecisaoPrompt(item)} className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 font-bold text-xs rounded-lg uppercase tracking-wide transition-all shadow-sm">
                        ⚡ Forçar Veredito
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {analises.length === 0 && (
                <tr><td colSpan={isMaster ? 6 : 5} className="p-8 text-center text-slate-400 italic">Nenhuma análise aguardando comitê no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 pt-6">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            ⚙️ Esteira de Processamento <span className="text-sm font-semibold text-slate-400 font-normal">(IA / Docs Pendentes)</span>
          </h2>
          <form onSubmit={handleCriarAnalise} className="flex gap-2 items-center">
            <input type="text" placeholder="Nome da Empresa..." value={nomeNovaEmpresa} onChange={(e) => setNomeNovaEmpresa(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-[240px] font-medium" />
            <button type="submit" className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap">➕ Nova Esteira</button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
                <th className="p-3.5 pl-4">Empresa</th>
                <th className="p-3.5 font-center">CNPJ</th>
                <th className="p-3.5">Status Interno</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {empresasAnalise.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhuma esteira pendente de docs ou processamento IA.</td></tr>
              ) : (
                empresasAnalise.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 pl-4 font-bold text-slate-900 uppercase">{item.empresa_nome}</td>
                    <td className="p-3.5 font-mono text-slate-500 text-xs">{item.cnpj}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-bold text-[10px] uppercase tracking-wider animate-pulse">{item.status}</span>
                    </td>
                    <td className="p-3.5 text-center space-x-1.5">
                      <button onClick={() => handleDeletarAnalise(item.id)} className="px-3 py-1 bg-white text-rose-600 border border-rose-200 font-bold rounded-md text-xs cursor-pointer hover:bg-rose-50 shadow-sm transition-all">✕ Remover</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}