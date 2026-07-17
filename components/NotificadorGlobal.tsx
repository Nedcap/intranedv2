/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase"; 
import { simplificarNome } from "@/actions/dashboard-service";
import { useRouter } from "next/navigation";
import { MAPA_DE_ROTAS } from "@/lib/rotas"; 

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  icone: string;
  rotaPath: string; 
  lida: boolean;
  data: Date;
}

export default function NotificadorGlobal() {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [painelAberto, setPainelAberto] = useState(false);

  // =========================================================================
  // 🧠 CÉREBRO DO NOTIFICADOR GLOBAL: MAPA DE TABELAS x EVENTOS x ROTAS
  // =========================================================================
  const DICIONARIO_NOTIFICACOES: Record<string, { rota: string, icone: string, formatar: (payload: any) => { titulo: string, msg: string, empresaAlvo: string } | null }> = {
    
    analises: {
      rota: "/dashboard/motor-credito/analise",
      icone: "📋",
      formatar: (p) => {
        const statusNovo = p.new?.status;
        const statusAntigo = p.old?.status;
        if ((statusNovo === "aprovado" || statusNovo === "reprovado") && statusNovo !== statusAntigo && statusAntigo !== undefined) {
          return { 
            titulo: "⚖️ Parecer Concluído", 
            msg: `A empresa ${p.new.empresa_nome} teve o parecer definido como: ${statusNovo.toUpperCase()}.`, 
            empresaAlvo: p.new.empresa_nome 
          };
        }
        return null;
      }
    },

    votos: {
      rota: "/dashboard/comite",
      icone: "🗳️",
      formatar: (p) => {
        if (p.new.membro_nome === "Decisão") return null; 
        return { 
          titulo: "Novo Voto Registrado", 
          msg: `${p.new.membro_nome} votou na empresa ${p.new.empresa_nome}.`, 
          empresaAlvo: p.new.empresa_nome 
        };
      }
    },

    chat_comite: {
      rota: "/dashboard/comite",
      icone: "💬",
      formatar: (p) => ({ 
        titulo: `Chat: ${p.new.empresa_nome}`, 
        msg: `${p.new.usuario}: "${p.new.mensagem}"`, 
        empresaAlvo: p.new.empresa_nome 
      })
    },

    cadastro_cedentes: {
      rota: "/dashboard/cadastro",
      icone: "🏢",
      formatar: (p) => ({ 
        titulo: "Novo Cedente na Base", 
        msg: `A empresa ${p.new.cedente} foi adicionada à esteira.`, 
        empresaAlvo: p.new.cedente 
      })
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const dispararAvisoNativo = (titulo: string, mensagem: string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(titulo, { body: mensagem });
    }
  };

  useEffect(() => {
    async function inicializarEscutaSegura() {
      const userStr = localStorage.getItem("intraned_user");
      let allowedCedentes: string[] = [];
      let isComercial = false;

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
        
        if (cargoUser === "comercial") {
          isComercial = true;
          const { data: vinculos } = await supabase.from("cadastro_cedentes").select("cedente").eq("comercial", user.nome);
          if (vinculos) allowedCedentes = vinculos.map((c: any) => simplificarNome(c.cedente));
        }
      }

      // 🌐 Abre UM ÚNICO CANAL ouvindo o banco inteiro
      const canalGlobal = supabase
        .channel("notificador-realtime-global")
        .on("postgres_changes", { event: "*", schema: "public" }, (payload: any) => {
          
          const tabela = payload.table;
          const regra = DICIONARIO_NOTIFICACOES[tabela];
          
          if (!regra || payload.eventType === "DELETE") return;

          const resultado = regra.formatar(payload);
          if (!resultado) return;

          if (isComercial) {
            const empresaSimplificada = simplificarNome(resultado.empresaAlvo);
            if (!allowedCedentes.includes(empresaSimplificada)) return; 
          }

          const rotaValida = MAPA_DE_ROTAS.some(r => r.path === regra.rota) ? regra.rota : "/dashboard";

          dispararAvisoNativo(resultado.titulo, resultado.msg);

          const nova: Notificacao = {
            id: Math.random().toString(36).substring(2, 9),
            titulo: resultado.titulo,
            mensagem: resultado.msg,
            icone: regra.icone,
            rotaPath: rotaValida,
            lida: false,
            data: new Date(),
          };
          
          setNotificacoes((prev) => [nova, ...prev].slice(0, 50)); 
        })
        .subscribe();

      return canalGlobal;
    }

    let canalAtivo: any = null;
    inicializarEscutaSegura().then((channel) => {
      canalAtivo = channel;
    });

    return () => {
      if (canalAtivo) supabase.removeChannel(canalAtivo);
    };
  }, []);

  const naoLidas = useMemo(() => notificacoes.filter(n => !n.lida).length, [notificacoes]);

  const marcarTodasComoLidas = () => {
    setNotificacoes(notificacoes.map(n => ({ ...n, lida: true })));
  };

  const limparHistorico = () => {
    setNotificacoes([]);
    setPainelAberto(false);
  };

  const clicarNotificacao = (n: Notificacao) => {
    setNotificacoes(notificacoes.map(x => x.id === n.id ? { ...x, lida: true } : x));
    setPainelAberto(false);
    router.push(n.rotaPath);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">
      
      {/* 📋 PAINEL EXPANSÍVEL */}
      {painelAberto && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all transform origin-bottom-right animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              🔔 Alertas do Sistema
            </h3>
            <div className="flex gap-3 items-center">
              {naoLidas > 0 && (
                <button onClick={marcarTodasComoLidas} className="text-slate-300 hover:text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors">
                  Lidas
                </button>
              )}
              <button onClick={() => setPainelAberto(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer text-lg leading-none">
                ✕
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[400px] bg-slate-50 p-2 space-y-2 custom-scrollbar">
            {notificacoes.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-xs font-bold uppercase tracking-widest">📭 Nenhuma novidade.</p>
            ) : (
              notificacoes.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => clicarNotificacao(n)}
                  className={`p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all hover:bg-slate-100 ${n.lida ? 'bg-white opacity-70' : 'bg-blue-50/40 border-blue-200'}`}
                >
                  <div className="flex gap-3 items-start">
                    <span className="text-lg shrink-0 mt-0.5">{n.icone}</span>
                    <div className="flex flex-col flex-1">
                      <div className="flex justify-between items-start">
                        <span className={`font-bold text-[11px] uppercase tracking-tight ${n.lida ? 'text-slate-600' : 'text-blue-900'}`}>
                          {n.titulo}
                        </span>
                        {!n.lida && <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0" />}
                      </div>
                      <span className="text-xs text-slate-700 mt-1 leading-relaxed">{n.mensagem}</span>
                      <span className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
                        {n.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {notificacoes.length > 0 && (
            <div className="bg-white border-t border-slate-100 p-2 shrink-0">
              <button onClick={limparHistorico} className="w-full text-center text-[10px] text-slate-400 hover:text-rose-600 uppercase tracking-widest font-bold py-1.5 cursor-pointer transition-colors">
                Limpar Histórico
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🔵 BOTÃO FLUTUANTE (FAB) */}
      <button
        onClick={() => { setPainelAberto(!painelAberto); if (!painelAberto) marcarTodasComoLidas(); }}
        className="relative bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transform transition-transform hover:scale-105 active:scale-95 cursor-pointer border-4 border-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>

        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}