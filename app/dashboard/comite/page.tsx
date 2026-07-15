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
    
    // Descobre o prefixo pela primeira URL de documento
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

        // 🛡️ Filtro de escopo comercial blindado (ilike)
        if (cargoUser === "comercial" && user.nome) {
          queryComite = queryComite.ilike("comercial", `%${user.nome}%`);
          queryEsteira = queryEsteira.ilike("comercial", `%${user.nome}%`);
        }
      }
      
      // Carrega pauta ativa do comitê
      const { data: dataComite } = await queryComite.eq("status", "aberta").order("criado_em", { ascending: false });
      if (dataComite) {
        
        // 🚀 Injeta as fotos únicas de nuvem dentro do objeto ANTES de renderizar o comitê!
        const analisesComImagensR2 = await Promise.all(dataComite.map(async (item) => {
           const urlsR2 = await vasculharImagensR2(item);
           return { ...item, todas_as_imagens_r2: urlsR2 };
        }));

        setAnalises(analisesComImagensR2);
        for (const item of analisesComImagensR2) {
          await carregarVotosIniciais(item.empresa_nome);
        }
      }

      // Carrega esteira operacional pendente 
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

      await supabase.from("votos").insert({ 
        empresa_nome: e, 
        membro_nome: autorDoVoto, 
        voto: opcaoVoto, 
        justificativa: justificativaVoto, 
        email_enviado: autorDoVoto === "Decisão"
      });
      
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
        cnpj: "00000000000000",
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

  // 🔥 A MÁGICA ACONTECE AQUI: Geramos o HTML pelo import e jogamos no state
  const activarModoLupaExecutiva = async (empresa: any) => {
    setCarregando(true);
    try {
      setEmpresaFocoAtivo(empresa);
      setIdEmpresaExpandida(empresa.id); 
      setModoFocoComite(true);
      
      // Usa a nova função importada do arquivo de gerar-analise!
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
      usuario: nomeUsuarioLogado || "Alyson (Web)", 
      mensagem: novaMsg.trim() 
    }).select();
    if (data) setChatMsgs([...chatMsgs, data[0]]);
    setNovaMsg("");
  };

  // 🔮 MODO COMITÊ TELA CHEIA ATIVO
  if (modoFocoComite && empresaFocoAtivo) {
    const listaDeVotos = votosAoVivo[empresaFocoAtivo.empresa_nome] || [];

    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px]">
        <div className="bg-slate-950 text-white p-3 px-6 flex justify-between items-center shadow-lg border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black tracking-tight text-blue-400">🏛️ COMITÊ EXECUTIVO DE CRÉDITO:</span>
            <h2 className="text-base font-black uppercase text-white tracking-wide">{empresaFocoAtivo.empresa_nome}</h2>
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded uppercase">{empresaFocoAtivo.status || "Em análise"}</span>
          </div>
          <div className="flex items-center gap-4">
            {isMaster && (
              <div className="flex gap-2 bg-slate-900/60 p-1 rounded-lg border border-slate-800 mr-2">
                <button onClick={() => forcarDecisaoMaster(empresaFocoAtivo, "Aprovado")} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded uppercase transition-all">✅ Aprovar</button>
                <button onClick={() => forcarDecisaoMaster(empresaFocoAtivo, "Reprovado")} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded uppercase transition-all">⛔ Reprovar</button>
              </div>
            )}
            <button onClick={desativarModoLupaExecutiva} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg shadow-sm transition-all cursor-pointer uppercase tracking-wider">
              ✕ Sair do Modo Comitê
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden w-full bg-slate-900">
          <div className="w-[70%] h-full p-4 border-r border-slate-800 flex flex-col">
            <div className="flex-1 bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-800 relative">
              {/* ALIMENTANDO O IFRAME COM O STATE GERADO PELA FUNÇÃO UNIVERSAL */}
              <iframe 
                srcDoc={htmlDossieRenderizado} 
                className="w-full h-full border-0 bg-white" 
                sandbox="allow-scripts allow-same-origin" 
              />
            </div>
          </div>

          <div className="w-[30%] h-full p-4 flex flex-col space-y-4 bg-slate-950/40">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3 shrink-0 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">🗳️ Painel de Voto</span>
                <span className="text-[11px] text-blue-400 font-bold bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50">👤 {votoComoDecisao ? "Decisão Final" : nomeUsuarioLogado}</span>
              </div>
              
              {(!isMaster && !isDiretor) ? (
                <div className="p-3 bg-red-950/30 text-red-400 font-bold text-xs rounded border border-red-900/50">
                  🔒 Seu perfil atual ({nomeUsuarioLogado}) está mapeado como consulta/operacional. Voto bloqueado.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <select value={opcaoVoto} onChange={(e) => setOpcaoVoto(e.target.value)} className="p-2 bg-slate-950 text-white border border-slate-800 rounded text-xs font-bold outline-none cursor-pointer">
                    <option value="">Selecione o seu Voto</option>
                    <option value="Aprovado">🟢 Aprovado</option>
                    <option value="Reprovado">🔴 Reprovado</option>
                  </select>

                  {isMaster && (
                    <label className="flex items-center gap-2 p-1 text-slate-300 font-bold text-xs bg-slate-950/50 rounded border border-slate-800/80 cursor-pointer hover:bg-slate-950 select-none">
                      <input type="checkbox" checked={votoComoDecisao} onChange={(e) => setVotoComoDecisao(e.target.checked)} className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-800" />
                      Assegurar este voto como a <span className="text-amber-400">Decisão Final</span>
                    </label>
                  )}

                  <textarea value={justificativaVoto} onChange={(e) => setJustificativaVoto(e.target.value)} placeholder="Justificativa ou parecer técnico do comitê..." className="w-full p-2 bg-slate-950 text-white border border-slate-800 rounded text-xs font-medium outline-none h-16 resize-none" />
                  <button onClick={() => processarVotoWeb(empresaFocoAtivo)} disabled={enviandoVoto} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg transition-all cursor-pointer shadow-md">
                    {enviandoVoto ? "Computando Parecer..." : "Confirmar e Lançar Voto"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex-1 flex flex-col overflow-hidden text-left">
              <span className="text-[11px] font-black text-slate-400 uppercase block tracking-wider mb-2">📋 Histórico de Pareceres</span>
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {listaDeVotos.length === 0 ? (
                  <p className="text-slate-500 italic text-xs py-8 text-center">Nenhum voto lançado em mesa.</p>
                ) : (
                  listaDeVotos.map((v: any, idx: number) => (
                    <div key={idx} className="p-2.5 border border-slate-800 rounded-lg bg-slate-950/60 flex flex-col gap-1 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-200">{v.membro_nome}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black ${v.voto === "Aprovado" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>{v.voto}</span>
                      </div>
                      <span className="text-slate-400 italic font-medium">"{v.justificativa}"</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex-1 flex flex-col overflow-hidden text-left">
              <span className="text-[11px] font-black text-slate-400 uppercase block tracking-wider mb-2">💬 Mesa de Debates</span>
              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg p-2 space-y-2 bg-slate-950/40">
                {chatMsgs.length === 0 ? (
                  <p className="text-center text-slate-600 py-10 text-xs italic">Nenhum comentário registrado.</p>
                ) : (
                  chatMsgs.map((m: any) => (
                    <div key={m.id} className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 text-xs">
                      <span className="font-bold text-blue-400">{m.usuario}</span>: <span className="text-slate-300 font-medium whitespace-pre-wrap break-words">{m.mensagem}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2 shrink-0">
                <input type="text" value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagemChat(empresaFocoAtivo.empresa_nome)} placeholder="Mensagem..." className="flex-1 p-2 bg-slate-950 text-white border border-slate-800 rounded-lg text-xs outline-none focus:border-blue-500 font-medium" />
                <button onClick={() => enviarMensagemChat(empresaFocoAtivo.empresa_nome)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 rounded-lg cursor-pointer transition-all">Mandar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🏛️ RENDERIZAÇÃO DA VISÃO PADRÃO
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 text-[13px]">
      {carregando && <div className="fixed inset-0 bg-white/40 z-50 flex items-center justify-center font-bold text-slate-500">Sincronizando esteira...</div>}
      
      <div className="space-y-2">
        <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">📋 Análises Em Comitê (Mesa V8)</h2>
          {isMaster && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded">⚡ Master Ativo</span>}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
                <th className="p-2.5">Empresa / Cedente</th>
                <th className="p-2.5">CNPJ</th>
                <th className="p-2.5 text-center">Entrada</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-center">Ações Gerais</th>
                {isMaster && <th className="p-2.5 text-center bg-slate-100 text-slate-800 border-l border-slate-200">⚡ AÇÃO MASTER</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {analises.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-bold text-slate-900 uppercase">{item.empresa_nome}</td>
                  <td className="p-2.5 font-mono text-slate-500">{item.cnpj}</td>
                  <td className="p-2.5 text-center text-slate-500 font-mono">{new Date(item.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase ${item.status === 'aprovado' ? 'bg-green-50 text-green-700 border border-green-200' : item.status === 'reprovado' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{item.status}</span>
                  </td>
                  <td className="p-2.5 text-center">
                    <button onClick={() => activarModoLupaExecutiva(item)} className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors uppercase tracking-wide">
                      🏛️ Entrar em Mesa
                    </button>
                  </td>
                  {isMaster && (
                    <td className="p-2.5 bg-slate-50 border-l border-slate-200 text-center space-x-2">
                      <button onClick={() => forcarDecisaoMaster(item, "Aprovado")} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded uppercase tracking-wider transition-all">✅ Aprovar</button>
                      <button onClick={() => forcarDecisaoMaster(item, "Reprovado")} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded uppercase tracking-wider transition-all">⛔ Reprovar</button>
                    </td>
                  )}
                </tr>
              ))}
              {analises.length === 0 && (
                <tr><td colSpan={isMaster ? 6 : 5} className="p-4 text-center text-slate-400 italic">Nenhuma análise em pauta na mesa com status "aberta".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">🔍 Esteira em Processamento Automático (IA / Docs)</h2>
          </div>
          <form onSubmit={handleCriarAnalise} className="flex gap-2 items-center">
            <input type="text" placeholder="Nome da Empresa..." value={nomeNovaEmpresa} onChange={(e) => setNomeNovaEmpresa(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] font-medium" />
            <button type="submit" className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer">➕ Nova Esteira</button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
                <th className="p-2.5">Empresa</th>
                <th className="p-2.5 font-center">CNPJ</th>
                <th className="p-2.5">Status Interno</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {empresasAnalise.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">Nenhuma esteira pendente de docs ou IA.</td></tr>
              ) : (
                empresasAnalise.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40">
                      <td className="p-2.5 font-bold text-blue-900 uppercase">{item.empresa_nome}</td>
                      <td className="p-2.5 font-mono text-slate-500">{item.cnpj}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-black text-[10px] uppercase tracking-wider animate-pulse">{item.status}</span>
                      </td>
                      <td className="p-2.5 text-center space-x-1.5">
                        <button onClick={() => handleDeletarAnalise(item.id)} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded text-xs cursor-pointer hover:bg-rose-100">✕ Remover</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}