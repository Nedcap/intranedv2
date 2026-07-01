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

  // Estado local para manipular a árvore antes de salvar no banco de dados
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

        // Monta o mapa de relações local id_usuario -> lider_id
        const mapaRelacoes: Record<string, string | null> = {};
        mapeados.forEach(u => {
          mapaRelacoes[u.id] = u.permissoes?.lider_id || null;
        });
        setHierarquiaLocal(mapaRelacoes);
      }
    } catch (err: any) {
      alert(`❌ Erro ao carregar dados do sistema: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosHierarquia();
  }, []);

  // 🎛️ GERENCIADORES DE DRAG AND DROP NATIVO
  const handleDragStart = (e: React.DragEvent, usuarioId: string) => {
    e.dataTransfer.setData("text/plain", usuarioId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleDrop = (e: React.DragEvent, novoLiderId: string | null) => {
    e.preventDefault();
    const usuarioArrastadoId = e.dataTransfer.getData("text/plain");

    // Evita loop infinito (fazer um usuário ser líder dele mesmo)
    if (usuarioArrastadoId === novoLiderId) return;

    // Evita loops hierárquicos descendentes simples
    let verificador = novoLiderId;
    while (verificador) {
      if (verificador === usuarioArrastadoId) {
        alert("⛔ Operação inválida: Um líder não pode ser subordinado do seu próprio subordinado!");
        return;
      }
      verificador = hierarquiaLocal[verificador] || null;
    }

    // Atualiza o estado da árvore localmente
    setHierarquiaLocal(prev => ({
      ...prev,
      [usuarioArrastadoId]: novoLiderId
    }));
  };

  // 💾 SALVAR ALTERAÇÕES EM MASSA NO SUPABASE
  const salvarEstruturaHierarquia = async () => {
    try {
      setSalvando(true);

      // Percorre todos os usuários disparando as atualizações no banco de dados
      for (const usuario of usuariosSistema) {
        const liderAtualLocal = hierarquiaLocal[usuario.id] || null;
        const liderNoBanco = usuario.permissoes?.lider_id || null;

        // Só faz a requisição se a relação tiver sido alterada na tela
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

      alert("🎉 Matriz de subordinação em cascata atualizada com sucesso!");
      await carregarDadosHierarquia();
    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro ao salvar hierarquia: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // 🌲 COMPONENTE RECURSIVO PARA RENDERIZAR OS NÍVEIS DA ÁRVORE
  const RenderizarNivelHierarquia = ({ liderId }: { liderId: string | null }) => {
    // Filtra quem está abaixo do liderId atual
    const filhos = usuariosSistema.filter(u => hierarquiaLocal[u.id] === liderId);

    if (filhos.length === 0) return null;

    return (
      <div className="flex flex-col gap-4 pl-6 border-l-2 border-dashed border-slate-200 mt-2">
        {filhos.map(sub => (
          <div 
            key={sub.id} 
            className="group text-left"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, sub.id)}
          >
            {/* MICROCARD DO USUÁRIO */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, sub.id)}
              className="inline-flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all min-w-[280px] bg-linear-to-r hover:from-blue-50/20"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                {sub.nome.substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 uppercase tracking-tight text-[11px] truncate">{sub.nome}</div>
                <div className="text-[10px] text-slate-400 font-medium truncate">{sub.email}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                sub.cargo === 'Master' || sub.cargo === 'Diretor' ? 'bg-purple-100 text-purple-700' :
                sub.cargo === 'Gerente' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {sub.cargo || "Comercial"}
              </span>
            </div>

            {/* Chamada recursiva para renderizar os filhos deste usuário (subordinação infinita) */}
            <RenderizarNivelHierarquia liderId={sub.id} />
          </div>
        ))}
      </div>
    );
  };

  // Pegamos os usuários que estão no topo absoluto (sem nenhum lider_id associado)
  const raizesDaArvore = usuariosSistema.filter(u => !hierarquiaLocal[u.id]);

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen text-[12px]">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🌲 Organograma e Árvore Dinâmica de Equipes</h1>
          <p className="text-xs text-slate-400">Arraste os cards de nomes para dentro de outros usuários para montar a árvore de subordinação e alçadas comerciais em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={carregarDadosHierarquia} 
            disabled={carregando || salvando}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 font-bold uppercase text-[10px] rounded-lg tracking-wider transition-all disabled:opacity-50"
          >
            🔄 Resetar
          </button>
          <button 
            onClick={salvarEstruturaHierarquia} 
            disabled={carregando || salvando}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-md transition-all disabled:opacity-50"
          >
            {salvando ? "⏳ Gravando Matriz..." : "💾 Salvar Árvor"}
          </button>
        </div>
      </div>

      {(carregando || salvando) && (
        <div className="p-2 text-center bg-blue-50 text-blue-700 font-bold font-mono rounded-lg animate-pulse text-[11px]">
          ⏳ Sincronizando dados com o ecossistema Supabase...
        </div>
      )}

      {/* ÁREA PRINCIPAL DA ÁRVORE */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Zona Limbo / Nível Superior Absoluto */}
        <div 
          className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/40 min-h-[400px] transition-colors"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)} // Drop direto no fundo move o cara para o Topo Absoluto
        >
          <div className="text-left mb-4">
            <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest block mb-1">👑 Direção / Nível Superior Sem Filtros</span>
            <span className="text-slate-400 text-[11px]">Cards soltos aqui veem tudo ou respondem direto para a mesa executiva. Arraste um card para dentro de outro para criar uma ramificação.</span>
          </div>

          <div className="flex flex-col gap-4">
            {raizesDaArvore.map(root => (
              <div 
                key={root.id} 
                className="text-left"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, root.id)}
              >
                {/* MICROCARD DA RAIZ */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, root.id)}
                  className="inline-flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-md transition-all min-w-[280px] bg-linear-to-r hover:from-blue-50/20"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white font-black text-[10px] uppercase">
                    {root.nome.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-slate-900 uppercase tracking-tight text-[11px] truncate">{root.nome}</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">{root.email}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                    root.cargo === 'Master' || root.cargo === 'Diretor' ? 'bg-purple-100 text-purple-700' :
                    root.cargo === 'Gerente' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {root.cargo || "Diretoria"}
                  </span>
                </div>

                {/* Renderização recursiva descendente (entra na subordinação) */}
                <RenderizarNivelHierarquia liderId={root.id} />
              </div>
            ))}

            {usuariosSistema.length === 0 && !carregando && (
              <p className="text-slate-400 italic text-center py-20">Nenhum usuário localizado para montagem da matriz.</p>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}