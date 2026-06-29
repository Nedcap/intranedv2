/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface EmailCard {
  id: string;
  mensagem_id: string;
  provedor: "GMAIL" | "OUTLOOK";
  remetente_nome: string;
  remetente_email: string;
  assunto: string;
  snippet: string;
  tem_anexo: boolean;
  status: "PENDENTE" | "LIDO" | "RESOLVIDO" | "LIXO";
  data_recebimento: string;
}

export default function CaixaInteligentePage() {
  const [emails, setEmails] = useState<EmailCard[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Controle de Autenticação
  const [gmailConectado, setGmailConectado] = useState(false);
  const [outlookConectado, setOutlookConectado] = useState(false);
  
  // Resposta Rápida
  const [emailRespondendo, setEmailRespondendo] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarCaixaFantasma = async () => {
    setCarregando(true);
    try {
      const userStr = localStorage.getItem("intraned_user");
      let usuarioLogado = "";
      if (userStr) {
        const user = JSON.parse(userStr);
        usuarioLogado = user.email || user.nome; // Usa o email do user para isolamento
      }

      if (!usuarioLogado) return;

      const { data, error } = await supabase
        .from("caixa_inteligente")
        .select("*")
        .eq("dono_da_caixa", usuarioLogado)
        .neq("status", "LIXO") // O lixo a gente nem traz pra tela
        .order("data_recebimento", { ascending: false });

      if (error) throw error;
      if (data) setEmails(data);
    } catch (err) {
      console.error("Erro ao carregar e-mails:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarCaixaFantasma();
  }, []);

  // ==========================================================================
  // 🔌 MOTORES DE INTEGRAÇÃO (OAUTH)
  // ==========================================================================
  const autenticarProvedor = (provedor: "GMAIL" | "OUTLOOK") => {
    alert(`Redirecionando para a tela de login do ${provedor}...\n(Aqui entrará a rota de OAuth no próximo passo)`);
    if (provedor === "GMAIL") setGmailConectado(true);
    if (provedor === "OUTLOOK") setOutlookConectado(true);
  };

  // ==========================================================================
  // 🔄 MOTORES DE AÇÃO DOS CARDS
  // ==========================================================================
  const mudarStatusEmail = async (id: string, novoStatus: string) => {
    try {
      // Atualiza na tela instantaneamente para parecer super rápido
      setEmails(prev => prev.map(e => e.id === id ? { ...e, status: novoStatus as any } : e));
      
      // Atualiza no banco fantasma
      await supabase.from("caixa_inteligente").update({ status: novoStatus }).eq("id", id);

      if (novoStatus === "LIXO") {
        // Remove da tela para não pesar
        setEmails(prev => prev.filter(e => e.id !== id));
        // TODO: Aqui a gente dispararia a API do Google/MS para arquivar o e-mail real lá
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao mover e-mail.");
    }
  };

  const enviarRespostaRapida = async (email: EmailCard) => {
    if (!textoResposta.trim()) return;
    
    setEnviando(true);
    try {
      // TODO: Rota de API POST /api/send-email { mensagem_id, texto }
      console.log(`Enviando para ${email.remetente_email}: ${textoResposta}`);
      
      // Simula o tempo de envio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert("🚀 Resposta enviada com sucesso!");
      setTextoResposta("");
      setEmailRespondendo(null);
      
      // Move pra resolvido automaticamente
      mudarStatusEmail(email.id, "RESOLVIDO");
    } catch (err) {
      console.error(err);
      alert("Falha ao enviar resposta.");
    } finally {
      setEnviando(false);
    }
  };

  const abrirNoNavegadorNativo = (email: EmailCard) => {
    // Monta a URL baseada no provedor e no ID original
    let url = "";
    if (email.provedor === "GMAIL") {
      url = `https://mail.google.com/mail/u/0/#inbox/${email.mensagem_id}`;
    } else {
      url = `https://outlook.office.com/mail/deeplink?viewmessage&itemid=${email.mensagem_id}`;
    }
    window.open(url, "_blank");
  };

  // ==========================================================================
  // 🎨 RENDERIZAÇÃO DAS COLUNAS (KANBAN)
  // ==========================================================================
  const renderColuna = (titulo: string, icone: string, statusFiltro: string, corBorda: string) => {
    const filtrados = emails.filter(e => e.status === statusFiltro);

    return (
      <div className="flex-1 bg-slate-100/50 border border-slate-200 rounded-2xl flex flex-col h-[75vh]">
        <div className={`p-4 border-b border-slate-200 bg-white rounded-t-2xl shadow-sm border-t-4 ${corBorda}`}>
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-xs flex items-center justify-between">
            <span>{icone} {titulo}</span>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px]">{filtrados.length}</span>
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {filtrados.length === 0 ? (
            <div className="text-center p-6 text-slate-400 font-bold text-xs italic opacity-70">Nenhum e-mail aqui.</div>
          ) : (
            filtrados.map(email => (
              <div key={email.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-3 group">
                
                {/* CABEÇALHO DO CARD */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${email.provedor === "GMAIL" ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                        {email.provedor}
                      </span>
                      <span className="font-bold text-slate-900 text-xs truncate" title={email.remetente_nome || email.remetente_email}>
                        {email.remetente_nome || email.remetente_email}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-800 text-sm leading-tight line-clamp-2" title={email.assunto}>
                      {email.assunto}
                    </h4>
                  </div>
                  {email.tem_anexo && (
                    <span className="bg-slate-100 text-slate-600 p-1.5 rounded-lg border border-slate-200" title="Possui Anexo">📎</span>
                  )}
                </div>

                {/* CORPO DO E-MAIL (SNIPPET) */}
                <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                  {email.snippet}
                </p>

                {/* ÁREA DE RESPOSTA RÁPIDA */}
                {emailRespondendo === email.id && (
                  <div className="bg-blue-50/50 border border-blue-100 p-2 rounded-lg flex flex-col gap-2 mt-1">
                    <textarea 
                      autoFocus
                      rows={3}
                      placeholder="Escreva sua resposta rápida aqui..."
                      value={textoResposta}
                      onChange={(e) => setTextoResposta(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-blue-200 outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEmailRespondendo(null); setTextoResposta(""); }} className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider">Cancelar</button>
                      <button onClick={() => enviarRespostaRapida(email)} disabled={enviando} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black rounded uppercase tracking-wider shadow-xs">
                        {enviando ? "⏳..." : "📤 Enviar"}
                      </button>
                    </div>
                  </div>
                )}

                {/* BOTÕES DE AÇÃO */}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1">
                    {statusFiltro !== "PENDENTE" && (
                      <button onClick={() => mudarStatusEmail(email.id, "PENDENTE")} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-black uppercase tracking-wider transition-colors" title="Mover para Pendentes">⏪ Voltar</button>
                    )}
                    {statusFiltro === "PENDENTE" && (
                      <button onClick={() => mudarStatusEmail(email.id, "LIDO")} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase tracking-wider transition-colors" title="Marcar como Em Andamento">▶ Ler</button>
                    )}
                    {statusFiltro !== "RESOLVIDO" && (
                      <button onClick={() => mudarStatusEmail(email.id, "RESOLVIDO")} className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-black uppercase tracking-wider transition-colors" title="Marcar como Resolvido">✅ Fechar</button>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <button onClick={() => setEmailRespondendo(emailRespondendo === email.id ? null : email.id)} className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider transition-colors shadow-xs">
                      💬 Responder
                    </button>
                    <button onClick={() => abrirNoNavegadorNativo(email)} className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-[10px] font-black uppercase tracking-wider transition-colors shadow-xs" title="Abrir no Webmail Oficial">
                      🌐 Abrir
                    </button>
                    <button onClick={() => mudarStatusEmail(email.id, "LIXO")} className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-black uppercase tracking-wider transition-colors" title="Mover para a Lixeira e Ocultar">
                      🗑️
                    </button>
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER E CONECTORES OAUTH */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">📬 TriageMail Corporativo</h2>
          <span className="text-xs text-slate-500 font-medium">Controle unificado de e-mails em formato Kanban.</span>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => autenticarProvedor("GMAIL")} 
            className={`px-4 py-2 font-black rounded-lg text-[10px] uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 border ${gmailConectado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"}`}
          >
            <span className="text-sm">📧</span> {gmailConectado ? "Gmail Conectado" : "Conectar Gmail"}
          </button>
          
          <button 
            onClick={() => autenticarProvedor("OUTLOOK")} 
            className={`px-4 py-2 font-black rounded-lg text-[10px] uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 border ${outlookConectado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"}`}
          >
            <span className="text-sm">📨</span> {outlookConectado ? "Outlook Conectado" : "Conectar Outlook"}
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse bg-slate-50 border border-slate-200 rounded-xl shadow-inner">
          Sincronizando caixas de e-mail seguras...
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 w-full">
          {renderColuna("Caixa de Entrada (A Fazer)", "📥", "PENDENTE", "border-t-rose-500")}
          {renderColuna("Lidos (Em Andamento)", "⏳", "LIDO", "border-t-blue-500")}
          {renderColuna("Resolvidos / Arquivados", "✅", "RESOLVIDO", "border-t-emerald-500")}
        </div>
      )}

      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}