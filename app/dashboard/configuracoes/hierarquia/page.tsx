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
  
  // 🗺️ Agora mapeamos id_usuario -> Array de lider_ids (Permite múltiplos vínculos!)
  const [hierarquiaLocal, setHierarquiaLocal] = useState<Record<string, string[]>>({});
  
  // 🎯 Lista de IDs dos usuários selecionados (Permite inserção múltipla!)
  const [usuariosSelecionadosIds, setUsuariosSelecionadosId] = useState<string[]>([]);

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
          // Trata se o banco já tiver o formato antigo de string ou se for array nativa
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

  useEffect(() => {
    carregarDadosHierarquia();
  }, []);

  // CONTROLE DE SELEÇÃO MÚLTIPLA (GAVETA ESQUERDA)
  const alternarSelecaoUsuario = (id: string) => {
    setUsuariosSelecionadosId(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const selecionarTodosLivres = (usuariosLivres: UsuarioSistema[]) => {
    if (usuariosSelecionadosIds.length === usuariosLivres.length) {
      setUsuariosSelecionadosId([]);
    } else {
      setUsuariosSelecionadosId(usuariosLivres.map(u => u.id));
    }
  };

  // EXECUTA A INTEGRAÇÃO EM MASSA E MULTI-PAI
  const executarMovimentacaoMultipla = (novoLiderId: string | null) => {
    if (usuariosSelecionadosIds.length === 0) return;

    setHierarquiaLocal(prev => {
      const copia = { ...prev };
      
      usuariosSelecionadosIds.forEach(subId => {
        if (subId === novoLiderId) return;

        // Se o drop for no fundo (null), limpa todos os líderes daquele grupo
        if (novoLiderId === null) {
          copia[subId] = [];
          return;
        }

        const listaLideresAtuais = copia[subId] || [];
        
        // Evita duplicar o mesmo líder na Array
        if (!listaLideresAtuais.includes(novoLiderId)) {
          copia[subId] = [...listaLideresAtuais, novoLiderId];
        }
      });

      return copia;
    });

    // Limpa o lote de seleção após o vínculo
    setUsuariosSelecionadosId([]);
  };

  const removerLiderEspecifico = (e: React.MouseEvent, usuarioId: string, liderIdRemover: string) => {
    e.stopPropagation();
    setHierarquiaLocal(prev => ({
      ...prev,
      [usuarioId]: (prev[usuarioId] || []).filter(id => id !== liderIdRemover)
    }));
  };

  const soltarCardGeral = (e: React.MouseEvent, usuarioId: string) => {
    e.stopPropagation();
    setHierarquiaLocal(prev => ({ ...prev, [usuarioId]: [] }));
  };

  const salvarEstruturaHierarquia = async () => {
    try {
      setSalvando(true);
      for (const usuario of usuariosSistema) {
        const lideresLocais = hierarquiaLocal[usuario.id] || [];
        
        const novasPermissoes = { ...usuario.permissoes };
        novasPermissoes.lider_ids = lideresLocais;
        
        // Mantém retrocompatibilidade apagando a chave singular antiga
        if (novasPermissoes.lider_id) delete novasPermissoes.lider_id;

        const { error } = await supabase
          .from("usuarios")
          .update({ permissoes: novasPermissoes })
          .eq("id", usuario.id);

        if (error) throw error;
      }
      alert("🎉 Organograma multi-vínculo salvo com sucesso!");
      await carregarDadosHierarquia();
    } catch (err: any) {
      alert(`❌ Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // 🌲 COMPONENTE RECURSIVO EM REDE (Aceita renders duplicados de um usuário em múltiplos galhos!)
  const RenderizarFilhosOrganograma = ({ liderId }: { liderId: string | null }) => {
    // Captura quem tem o liderId atual na sua lista de líderes
    const filhos = usuariosSistema.filter(u => (hierarquiaLocal[u.id] || []).includes(liderId as string));
    if (filhos.length === 0) return null;

    return (
      <div className="flex justify-center items-start gap-x-8 pt-8 relative w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-200"></div>

        {filhos.map((sub, idx) => {
          const temFilhos = usuariosSistema.some(u => (hierarquiaLocal[u.id] || []).includes(sub.id));
          const estaSelecionadoInLote = usuariosSelecionadosIds.includes(sub.id);

          return (
            <div 
              key={`${sub.id}-${liderId}`} // Chave composta para permitir o mesmo card em galhos diferentes
              className="relative flex flex-col items-center shrink-0"
              style={{
                backgroundImage: `linear-gradient(to right, ${idx === 0 ? 'transparent' : '#e2e8f0'} 50%, ${idx === filhos.length - 1 ? 'transparent' : '#e2e8f0'} 50%)`,
                backgroundPosition: 'top',
                backgroundSize: '100% 2px',
                backgroundRepeat: 'no-repeat',
                paddingTop: '16px'
              }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-200"></div>

              {/* CARD MULTI-ALOCÁVEL */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (usuariosSelecionadosIds.length > 0) {
                    executarMovimentacaoMultipla(sub.id); // Lança o lote selecionado abaixo deste pai
                  } else {
                    alternarSelecaoUsuario(sub.id); // Entra no lote de seleção
                  }
                }}
                className={`relative flex flex-col w-[240px] bg-white border-2 p-3.5 rounded-2xl shadow-xs transition-all text-left z-10 cursor-pointer select-none ${
                  estaSelecionadoInLote ? "border-blue-600 ring-4 ring-blue-100 bg-blue-50/10" : "border-slate-200 hover:border-slate-400 hover:shadow-md"
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

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 gap-2">
                  <button 
                    onClick={(e) => liderId ? removerLiderEspecifico(e, sub.id, liderId) : soltarCardGeral(e, sub.id)}
                    className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase transition-colors shrink-0"
                  >
                    ✕ Tirar Deste Ramo
                  </button>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight shrink-0 ${
                    sub.cargo === 'Master' || sub.cargo === 'Diretor' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                    sub.cargo === 'Gerente' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {sub.cargo || "Operacional"}
                  </span>
                </div>

                {temFilhos && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-slate-200 translate-y-full"></div>
                )}
              </div>

              {/* Descida recursiva passando o ID deste nó para buscar os filhos dele */}
              <RenderizarFilhosOrganograma liderId={sub.id} />
            </div>
          );
        })}
      </div>
    );
  };

  // No modelo multi-pai, as raízes são usuários que possuem a lista lider_ids vazia
  const raizesDaArvore = usuariosSistema.filter(u => (hierarquiaLocal[u.id] || []).length === 0);
  const usuariosLivresParaArraste = usuariosSistema.filter(u => (hierarquiaLocal[u.id] || []).length === 0);

  return (
    <div className="p-6 space-y-6 font-sans bg-slate-50 min-h-screen text-[12px] flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-4 shrink-0">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🌲 Central de Alçadas Multi-Vínculo (Rede)</h1>
          <p className="text-xs text-slate-400">Selecione múltiplos usuários na gaveta esquerda e clique em cima de qualquer líder para criar vínculos simultâneos.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarDadosHierarquia} disabled={carregando || salvando} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 font-bold uppercase text-[10px] rounded-lg tracking-wider shadow-xs transition-all">
            🔄 Descartar Mudanças
          </button>
          <button onClick={salvarEstruturaHierarquia} disabled={carregando || salvando} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-md transition-all">
            {salvando ? "⏳ Gravando Matriz..." : "📤 Salvar Alterações"}
          </button>
        </div>
      </div>

      {/* WORKSPACE COMPLETO */}
      <div className="flex-1 flex gap-6 overflow-hidden w-full h-full items-stretch">
        
        {/* GAVETA ESQUERDA: BANCO DE SELEÇÃO MULTIPLA */}
        <div className="w-[260px] bg-slate-900 text-white p-4 rounded-2xl flex flex-col shadow-xl shrink-0 border border-slate-800">
          <div className="border-b border-slate-800 pb-2 mb-3 flex justify-between items-center">
            <div>
              <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block">👤 Em Seleção ({usuariosSelecionadosIds.length})</span>
              <span className="text-slate-500 text-[10px] block mt-0.5 leading-tight">Marque e associe em lote.</span>
            </div>
            {usuariosLivresParaArraste.length > 0 && (
              <button 
                onClick={() => selecionarTodosLivres(usuariosLivresParaArraste)} 
                className="text-[9px] font-bold uppercase text-blue-400 hover:underline bg-transparent border-0 cursor-pointer"
              >
                {usuariosSelecionadosIds.length === usuariosLivresParaArraste.length ? "Limpar" : "Todos"}
              </button>
            )}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={selecionado} 
                      readOnly 
                      className="w-3.5 h-3.5 rounded text-blue-600 border-slate-700 bg-slate-950 focus:ring-0 shrink-0 pointer-events-none"
                    />
                    <span className="font-bold uppercase tracking-tight text-[11px] truncate">{user.nome}</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono shrink-0 ${selecionado ? 'bg-blue-800 text-white' : 'bg-slate-950 text-slate-400'}`}>
                    {user.cargo || "Comercial"}
                  </span>
                </div>
              );
            })}

            {usuariosLivresParaArraste.length === 0 && (
              <p className="text-slate-600 italic text-center text-[11px] pt-12">Todos organizados em tela.</p>
            )}
          </div>
        </div>

        {/* PAINEL CENTRAL: ORGANOGRAMA EM REDE */}
        <div 
          className="flex-1 bg-white border border-slate-200 rounded-2xl p-8 overflow-auto shadow-inner relative flex flex-col"
          onClick={() => {
            if (usuariosSelecionadosIds.length > 0) executarMovimentacaoMultipla(null);
          }}
        >
          <div className="text-left mb-6 border-b border-slate-100 pb-3 shrink-0">
            <span className="font-black text-slate-400 text-[9px] uppercase tracking-widest block mb-1">👑 Líderes Absolutos de Alçada (Diretores / Master)</span>
            <span className="text-slate-400 text-[11px]">Selecione os usuários na gaveta e **clique no fundo branco** para torná-los chefes de célula, ou clique em outros cards para criar sub-ramos.</span>
          </div>

          <div className="flex justify-center items-start gap-x-12 pt-4 m-auto w-max min-w-full">
            {raizesDaArvore.map((root) => {
              const temFilhos = usuariosSistema.some(u => (hierarquiaLocal[u.id] || []).includes(root.id));
              const estaSelecionadoInLote = usuariosSelecionadosIds.includes(root.id);

              return (
                <div key={root.id} className="flex flex-col items-center relative text-center">
                  
                  {/* CARD RAIZ PRINCIPAL */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (usuariosSelecionadosIds.length > 0) {
                        executarMovimentacaoMultipla(root.id); // Aloca os selecionados abaixo deste pai
                      } else {
                        alternarSelecaoUsuario(root.id); // Entra no lote de seleção
                      }
                    }}
                    className={`relative flex flex-col w-[240px] bg-white border-2 p-3.5 rounded-2xl shadow-sm transition-all text-left z-10 cursor-pointer ${
                      estaSelecionadoInLote ? "border-blue-600 ring-4 ring-blue-100 bg-blue-50/10" : "border-slate-300 hover:border-slate-500"
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
                        onClick={(e) => soltarCardGeral(e, root.id)}
                        className="text-[9px] text-rose-500 hover:text-rose-700 font-bold uppercase transition-colors"
                      >
                        ✕ Soltar Card
                      </button>
                      <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-purple-900 text-white">
                        {root.cargo || "Diretor"}
                      </span>
                    </div>

                    {temFilhos && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-slate-300 translate-y-full"></div>
                    )}
                  </div>

                  {/* Renderiza as ramificações de rede descendente */}
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