/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  role: "Master" | "Gestor" | "SDR" | "Comite" | "Diretoria";
  superior_nome?: string;
  superior_id?: string;
}

export default function GerenciarHierarquiaPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // Estados de edição rápidos
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const [novaRole, setNovaRole] = useState<any>("");
  const [novoSuperior, setNovoSuperior] = useState<string>("");

  const carregarHierarquiaGlobal = async () => {
    try {
      setCarregando(true);
      
      // Puxa todos os perfis cadastrados
      const { data: perfis, error: errPerfis } = await supabase.from("crm_profiles").select("*");
      // Puxa os vínculos da árvore
      const { data: vinculos } = await supabase.from("crm_hierarquia").select("*");

      if (errPerfis) throw errPerfis;

      if (perfis) {
        const mapeados = perfis.map((p: any) => {
          // Acha quem é o chefe desse cara
          const vinculo = vinculos?.find(v => v.subordinado_id === p.id);
          const chefe = perfis.find(chefePerfil => chefePerfil.id === vinculo?.superior_id);
          
          return {
            id: p.id,
            nome: p.nome,
            email: p.email,
            role: p.role,
            superior_id: chefe?.id || "",
            superior_nome: chefe?.nome || "Sem Superior Direto (Topo da Cadeia)"
          };
        });
        setColaboradores(mapeados);
      }
    } catch (err: any) {
      alert(`Erro ao carregar: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarHierarquiaGlobal(); }, []);

  // Salva a alteração de cargo e de chefe de uma vez só
  const handleSalvarAlteracao = async () => {
    if (!idSelecionado) return;
    try {
      setCarregando(true);
      
      // 1. Atualiza a role na tabela de perfil
      await supabase.from("crm_profiles").update({ role: novaRole }).eq("id", idSelecionado);

      // 2. Atualiza a árvore de reporte (Deleta o vínculo antigo e cria o novo se houver superior)
      await supabase.from("crm_hierarquia").delete().eq("subordinado_id", idSelecionado);
      
      if (novoSuperior && novoSuperior !== "nenhum") {
        await supabase.from("crm_hierarquia").insert([{
          subordinado_id: idSelecionado,
          superior_id: novoSuperior
        }]);
      }

      alert("Hierarquia e cargo atualizados globalmente!");
      setIdSelecionado(null);
      await carregarHierarquiaGlobal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      <div>
        <h1 className="text-xl font-black text-slate-900 uppercase">🌳 Organograma e Árvore de Hierarquias (CRM Global)</h1>
        <p className="text-xs text-slate-400">Defina os cargos da esteira e quem responde a quem para travar os filtros automáticos de visualização.</p>
      </div>

      {carregando && <div className="p-2 text-center bg-blue-50 text-blue-600 rounded-lg animate-pulse font-bold">Processando organograma...</div>}

      {/* TABELA DE CONFIGURAÇÃO DA ÁRVORE DE REPORTES */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider">
              <th className="p-3">Colaborador / Operador</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Cargo na Esteira</th>
              <th className="p-3">Responde Diretamente A (Superior)</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {colaboradores.map(col => (
              <tr key={col.id} className="hover:bg-slate-50 transition-colors font-medium">
                <td className="p-3 font-bold text-slate-900 uppercase">{col.nome}</td>
                <td className="p-3 font-mono text-slate-500">{col.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${col.role === 'Master' ? 'bg-red-100 text-red-700' : col.role === 'Gestor' ? 'bg-blue-100 text-blue-700' : col.role === 'Comite' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                    {col.role}
                  </span>
                </td>
                <td className="p-3 text-slate-600 font-bold uppercase">👉 {col.superior_nome}</td>
                <td className="p-3 text-center">
                  <button 
                    onClick={() => {
                      setIdSelecionado(col.id);
                      setNovaRole(col.role);
                      setNovoSuperior(col.superior_id || "nenhum");
                    }} 
                    className="px-2.5 py-1 bg-slate-900 text-white font-black uppercase text-[9px] rounded hover:bg-blue-600 transition-colors"
                  >
                    ✏️ Mudar Hierarquia
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* INTERFACE DE EDIÇÃO FLUTUANTE / MODAL DE MODIFICAÇÃO DE VÍNCULO */}
      {idSelecionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-xl border border-slate-200 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-black uppercase text-slate-900 text-[11px] border-b pb-1">Alterar Posição na Árvore NedHub</h3>
            
            {/* Seletor de Cargo */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Definir Cargo Corporativo:</label>
              <select value={novaRole} onChange={e => setNovaRole(e.target.value as any)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800">
                <option value="SDR">SDR (Vê apenas seus próprios leads)</option>
                <option value="Gestor">Gestor / Comercial Luiz (Vê seus leads + os subordinados)</option>
                <option value="Comite">Comitê de Crédito (Vê apenas leads maduros enviados a comitê)</option>
                <option value="Diretoria">Diretoria Executiva (Acesso de leitura total)</option>
                <option value="Master">Master / Administrador (Controle irrestrito total)</option>
              </select>
            </div>

            {/* Seletor de Líder Direto */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Vincular Líder / Superior Direto:</label>
              <select value={novoSuperior} onChange={e => setNovoSuperior(e.target.value)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800">
                <option value="nenhum">Sem líder direto (Responderá direto a você Master)</option>
                {colaboradores.filter(c => c.id !== idSelecionado).map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.role})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 text-[10px] pt-2">
              <button onClick={() => setIdSelecionado(null)} className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg uppercase">Cancelar</button>
              <button onClick={handleSalvarAlteracao} className="px-4 py-1.5 bg-blue-600 text-white font-black rounded-lg uppercase shadow-md">Confirmar Novo Fluxo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}