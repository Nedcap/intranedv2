/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  permissoes: Record<string, any>;
}

export default function GerenciarHierarquiaPage() {
  const [mounted, setMounted] = useState(false);
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // Mapa id_usuario (subordinado) -> Array de lider_ids
  const [hierarquiaLocal, setHierarquiaLocal] = useState<Record<string, string[]>>({});
  const [usuariosSelecionadosIds, setUsuariosSelecionadosId] = useState<string[]>([]);

  // Evita erro de SSR (Hydration) com o ReactFlow
  useEffect(() => {
    setMounted(true);
    carregarDadosHierarquia();
  }, []);

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

        const mapaRelacoes: Record<string, string[]> = {};
        mapeados.forEach(u => {
          const lideres = u.permissoes?.lider_ids || (u.permissoes?.lider_id ? [u.permissoes.lider_id] : []);
          mapaRelacoes[u.id] = Array.isArray(lideres) ? lideres : [lideres];
        });
        setHierarquiaLocal(mapaRelacoes);
      }
    } catch (err: any) {
      alert(`❌ Erro ao carregar dados: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const alternarSelecaoUsuario = (id: string) => {
    setUsuariosSelecionadosId(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const vincularLoteAoLider = (liderId: string | null) => {
    if (usuariosSelecionadosIds.length === 0) return;

    setHierarquiaLocal(prev => {
      const copia = { ...prev };
      usuariosSelecionadosIds.forEach(subId => {
        if (subId === liderId) return; // Impede que o cara seja líder dele mesmo
        if (liderId === null) {
          copia[subId] = []; // Solta pro topo
          return;
        }
        const lideresAtuais = copia[subId] || [];
        if (!lideresAtuais.includes(liderId)) {
          copia[subId] = [...lideresAtuais, liderId];
        }
      });
      return copia;
    });
    setUsuariosSelecionadosId([]);
  };

  const limparTodosVinculosCard = (id: string) => {
    setHierarquiaLocal(prev => ({ ...prev, [id]: [] }));
  };

  const salvarEstruturaHierarquia = async () => {
    try {
      setSalvando(true);
      for (const usuario of usuariosSistema) {
        const lideresLocais = hierarquiaLocal[usuario.id] || [];
        const novasPermissoes = { ...usuario.permissoes };
        novasPermissoes.lider_ids = lideresLocais;
        if (novasPermissoes.lider_id) delete novasPermissoes.lider_id; // Limpa o formato legado

        const { error } = await supabase
          .from("usuarios")
          .update({ permissoes: novasPermissoes })
          .eq("id", usuario.id);

        if (error) throw error;
      }
      alert("🎉 Organograma gravado e regras de visibilidade aplicadas!");
      await carregarDadosHierarquia();
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // 🧮 ALGORITMO DE POSICIONAMENTO BLINDADO
  const { nodes, edges } = useMemo(() => {
    const nodesList: any[] = [];
    const edgesList: any[] = [];

    const niveis: Record<string, number> = {};
    const visitando = new Set<string>();

    const calcularNivel = (id: string): number => {
      if (niveis[id] !== undefined) return niveis[id];
      // 🛡️ Proteção contra LOOP INFINITO (A lidera B que lidera A)
      if (visitando.has(id)) return 0; 
      
      visitando.add(id);
      const pais = hierarquiaLocal[id] || [];
      if (pais.length === 0) {
        niveis[id] = 0;
        visitando.delete(id);
        return 0;
      }
      const niveisPais = pais.map(pId => calcularNivel(pId) + 1);
      const maxNivel = Math.max(...niveisPais);
      niveis[id] = maxNivel;
      visitando.delete(id);
      return maxNivel;
    };

    usuariosSistema.forEach(u => calcularNivel(u.id));

    const usuariosPorNivel: Record<number, string[]> = {};
    usuariosSistema.forEach(u => {
      const nv = niveis[u.id] || 0;
      if (!usuariosPorNivel[nv]) usuariosPorNivel[nv] = [];
      usuariosPorNivel[nv].push(u.id);
    });

    usuariosSistema.forEach(u => {
      const nv = niveis[u.id] || 0;
      const indexNoNivel = usuariosPorNivel[nv].indexOf(u.id);
      const totalNoNivel = usuariosPorNivel[nv].length;

      const posX = (indexNoNivel - (totalNoNivel - 1) / 2) * 280 + 350;
      const posY = nv * 180 + 40;

      const selecionado = usuariosSelecionadosIds.includes(u.id);

      nodesList.push({
        id: u.id,
        position: { x: posX, y: posY },
        data: {
          label: (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (usuariosSelecionadosIds.length > 0) {
                  vincularLoteAoLider(u.id); // Se tem alguém selecionado na gaveta, vincula
                } else {
                  alternarSelecaoUsuario(u.id); // Senão, seleciona ele mesmo
                }
              }}
              className={`flex flex-col w-[230px] bg-white border-2 p-3.5 rounded-2xl text-left shadow-xs transition-all cursor-pointer ${
                selecionado ? "border-blue-600 ring-4 ring-blue-100 bg-blue-50/10" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[9px] uppercase">
                  {u.nome.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-[11px] uppercase truncate">{u.nome}</h3>
                  <p className="text-[9px] text-slate-400 truncate leading-none mt-0.5">{u.email}</p>
                </div>
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                <button 
                  onClick={(e) => { e.stopPropagation(); limparTodosVinculosCard(u.id); }}
                  className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase transition-colors bg-transparent border-0 cursor-pointer"
                >
                  ✕ Soltar
                </button>
                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-700">
                  {u.cargo || "Membro"}
                </span>
              </div>
            </div>
          )
        },
        style: { background: "transparent", border: "none", padding: 0 },
      });

      const pais = hierarquiaLocal[u.id] || [];
      pais.forEach(pId => {
        edgesList.push({
          id: `edge-${pId}-${u.id}`,
          source: pId,
          target: u.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#94a3b8", strokeWidth: 2 },
        });
      });
    });

    return { nodes: nodesList, edges: edgesList };
  }, [usuariosSistema, hierarquiaLocal, usuariosSelecionadosIds]);

  const usuariosLivresParaArraste = usuariosSistema.filter(u => (hierarquiaLocal[u.id] || []).length === 0);

  if (!mounted) return <div className="p-8 text-center animate-pulse text-slate-400">Preparando tela interativa...</div>;

  return (
    <div className="p-6 space-y-6 font-sans bg-slate-50 min-h-screen text-[12px] flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4 shrink-0">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🌲 Central de Alçadas em Rede Interativa</h1>
          <p className="text-xs text-slate-400">Selecione colaboradores na gaveta esquerda e clique em qualquer card do canvas central para criar múltiplos vínculos diretos.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarDadosHierarquia} disabled={carregando || salvando} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 font-bold uppercase text-[10px] rounded-lg tracking-wider transition-all">
            🔄 Descartar
          </button>
          <button onClick={salvarEstruturaHierarquia} disabled={carregando || salvando} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-md transition-all cursor-pointer">
            {salvando ? "⏳ Gravando..." : "📤 Salvar Organograma"}
          </button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 flex gap-6 overflow-hidden w-full h-full items-stretch">
        
        {/* GAVETA ESQUERDA */}
        <div className="w-[260px] bg-slate-900 text-white p-4 rounded-2xl flex flex-col shadow-xl shrink-0 border border-slate-800">
          <div className="border-b border-slate-800 pb-2 mb-3">
            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block">👤 Tops de Linha / Soltos ({usuariosLivresParaArraste.length})</span>
            <span className="text-slate-500 text-[10px] block mt-0.5 leading-tight">Selecione aqui e clique num líder ao lado para vincular.</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {usuariosLivresParaArraste.map(user => {
              const selecionado = usuariosSelecionadosIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => alternarSelecaoUsuario(user.id)}
                  className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-all select-none ${
                    selecionado 
                      ? "bg-blue-600 border-blue-400 font-bold ring-2 ring-blue-500/20 text-white" 
                      : "bg-slate-800 border-slate-700/60 text-slate-200 hover:border-slate-500"
                  }`}
                >
                  <span className="font-bold uppercase tracking-tight text-[11px] truncate" title={user.nome}>{user.nome}</span>
                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono">
                    {user.cargo || "Comercial"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CANVAS PRINCIPAL */}
        <div 
          className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-inner relative overflow-hidden flex flex-col h-full cursor-grab active:cursor-grabbing"
          onClick={() => { if (usuariosSelecionadosIds.length > 0) vincularLoteAoLider(null); }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesConnectable={false}
            nodesDraggable={true}
            minZoom={0.2}
            maxZoom={1.5}
          >
            <Background color="#cbd5e1" gap={16} size={1} />
            <Controls className="bg-white border border-slate-200 rounded-lg shadow-sm p-1" />
          </ReactFlow>
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