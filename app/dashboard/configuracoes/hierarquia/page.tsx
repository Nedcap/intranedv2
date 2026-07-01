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
  
  // Mapa de relações local id_usuario -> lider_id
  const [hierarquiaLocal, setHierarquiaLocal] = useState<Record<string, string | null>>({});
  
  // Estado que guarda o usuário selecionado para ser movido
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState<string | null>(null);

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

  const selecionarParaMover = (id: string) => {
    if (usuarioSelecionadoId === id) {
      setUsuarioSelecionadoId(null);
    } else {
      setUsuarioSelecionadoId(id);
    }
  };

  const executarMovimentacao = (novoLiderId: string | null) => {
    if (!usuarioSelecionadoId) return;
    if (usuarioSelecionadoId === novoLiderId) {
      setUsuarioSelecionadoId(null);
      return;
    }

    // Validador de loop infinito na árvore (Grafo sem circularidade)
    let verificador = novoLiderId;
    while (verificador) {
      if (verificador === usuarioSelecionadoId) {
        alert("⛔ Operação inválida: Um líder não pode ser subordinado de alguém que já responde a ele!");
        setUsuarioSelecionadoId(null);
        return;
      }
      verificador = hierarquiaLocal[verificador] || null;
    }

    setHierarquiaLocal(prev => ({
      ...prev,
      [usuarioSelecionadoId]: novoLiderId
    }));
    setUsuarioSelecionadoId(null);
  };

  const desvincularUsuario = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHierarquiaLocal(prev => ({ ...prev, [id]: null }));
    if (usuarioSelecionadoId === id) setUsuarioSelecionadoId(null);
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
      alert("🎉 Organograma salvo com sucesso!");
      await carregarDadosHierarquia();
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // 🌲 GERADOR RECURSIVO INFINITO DE RAMIFICAÇÕES (Corrigido e alinhado)
  const RenderizarFilhosOrganograma = ({ liderId }: { liderId: string | null }) => {
    const filhos = usuariosSistema.filter(u => hierarquiaLocal[u.id] === liderId);
    if (filhos.length === 0) return null;

    return (
      <div className="flex justify-center items-start gap-x-8 pt-8 relative w-full">
        {/* Linha vertical que desce do pai para conectar com os filhos */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-200"></div>

        {filhos.map((sub, idx) => {
          const temFilhos = usuariosSistema.some(u => hierarquiaLocal[u.id] === sub.id);
          const estaSelecionado = usuarioSelecionadoId === sub.id;

          return (
            <div 
              key={sub.id} 
              className="relative flex flex-col items-center shrink-0"
              style={{
                backgroundImage: `linear-gradient(to right, ${idx === 0 ? 'transparent' : '#e2e8f0'} 50%, ${idx === filhos.length - 1 ? 'transparent' : '#e2e8f0'} 50%)`,
                backgroundPosition: 'top',
                backgroundSize: '100% 2px',
                backgroundRepeat: 'no-repeat',
                paddingTop: '16px'
              }}
            >
              {/* Linha vertical curta no topo de cada filho */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-200"></div>

              {/* CARD DE SUBORDINADO (PERMITE SUBORDINAÇÃO INFINITA AGORA) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (usuarioSelecionadoId) {
                    executarMovimentacao(sub.id); // Aloca quem está selecionado abaixo de mim
                  } else {
                    selecionarParaMover(sub.id); // Me seleciona para eu ser movido
                  }
                }}
                className={`relative flex flex-col w-[230px] bg-white border-2 p-3.5 rounded-2xl shadow-xs transition-all text-left z-10 cursor-pointer select-none ${
                  estaSelecionado ? "border-blue-600 ring-4 ring-blue-100 animate-pulse bg-blue-50/10" : "border-slate-200 hover:border-slate-400 hover:shadow-md"
                }`}
              >
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
                  <button 
                    onClick={(e) => desvincularUsuario(e, sub.id)}
                    className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase transition-colors"
                  >
                    ✕ Soltar Card
                  </button>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight ${
                    sub.cargo === 'Master' || sub.cargo === 'Diretor' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                    sub.cargo === 'Gerente' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {sub.cargo || "Operacional"}
                  </span>
                </div>

                {/* Se eu tiver filhos, puxo a linha vertical contínua para baixo */}
                {temFilhos && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-200 translate-y-full"></div>
                )}
              </div>

              {/* 🔄 CHAMADA RECURSIVA CHAVE: Permite que este filho também seja pai de outra camada abaixo dele */}
              <RenderizarFilhosOrganograma liderId={sub.id} />
            </div>
          );
        })}
      </div>
    );
  };

  const raizesDaArvore = usuariosSistema.filter(u => !hierarquiaLocal[u.id]);
  const usuariosLivresParaArraste = usuariosSistema.filter(u => hierarquiaLocal[u.id] === null);

  return (
    <div className="p-6 space-y-6 font-sans bg-slate-50 min-h-screen text-[12px] flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4 shrink-0">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🌲 Central de Hierarquias & Estrutura</h1>
          <p className="text-xs text-slate-400">Clique em um colaborador na lista da esquerda e depois clique em cima do líder desejado na árvore no centro.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarDadosHierarquia} disabled={carregando || salvando} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 font-bold uppercase text-[10px] rounded-lg tracking-wider transition-all">
            🔄 Descartar Alterações
          </button>
          <button onClick={salvarEstruturaHierarquia} disabled={carregando || salvando} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-md transition-all">
            {salvando ? "⏳ Gravando..." : "📤 Salvar Organograma"}
          </button>
        </div>
      </div>

      {/* WORKSPACE HIERÁRQUICO */}
      <div className="flex-1 flex gap-6 overflow-hidden w-full h-full items-stretch">
        
        {/* LADO ESQUERDO: BANCO DE RESERVAS DISPONÍVEIS */}
        <div className="w-[260px] bg-slate-900 text-white p-4 rounded-2xl flex flex-col shadow-xl shrink-0 border border-slate-800">
          <div className="border-b border-slate-800 pb-2 mb-3">
            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block">👤 Colaboradores Livres</span>
            <span className="text-slate-500 text-[10px] block mt-0.5 leading-tight">Clique para selecionar e depois clique em um card na árvore.</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {usuariosLivresParaArraste.map(user => {
              const selecionado = usuarioSelecionadoId === user.id;
              return (
                <div
                  key={user.id}
                  onClick={() => selecionarParaMover(user.id)}
                  className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-all select-none ${
                    selecionado 
                      ? "bg-blue-600 border-blue-400 font-bold ring-2 ring-blue-500/20 text-white animate-pulse" 
                      : "bg-slate-800 border-slate-700/60 text-slate-200 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-5 w-5 rounded-full bg-slate-950 text-slate-300 flex items-center justify-center text-[8px] font-bold uppercase shrink-0">
                      {user.nome.substring(0, 2)}
                    </div>
                    <span className="font-bold uppercase tracking-tight text-[11px] truncate">{user.nome}</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono shrink-0 ${selecionado ? 'bg-blue-800 text-white' : 'bg-slate-950 text-slate-400'}`}>
                    {user.cargo || "Comercial"}
                  </span>
                </div>
              );
            })}

            {usuariosLivresParaArraste.length === 0 && (
              <p className="text-slate-600 italic text-center text-[11px] pt-12">Todos organizados na árvore.</p>
            )}
          </div>
        </div>

        {/* LADO DIREITO: GRID INTERATIVO DO ORGANOGRAMA */}
        <div 
          className="flex-1 bg-white border border-slate-200 rounded-2xl p-8 overflow-auto shadow-inner relative flex flex-col"
          onClick={() => {
            if (usuarioSelecionadoId) executarMovimentacao(null);
          }}
        >
          <div className="text-left mb-6 border-b border-slate-100 pb-3 shrink-0">
            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block mb-1">👑 Linha Superior Corporativa / Direção</span>
            <span className="text-slate-400 text-[11px]">Clique em um colaborador na gaveta e depois **clique no fundo branco** daqui para torná-lo um Líder Absoluto da Ned Capital.</span>
          </div>

          {/* CONTÊINER COM AS LINHAS HORIZONTAIS */}
          <div className="flex justify-center items-start gap-x-12 pt-4 m-auto w-max min-w-full">
            {raizesDaArvore.map((root) => {
              const temFilhos = usuariosSistema.some(u => hierarquiaLocal[u.id] === root.id);
              const estaSelecionado = usuarioSelecionadoId === root.id;

              return (
                <div key={root.id} className="flex flex-col items-center relative text-center">
                  
                  {/* CARD RAIZ PRINCIPAL */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (usuarioSelecionadoId) {
                        executarMovimentacao(root.id);
                      } else {
                        selecionarParaMover(root.id);
                      }
                    }}
                    className={`relative flex flex-col w-[230px] bg-white border-2 p-3.5 rounded-2xl shadow-sm transition-all text-left z-10 cursor-pointer ${
                      estaSelecionado ? "border-blue-600 ring-4 ring-blue-100 animate-pulse bg-blue-50/10" : "border-slate-300 hover:border-slate-500"
                    }`}
                  >
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
                      <button 
                        onClick={(e) => desvincularUsuario(e, root.id)}
                        className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase transition-colors"
                      >
                        ✕ Soltar Card
                      </button>
                      <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-purple-900 text-white">
                        {root.cargo || "Diretor"}
                      </span>
                    </div>

                    {temFilhos && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-200 translate-y-full"></div>
                    )}
                  </div>

                  {/* 🔄 Renderiza os subordinados diretos e ativa a cascata recursiva infinita para as próximas subcamadas */}
                  <RenderizarFilhosOrganograma liderId={root.id} />
                </div>
              );
            })}

            {usuariosSistema.length === 0 && !carregando && (
              <p className="text-slate-400 italic text-center py-20 m-auto">Nenhum operador localizado no sistema.</p>
            )}
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