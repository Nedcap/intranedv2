/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  permissoes: Record<string, any>;
}

export default function GerenciarHierarquiaPage() {
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [hierarquiaLocal, setHierarquiaLocal] = useState<Record<string, string | null>>({});

  const carregarDadosHierarquia = async () => {
    try {
      setCarregando(true);
      const { data: dbUsuarios, error: errUsuarios } = await supabase
        .from("usuarios")
        .select("id, nome, email, cargo, permissoes")
        .order("nome", { ascending: true });

      if (errUsuarios) throw errUsuarios;
      
      if (dbUsuarios) {
        const mapeados = dbUsuarios.map(u => ({
          ...u,
          permissoes: typeof u.permissoes === 'object' && u.permissoes !== null ? u.permissoes : {}
        }));
        setUsuariosSistema(mapeados);

        const mapaRelacoes: Record<string, string | null> = {};
        mapeados.forEach(u => {
          mapaRelacoes[u.id] = u.permissoes?.lider_id || null;
        });
        setHierarquiaLocal(mapaRelacoes);
      }
    } catch (err: any) {
      alert(`❌ Erro ao carregar dados: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosHierarquia();
  }, []);

  const handleDragStart = (e: React.DragEvent, usuarioId: string) => {
    e.dataTransfer.setData("text/plain", usuarioId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, novoLiderId: string | null) => {
    e.preventDefault();
    const usuarioArrastadoId = e.dataTransfer.getData("text/plain");

    if (usuarioArrastadoId === novoLiderId) return;

    let verificador = novoLiderId;
    while (verificador) {
      if (verificador === usuarioArrastadoId) {
        alert("⛔ Operação inválida: Um líder não pode responder ao seu próprio subordinado!");
        return;
      }
      verificador = hierarquiaLocal[verificador] || null;
    }

    setHierarquiaLocal(prev => ({ ...prev, [usuarioArrastadoId]: novoLiderId }));
  };

  const removerDaArvore = (usuarioId: string) => {
    setHierarquiaLocal(prev => ({ ...prev, [usuarioId]: null }));
  };

  const salvarEstruturaHierarquia = async () => {
    try {
      setSalvando(true);
      for (const usuario of usuariosSistema) {
        const liderAtualLocal = hierarquiaLocal[usuario.id] || null;
        const liderNoBanco = usuario.permissoes?.lider_id || null;

        if (liderAtualLocal !== liderNoBanco) {
          const novasPermissoes = { ...usuario.permissoes };
          if (liderAtualLocal) {
            novasPermissoes.lider_id = liderAtualLocal;
          } else {
            delete novasPermissoes.lider_id;
          }

          const { error } = await supabase
            .from("usuarios")
            .update({ permissoes: novasPermissoes })
            .eq("id", usuario.id);

          if (error) throw error;
        }
      }
      alert("🎉 Matriz hierárquica salva com sucesso!");
      await carregarDadosHierarquia();
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // 🌲 RAMOS DO ORGANOGRAMA
  const RenderizarFilhosOrganograma = ({ liderId }: { liderId: string | null }) => {
    const filhos = usuariosSistema.filter(u => hierarquiaLocal[u.id] === liderId);
    if (filhos.length === 0) return null;

    return (
      <div className="flex justify-center items-start gap-x-10 pt-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-300"></div>

        {filhos.map((sub, idx) => {
          const temFilhos = usuariosSistema.some(u => hierarquiaLocal[u.id] === sub.id);
          return (
            <div 
              key={sub.id} 
              className="relative flex flex-col items-center shrink-0"
              style={{
                backgroundImage: `linear-gradient(to right, ${idx === 0 ? 'transparent' : '#cbd5e1'} 50%, ${idx === filhos.length - 1 ? 'transparent' : '#cbd5e1'} 50%)`,
                backgroundPosition: 'top',
                backgroundSize: '100% 2px',
                backgroundRepeat: 'no-repeat',
                paddingTop: '16px'
              }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-300"></div>

              {/* CARD EXPANDIDO DENTRO DA ÁRVORE */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, sub.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, sub.id)}
                className="relative flex flex-col w-[240px] bg-white border-2 border-slate-200 p-4 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left z-10 cursor-grab active:cursor-grabbing group"
              >
                {/* Botão de ejeção rápida para remover da hierarquia */}
                <button 
                  onClick={() => removerDaArvore(sub.id)}
                  className="absolute -top-2 -right-2 h-5 w-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remover vínculo de equipe"
                >
                  ✕
                </button>

                <div className="flex items-center gap-2.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center font-black text-[9px] uppercase ${
                    sub.cargo === 'Master' || sub.cargo === 'Diretor' ? 'bg-slate-900 text-white' :
                    sub.cargo === 'Gerente' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {sub.nome.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 text-[11px] uppercase truncate tracking-tight">{sub.nome}</h3>
                    <p className="text-[9px] text-slate-400 font-medium truncate leading-tight">{sub.email}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                  <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider">NED CAPITAL</span>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight ${
                    sub.cargo === 'Master' || sub.cargo === 'Diretor' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                    sub.cargo === 'Gerente' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {sub.cargo || "Comercial"}
                  </span>
                </div>

                {temFilhos && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-300 translate-y-full"></div>
                )}
              </div>

              <RenderizarFilhosOrganograma liderId={sub.id} />
            </div>
          );
        })}
      </div>
    );
  };

  const raizesDaArvore = usuariosSistema.filter(u => !hierarquiaLocal[u.id]);

  // Lista os usuários que ainda estão "soltos" na gaveta de reservas
  const usuariosLivresParaArraste = usuariosSistema.filter(u => hierarquiaLocal[u.id] === null);

  return (
    <div className="p-6 space-y-6 font-sans bg-slate-50 min-h-screen text-[12px] flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4 shrink-0">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🌲 Modelador de Alçadas & Organograma</h1>
          <p className="text-xs text-slate-400">Arraste os colaboradores da gaveta esquerda para dentro do painel central para criar a teia de subordinação.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarDadosHierarquia} disabled={carregando || salvando} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 font-bold uppercase text-[10px] rounded-lg tracking-wider transition-all">
            🔄 Limpar Alterações
          </button>
          <button onClick={salvarEstruturaHierarquia} disabled={carregando || salvando} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-md transition-all">
            {salvando ? "⏳ Atualizando..." : "💾 Salvar Árvore"}
          </button>
        </div>
      </div>

      {/* WORKSPACE DIVIDIDO */}
      <div className="flex-1 flex gap-6 overflow-hidden w-full h-full items-stretch">
        
        {/* LADO ESQUERDO: GAVETA COM CARDS INICIAIS MICRO */}
        <div className="w-[260px] bg-slate-900 text-white p-4 rounded-2xl flex flex-col shadow-xl shrink-0 border border-slate-800">
          <div className="border-b border-slate-800 pb-2 mb-3">
            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block">👤 Colaboradores Soltos</span>
            <span className="text-slate-500 text-[10px] block mt-0.5 leading-tight">Pegue e arraste daqui para dentro do organograma.</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {usuariosLivresParaArraste.map(user => (
              <div
                key={user.id}
                draggable
                onDragStart={(e) => handleDragStart(e, user.id)}
                className="flex items-center justify-between p-2 bg-slate-800 border border-slate-700/60 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-500 transition-all select-none hover:bg-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-5 w-5 rounded-full bg-slate-900 text-slate-300 flex items-center justify-center text-[8px] font-bold uppercase shrink-0">
                    {user.nome.substring(0, 2)}
                  </div>
                  <span className="font-bold text-slate-200 uppercase tracking-tight text-[11px] truncate">{user.nome}</span>
                </div>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono shrink-0">
                  {user.cargo || "Comercial"}
                </span>
              </div>
            ))}

            {usuariosLivresParaArraste.length === 0 && (
              <p className="text-slate-600 italic text-center text-[11px] pt-12">Todos os colaboradores já foram organizados na árvore.</p>
            )}
          </div>
        </div>

        {/* LADO DIREITO: ZONA DE CONSTRUÇÃO DO ORGANOGRAMA */}
        <div 
          className="flex-1 bg-white border border-slate-200 rounded-2xl p-8 overflow-auto shadow-inner relative flex flex-col"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)} // Soltar no fundo lança ele de volta como Raiz
        >
          <div className="text-left mb-6 border-b border-slate-100 pb-3 shrink-0 flex justify-between items-center">
            <div>
              <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block mb-0.5">👑 Quadro Diretivo / Raízes Ativas</span>
              <span className="text-slate-400 text-[11px]">Solte os cartões aqui para criar líderes absolutos, ou arraste um para dentro do outro para vincular.</span>
            </div>
          </div>

          <div className="flex justify-center items-start gap-x-12 pt-4 m-auto w-max min-w-full">
            {raizesDaArvore.map((root) => {
              const temFilhos = usuariosSistema.some(u => hierarquiaLocal[u.id] === root.id);
              return (
                <div key={root.id} className="flex flex-col items-center relative text-center">
                  
                  {/* CARD PRINCIPAL EXPANDIDO */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, root.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, root.id)}
                    className="relative flex flex-col w-[240px] bg-white border-2 border-slate-300 p-3.5 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-md transition-all text-left z-10 group"
                  >
                    <button 
                      onClick={() => removerDaArvore(root.id)}
                      className="absolute -top-2 -right-2 h-5 w-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      ✕
                    </button>

                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[9px] uppercase">
                        {root.nome.substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900 text-[11px] uppercase truncate tracking-tight">{root.nome}</h3>
                        <p className="text-[9px] text-slate-400 font-medium truncate leading-tight">{root.email}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider">NED CAPITAL</span>
                      <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-purple-900 text-white">
                        {root.cargo || "Diretor"}
                      </span>
                    </div>

                    {temFilhos && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-300 translate-y-full"></div>
                    )}
                  </div>

                  <RenderizarFilhosOrganograma liderId={root.id} />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}