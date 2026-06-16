/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function ComitePage() {
  const [analises, setAnalises] = useState<any[]>([]);
  const [empresasAnalise, setEmpresasAnalise] = useState<any[]>([]); 
  const [carregando, setCarregando] = useState(true);
  
  const [idEmpresaExpandida, setEditandoEmpresaExpandida] = useState<string | null>(null);
  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  
  const [membroVoto, setMembroVoto] = useState("");
  const [opcaoVoto, setOpcaoVoto] = useState("");
  const [justificativaVoto, setJustificativaVoto] = useState("");
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [avisoCopia, setAvisoCopia] = useState(false);
  
  const [conteudoHtmlPreview, setConteudoHtmlPreview] = useState<string | null>(null);
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = useState("");
  
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pendenciaTexto, setPendenciaTexto] = useState("");
  const [novaDataEnvio, setNovaDataEnvio] = useState("");

  const [isMaster, setIsMaster] = useState(false);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("");

  // 🎯 Otimização: Função memorizada para evitar recriação de escopo e loops reativos
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

        // Dispara a carga de votos inicial de forma limpa
        for (const item of filtradas) {
          await carregarVotosIniciais(item.empresa_nome);
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

  // 📡 1. CARGA INICIAL E REALTIME DE VOTOS (Livre de loops de render)
  useEffect(() => {
    carregarComite(); 

    try {
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setNomeUsuarioLogado(parsed.nome || "Comercial Ned");
        if (String(parsed.perfil || parsed.cargo).toLowerCase() === "master") setIsMaster(true);
      }
    } catch (e) { console.error(e); }

    // O canal escuta as mudanças e atualiza com base no payload puro recebido, sem varrer o estado 'analises'
    const canalVotos = supabase
      .channel("votos-live-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, (payload: any) => {
        const nomeEmp = payload.new?.empresa_nome || payload.old?.empresa_nome;
        if (nomeEmp) {
          carregarVotosIniciais(nomeEmp);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalVotos);
    };
  }, [carregarVotosIniciais]);

  // 📡 2. REALTIME DO CHAT INTERNO DA EMPRESA EXPANDIDA
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
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro no painel Master: ${err.message}`);
    } fill-out {
      setCarregando(false);
    }
  };

  const processarVotoWeb = async (empresaItem: any) => {
    if (!membroVoto || !opcaoVoto || !justificativaVoto) {
      alert("Por favor, preencha todos os campos do voto.");
      return;
    }
    try {
      setEnviandoVoto(true);
      const e = empresaItem.empresa_nome;
      
      await supabase.from("votos").insert({ 
        empresa_nome: e, 
        membro_nome: membroVoto, 
        voto: opcaoVoto, 
        justificativa: justificativaVoto, 
        email_enviado: true 
      });
      
      const emailsAlvo = await obtener_emails_notificacao(e);

      if (membroVoto === "Decisão") {
        const { error } = await supabase.from("analises").update({ status: opcaoVoto }).eq("id", empresaItem.id);
        if (error) throw error;
        
        const { data: todosVotos } = await supabase.from("votos").select("*").eq("empresa_nome", e);
        const corAta = opcaoVoto === "Aprovado" ? "#059669" : "#ef4444";
        const linesAta = (todosVotos || []).map(v => `<tr><td style='border:1px solid #ddd;padding:8px;'><b>${v.membro_nome}</b></td><td style='border:1px solid #ddd;padding:8px;'>${v.voto}</td><td style='border:1px solid #ddd;padding:8px;'>${v.justificativa}</td></tr>`).join("");
        const htmlAta = `<html><body><h2>Ata de Comitê Finalizada: ${e}</h2><p>Status Final: <b style='color:${corAta}'>${opcaoVoto}</b></p><table style='width:100%;border-collapse:collapse;'><thead><tr style='background:#f4f4f4;'><th style='padding:8px;border:1px solid #ddd;'>Membro</th><th style='padding:8px;border:1px solid #ddd;'>Voto</th><th style='padding:8px;border:1px solid #ddd;'>Parecer</th></tr></thead><tbody>${linesAta}</tbody></table></body></html>`;
        
        await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);
      }
      
      alert("🗳️ Voto computado com sucesso!");
      setJustificativaVoto(""); 
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

  const alternarPainelInterno = async (empresa: any) => {
    if (idEmpresaExpandida === empresa.id) {
      setEditandoEmpresaExpandida(null);
      setChatMsgs([]);
    } else {
      setEditandoEmpresaExpandida(empresa.id);
      const { data } = await supabase.from("chat_comite").select("*").eq("empresa_nome", empresa.empresa_nome).order("id", { ascending: true });
      if (data) setChatMsgs(data);
    }
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

  const tratarAberturaAnalise = async (caminho: string) => {
    if (!caminho) return alert("Esta análise ainda não possui relatório gerado.");
    const urlLimpa = caminho.trim();
    if (urlLimpa.startsWith("http")) { 
      try {
        const res = await fetch(urlLimpa);
        const htmlText = await res.text();
        setConteudoHtmlPreview(htmlText);
        return;
      } catch {
        window.open(urlLimpa, "_blank");
        return;
      }
    }
    const partes = urlLimpa.split(/[\\/]/);
    const nomeArquivo = partes[partes.length - 1].trim();
    try {
      const { data, error } = await supabase.storage.from("analises").download(nomeArquivo);
      if (error) {
        navigator.clipboard.writeText(urlLimpa); 
        setAvisoCopia(true);
        setTimeout(() => setAvisoCopia(false), 4000);
        return;
      }
      if (data) setConteudoHtmlPreview(await data.text());
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 text-[13px]">
      {carregando && <div className="fixed inset-0 bg-white/40 z-50 flex items-center justify-center font-bold text-slate-500">Sincronizando esteira...</div>}
      
      {/* 🏛️ SEÇÃO 1: PAUTA DO COMITÊ */}
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
              {analises.map((item) => {
                const painelAberto = idEmpresaExpandida === item.id;
                const listaDeVotos = votosAoVivo[item.empresa_nome] || [];
                
                return (
                  <tr key={item.id} style={{ display: "contents" }}>
                    {/* LINHA MASTER PRINCIPAL */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-bold text-slate-900">{item.empresa_nome}</td>
                      <td className="p-2.5 text-slate-500">{item.comercial || "-"}</td>
                      <td className="p-2.5 text-center text-slate-500">{item.data_recebimento ? new Date(item.data_recebimento.split("T")[0]+"T12:00:00").toLocaleDateString("pt-BR") : "-"}</td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-md uppercase">{item.status || "Em análise"}</span>
                      </td>
                      <td className="p-2.5 flex gap-2 justify-center">
                        <button onClick={() => tratarAberturaAnalise(item.caminho_local)} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-200 text-xs cursor-pointer transition-colors">📄 Análise</button>
                        <button onClick={() => alternarPainelInterno(item)} className={`px-2.5 py-0.5 font-bold rounded text-xs cursor-pointer transition-colors ${painelAberto ? "bg-slate-800 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                          {painelAberto ? "✕ Fechar" : "💬 Votar / Chat"}
                        </button>
                      </td>
                      {isMaster && (
                        <td className="p-2.5 bg-slate-50 border-l border-slate-200 text-center space-x-2">
                          <button onClick={() => forcarDecisaoMaster(item, "Aprovado")} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-[11px] uppercase cursor-pointer shadow-sm transition-all">✅ Aprovar</button>
                          <button onClick={() => forcarDecisaoMaster(item, "Reprovado")} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black rounded text-[11px] uppercase cursor-pointer shadow-sm transition-all">⛔ Reprovar</button>
                        </td>
                      )}
                    </tr>

                    {/* COMPONENTE INTERNO EXPANDIDO - SEGURO CONTRA LOOPS */}
                    {painelAberto && (
                      <tr>
                        <td colSpan={isMaster ? 6 : 5} className="bg-slate-50/50 p-4 border-l-4 border-blue-600">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-slate-200 p-4 rounded-xl shadow-xs text-left">
                            
                            {/* Bloco Voto */}
                            <div className="space-y-3 border-r border-slate-100 pr-4">
                              <span className="text-[11px] font-black text-slate-500 uppercase block tracking-wider">🗳️ Painel de Votação</span>
                              <div className="grid grid-cols-2 gap-2">
                                <select value={membroVoto} onChange={(e) => setMembroVoto(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none cursor-pointer">
                                  <option value="">Membro</option><option value="Diego">Diego</option><option value="Alyson">Alyson</option><option value="Decisão">Decisão</option>
                                </select>
                                <select value={opcaoVoto} onChange={(e) => setOpcaoVoto(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none cursor-pointer">
                                  <option value="">Voto</option><option value="Aprovado">Aprovado</option><option value="Reprovado">Reprovado</option>
                                </select>
                              </div>
                              <textarea value={justificativaVoto} onChange={(e) => setJustificativaVoto(e.target.value)} placeholder="Parecer técnico ou justificativa..." className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium outline-none h-14 resize-none" />
                              <button onClick={() => processarVotoWeb(item)} disabled={enviandoVoto} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded transition-all cursor-pointer">
                                {enviandoVoto ? "Computando..." : "Registrar Voto Oficial"}
                              </button>
                            </div>

                            {/* Bloco Histórico */}
                            <div className="space-y-2 border-r border-slate-100 pr-4 overflow-y-auto max-h-[220px]">
                              <span className="text-[11px] font-black text-slate-500 uppercase block tracking-wider">📋 Votos Registrados (Ao Vivo)</span>
                              {listaDeVotos.length === 0 ? (
                                <p className="text-slate-400 italic text-xs py-4 text-center">Nenhum voto computado.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {listaDeVotos.map((v: any, idx: number) => (
                                    <div key={idx} className="p-2 border border-slate-100 rounded bg-slate-50/50 flex flex-col gap-0.5 text-xs">
                                      <div className="flex justify-between items-center font-bold">
                                        <span className="text-slate-800">{v.membro_nome}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-black ${v.voto === "Aprovado" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{v.voto}</span>
                                      </div>
                                      <span className="text-slate-500 italic font-medium">"{v.justificativa}"</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Bloco Chat */}
                            <div className="flex flex-col h-[220px]">
                              <span className="text-[11px] font-black text-slate-500 uppercase block tracking-wider mb-2">💬 Discussão e Alinhamentos</span>
                              <div className="flex-1 overflow-y-auto border border-slate-100 rounded p-2 space-y-2 bg-slate-50/30">
                                {chatMsgs.length === 0 ? (
                                  <p className="text-center text-slate-400 py-8 text-xs">Nenhum comentário na mesa.</p>
                                ) : (
                                  chatMsgs.map((m: any) => (
                                    <div key={m.id} className="bg-white p-2 rounded border border-slate-100 shadow-2xs text-xs">
                                      <span className="font-bold text-blue-600">{m.usuario}</span>: <span className="text-slate-700 font-medium">{m.mensagem}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex gap-2 mt-2 shrink-0">
                                <input type="text" value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagemChat(item.empresa_nome)} placeholder="Mensagem..." className="flex-1 p-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-blue-500 font-semibold text-slate-800" />
                                <button onClick={() => enviarMensagemChat(item.empresa_nome)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 rounded cursor-pointer transition-all">Mandar</button>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔍 SEÇÃO 2: ESTEIRA DE ENTRADA */}
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

      {/* MODAL PREVIEW HTML */}
      {conteudoHtmlPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="w-screen h-screen bg-white flex flex-col overflow-hidden fixed inset-0">
            <div className="flex justify-between items-center bg-slate-800 text-white p-3 shrink-0 shadow-md">
              <h3 className="font-bold text-sm">📄 Visualizador de Apresentações Ned Capital</h3>
              <button onClick={() => setConteudoHtmlPreview(null)} className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-3 py-1 rounded transition-all cursor-pointer">✕ Fechar Tela Cheia</button>
            </div>
            <div className="flex-1 bg-white min-h-0">
              <iframe srcDoc={conteudoHtmlPreview} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}