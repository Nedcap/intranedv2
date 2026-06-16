/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function ComitePage() {
  const [analises, setAnalises] = useState<any[]>([]);
  const [empresasAnalise, setEmpresasAnalise] = useState<any[]>([]); 
  const [carregando, setCarregando] = useState(true);
  
  // 🎛️ CONTROLES DE FOCO E EXPANSÃO INTEGRADA
  const [idEmpresaExpandida, setEditandoEmpresaExpandida] = useState<string | null>(null);
  const [modoFocoComite, setModoFocoComite] = useState(false);
  const [empresaFocoAtivo, setEmpresaFocoAtivo] = useState<any>(null);

  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [diretoresBanco, setDiretoresBanco] = useState<string[]>([]);

  // Perfis de voto controlados pelo perfil logado
  const [opcaoVoto, setOpcaoVoto] = useState("");
  const [justificativaVoto, setJustificativaVoto] = useState("");
  const [votoComoDecisao, setVotoComoDecisao] = useState(false); 
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  
  const [htmlPreviewsInline, setHtmlPreviewsInline] = useState<Record<string, string>>({});
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pendenciaTexto, setPendenciaTexto] = useState("");
  const [novaDataEnvio, setNovaDataEnvio] = useState("");

  const [isMaster, setIsMaster] = useState(false);
  const [isDiretor, setIsDiretor] = useState(false); // 🎯 Novo Estado: Controle de interface para diretores
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

  const carregarComite = async () => {
    try {
      setCarregando(true);
      const userStr = localStorage.getItem("intraned_user");
      let queryComite = supabase.from("analises").select("*");
      let queryEsteira = supabase.from("em_analise").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
        if (cargoUser === "comercial") {
          queryComite = queryComite.eq("comercial", user.nome);
          queryEsteira = queryEsteira.eq("agente_nome", user.nome);
        }
      }
      
      const { data: dataComite } = await queryComite.order("criado_em", { ascending: false });
      if (dataComite) {
        const filtradas = dataComite.filter(a => {
          const st = (a.status || "").toLowerCase();
          return st.includes("comit") || st.includes("aberto") || st === "em análise" || st === "";
        });
        setAnalises(filtradas);

        for (const item of filtradas) {
          await carregarVotosIniciais(item.empresa_nome);
          if (item.caminho_local) baixarHtmlInline(item.id, item.caminho_local);
        }
      }

      const { data: dataAnalise } = await queryEsteira.order("data_envio", { ascending: false });
      if (dataAnalise) setEmpresasAnalise(dataAnalise);

    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setCarregando(false);
    }
  };

  const baixarHtmlInline = async (id: string, caminho: string) => {
    const urlLimpa = caminho.trim();
    if (urlLimpa.startsWith("http")) { 
      try {
        const res = await fetch(urlLimpa);
        const text = await res.text();
        setHtmlPreviewsInline(prev => ({ ...prev, [id]: text }));
      } catch { /* fallback */ }
      return;
    }
    const partes = urlLimpa.split(/[\\/]/);
    const nomeArquivo = partes[partes.length - 1].trim();
    try {
      const { data } = await supabase.storage.from("analises").download(nomeArquivo);
      if (data) {
        const text = await data.text();
        setHtmlPreviewsInline(prev => ({ ...prev, [id]: text }));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    carregarDiretores();
    carregarComite(); 

    try {
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setNomeUsuarioLogado(parsed.nome || "Membro Ned");
        
        const cargoLimpo = String(parsed.perfil || parsed.cargo || "").toLowerCase().trim();
        
        if (cargoLimpo === "master") {
          setIsMaster(true);
        }
        if (cargoLimpo === "diretor") {
          setIsDiretor(true);
        }
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
      const { data: analise } = await supabase.from("analises").select("comercial").eq("empresa_nome", empresaNome).limit(1).maybeSingle();
      if (analise?.comercial) {
        const { data: com } = await supabase.from("usuarios").select("email").eq("nome", analise.comercial).limit(1).maybeSingle();
        if (com?.email) emails.add(com.email);
      }
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
    } catch (err) { console.error("Erro na API de e-mail:", err); }
  };

  const forcarDecisaoMaster = async (empresaItem: any, decisaoFinal: "Aprovado" | "Reprovado") => {
    const conf = confirm(`⚠️ DECISÃO EXECUTIVA: Deseja mover a empresa ${empresaItem.empresa_nome} para ${decisaoFinal}?`);
    if (!conf) return;

    try {
      setCarregando(true);
      const e = empresaItem.empresa_nome;

      const { error } = await supabase.from("analises").update({ status: decisaoFinal }).eq("id", empresaItem.id);
      if (error) throw error;

      const emailsAlvo = await obtener_emails_notificacao(e);
      const corner = decisaoFinal === "Aprovado" ? "#059669" : "#ef4444";
      
      const { data: todosVotos } = await supabase.from("votos").select("*").eq("empresa_nome", e);
      let linesAta = (todosVotos || []).map(v => `<tr><td style='border:1px solid #ddd;padding:8px;'><b>${v.membro_nome}</b></td><td style='border:1px solid #ddd;padding:8px;'>${v.voto}</td><td style='border:1px solid #ddd;padding:8px;'>${v.justificativa}</td></tr>`).join("");
      
      if (!linesAta) linesAta = `<tr><td colspan="3" style='border:1px solid #ddd;padding:8px;text-align:center;'>Decisão executiva direta. Nenhum voto prévio registrado.</td></tr>`;

      const htmlAta = `<html><body><h2>Ata de Comitê Finalizada: ${e}</h2><p>Status Final: <b style='color:${corner}'>${decisaoFinal}</b></p><table style='width:100%;border-collapse:collapse;'><thead><tr style='background:#f4f4f4;'><th style='padding:8px;border:1px solid #ddd;'>Membro</th><th style='padding:8px;border:1px solid #ddd;'>Voto</th><th style='padding:8px;border:1px solid #ddd;'>Parecer</th></tr></thead><tbody>${linesAta}</tbody></table></body></html>`;

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
    // 🎯 TRAVA REAL DE ESCOPO COMERCIAL / OPERACIONAL: Se o usuário logado não for Master e não for Diretor, aborta imediatamente
    if (!isMaster && !isDiretor) {
      alert("🚫 ACESSO NEGADO: Apenas usuários com perfil ou cargo de 'Diretor' ou 'Master' podem assinar pareceres e registrar votos no comitê de crédito.");
      return;
    }

    if (!opcaoVoto || !justificativaVoto) {
      alert("Por favor, selecione o seu voto e preencha o parecer/justificativa.");
      return;
    }
    try {
      setEnviandoVoto(true);
      const e = empresaItem.empresa_nome;
      
      // Define a assinatura do voto baseado no login ou checkbox Master
      const autorDoVoto = (isMaster && votoComoDecisao) ? "Decisão" : nomeUsuarioLogado;

      await supabase.from("votos").insert({ 
        empresa_nome: e, 
        membro_nome: autorDoVoto, 
        voto: opcaoVoto, 
        justificativa: justificativaVoto, 
        email_enviado: autorDoVoto === "Decisão"
      });
      
      if (autorDoVoto === "Decisão") {
        const { error } = await supabase.from("analises").update({ status: opcaoVoto }).eq("id", empresaItem.id);
        if (error) throw error;
        
        const emailsAlvo = await obtener_emails_notificacao(e);
        const { data: todosVotos } = await supabase.from("votos").select("*").eq("empresa_nome", e);
        const corAta = opcaoVoto === "Aprovado" ? "#059669" : "#ef4444";
        const linesAta = (todosVotos || []).map(v => `<tr><td style='border:1px solid #ddd;padding:8px;'><b>${v.membro_nome}</b></td><td style='border:1px solid #ddd;padding:8px;'>${v.voto}</td><td style='border:1px solid #ddd;padding:8px;'>${v.justificativa}</td></tr>`).join("");
        const htmlAta = `<html><body><h2>Ata de Comitê Finalizada: ${e}</h2><p>Status Final: <b style='color:${corAta}'>${opcaoVoto}</b></p><table style='width:100%;border-collapse:collapse;'><thead><tr style='background:#f4f4f4;'><th style='padding:8px;border:1px solid #ddd;'>Membro</th><th style='padding:8px;border:1px solid #ddd;'>Voto</th><th style='padding:8px;border:1px solid #ddd;'>Parecer</th></tr></thead><tbody>${linesAta}</tbody></table></body></html>`;
        
        await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);
        if (modoFocoComite) desativarModoLupaExecutiva();
      }
      
      alert(autorDoVoto === "Decisão" ? "🏁 Comitê encerrado e Ata enviada!" : "🗳️ Seu voto foi computado com sucesso!");
      setJustificativaVoto(""); 
      setVotoComoDecisao(false);
      await carregarVotosIniciais(e);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      const nomeDoAgente = user?.user_metadata?.nome || user?.email || nomeUsuarioLogado || "Comercial Ned";
      const dataFormatada = new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("em_analise").insert({
        agente_comercial_id: user?.id || null,
        agente_nome: nomeDoAgente,
        nome_empresa: nomeNovaEmpresa.trim().toUpperCase(),
        data_envio: dataFormatada
      });

      if (error) throw error;
      setNomeNovaEmpresa("");
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro inesperado: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarEdicao = async (item: any) => {
    try {
      setCarregando(true);
      let dataBanco: string | null = item.nova_data_envio;
      if (novaDataEnvio) {
        const partes = novaDataEnvio.split("/");
        if (partes.length === 3) dataBanco = `${partes[2]}-${partes[1]}-${partes[0]}`;
      }

      const { error } = await supabase.from("em_analise").update({
        pendencias: pendenciaTexto,
        nova_data_envio: dataBanco
      }).eq("id", item.id);

      if (error) throw error;
      setEditandoId(null); setPendenciaTexto(""); setNovaDataEnvio("");
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro ao atualizar: ${err.message}`);
    } finally { setCarregando(false); }
  };

  const handleDeletarAnalise = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta empresa?")) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("em_analise").delete().eq("id", id);
      if (error) throw error;
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro ao deletar: ${err.message}`);
    } finally { setCarregando(false); }
  };

  const ativarModoLupaExecutiva = async (empresa: any) => {
    setEmpresaFocoAtivo(empresa);
    setEditandoEmpresaExpandida(empresa.id);
    setModoFocoComite(true);
    
    const { data } = await supabase.from("chat_comite").select("*").eq("empresa_nome", empresa.empresa_nome).order("id", { ascending: true });
    if (data) setChatMsgs(data);
  };

  const desativarModoLupaExecutiva = () => {
    setModoFocoComite(false);
    setEmpresaFocoAtivo(null);
    setEditandoEmpresaExpandida(null);
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
    const htmlPreview = htmlPreviewsInline[empresaFocoAtivo.id];

    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px]">
        {/* Cabeçalho de Comando Superior */}
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

        {/* Corpo Split Layout */}
        <div className="flex-1 flex overflow-hidden w-full bg-slate-900">
          
          {/* LADO ESQUERDO: RELATÓRIO DO SLIDE COMPLETO */}
          <div className="w-[70%] h-full p-4 border-r border-slate-800 flex flex-col">
            <div className="flex-1 bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-800">
              {htmlPreview ? (
                <iframe srcDoc={htmlPreview} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 italic text-sm gap-2">
                  <span className="animate-spin text-xl">⏳</span>
                  Carregando relatório técnico na memória...
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: DASHBOARD DECISÓRIO */}
          <div className="w-[30%] h-full p-4 flex flex-col space-y-4 bg-slate-950/40">
            
            {/* Bloco Voto Autenticado e Travado */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3 shrink-0 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">🗳️ Painel de Voto</span>
                <span className="text-[11px] text-blue-400 font-bold bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50">
                  👤 {votoComoDecisao ? "Decisão Final" : nomeUsuarioLogado}
                </span>
              </div>
              
              {/* Oculta as opções de voto para quem não tem escopo comercial de comitê */}
              {(!isMaster && !isDiretor) ? (
                <div className="p-3 bg-red-950/30 text-red-400 font-bold text-xs rounded border border-red-900/50 leading-relaxed">
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

            {/* Bloco Histórico de Votos */}
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

            {/* Bloco Chat Mesa de Debates */}
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

  // 🏛️ RENDEREIZAÇÃO DA VISÃO PADRÃO (PAINEL GERAL DO INTRANED)
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 text-[13px]">
      {carregando && <div className="fixed inset-0 bg-white/40 z-50 flex items-center justify-center font-bold text-slate-500">Sincronizando esteira...</div>}
      
      {/* SEÇÃO 1: PAUTA DO COMITÊ */}
      <div className="space-y-2">
        <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">📋 Análises Em Comitê</h2>
          {isMaster && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded">⚡ Master Ativo</span>}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
                <th className="p-2.5">Empresa / Cedente</th>
                <th className="p-2.5">Assessor</th>
                <th className="p-2.5 text-center">Recebimento</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-center">Ações Gerais</th>
                {isMaster && <th className="p-2.5 text-center bg-slate-100 text-slate-800 border-l border-slate-200">⚡ AÇÃO MASTER</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {analises.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-bold text-slate-900">{item.empresa_nome}</td>
                  <td className="p-2.5 text-slate-500">{item.comercial || "-"}</td>
                  <td className="p-2.5 text-center text-slate-500">{item.data_recebimento ? new Date(item.data_recebimento.split("T")[0]+"T12:00:00").toLocaleDateString("pt-BR") : "-"}</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-md uppercase">{item.status || "Em análise"}</span>
                  </td>
                  <td className="p-2.5 text-center">
                    <button onClick={() => ativarModoLupaExecutiva(item)} className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors">
                      🏛️ Entrar em Modo Comitê
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
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 2: ESTEIRA DE ENTRADA */}
      <div className="space-y-3 pt-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">🔍 Esteira de Entrada (Em Análise)</h2>
            <p className="text-xs text-slate-400 font-medium">Controle de entrada do time comercial e acompanhamento de pendências cadastrais.</p>
          </div>
          <form onSubmit={handleCriarAnalise} className="flex gap-2 items-center">
            <input type="text" placeholder="Nome do Lead / Empresa..." value={nomeNovaEmpresa} onChange={(e) => setNomeNovaEmpresa(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] font-medium" />
            <button type="submit" className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer">➕ Solicitar Análise</button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
                <th className="p-2.5">Agente Comercial</th>
                <th className="p-2.5">Empresa</th>
                <th className="p-2.5 text-center">Data Envio</th>
                <th className="p-2.5">Pendências Identificadas</th>
                <th className="p-2.5 text-center">Retorno Pendência</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {empresasAnalise.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400 italic">Nenhum lead em análise na esteira.</td></tr>
              ) : (
                empresasAnalise.map((item) => {
                  const estaEditando = editandoId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40">
                      <td className="p-2.5 text-slate-500">{item.agente_nome}</td>
                      <td className="p-2.5 font-bold text-blue-900">{item.nome_empresa}</td>
                      <td className="p-2.5 text-center text-slate-500">{item.data_envio ? new Date(item.data_envio.split("T")[0]+"T12:00:00").toLocaleDateString("pt-BR") : "-"}</td>
                      <td className="p-2.5 max-w-[320px]">
                        {estaEditando ? (
                          <input type="text" value={pendenciaTexto} onChange={(e) => setPendenciaTexto(e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-medium" />
                        ) : (
                          <span className={item.pendencias ? "text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs block font-semibold" : "text-slate-400 italic font-normal"}>{item.pendencias || "Sem pendências"}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {estaEditando ? (
                          <input type="text" placeholder="DD/MM/YYYY" value={novaDataEnvio} onChange={(e) => setNovaDataEnvio(e.target.value)} className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-center font-medium" />
                        ) : (
                          <span className="text-slate-600 font-semibold">{item.nova_data_envio ? new Date(item.nova_data_envio.split("T")[0]+"T12:00:00").toLocaleDateString("pt-BR") : "-"}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center space-x-1.5">
                        {estaEditando ? (
                          <>
                            <button onClick={() => handleSalvarEdicao(item)} className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-xs cursor-pointer">Salvar</button>
                            <button onClick={() => setEditandoId(null)} className="px-2 py-0.5 bg-slate-200 text-slate-600 font-bold rounded text-xs cursor-pointer">Sair</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditandoId(item.id); setPendenciaTexto(item.pendencias || ""); setNovaDataEnvio(item.nova_data_envio ? new Date(item.nova_data_envio.split("T")[0]+"T12:00:00").toLocaleDateString("pt-BR") : ""); }} className="px-2 py-0.5 border border-slate-300 text-slate-600 font-bold rounded text-xs cursor-pointer hover:bg-slate-50">📝 Cobrar</button>
                            <button onClick={() => handleDeletarAnalise(item.id)} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded text-xs cursor-pointer hover:bg-rose-100">✕</button>
                          </>
                        )}
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