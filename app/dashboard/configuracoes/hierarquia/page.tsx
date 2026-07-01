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
      alert("🎉 Organograma atualizado e salvo com sucesso!");
      await carregarDadosHierarquia();
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // 🌲 COMPONENTE RECURSIVO HORIZONTAL (GERADOR DE RAMOS)
  const RenderizarFilhosOrganograma = ({ liderId }: { liderId: string | null }) => {
    const filhos = usuariosSistema.filter(u => hierarquiaLocal[u.id] === liderId);
    if (filhos.length === 0) return null;

    return (
      <ul className="flex justify-center gap-x-8 pt-8 relative before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-[2px] before:h-8 before:bg-slate-300">
        {filhos.map((sub, idx) => {
          const temFilhos = usuariosSistema.some(u => hierarquiaLocal[u.id] === sub.id);
          return (
            <li 
              key={sub.id} 
              className="relative px-2 text-center flex flex-col items-center shrink-0"
              style={{
                // Estilização das linhas horizontais que conectam os ramos irmãos
                backgroundImage: `linear-gradient(to right, ${idx === 0 ? 'transparent' : '#cbd5e1'} 50%, ${idx === filhos.length - 1 ? 'transparent' : '#cbd5e1'} 50%)`,
                backgroundPosition: 'top',
                backgroundSize: '100% 2px',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {/* Linha vertical que entra no topo do card */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-300"></div>

              {/* CARD EXECUTIVO DO COLABORADOR */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, sub.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, sub.id)}
                className={`relative mt-4 flex flex-col w-[240px] bg-white border-2 border-slate-200 p-3.5 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-md transition-all select-none text-left z-10 ${
                  temFilhos ? "after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-[2px] after:h-4 after:bg-slate-300 after:translate-y-full" : ""
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
                  <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider">NED CAPITAL</span>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight ${
                    sub.cargo === 'Master' || sub.cargo === 'Diretor' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                    sub.cargo === 'Gerente' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {sub.cargo || "Comercial"}
                  </span>
                </div>
              </div>

              {/* Descida recursiva horizontal */}
              <RenderizarFilhosOrganograma liderId={sub.id} />
            </li>
          );
        })}
      </ul>
    );
  };

  const raizesDaArvore = usuariosSistema.filter(u => !hierarquiaLocal[u.id]);

  return (
    <div className="p-6 space-y-6 font-sans bg-slate-50 min-h-screen text-[12px] flex flex-col">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4 shrink-0">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🌲 Central de Hierarquias & Equipes</h1>
          <p className="text-xs text-slate-400">Monte a estrutura de subordinação do time. Arraste e solte os cards para vincular subordinados aos líderes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarDadosHierarquia} disabled={carregando || salvando} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 font-bold uppercase text-[10px] rounded-lg tracking-wider shadow-xs transition-all">
            🔄 Resetar Árvore
          </button>
          <button onClick={salvarEstruturaHierarquia} disabled={carregando || salvando} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-md transition-all">
            {salvando ? "⏳ Salvando..." : "📤 Salvar Matriz"}
          </button>
        </div>
      </div>

      {/* ÁREA DE ROLAGEM HORIZONTAL DO ORGANOGRAMA */}
      <div 
        className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-8 overflow-auto shadow-inner min-h-[600px] flex flex-col select-none"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)} // Soltar no fundo limpa o líder (vai pro Topo)
      >
        <div className="text-left mb-6 border-b border-slate-100 pb-3 shrink-0">
          <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block mb-1">👑 Topo Absoluto / Nível Superior Sem Filtros</span>
          <span className="text-slate-400 text-[11px]">Cards soltos aqui respondem direto para a mesa executiva. Solte um card em cima de outro para criar um ramo descendente.</span>
        </div>

        {/* CONTÊINER GERAL DA ÁRVORE */}
        <div className="flex justify-center gap-x-12 pt-4 m-auto w-max min-w-full">
          {raizesDaArvore.map((root) => {
            const temFilhos = usuariosSistema.some(u => hierarquiaLocal[u.id] === root.id);
            return (
              <div key={root.id} className="flex flex-col items-center relative text-center">
                
                {/* CARD RAIZ */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, root.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, root.id)}
                  className={`relative flex flex-col w-[240px] bg-white border-2 border-slate-300 p-3.5 rounded-2xl shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-md transition-all text-left z-10 ${
                    temFilhos ? "after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-[2px] after:h-8 after:bg-slate-300 after:translate-y-full" : ""
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
                    <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider">NED CAPITAL</span>
                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-purple-900 text-white">
                      {root.cargo || "Diretor"}
                    </span>
                  </div>
                </div>

                {/* Renderização dos galhos abaixo da raiz */}
                <RenderizarFilhosOrganograma liderId={root.id} />
              </div>
            ))}

          {usuariosSistema.length === 0 && !carregando && (
            <p className="text-slate-400 italic text-center py-20 m-auto">Nenhum operador localizado no banco de dados.</p>
          )}
        </div>
      </div>
    </div>
  );
}