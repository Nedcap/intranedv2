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
  
  // Modais e Estados de Edição/Criação
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  
  // Campos do Formulário
  const [inputNome, setInputNome] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [inputRole, setInputRole] = useState<any>("SDR");
  const [inputSuperior, setInputSuperior] = useState("");

  const carregarHierarquiaGlobal = async () => {
    try {
      setCarregando(true);
      
      // Puxa perfis e os vínculos da árvore
      const { data: perfis, error: errPerfis } = await supabase.from("crm_profiles").select("*");
      const { data: vinculos } = await supabase.from("crm_hierarquia").select("*");

      if (errPerfis) throw errPerfis;

      if (perfis) {
        const mapeados = perfis.map((p: any) => {
          const vinculo = vinculos?.find(v => v.subordinado_id === p.id);
          const chefe = perfis.find(chefePerfil => chefePerfil.id === vinculo?.superior_id);
          
          return {
            id: p.id,
            nome: p.nome,
            email: p.email,
            role: p.role,
            superior_id: chefe?.id || "",
            superior_nome: chefe?.nome || "Sem Superior Direto (Topo)"
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

  // 📝 SALVAR (CRIAÇÃO OU ATUALIZAÇÃO MANUAL)
  const handleSalvarHierarquia = async () => {
    if (!inputNome || !inputEmail) return alert("Nome e E-mail são obrigatórios.");
    
    try {
      setCarregando(true);
      let targetId = idSelecionado;

      if (modoEdicao && targetId) {
        // 1. Atualiza dados do Perfil existente
        await supabase.from("crm_profiles").update({
          nome: inputNome,
          email: inputEmail,
          role: inputRole
        }).eq("id", targetId);
      } else {
        // 2. Criação Manual (Gera um UUID randômico para uso no CRM interno)
        targetId = crypto.randomUUID();
        const { error } = await supabase.from("crm_profiles").insert([{
          id: targetId,
          nome: inputNome,
          email: inputEmail,
          role: inputRole
        }]);
        if (error) throw error;
      }

      // 3. Atualiza vínculo na árvore (Deleta relação antiga e cria a nova se houver superior selecionado)
      await supabase.from("crm_hierarquia").delete().eq("subordinado_id", targetId);
      
      if (inputSuperior && inputSuperior !== "nenhum") {
        await supabase.from("crm_hierarquia").insert([{
          subordinado_id: targetId,
          superior_id: inputSuperior
        }]);
      }

      alert(modoEdicao ? "Colaborador atualizado!" : "Novo colaborador inserido com sucesso!");
      fecharModal();
      await carregarHierarquiaGlobal();
    } catch (err: any) {
      alert(`Erro ao processar: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // 🗑️ DELETAR COLABORADOR DA ÁRVORE
  const handleDeletarColaborador = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este operador do CRM? Isso romperá os fluxos hierárquicos vinculados a ele.")) return;
    try {
      setCarregando(true);
      // Remove da tabela de hierarquia e de perfis (cascade limpa dependências diretas)
      await supabase.from("crm_hierarquia").delete().or(`subordinado_id.eq.${id},superior_id.eq.${id}`);
      const { error } = await supabase.from("crm_profiles").delete().eq("id", id);
      if (error) throw error;

      alert("Operador removido da base.");
      await carregarHierarquiaGlobal();
    } catch (err: any) {
      alert(`Erro ao deletar: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalParaCriacao = () => {
    setModoEdicao(false);
    setIdSelecionado(null);
    setInputNome("");
    setInputEmail("");
    setInputRole("SDR");
    setInputSuperior("nenhum");
    setModalAberto(true);
  };

  const abrirModalParaEdicao = (col: Colaborador) => {
    setModoEdicao(true);
    setIdSelecionado(col.id);
    setInputNome(col.nome);
    setInputEmail(col.email);
    setInputRole(col.role);
    setInputSuperior(col.superior_id || "nenhum");
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setIdSelecionado(null);
  };

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      
      {/* HEADER DA PÁGINA COM BOTÃO ADICIONAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">🌳 Organograma e Árvore de Hierarquias (CRM Global)</h1>
          <p className="text-xs text-slate-400">Gerencie operadores da esteira de crédito, altere atribuições ou adicione novos colaboradores de forma manual.</p>
        </div>
        <button 
          onClick={abrirModalParaCriacao}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-md transition-all cursor-pointer"
        >
          ➕ Novo Operador / Colaborador
        </button>
      </div>

      {carregando && <div className="p-2 text-center bg-blue-50 text-blue-600 rounded-lg animate-pulse font-bold text-[11px]">Processando alterações e carregando árvore...</div>}

      {/* TABELA DE CONFIGURAÇÃO DA ÁRVORE */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider">
              <th className="p-3">Colaborador / Operador</th>
              <th className="p-3">E-mail Corporativo</th>
              <th className="p-3">Cargo na Esteira</th>
              <th className="p-3">Superior Direto (Líder)</th>
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
                <td className="p-3 text-center flex items-center justify-center gap-1.5">
                  <button 
                    onClick={() => abrirModalParaEdicao(col)} 
                    className="px-2 py-1 bg-slate-800 text-white font-black uppercase text-[9px] rounded hover:bg-blue-600 transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    onClick={() => handleDeletarColaborador(col.id)} 
                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-black uppercase text-[9px] rounded border border-red-200 transition-colors"
                    title="Remover operador"
                  >
                    🗑️ Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔮 MODAL UNIFICADO: CADASTRO E EDIÇÃO DE OPERADORES */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-5 rounded-xl border border-slate-200 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-black uppercase text-slate-900 text-[11px] border-b pb-1">
              {modoEdicao ? "⚙️ Modificar Operador na Árvore" : "➕ Inserir Novo Operador na Árvore"}
            </h3>
            
            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Nome Completo:</label>
                <input type="text" value={inputNome} onChange={e => setInputNome(e.target.value)} placeholder="Ex: Luiz Comercial" className="w-full p-2 border bg-white rounded-lg outline-none font-bold text-slate-800 uppercase" />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">E-mail Corporativo:</label>
                <input type="email" value={inputEmail} onChange={e => setInputEmail(e.target.value)} placeholder="exemplo@nedcapital.com" className="w-full p-2 border bg-white rounded-lg outline-none font-mono text-slate-800" />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Cargo/Função Corporativa:</label>
                <select value={inputRole} onChange={e => setInputRole(e.target.value as any)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800">
                  <option value="SDR">SDR (Vê apenas seus próprios leads de prospecção)</option>
                  <option value="Gestor">Gestor / Comercial Luiz (Vê seus leads + os subordinados)</option>
                  <option value="Comite">Comitê de Crédito (Vê apenas leads maduros enviados a comitê)</option>
                  <option value="Diretoria">Diretoria Executiva (Acesso de leitura total na carteira)</option>
                  <option value="Master">Master / Administrador (Controle irrestrito global)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Líder / Reporte Direto:</label>
                <select value={inputSuperior} onChange={e => setInputSuperior(e.target.value)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800">
                  <option value="nenhum">Sem líder direto (Responde direto ao Master)</option>
                  {colaboradores.filter(c => c.id !== idSelecionado).map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.role})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-[10px] pt-2 border-t">
              <button onClick={fecharModal} className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg uppercase">Cancelar</button>
              <button onClick={handleSalvarHierarquia} className="px-4 py-1.5 bg-blue-600 text-white font-black rounded-lg uppercase shadow-md">
                {modoEdicao ? "Salvar Alterações" : "Gravar Operador"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}