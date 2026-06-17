/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  cargo: string;
}

interface RelacaoHierarquia {
  subordinado_id: string;
  superior_id: string;
  recebe_comissao: boolean;
  pode_visualizar: boolean;
}

export default function GerenciarHierarquiaPage() {
  // 🔥 AGORA CONECTADO À SUA TABELA REAL DE USUÁRIOS DO SISTEMA
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [vinculos, setVinculos] = useState<RelacaoHierarquia[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // O Supervisor/Gestor selecionado no topo para gerenciar sua cascata de subordinados
  const [supervisorSelecionadoId, setSupervisorSelecionadoId] = useState<string>("");

  const carregarDadosConfig = async () => {
    try {
      setCarregando(true);
      
      // 🎯 BUSCA REAL: Puxando da tabela 'usuarios' que você usa na central de acessos
      const { data: dbUsuarios, error: errUsuarios } = await supabase
        .from("usuarios")
        .select("id, nome, email, cargo")
        .order("nome", { ascending: true });

      const { data: dbVinculos, error: errVinculos } = await supabase
        .from("crm_hierarquia")
        .select("*");

      if (errUsuarios) throw errUsuarios;
      if (errVinculos) throw errVinculos;

      if (dbUsuarios) setUsuariosSistema(dbUsuarios);
      if (dbVinculos) {
        setVinculos(dbVinculos.map((v: any) => ({
          subordinado_id: v.subordinado_id,
          superior_id: v.superior_id,
          // Lê os parâmetros dinâmicos de permissão e comissão da cascata
          recebe_comissao: v.recebe_comissao ?? v.campos_customizados?.recebe_comissao ?? false,
          pode_visualizar: v.pode_visualizar ?? v.campos_customizados?.pode_visualizar ?? true,
        })));
      }
    } catch (err: any) {
      alert(`Erro ao carregar estrutura de usuários: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosConfig();
  }, []);

  // Salva, remove ou atualiza os checkboxes da tabela de subordinação em tempo real no banco
  const handleAlternarCaixinhaSubordinado = async (subordinadoId: string, campo: "vincular" | "recebe_comissao" | "pode_visualizar", valorAtual: boolean) => {
    if (!supervisorSelecionadoId) return;

    try {
      setCarregando(true);
      const vinculoExistente = vinculos.find(v => v.subordinado_id === subordinadoId && v.superior_id === supervisorSelecionadoId);

      if (campo === "vincular") {
        if (!valorAtual) {
          // Se marcou o agente: limpa relações antigas desse subordinado e crava o novo líder
          await supabase.from("crm_hierarquia").delete().eq("subordinado_id", subordinadoId);
          await supabase.from("crm_hierarquia").insert([{
            subordinado_id: subordinadoId,
            superior_id: supervisorSelecionadoId,
            pode_visualizar: true,
            recebe_comissao: false
          }]);
        } else {
          // Se desmarcou o agente: remove ele da cascata desse líder
          await supabase.from("crm_hierarquia").delete().eq("subordinado_id", subordinadoId).eq("superior_id", supervisorSelecionadoId);
        }
      } else {
        // Se mudou "Recebe Comissão" ou "Pode Visualizar"
        if (vinculoExistente) {
          const payloadUpdate: any = {};
          if (campo === "recebe_comissao") payloadUpdate.recebe_comissao = !valorAtual;
          if (campo === "pode_visualizar") payloadUpdate.pode_visualizar = !valorAtual;

          await supabase.from("crm_hierarquia")
            .update(payloadUpdate)
            .eq("subordinado_id", subordinadoId)
            .eq("superior_id", supervisorSelecionadoId);
        }
      }

      await carregarDadosConfig();
    } catch (err: any) {
      alert(`Erro ao atualizar cascata no banco: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Garante que o usuário selecionado como superior não apareça listado abaixo para se auto-vincular
  const listaAgentesCandidatos = useMemo(() => {
    return usuariosSistema.filter(u => u.id !== supervisorSelecionadoId);
  }, [usuariosSistema, supervisorSelecionadoId]);

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen text-[12px]">
      
      {/* HEADER DA PÁGINA COM A NOMENCLATURA DO CRM */}
      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🏠 Página Inicial / Agente/Supervisor (FBC060)</h1>
        <p className="text-xs text-slate-400">Monte a estrutura em cascata utilizando a base de usuários do sistema. Defina alçadas de visualização de contratos e comissionamento.</p>
      </div>

      {/* SEÇÃO SUPERIOR DE FILTRO POR SUPERVISOR (image_389ae5.png) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono">
        <div className="flex items-center gap-3 w-full sm:max-w-xl">
          <span className="font-bold text-slate-600 uppercase text-[10px] whitespace-nowrap">Supervisor 🔍</span>
          <select 
            value={supervisorSelecionadoId} 
            onChange={(e) => setSupervisorSelecionadoId(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-[11px] font-black uppercase text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value="">-- SELECONE O GESTOR / SUPERVISOR COMERCIAL --</option>
            {usuariosSistema.map(user => (
              <option key={user.id} value={user.id}>{user.nome} ({user.cargo || "Comercial"})</option>
            ))}
          </select>
        </div>
        
        <div>
          <button onClick={carregarDadosConfig} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-sm transition-all">
            Buscar Cascata
          </button>
        </div>
      </div>

      {carregando && (
        <div className="p-2 text-center bg-amber-50 text-amber-700 font-bold font-mono rounded-lg animate-pulse text-[11px]">
          ⏳ Atualizando e salvando permissões na tabela crm_hierarquia...
        </div>
      )}

      {/* MATRIZ COMPLETA DE VÍNCULOS POR CHECKBOX (image_38a2bb.png) */}
      {supervisorSelecionadoId ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] border-b border-slate-200">
                <th className="p-3 w-24 text-center">Cód. Agente</th>
                <th className="p-3">Agente / Operador Cadastrado</th>
                <th className="p-3 text-center w-44">Pertence à Cascata?</th>
                <th className="p-3 text-center w-44">Recebe Comissão</th>
                <th className="p-3 text-center w-44">Pode Visualizar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-sans text-slate-700 font-medium">
              {listaAgentesCandidatos.map((agente, index) => {
                const r = vinculos.find(v => v.subordinado_id === agente.id && v.superior_id === supervisorSelecionadoId);
                const pertenceAoSupervisor = !!r;

                return (
                  <tr key={agente.id} className={`hover:bg-slate-50/60 transition-colors ${pertenceAoSupervisor ? 'bg-blue-50/20 font-bold' : ''}`}>
                    {/* Código sequencial incremental correspondente ao print */}
                    <td className="p-3 font-mono text-slate-400 text-center">{index + 1}</td>
                    
                    <td className="p-3">
                      <div className="text-slate-900 uppercase font-black text-[11px]">{agente.nome}</div>
                      <div className="text-[10px] font-mono text-slate-400 normal-case">{agente.email} | Nível: {agente.cargo || "Comercial"}</div>
                    </td>

                    {/* Checkbox Principal: Se o operador responde a este supervisor */}
                    <td className="p-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={pertenceAoSupervisor}
                        onChange={() => handleAlternarCaixinhaSubordinado(agente.id, "vincular", pertenceAoSupervisor)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </td>

                    {/* Checkbox Secundário: Comissão (SIM/NÃO) */}
                    <td className="p-3 text-center font-mono text-[10px]">
                      <input 
                        type="checkbox" 
                        disabled={!pertenceAoSupervisor}
                        checked={pertenceAoSupervisor ? r.recebe_comissao : false}
                        onChange={() => handleAlternarCaixinhaSubordinado(agente.id, "recebe_comissao", r?.recebe_comissao || false)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer disabled:opacity-30"
                      />
                      <span className="block text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                        {pertenceAoSupervisor && r.recebe_comissao ? "SIM" : "NÃO"}
                      </span>
                    </td>

                    {/* Checkbox Terciário: Pode Visualizar (SIM/NÃO) */}
                    <td className="p-3 text-center font-mono text-[10px]">
                      <input 
                        type="checkbox" 
                        disabled={!pertenceAoSupervisor}
                        checked={pertenceAoSupervisor ? r.pode_visualizar : false}
                        onChange={() => handleAlternarCaixinhaSubordinado(agente.id, "pode_visualizar", r?.pode_visualizar || false)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer disabled:opacity-30"
                      />
                      <span className="block text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                        {pertenceAoSupervisor && r.pode_visualizar ? "SIM" : "NÃO"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-center rounded-2xl font-medium">
          💡 Escolha um **Supervisor** cadastrado no seletor de buscas acima para abrir a tabela de vinculação por caixas.
        </div>
      )}

    </div>
  );
}