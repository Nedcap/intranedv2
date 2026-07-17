/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { MAPA_DE_ROTAS } from "@/lib/rotas";
import { useRouter } from "next/navigation";

// Define a estrutura de uma notificação na tela
interface NotificacaoItem {
  id: string;
  tabela: string;
  rotaPath: string;
  icone: string;
  titulo: string;
  mensagem: string;
  data: Date;
  lida: boolean;
}

export default function NotificadorGlobal() {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  // =========================================================================
  // 🧠 O CÉREBRO DO NOTIFICADOR: MAPA DE TABELAS PARA ROTAS
  // =========================================================================
  // Aqui você diz: "Se a tabela X sofrer um INSERT, isso pertence à rota Y"
  const DICIONARIO_NOTIFICACOES: Record<string, { rota: string, formatar: (payload: any) => { titulo: string, msg: string } }> = {
    
    // Alertas do Comitê (Crédito)
    votos: {
      rota: "/dashboard/comite",
      formatar: (d) => ({
        titulo: "Novo Voto no Comitê",
        msg: `${d.membro_nome} votou [${d.voto}] na empresa ${d.empresa_nome}.`
      })
    },
    chat_comite: {
      rota: "/dashboard/comite",
      formatar: (d) => ({
        titulo: "Nova Mensagem na Mesa",
        msg: `${d.usuario} comentou em ${d.empresa_nome}: "${d.mensagem.substring(0, 30)}..."`
      })
    },

    // Alertas do Motor de Crédito
    analises: {
      rota: "/dashboard/motor-credito/analise",
      formatar: (d) => ({
        titulo: "Movimentação na Esteira",
        msg: `A análise de ${d.empresa_nome} mudou para o status: ${d.status}.`
      })
    },

    // Alertas de Cadastro
    cadastro_cedentes: {
      rota: "/dashboard/cadastro",
      formatar: (d) => ({
        titulo: "Novo Cedente Cadastrado",
        msg: `O cedente ${d.cedente} foi adicionado à base.`
      })
    }
    // Adicione mais tabelas aqui conforme o sistema cresce!
  };

  useEffect(() => {
    // 1. Pega o usuário logado para sabermos o perfil dele
    const userStr = localStorage.getItem("intraned_user");
    if (userStr) {
      setUsuarioLogado(JSON.parse(userStr));
    }

    // 2. Abre UM ÚNICO CANAL GLOBAL no Supabase para ouvir todas as tabelas
    const canalGlobal = supabase
      .channel("canal-global-notificacoes")
      .on("postgres_changes", { event: "INSERT", schema: "public" }, (payload) => {
        processarEventoGlobal(payload);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "analises" }, (payload) => {
        // Exemplo: ouvindo UPDATEs específicos apenas na tabela de análises
        processarEventoGlobal(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalGlobal);
    };
  }, []);

  const processarEventoGlobal = (payload: any) => {
    const tabela = payload.table;
    const dados = payload.new;

    // Se a tabela não está no nosso dicionário, ignoramos
    if (!DICIONARIO_NOTIFICACOES[tabela]) return;

    const configRegra = DICIONARIO_NOTIFICACOES[tabela];
    
    // Puxa as informações da rota cruzando com seu arquivo rotas.tsx
    const infoRota = MAPA_DE_ROTAS.find(r => r.path === configRegra.rota);
    if (!infoRota) return;

    // 🔥 FILTRO DE PERMISSÃO:
    // Aqui você pode colocar a lógica para não notificar o usuário se ele não tiver acesso à rota.
    // Exemplo: Se a rota não for defaultMaster e ele não for master, não notifica.
    // (Para simplificar, assumimos que todos recebem se estiver mapeado, mas a trava fica aqui).

    const { titulo, msg } = configRegra.formatar(dados);

    const novaNotificacao: NotificacaoItem = {
      id: `${tabela}-${dados.id || Date.now()}`,
      tabela,
      rotaPath: configRegra.rota,
      icone: infoRota.icone,
      titulo,
      mensagem: msg,
      data: new Date(),
      lida: false
    };

    // Toca um sonzinho rápido (Opcional - coloque um arquivo audio.mp3 na pasta /public)
    // const audio = new Audio('/notification.mp3');
    // audio.play().catch(e => console.log('Áudio bloqueado pelo navegador', e));

    setNotificacoes(prev => [novaNotificacao, ...prev].slice(0, 50)); // Mantém as últimas 50
  };

  const notificacoesNaoLidas = useMemo(() => notificacoes.filter(n => !n.lida).length, [notificacoes]);

  const marcarComoLida = (id: string) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const clicarNotificacao = (n: NotificacaoItem) => {
    marcarComoLida(n.id);
    setIsOpen(false);
    router.push(n.rotaPath);
  };

  const limparTudo = () => {
    setNotificacoes([]);
    setIsOpen(false);
  };

  return (
    <div className="relative z-[100] font-sans">
      {/* SINO DE NOTIFICAÇÃO */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600 transition-all focus:outline-none"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {notificacoesNaoLidas > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-bounce">
            {notificacoesNaoLidas > 99 ? '99+' : notificacoesNaoLidas}
          </span>
        )}
      </button>

      {/* DROPDOWN DE NOTIFICAÇÕES */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-extrabold text-slate-800 text-sm tracking-wide flex items-center gap-2">
              🔔 Alertas do Sistema
            </h3>
            {notificacoes.length > 0 && (
              <button onClick={limparTudo} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 uppercase tracking-widest transition-colors">
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notificacoes.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-3xl opacity-50">📭</span>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nenhuma notificação nova</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notificacoes.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => clicarNotificacao(n)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3 ${n.lida ? 'opacity-60' : 'bg-blue-50/30'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-lg shrink-0">
                      {n.icone}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className={`text-xs truncate uppercase tracking-wider ${n.lida ? 'text-slate-500 font-bold' : 'text-slate-900 font-black'}`}>
                          {n.titulo}
                        </p>
                        {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1"></span>}
                      </div>
                      <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                        {n.mensagem}
                      </p>
                      <span className="text-[9px] text-slate-400 font-bold mt-2 block uppercase">
                        {n.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* LInk rápido para a central */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest cursor-pointer hover:underline">
              Visualizar Central de Alertas →
            </span>
          </div>
        </div>
      )}
    </div>
  );
}