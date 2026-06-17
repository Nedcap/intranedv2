/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  cargo: string; // "Master", "Operacional", "Comercial"
}

interface RelacaoHierarquia {
  subordinado_id: string;
  superior_id: string;
}

export default function GerenciarHierarquiaPage() {
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [vinculos, setVinculos] = useState<RelacaoHierarquia[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // 🔒 O Líder/Gestor selecionado no topo para gerenciar quem está na sua equipe abaixo
  const [liderSelecionadoId, setLiderSelecionadoId] = useState<string>("");

  const carregarDadosConfig = async () => {
    try {
      setCarregando(true);
      
      // Busca da tabela real de usuários cadastrados no sistema
      const { data: dbUsuarios, error: errUsuarios } = await supabase
        .from("usuarios")
        .select("id, nome, email, cargo")
        .order("nome", { ascending: true });

      const { data: dbVinculos, error: errVinculos } = await supabase
        .from("crm_hierarquia")
        .select("subordinado_id, superior_id");

      if (errUsuarios) throw errUsuarios;
      if (errVinculos) throw errVinculos;

      if (dbUsuarios) setUsuariosSistema(dbUsuarios);
      if (dbVinculos) setVinculos(dbVinculos);
    } catch (err: any) {
      alert(`Erro ao carregar estrutura de equipes: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosConfig();
  }, []);

  // Vincular ou desvincular um operador à equipe do Líder selecionado
  const handleAlternarEquipeSubordinado = async (subordinadoId: string, jaPertence: boolean) => {
    if (!liderSelecionadoId) return;

    try {
      setCarregando(true);

      if (!jaPertence) {
        // 🔒 Vincula o operador a este líder (limpa reportes antigos para evitar duplicidade de gerência se necessário)
        await supabase.from("crm_hierarquia").delete().eq("subordinado_id", subordinadoId);
        await supabase.from("crm_hierarquia").insert([{
          subordinado_id: subordinadoId,
          superior_id: liderSelecionadoId
        }]);
      } else {
        // Desvincula o operador da equipe deste líder
        await supabase.from("crm_hierarquia")
          .delete()
          .eq("subordinado_id", subordinadoId)
          .eq("superior_id", liderSelecionadoId);
      }

      await carregarDadosConfig();
    } catch (err: any) {
      alert(`Erro ao atualizar hierarquia: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Impede que o próprio líder apareça na lista de pessoas para ele gerenciar a si mesmo
  const listaMembrosEquipeDisponiveis = useMemo(() => {
    return usuariosSistema.filter(u => u.id !== liderSelecionadoId);
  }, [usuariosSistema, liderSelecionadoId]);

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen text-[12px]">
      
      {/* HEADER DA PÁGINA */}
      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">⚙️ Central de Alçadas e Hierarquia de Carteiras (FBC060)</h1>
        <p className="text-xs text-slate-400">Vincule a estrutura em cascata da operação. Quem estiver marcado na tabela abaixo fará parte da equipe do líder selecionado, permitindo o cascateamento de visibilidade dos cards no NedHub.</p>
      </div>

      {/* SELETOR SUPERIOR DO LÍDER/GESTOR */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono">
        <div className="flex items-center gap-3 w-full sm:max-w-xl">
          <span className="font-bold text-slate-600 uppercase text-[10px] whitespace-nowrap">Líder / Gestor 🔍</span>
          <select 
            value={liderSelecionadoId} 
            onChange={(e) => setLiderSelecionadoId(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-[11px] font-black uppercase text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value="">-- SELECIONE O DIRETOR, GERENTE OU RESPONSÁVEL SUPERIOR --</option>
            {usuariosSistema.map(user => (
              <option key={user.id} value={user.id}>{user.nome} ({user.cargo || "Operador"})</option>
            ))}
          </select>
        </div>
        
        <div>
          <button onClick={carregarDadosConfig} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-sm transition-all">
            Recarregar Base
          </button>
        </div>
      </div>

      {carregando && (
        <div className="p-2 text-center bg-blue-50 text-blue-700 font-bold font-mono rounded-lg animate-pulse text-[11px]">
          ⏳ Atualizando árvore de permissões de carteira no banco de dados...
        </div>
      )}

      {/* MATRIZ DE VISIBILIDADE EM CASCATA POR CHECKBOX */}
      {liderSelecionadoId ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider">
                <th className="p-3 w-20 text-center">Índice</th>
                <th className="p-3">Operador / Colaborador da Base</th>
                <th className="p-3">Cargo/Nível</th>
                <th className="p-3 text-center w-64">Faz parte da Equipe deste Líder?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-sans text-slate-700 font-medium">
              {listaMembrosEquipeDisponiveis.map((colaborador, index) => {
                // Verifica se este operador responde ao líder ativo do topo
                const pertenceAoLider = vinculos.some(v => v.subordinado_id === colaborador.id && v.superior_id === liderSelecionadoId);

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

                    {/* Caixinha de atribuição de equipe (Muda a visibilidade do CRM) */}
                    <td className="p-3 text-center">
                      <label className="flex items-center justify-center gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={pertenceAoLider}
                          onChange={() => handleAlternarEquipeSubordinado(colaborador.id, pertenceAoLider)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                        <span className={`font-mono text-[9px] font-bold ${pertenceAoLider ? 'text-blue-600' : 'text-slate-400'}`}>
                          {pertenceAoLider ? "🟢 SUBORDINADO VINCULADO" : "⚪ NÃO REPORTA A ELE"}
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
          💡 Escolha um usuário no topo para gerenciar e vincular quais SDRs ou Comerciais respondem diretamente a ele.
        </div>
      )}

    </div>
  );
}