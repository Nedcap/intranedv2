/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  permissoes: Record<string, any>; // JSONB real do banco
}

export default function GerenciarHierarquiaPage() {
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // Usuário superior selecionado no filtro do topo para gerenciar sua equipe direta
  const [liderSelecionadoId, setLiderSelecionadoId] = useState<string>("");

  const carregarDadosHierarquia = async () => {
    try {
      setCarregando(true);
      
      // Busca os colaboradores lendo EXATAMENTE as colunas que existem na tabela 'usuarios'
      const { data: dbUsuarios, error: errUsuarios } = await supabase
        .from("usuarios")
        .select("id, nome, email, cargo, permissoes")
        .order("nome", { ascending: true });

      if (errUsuarios) throw errUsuarios;
      
      if (dbUsuarios) {
        // Garante que permissões seja sempre um objeto JSON válido (como no seu DDL)
        const mapeados = dbUsuarios.map(u => ({
          ...u,
          permissoes: typeof u.permissoes === 'object' && u.permissoes !== null ? u.permissoes : {}
        }));
        setUsuariosSistema(mapeados);
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

  // Grava o vínculo injetando "lider_id" no objeto jsonb de permissoes
  const handleAlternarEquipeSubordinado = async (subordinado: UsuarioSistema, jaPertence: boolean) => {
    if (!liderSelecionadoId) return;

    try {
      setCarregando(true);

      // Copia o objeto JSON de permissões existente (para não apagar os acessos das rotas)
      const novasPermissoes = { ...subordinado.permissoes };

      // Se a caixinha foi marcada (jaPertence era falso), cravamos o ID do novo líder
      if (!jaPertence) {
        novasPermissoes.lider_id = liderSelecionadoId;
      } else {
        // Se desmarcou, removemos a chave lider_id do JSON
        delete novasPermissoes.lider_id;
      }

      // Atualizamos a tabela 'usuarios'
      const { error } = await supabase
        .from("usuarios")
        .update({ permissoes: novasPermissoes })
        .eq("id", subordinado.id);

      if (error) throw error;

      // Recarrega os dados atualizados direto do banco
      await carregarDadosHierarquia();
    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro de persistência no Supabase: ${err.message}.`);
    } finally {
      setCarregando(false);
    }
  };

  // Impede que o líder apareça na lista de subordinados dele mesmo
  const listaMembrosDisponiveis = useMemo(() => {
    return usuariosSistema.filter(u => u.id !== liderSelecionadoId);
  }, [usuariosSistema, liderSelecionadoId]);

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen text-[12px]">
      
      {/* HEADER */}
      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">👥 Central de Alçadas e Controle de Equipes</h1>
        <p className="text-xs text-slate-400">Monte a estrutura de subordinação do time. Os usuários marcados abaixo farão parte da carteira do líder selecionado.</p>
      </div>

      {/* SELETOR OPERACIONAL DO LÍDER */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono">
        <div className="flex items-center gap-3 w-full sm:max-w-xl">
          <span className="font-bold text-slate-600 uppercase text-[10px] whitespace-nowrap">Responsável Superior 🔍</span>
          <select 
            value={liderSelecionadoId} 
            onChange={(e) => setLiderSelecionadoId(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-[11px] font-black uppercase text-slate-800 outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
          >
            <option value="">-- SELECIONE O DIRETOR, GERENTE OU COORDENADOR --</option>
            {usuariosSistema.map(user => (
              <option key={user.id} value={user.id}>{user.nome} ({user.cargo || "Operador"})</option>
            ))}
          </select>
        </div>
        
        <div>
          <button onClick={carregarDadosHierarquia} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-sm transition-all cursor-pointer">
            Sincronizar Estrutura
          </button>
        </div>
      </div>

      {carregando && (
        <div className="p-2 text-center bg-blue-50 text-blue-700 font-bold font-mono rounded-lg animate-pulse text-[11px]">
          ⏳ Salvando matriz de cascata na base de dados...
        </div>
      )}

      {/* GRADE DE FILIAÇÃO DE TIME */}
      {liderSelecionadoId ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider border-b">
                <th className="p-3 w-20 text-center">Índice</th>
                <th className="p-3">Colaborador Técnico</th>
                <th className="p-3">Cargo / Nível Atual</th>
                <th className="p-3 text-center w-72">Vincular à Carteira deste Líder?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-sans text-slate-700 font-medium">
              {listaMembrosDisponiveis.map((colaborador, index) => {
                // Checa se o JSON de permissões deste usuário possui a chave lider_id apontando para o líder do topo
                const pertenceAoLider = colaborador.permissoes?.lider_id === liderSelecionadoId;

                return (
                  <tr key={colaborador.id} className={`hover:bg-slate-50/60 transition-colors ${pertenceAoLider ? 'bg-blue-50/30 font-bold' : ''}`}>
                    <td className="p-3 font-mono text-slate-400 text-center">{index + 1}</td>
                    
                    <td className="p-3">
                      <div className="text-slate-900 uppercase font-black text-[11px]">{colaborador.nome}</div>
                      <div className="text-[10px] font-mono text-slate-400 normal-case">{colaborador.email}</div>
                    </td>

                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        colaborador.cargo === 'Master' ? 'bg-purple-100 text-purple-700' :
                        colaborador.cargo === 'Operacional' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {colaborador.cargo || "Comercial / SDR"}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <label className="flex items-center justify-center gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={pertenceAoLider}
                          onChange={() => handleAlternarEquipeSubordinado(colaborador, pertenceAoLider)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-0"
                        />
                        <span className={`font-mono text-[9px] font-bold ${pertenceAoLider ? 'text-blue-600' : 'text-slate-400'}`}>
                          {pertenceAoLider ? "🟢 INTEGRANTE DA EQUIPE" : "⚪ LIVRE (SEM VÍNCULO)"}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-center rounded-2xl font-medium">
          💡 Escolha um **Responsável Superior** no menu do topo para abrir e configurar a árvore de visibilidade de subordinados.
        </div>
      )}

    </div>
  );
}