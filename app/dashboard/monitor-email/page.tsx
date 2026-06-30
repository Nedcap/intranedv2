/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface EmailCard {
  id: string;
  mensagem_id: string;
  provedor: "GMAIL" | "OUTLOOK";
  caixa_origem: string; 
  remetente_nome: string;
  remetente_email: string;
  assunto: string;
  snippet: string;
  tem_anexo: boolean;
  status: "PENDENTE" | "LIDO" | "BANDEIRA" | "RESOLVIDO" | "LIXO";
  data_recebimento: string;
}

export default function CaixaInteligentePage() {
  const [emails, setEmails] = useState<EmailCard[]>([]);
  const [contasConectadas, setContasConectadas] = useState<string[]>([]);
  const [contaAtiva, setContaAtiva] = useState<string>("");
  
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  
  const [buscaRemetente, setBuscaRemetente] = useState("");
  const [buscaAssunto, setBuscaAssunto] = useState("");

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [historicoBuscado, setHistoricoBuscado] = useState<EmailCard[]>([]);
  const [abrindoHistorico, setAbrindoHistorico] = useState(false);

  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [emailRespondendo, setEmailRespondendo] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Guardar a referência da conta ativa para o setInterval não ler estado desatualizado
  const contaAtivaRef = useRef(contaAtiva);

  useEffect(() => {
    contaAtivaRef.current = contaAtiva;
  }, [contaAtiva]);

  const obterUsuarioLogado = () => {
    if (typeof window === "undefined") return "";
    const userStr = localStorage.getItem("intraned_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.email || user.nome;
    }
    return "";
  };

  const carregarAbasEContas = async () => {
    const usuarioLogado = obterUsuarioLogado();
    if (!usuarioLogado) return;

    const { data } = await supabase
      .from("usuarios_integracoes")
      .select("gmail_conta_conectada")
      .eq("email_usuario", usuarioLogado);

    const lista = data?.map(d => d.gmail_conta_conectada) || [];
    setContasConectadas(lista);
    
    if (lista.length > 0 && !contaAtiva) {
      setContaAtiva(lista[0]); 
    }
  };

  const carregarCardsDaContaAtiva = async (mostrarCarregando = true) => {
    if (!contaAtiva) return setEmails([]);
    if (mostrarCarregando) setCarregando(true);
    try {
      const usuarioLogado = obterUsuarioLogado();
      const { data } = await supabase
        .from("caixa_inteligente")
        .select("*")
        .eq("dono_da_caixa", usuarioLogado)
        .eq("caixa_origem", contaAtiva)
        .not("status", "in", '("LIXO", "RESOLVIDO")')
        .order("data_recebimento", { ascending: false });

      setEmails(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (mostrarCarregando) setCarregando(false);
    }
  };

  // 🔄 SINCRONIZADOR SILENCIOSO EM SEGUNDO PLANO
  const rodarSincronizadorDaAba = async (abaParaSincronizar = contaAtivaRef.current) => {
    if (!abaParaSincronizar || sincronizando) return;
    setSincronizando(true);
    try {
      await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: obterUsuarioLogado(), contaAtiva: abaParaSincronizar })
      });
      // Recarrega sem travar a tela
      const usuarioLogado = obterUsuarioLogado();
      const { data } = await supabase
        .from("caixa_inteligente")
        .select("*")
        .eq("dono_da_caixa", usuarioLogado)
        .eq("caixa_origem", abaParaSincronizar)
        .not("status", "in", '("LIXO", "RESOLVIDO")')
        .order("data_recebimento", { ascending: false });

      setEmails(data || []);
    } catch (err) {
      console.error("Erro na sincronização automática:", err);
    } finally {
      setSincronizando(false);
    }
  };

  const buscarHistoricoPorData = async () => {
    if (!dataInicio || !contaAtiva) return;
    setSincronizando(true);
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userEmail: obterUsuarioLogado(), 
          contaAtiva, 
          dataInicio, 
          dataFim 
        })
      });
      const dados = await res.json();
      setHistoricoBuscado(dados.messages || []);
      setAbrindoHistorico(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSincronizando(false);
    }
  };

  const importarEmailSelecionado = async (email: EmailCard) => {
    try {
      await supabase.from("caixa_inteligente").upsert(email, { onConflict: "mensagem_id" });
      setHistoricoBuscado(prev => prev.filter(e => e.mensagem_id !== email.mensagem_id));
      await carregarCardsDaContaAtiva(false);
    } catch (err) {
      console.error(err);
    }
  };

  const enviarRespostaGmailReal = async (email: EmailCard) => {
    if (!textoResposta.trim() || enviando) return; // 🛡️ Evita múltiplos cliques se já estiver enviando
    setEnviando(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: obterUsuarioLogado(),
          mensagemId: email.mensagem_id,
          para: email.remetente_email,
          assunto: email.assunto,
          textoResposta
        })
      });

      // Se a rota falhar (ex: 500 ou 400), precisamos pegar o erro aqui
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro do servidor (${res.status})`);
      }

      const resultado = await res.json();
      if (resultado.error) throw new Error(resultado.error);

      // ✨ SE DEU CERTO: Limpa e move para Resolvido
      setTextoResposta("");
      setEmailRespondendo(null);
      await mudarStatusEmail(email.id, "RESOLVIDO");
      
    } catch (err: any) {
      console.error("❌ Falha crítica no envio:", err);
      // Como não queremos alert(), vamos printar o erro direto na tela de resposta pro desenvolvedor ver o que quebrou!
      setTextoResposta(prev => `${prev}\n\n[⚠️ ERRO AO ENVIAR: ${err.message}]`);
    } finally {
      setEnviando(false); // 🔓 DESTREVA O BOTÃO INDEPENDENTE DE DAR CERTO OU ERRADO!
    }
  };

  const adicionarNovaContaGoogle = () => {
    const clientId = "286592186985-510m9rsgj1f2ifqas12jegg7are7ddqg.apps.googleusercontent.com";
    const redirectUri = `https://intraned.nedcapital.com.br/api/auth/google`;
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email")}&state=${encodeURIComponent(obterUsuarioLogado())}&access_type=offline&prompt=select_account`;
  };

  const mudarStatusEmail = async (id: string, novoStatus: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, status: novoStatus as any } : e));
    await supabase.from("caixa_inteligente").update({ status: novoStatus }).eq("id", id);
    if (novoStatus === "LIXO" || novoStatus === "RESOLVIDO") {
      setEmails(prev => prev.filter(e => e.id !== id));
    }
  };

  useEffect(() => {
    carregarAbasEContas();
  }, []);

  // 🌟 GATILHO DE MUDANÇA DE ABA
  useEffect(() => {
    if (contaAtiva) {
      carregarCardsDaContaAtiva(true);
      rodarSincronizadorDaAba(contaAtiva);
    }
  }, [contaAtiva]);

  // ⏱️ GATILHO DE CRONÔMETRO AUTOMÁTICO (Vigia a cada 30 segundos)
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (contaAtivaRef.current) {
        console.log(`[Vigilante] Sincronizando automático para: ${contaAtivaRef.current}`);
        rodarSincronizadorDaAba(contaAtivaRef.current);
      }
    }, 30000); // Mude para 10000 se quiser testar cravado de 10 em 10 segundos

    return () => clearInterval(intervalo);
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setArrastandoId(id);
  };

  const handleDrop = async (e: React.DragEvent, novaColuna: string) => {
    e.preventDefault();
    if (!arrastandoId) return;
    mudarStatusEmail(arrastandoId, novaColuna);
    setArrastandoId(null);
  };

  const emailsFiltrados = emails.filter(e => {
    const bateRemetente = e.remetente_nome.toLowerCase().includes(buscaRemetente.toLowerCase()) || e.remetente_email.toLowerCase().includes(buscaRemetente.toLowerCase());
    const bateAssunto = e.assunto.toLowerCase().includes(buscaAssunto.toLowerCase());
    return bateRemetente && bateAssunto;
  });

  const renderColuna = (titulo: string, icone: string, statusFiltro: string, corBorda: string) => {
    const listaColuna = emailsFiltrados.filter(e => e.status === statusFiltro);
    return (
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, statusFiltro)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex flex-col h-[65vh]">
        <div className={`p-3 border-b border-slate-200 bg-white rounded-t-xl border-t-4 ${corBorda}`}>
          <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs flex items-center justify-between">
            <span>{icone} {titulo}</span>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{listaColuna.length}</span>
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {carregando ? (
            <div className="text-center p-6 text-slate-400 font-bold text-xs">Carregando dados...</div>
          ) : listaColuna.length === 0 ? (
            <div className="text-center p-6 text-slate-400 font-bold text-xs italic">Sem e-mails aqui.</div>
          ) : (
            listaColuna.map(email => (
              <div key={email.id} draggable onDragStart={(e) => handleDragStart(e, email.id)} className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:border-slate-300">
                <div className="flex justify-between items-start gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[8px] font-black uppercase px-1 rounded bg-red-50 text-red-600 border border-red-100">{email.provedor}</span>
                      <span className="font-bold text-slate-800 text-xs truncate">{email.remetente_nome}</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs line-clamp-1">{email.assunto}</h4>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <button onClick={() => mudarStatusEmail(email.id, email.status === "BANDEIRA" ? "PENDENTE" : "BANDEIRA")} className="text-xs p-0.5 rounded hover:bg-slate-100" title="Alternar Acompanhamento">
                      {email.status === "BANDEIRA" ? "🚩" : "🏳️"}
                    </button>
                    <button onClick={() => mudarStatusEmail(email.id, "LIXO")} className="text-xs p-0.5 rounded text-rose-600 hover:bg-rose-50" title="Excluir Card">🗑️</button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">{email.snippet}</p>

                {emailRespondendo === email.id && (
                  <div className="bg-blue-50/50 border border-blue-100 p-2 rounded flex flex-col gap-2">
                    <textarea 
                      rows={3}
                      placeholder="Escreva a resposta corporativa..."
                      value={textoResposta}
                      onChange={(e) => setTextoResposta(e.target.value)}
                      className="w-full text-xs p-1.5 rounded border border-blue-200 outline-none resize-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => { setEmailRespondendo(null); setTextoResposta(""); }} className="text-[10px] font-bold text-slate-500 uppercase">Sair</button>
                      <button onClick={() => enviarRespostaGmailReal(email)} disabled={enviando} className="px-2 py-1 bg-blue-600 text-white text-[10px] font-black rounded uppercase">
                        {enviando ? "Enviando..." : "📤 Enviar Agora"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-medium">{new Date(email.data_recebimento).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEmailRespondendo(emailRespondendo === email.id ? null : email.id)} className="text-blue-600 font-bold hover:underline">💬 Responder</button>
                    <button onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.mensagem_id}`, "_blank")} className="text-slate-500 font-bold hover:underline">🌐 Link</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-10 text-xs font-sans text-slate-700">
      
      {/* SELEÇÃO DE ABAS MULTICONTAS */}
      <div className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded-xl shadow-2xs overflow-x-auto gap-2">
        <div className="flex gap-1 items-center">
          {contasConectadas.length === 0 ? (
            <span className="text-slate-400 font-bold p-2 italic">Nenhum e-mail corporativo integrado...</span>
          ) : (
            contasConectadas.map(conta => (
              <button 
                key={conta} 
                onClick={() => setContaAtiva(conta)}
                className={`px-3 py-1.5 rounded-lg font-black transition-colors ${contaAtiva === conta ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
              >
                📬 {conta}
              </button>
            ))
          )}
        </div>
        <button onClick={adicionarNovaContaGoogle} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg uppercase whitespace-nowrap text-[10px]">
          ➕ Conectar Novo E-mail
        </button>
      </div>

      {/* CONTROLE FILTROS E HISTÓRICO */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase">Aba Ativa: <span className="text-blue-600">{contaAtiva || "Nenhuma"}</span></h2>
            <p className="text-slate-400 text-[10px]">Sincronização inteligente ativada.</p>
          </div>
          
          {/* O VOLTADO DO BOTÃO DE CHECAGEM + ANIMAÇÃO DE BACKUP */}
          <div className="flex items-center gap-2">
            {sincronizando && (
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md animate-pulse">
                🔄 Atualizando...
              </span>
            )}
            <button 
              onClick={() => rodarSincronizadorDaAba(contaAtiva)} 
              disabled={sincronizando || !contaAtiva} 
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg uppercase text-[10px] disabled:opacity-50"
            >
              Puxar E-mails Novos
            </button>
          </div>
        </div>

        {/* PROCURAR LOCAIS E HISTÓRICO POR DATA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-500 text-[9px] uppercase">Filtrar Remetente</span>
            <input type="text" value={buscaRemetente} onChange={(e) => setBuscaRemetente(e.target.value)} placeholder="Nome ou e-mail..." className="p-1.5 rounded border border-slate-200 bg-white text-xs outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-500 text-[9px] uppercase">Filtrar Assunto</span>
            <input type="text" value={buscaAssunto} onChange={(e) => setBuscaAssunto(e.target.value)} placeholder="Palavra-chave..." className="p-1.5 rounded border border-slate-200 bg-white text-xs outline-none" />
          </div>
          
          <div className="flex flex-col gap-1 md:col-span-2 border-l border-slate-200 pl-3">
            <span className="font-black text-blue-600 text-[9px] uppercase">🔍 Buscar Histórico da Caixa por Período</span>
            <div className="flex gap-2 items-center">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="p-1.5 rounded border border-slate-200 text-xs bg-white flex-1 outline-none" />
              <span className="text-slate-400 font-bold">até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="p-1.5 rounded border border-slate-200 text-xs bg-white flex-1 outline-none" />
              <button onClick={buscarHistoricoPorData} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded uppercase text-[10px]">Buscar</button>
            </div>
          </div>
        </div>
      </div>

      {/* SELETOR DE IMPORTAÇÃO */}
      {abrindoHistorico && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-amber-800 uppercase tracking-wider text-xs">📬 E-mails encontrados ({historicoBuscado.length}) - Escolha quais quer trazer para o Kanban</h3>
            <button onClick={() => setAbrindoHistorico(false)} className="text-amber-600 font-black hover:underline uppercase text-[10px]">Fechar</button>
          </div>
          <div className="max-h-[25vh] overflow-y-auto space-y-2 custom-scrollbar">
            {historicoBuscado.length === 0 && <p className="text-slate-400 font-bold italic text-center py-2">Nenhum e-mail retornado.</p>}
            {historicoBuscado.map(h => (
              <div key={h.mensagem_id} className="bg-white border border-amber-100 rounded-lg p-2 flex justify-between items-center gap-4 shadow-2xs">
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 text-xs">{h.remetente_nome}</span> - <span className="font-medium text-slate-500">{h.assunto}</span>
                  <p className="text-[10px] text-slate-400 truncate">{h.snippet}</p>
                </div>
                <button onClick={() => importarEmailSelecionado(h)} className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[9px] rounded whitespace-nowrap">📥 Importar Card</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KANBAN */}
      <div className="flex flex-col md:flex-row gap-4 w-full">
        {renderColuna("Caixa de Entrada", "📥", "PENDENTE", "border-t-blue-500")}
        {renderColuna("Em Atendimento", "⏳", "LIDO", "border-t-amber-500")}
        {renderColuna("Acompanhamento 🚩", "🚩", "BANDEIRA", "border-t-purple-600")}
      </div>

      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}} />
    </div>
  );
}