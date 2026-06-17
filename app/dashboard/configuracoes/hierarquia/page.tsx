/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Perfil {
  id: string;
  nome: string;
  email: string;
  role: string;
}

interface RelacaoHierarquia {
  subordinado_id: string;
  superior_id: string;
  recebe_comissao: boolean;
  pode_visualizar: boolean;
}

export default function GerenciarHierarquiaPage() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [vinculos, setVinculos] = useState<RelacaoHierarquia[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // 🎯 O coração do print: O Supervisor selecionado no topo para gerenciar sua cascata
  const [supervisorSelecionadoId, setSupervisorSelecionadoAgenda] = useState<string>("");

  const carregarDadosConfig = async () => {
    try {
      setCarregando(true);
      const { data: dbPerfis, error: errPerfis } = await supabase.from("crm_profiles").select("*").order("nome");
      const { data: dbVinculos, error: errVinculos } = await supabase.from("crm_hierarquia").select("*");

      if (errPerfis) throw errPerfis;
      if (errVinculos) throw errVinculos;

      if (dbPerfis) setPerfis(dbPerfis);
      if (dbVinculos) {
        setVinculos(dbVinculos.map((v: any) => ({
          subordinado_id: v.subordinado_id,
          superior_id: v.superior_id,
          // Lê os booleanos das caixinhas direto do jsonb ou colunas nativas se houver
          recebe_comissao: v.recebe_comissao ?? v.campos_customizados?.recebe_comissao ?? false,
          pode_visualizar: v.pode_visualizar ?? v.campos_customizados?.pode_visualizar ?? true,
        })));
      }
    } catch (err: any) {
      alert(`Erro ao carregar matriz: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosConfig();
  }, []);

  // ⚡ SALVA OU ATUALIZA A CAIXINHA DE SELEÇÃO EM TEMPO REAL NO BANCO
  const handleAlternarCaixinhaSubordinado = async (subordinadoId: string, campo: "vincular" | "recebe_comissao" | "pode_visualizar", valorAtual: boolean) => {
    if (!supervisorSelecionadoId) return;

    try {
      setCarregando(true);
      
      const vinculoExistente = vinculos.find(v => v.subordinado_id === subordinadoId && v.superior_id === supervisorSelecionadoId);

      if (campo === "vincular") {
        if (!valorAtual) {
          // Se marcou a caixinha principal (Inserir na cascata deste supervisor)
          await supabase.from("crm_hierarquia").delete().eq("subordinado_id", subordinadoId); // Limpa liderança antiga
          await supabase.from("crm_hierarquia").insert([{
            subordinado_id: subordinadoId,
            superior_id: supervisorSelecionadoId,
            pode_visualizar: true,
            recebe_comissao: false
          }]);
        } else {
          // Se desmarcou (Remover da cascata dele)
          await supabase.from("crm_hierarquia").delete().eq("subordinado_id", subordinadoId).eq("superior_id", supervisorSelecionadoId);
        }
      } else {
        // Se alterou as sub-caixinhas ("Recebe Comissão" ou "Pode Visualizar")
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
      alert(`Erro ao atualizar matriz: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Filtra a lista de candidatos que podem ser subordinados (não faz sentido o supervisor ser subordinado de si mesmo)
  const listaCandidatosSubordinados = useMemo(() => {
    return perfis.filter(p => p.id !== supervisorSelecionadoId);
  }, [perfis, supervisorSelecionadoId]);

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen text-[12px]">
      
      {/* HEADER IDÊNTICO À ESTRUTURA DO SEU CRM */}
      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">🏠 Página Inicial / Agente/Supervisor (FBC060)</h1>
        <p className="text-xs text-slate-400">Vincule a cascata de operadores. Quem estiver marcado abaixo herda as travas e envia relatórios para o supervisor do topo.</p>
      </div>

      {/* 🎯 SEÇÃO SUPERIOR DE FILTRO - REPLICANDO IGUAL AO PRINT image_38a2bb.png */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center font-mono">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-600 uppercase text-[10px]">Supervisor 🔍</span>
          <select 
            value={supervisorSelecionadoId} 
            onChange={(e) => setSupervisorSelecionadoAgenda(e.target.value)}
            className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-[11px] font-black uppercase text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value="">-- Selecione o Gestor / Supervisor Comercial --</option>
            {perfis.filter(p => p.role !== "SDR").map(p => (
              <option key={p.id} value={p.id}>{p.nome} ({p.role})</option>
            ))}
          </select>
        </div>
        
        <div className="text-right">
          <button onClick={carregarDadosConfig} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] rounded-lg tracking-wider shadow-sm transition-all">
            Buscar Cascata
          </button>
        </div>
      </div>

      {carregando && (
        <div className="p-2 text-center bg-amber-50 text-amber-700 font-bold font-mono rounded-lg animate-pulse">
          ⏳ Gravando parâmetros e atualizando regras de visibilidade cascata...
        </div>
      )}

      {/* 📊 A TABELA DE MATRIZ DE CHECKBOXES - IGUAL AO DA IMAGEM image_38a2bb.png */}
      {supervisorSelecionadoId ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-amber-100/70 text-slate-800 font-black uppercase text-[10px] border-b border-slate-200">
                <th className="p-3 w-20">Cód. Agente</th>
                <th className="p-3">Agente / Subordinado</th>
                <th className="p-3 text-center w-40">Pertence à Cascata?</th>
                <th className="p-3 text-center w-40">Recebe Comissão</th>
                <th className="p-3 text-center w-40">Pode Visualizar tudo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-sans text-slate-700 font-medium">
              {listaCandidatosSubordinados.map((agente, index) => {
                // Verifica o estado real do vínculo deste par de usuários
                const r = vinculos.find(v => v.subordinado_id === agente.id && v.superior_id === supervisorSelecionadoId);
                const pertenceAoSupervisor = !!r;

                return (
                  <tr key={agente.id} className={`hover:bg-slate-50/60 transition-colors ${pertenceAoSupervisor ? 'bg-blue-50/20 font-bold' : ''}`}>
                    {/* Código fictício sequencial baseado na ordenação igual ao do print */}
                    <td className="p-3 font-mono text-slate-400 text-center">{index + 1}</td>
                    
                    <td className="p-3">
                      <div className="text-slate-900 uppercase font-black text-[11px]">{agente.nome}</div>
                      <div className="text-[10px] font-mono text-slate-400 normal-case">{agente.email} | Nível: {agente.role}</div>
                    </td>

                    {/* Caixinha 1: Se o usuário está associado a este supervisor */}
                    <td className="p-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={pertenceAoSupervisor}
                        onChange={() => handleAlternarCaixinhaSubordinado(agente.id, "vincular", pertenceAoSupervisor)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </td>

                    {/* Caixinha 2: Recebe Comissão (Padrão do print: SIM/NAO visual ou checkbox) */}
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

                    {/* Caixinha 3: Pode Visualizar tudo (Padrão do print) */}
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
        <div className="p-12 border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-center rounded-2xl">
          👉 Escolha um **Supervisor** no seletor de busca do topo para abrir a matriz de vinculação por caixas.
        </div>
      )}

    </div>
  );
}