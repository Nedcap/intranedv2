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
  status: "PENDENTE" | "LIDO" | "BANDEIRA" | "RESOLVIDO" | "LIXO";
  data_recebimento: string;
}

export default function CaixaInteligentePage() {
  const [emails, setEmails] = useState<EmailCard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  // Filtros locais de busca
  const [buscaRemetente, setBuscaRemetente] = useState("");
  const [buscaAssunto, setBuscaAssunto] = useState("");

  // Filtro inteligente de histórico (Datas)
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [historicoBuscado, setHistoricoBuscado] = useState<EmailCard[]>([]);
  const [abrindoHistorico, setAbrindoHistorico] = useState(false);

  const [gmailConectado, setGmailConectado] = useState(false);
  const [outlookConectado, setOutlookConectado] = useState(false);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [emailRespondendo, setEmailRespondendo] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const obterUsuarioLogado = () => {
    if (typeof window === "undefined") return "";
    const userStr = localStorage.getItem("intraned_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.email || user.nome;
    }
    return "";
  };

  const carregarDadosDoSupabase = async () => {
    setCarregando(true);
    try {
      const usuarioLogado = obterUsuarioLogado();
      if (!usuarioLogado) return;

      const { data, error } = await supabase
        .from("caixa_inteligente")
        .select("*")
        .eq("dono_da_caixa", usuarioLogado)
        .not("status", "in", '("LIXO", "RESOLVIDO")')
        .order("data_recebimento", { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  const sincronizarCaixaAtual = async () => {
    const usuarioLogado = obterUsuarioLogado();
    if (!usuarioLogado) return alert("Sessão inválida.");
    setSincronizando(true);
    try {
      await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: usuarioLogado })
      });
      await carregarDadosDoSupabase();
    } catch (err) {
      console.error(err);
    } finally {
      setSincronizando(false);
    }
  };

  const buscarHistoricoPorData = async () => {
    if (!dataInicio) return alert("Selecione ao menos a data inicial.");
    const usuarioLogado = obterUsuarioLogado();
    setSincronizando(true);
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: usuarioLogado, dataInicio, dataFim })
      });
      const dados = await res.json();
      if (dados.error) throw new Error(dados.error);
      setHistoricoBuscado(dados.messages || []);
      setAbrindoHistorico(true);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const importarEmailSelecionado = async (email: EmailCard) => {
    try {
      await supabase.from("caixa_inteligente").upsert(email, { onConflict: "mensagem_id" });
      alert("E-mail importado para o Kanban!");
      setHistoricoBuscado(prev => prev.filter(e => e.mensagem_id !== email.mensagem_id));
      await carregarDadosDoSupabase();
    } catch (err) {
      console.error(err);
    }
  };

  const mudarStatusEmail = async (id: string, novoStatus: string) => {
    // Sem setTimeout ou animações - atualização direta e limpa
    setEmails(prev => prev.map(e => e.id === id ? { ...e, status: novoStatus as any } : e));
    if (!id.startsWith("fake-")) {
      await supabase.from("caixa_inteligente").update({ status: novoStatus }).eq("id", id);
    }
    if (novoStatus === "LIXO" || novoStatus === "RESOLVIDO") {
      setEmails(prev => prev.filter(e => e.id !== id));
    }
  };

  const enviarRespostaGmailReal = async (email: EmailCard) => {
    if (!textoResposta.trim()) return;
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
      const resultado = await res.json();
      if (resultado.error) throw new Error(resultado.error);

      alert("🚀 Resposta enviada direto pelo Gmail!");
      setTextoResposta("");
      setEmailRespondendo(null);
      await mudarStatusEmail(email.id, "RESOLVIDO");
    } catch (err: any) {
      alert(`Falha no envio: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  useEffect(() => {
    carregarDadosDoSupabase();
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

  // Aplica os filtros locais da busca
  const emailsFiltrados = emails.filter(e => {
    const bateRemetente = e.remetente_nome.toLowerCase().includes(buscaRemetente.toLowerCase()) || e.remetente_email.toLowerCase().includes(buscaRemetente.toLowerCase());
    const bateAssunto = e.assunto.toLowerCase().includes(buscaAssunto.toLowerCase());
    return bateRemetente && bateAssunto;
  });

  const renderColuna = (titulo: string, icone: string, statusFiltro: string, corBorda: string) => {
    const listaColuna = emailsFiltrados.filter(e => e.status === statusFiltro);

    return (
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, statusFiltro)}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex flex-col h-[70vh]"
      >
        <div className={`p-3 border-b border-slate-200 bg-white rounded-t-xl shadow-xs border-t-4 ${corBorda}`}>
          <h3 className="font-black text-slate-700 uppercase tracking-wider text-xs flex items-center justify-between">
            <span>{icone} {titulo}</span>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px]">{listaColuna.length}</span>
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {listaColuna.length === 0 && (
            <div className="text-center p-6 text-slate-400 font-bold text-xs italic">Sem e-mails aqui.</div>
          )}

          {listaColuna.map(email => (
            <div 
              key={email.id} 
              draggable
              onDragStart={(e) => handleDragStart(e, email.id)}
              className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] font-black uppercase px-1 rounded bg-red-50 text-red-600 border border-red-100">{email.provedor}</span>
                    <span className="font-bold text-slate-800 text-xs truncate">{email.remetente_nome}</span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-xs line-clamp-1">{email.assunto}</h4>
                </div>
                <div className="flex gap-1">
                  {/* Botões de Mudar Estado Rápidos */}
                  {email.status !== "BANDEIRA" ? (
                    <button onClick={() => mudarStatusEmail(email.id, "BANDEIRA")} className="text-xs p-0.5 hover:bg-slate-100 rounded" title="Marcar Acompanhamento">🏳️</button>
                  ) : (
                    <button onClick={() => mudarStatusEmail(email.id, "PENDENTE")} className="text-xs p-0.5 hover:bg-slate-100 rounded" title="Remover Acompanhamento">🚩</button>
                  )}
                  <button onClick={() => mudarStatusEmail(email.id, "LIXO")} className="text-xs p-0.5 hover:bg-rose-100 rounded text-rose-600" title="Incinerar Card">🗑️</button>
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
                <div className="flex gap-1.5">
                  <button onClick={() => setEmailRespondendo(emailRespondendo === email.id ? null : email.id)} className="text-blue-600 font-bold hover:underline">💬 Responder</button>
                  <button onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.mensagem_id}`, "_blank")} className="text-slate-500 font-bold hover:underline">🌐 Link</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-10 text-xs font-sans text-slate-700">
      
      {/* SEÇÃO DE CONTROLE PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">📬 TriageMail Inteligente</h2>
            <p className="text-slate-400 text-[11px] font-medium">Monitore, responda e filtre sua caixa sem sobrecarga visual.</p>
          </div>
          <button 
            onClick={sincronizarCaixaAtual} 
            disabled={sincronizando}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg uppercase tracking-wider transition-colors"
          >
            {sincronizando ? "🔄 Sincronizando..." : "🔄 Atualizar Monitor"}
          </button>
        </div>

        {/* BARRA DE FILTROS LOCAIS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-150">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-500 text-[10px] uppercase">Filtrar Remetente</span>
            <input type="text" value={buscaRemetente} onChange={(e) => setBuscaRemetente(e.target.value)} placeholder="Nome ou e-mail..." className="p-1.5 rounded border border-slate-200 outline-none bg-white text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-500 text-[10px] uppercase">Filtrar Assunto</span>
            <input type="text" value={buscaAssunto} onChange={(e) => setBuscaAssunto(e.target.value)} placeholder="Palavra-chave..." className="p-1.5 rounded border border-slate-200 outline-none bg-white text-xs" />
          </div>
          
          {/* FILTRO INTELIGENTE DE BUSCA NO HISTÓRICO GMAIL */}
          <div className="flex flex-col gap-1 md:col-span-2 border-l border-slate-200 pl-3">
            <span className="font-black text-blue-600 text-[10px] uppercase">🔍 Puxar Histórico da Caixa (Por Período)</span>
            <div className="flex gap-2 items-center">
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="p-1.5 rounded border border-slate-200 outline-none text-xs bg-white flex-1" />
              <span className="text-slate-400 font-bold">até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="p-1.5 rounded border border-slate-200 outline-none text-xs bg-white flex-1" />
              <button onClick={buscarHistoricoPorData} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded uppercase">Buscar</button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL / SELETOR DE IMPORTAÇÃO DE HISTÓRICO */}
      {abrindoHistorico && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-amber-800 uppercase tracking-wider text-xs">📬 E-mails encontrados na sua conta ({historicoBuscado.length}) - Escolha quais quer importar</h3>
            <button onClick={() => setAbrindoHistorico(false)} className="text-amber-600 font-black hover:underline uppercase text-[10px]">Fechar Histórico</button>
          </div>
          <div className="max-h-[25vh] overflow-y-auto space-y-2 custom-scrollbar">
            {historicoBuscado.length === 0 && <p className="text-slate-400 font-bold italic text-center py-2">Nenhum e-mail retornado nesse período.</p>}
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

      {/* PAINEL KANBAN ATUALIZADO */}
      <div className="flex flex-col md:flex-row gap-4 w-full">
        {renderColuna("Caixa de Entrada", "📥", "PENDENTE", "border-t-blue-500")}
        {renderColuna("Em Atendimento", "⏳", "LIDO", "border-t-amber-500")}
        {renderColuna("Acompanhamento (Bandeira)", "🚩", "BANDEIRA", "border-t-purple-600")}
      </div>

      <style dangerouslySetContent={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}} />
    </div>
  );
}