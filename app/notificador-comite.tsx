/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
// 🛡️ Caminho relativo saindo de 'app' e indo para 'lib'
import { supabase } from "../lib/supabase"; 

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "analise" | "voto" | "chat";
  lida: boolean;
  data: Date;
}

export default function NotificadorComite() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [painelAberto, setPainelAberto] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const adicionarNotificacao = (titulo: string, mensagem: string, tipo: "analise" | "voto" | "chat") => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(titulo, { body: mensagem });
    }

    const nova: Notificacao = {
      id: Math.random().toString(36).substring(2, 9),
      titulo,
      mensagem,
      tipo,
      lida: false,
      data: new Date(),
    };
    
    setNotificacoes((prev) => [nova, ...prev]);
  };

  useEffect(() => {
    const canalComiteGlobal = supabase
      .channel("comite-realtime-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "analises" }, (payload: any) => {
        adicionarNotificacao("📋 Nova Análise", `A empresa ${payload.new.empresa_nome} chegou no comitê.`, "analise");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votos" }, (payload: any) => {
        if (payload.new.membro_nome !== "Decisão") {
          adicionarNotificacao("🗳️ Novo Voto", `${payload.new.membro_nome} votou em ${payload.new.empresa_nome}.`, "voto");
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_comite" }, (payload: any) => {
        adicionarNotificacao(`💬 Chat: ${payload.new.empresa_nome}`, `${payload.new.usuario}: "${payload.new.mensagem}"`, "chat");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalComiteGlobal);
    };
  }, []);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const marcarTodasComoLidas = () => {
    setNotificacoes(notificacoes.map(n => ({ ...n, lida: true })));
  };

  const limparHistorico = () => {
    setNotificacoes([]);
    setPainelAberto(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {painelAberto && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all transform origin-bottom-right">
          <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
            <h3 className="text-white font-bold text-sm">🔔 Atualizações</h3>
            <div className="flex gap-3">
              {naoLidas > 0 && (
                <button onClick={marcarTodasComoLidas} className="text-slate-300 hover:text-white text-xs font-medium cursor-pointer">
                  Marcar lidas
                </button>
              )}
              <button onClick={() => setPainelAberto(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[400px] bg-slate-50 p-2 space-y-2">
            {notificacoes.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-xs font-medium">Nenhuma novidade por enquanto.</p>
            ) : (
              notificacoes.map((n) => {
                let corBorda = "border-blue-500 bg-blue-50";
                let icone = "📋";
                if (n.tipo === "voto") { corBorda = "border-emerald-500 bg-emerald-50"; icone = "🗳️"; }
                else if (n.tipo === "chat") { corBorda = "border-amber-500 bg-amber-50"; icone = "💬"; }

                return (
                  <div key={n.id} className={`p-3 rounded-xl border ${corBorda} ${n.lida ? 'opacity-60' : 'shadow-sm'}`}>
                    <div className="flex gap-2 items-start">
                      <span className="text-lg">{icone}</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-[11px] uppercase tracking-tight">
                          {n.titulo}
                          {!n.lida && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                        </span>
                        <span className="text-xs text-slate-700 mt-0.5 leading-relaxed">{n.mensagem}</span>
                        <span className="text-[9px] text-slate-400 mt-1 font-medium">
                          {n.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {notificacoes.length > 0 && (
            <div className="bg-white border-t border-slate-100 p-2 shrink-0">
              <button onClick={limparHistorico} className="w-full text-center text-xs text-slate-500 hover:text-red-600 font-bold py-1 cursor-pointer">
                Limpar Histórico
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => { setPainelAberto(!painelAberto); if (!painelAberto) marcarTodasComoLidas(); }}
        className="relative bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transform transition-transform hover:scale-105 active:scale-95 cursor-pointer border-4 border-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>

        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">
            {naoLidas}
          </span>
        )}
      </button>
    </div>
  );
}