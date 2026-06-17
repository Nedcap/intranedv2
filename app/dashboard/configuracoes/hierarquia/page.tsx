/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  role: "Master" | "Gestor" | "SDR" | "Comite" | "Diretoria";
  superior_id?: string;
  superior_nome?: string;
}

export default function GerenciarHierarquiaPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // Estado para modais e formulários
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  
  const [inputNome, setInputNome] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [inputRole, setInputRole] = useState<any>("SDR");
  const [inputSuperior, setInputSuperior] = useState("");

  const carregarHierarquiaGlobal = async () => {
    try {
      setCarregando(true);
      
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

  // Alterar líder direto via clique rápido na caixinha da árvore
  const handleMudarLiderDireto = async (subordinadoId: string, novoSuperiorId: string) => {
    try {
      setCarregando(true);
      // Remove vínculo antigo
      await supabase.from("crm_hierarquia").delete().eq("subordinado_id", subordinadoId);
      
      // Se não escolheu "nenhum", insere o novo vínculo
      if (novoSuperiorId && novoSuperiorId !== "nenhum") {
        await supabase.from("crm_hierarquia").insert([{
          subordinado_id: subordinadoId,
          superior_id: novoSuperiorId
        }]);
      }
      await carregarHierarquiaGlobal();
    } catch (err: any) {
      alert(`Erro ao mudar liderança: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarHierarquia = async () => {
    if (!inputNome || !inputEmail) return alert("Nome e E-mail são obrigatórios.");
    
    try {
      setCarregando(true);
      let targetId = idSelecionado;

      if (modoEdicao && targetId) {
        await supabase.from("crm_profiles").update({
          nome: inputNome,
          email: inputEmail,
          role: inputRole
        }).eq("id", targetId);
      } else {
        targetId = crypto.randomUUID();
        const { error } = await supabase.from("crm_profiles").insert([{
          id: targetId,
          nome: inputNome,
          email: inputEmail,
          role: inputRole
        }]);
        if (error) throw error;
      }

      await supabase.from("crm_hierarquia").delete().eq("subordinado_id", targetId);
      
      if (inputSuperior && inputSuperior !== "nenhum") {
        await supabase.from("crm_hierarquia").insert([{
          subordinado_id: targetId,
          superior_id: inputSuperior
        }]);
      }

      alert(modoEdicao ? "Colaborador atualizado!" : "Novo colaborador inserido!");
      fecharModal();
      await carregarHierarquiaGlobal();
    } catch (err: any) {
      alert(`Erro ao processar: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleDeletarColaborador = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este operador? Isso romperá os fluxos hierárquicos dele.")) return;
    try {
      setCarregando(true);
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

  // Estrutura a árvore computada em tempo de execução para renderização recursiva
  const colaboradoresPorLider = useMemo(() => {
    const topos = colaboradores.filter(c => !c.superior_id);
    const subordinados = colaboradores.filter(c => c.superior_id);
    return { topos, subordinados };
  }, [colaboradores]);

  const abrirModalParaCriacao = () => {
    setModoEdicao(false); setIdSelecionado(null); setInputNome(""); setInputEmail(""); setInputRole("SDR"); setInputSuperior("nenhum"); setModalAberto(true);
  };

  const abrirModalParaEdicao = (col: Colaborador) => {
    setModoEdicao(true); setIdSelecionado(col.id); setInputNome(col.nome); setInputEmail(col.email); setInputRole(col.role); setInputSuperior(col.superior_id || "nenhum"); setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setIdSelecionado(null); };

  // Componente interno recursivo para desenhar os nós da árvore
  function NoDaArvore({ membro }: { membro: Colaborador }) {
    const filhos = colaboradoresPorLider.subordinados.filter(c => c.superior_id === membro.id);

    return (
      <div className="flex flex-col items-center mt-4">
        {/* Caixinha do Usuário */}
        <div className="bg-slate-50 border border-slate-200 shadow-xs rounded-xl p-3.5 w-64 text-center hover:border-blue-500 transition-all relative">
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => abrirModalParaEdicao(membro)} className="text-slate-400 hover:text-blue-600 text-[10px]" title="Editar cadastro">✏️</button>
            <button onClick={() => handleDeletarColaborador(membro.id)} className="text-slate-400 hover:text-red-600 text-[10px]" title="Excluir">🗑️</button>
          </div>

          <h3 className="font-bold text-slate-900 uppercase text-[11px] truncate pr-8">{membro.nome}</h3>
          <p className="text-[9px] text-slate-400 font-mono truncate mb-1.5">{membro.email}</p>
          
          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase mb-3 ${
            membro.role === 'Master' ? 'bg-red-100 text-red-700' : 
            membro.role === 'Gestor' ? 'bg-blue-100 text-blue-700' : 
            membro.role === 'Comite' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {membro.role}
          </span>

          {/* Seletor rápido de Vínculo Hierárquico direto na caixinha */}
          <div className="mt-2 pt-2 border-t border-slate-200/60 text-left">
            <label className="block text-[8px] uppercase font-bold text-slate-400 mb-0.5">Reporta diretamente a:</label>
            <select 
              value={membro.superior_id || "nenhum"} 
              onChange={(e) => handleMudarLiderDireto(membro.id, e.target.value)}
              className="w-full bg-white border border-slate-200 rounded p-1 text-[9px] font-bold text-slate-700 outline-none"
            >
              <option value="nenhum">Ninguém (Topo da Árvore)</option>
              {colaboradores.filter(c => c.id !== membro.id).map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha conectora vertical estrutural */}
        {filhos.length > 0 && <div className="w-0.5 h-6 bg-slate-300 my-1"></div>}

        {/* Renderização dos filhos ramificados lateralmente */}
        {filhos.length > 0 && (
          <div className="flex gap-4 border-t border-slate-300 pt-4 px-2 relative">
            {filhos.map(filho => (
              <NoDaArvore key={filho.id} membro={filho} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">🌳 Construtor Visual de Organograma e Hierarquias</h1>
          <p className="text-xs text-slate-400">Gerencie a árvore de visibilidade do CRM mudando o reporte direto diretamente nas caixinhas.</p>
        </div>
        <button 
          onClick={abrirModalParaCriacao}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-md transition-all cursor-pointer"
        >
          ➕ Adicionar Novo Colaborador
        </button>
      </div>

      {carregando && (
        <div className="p-2 text-center bg-blue-50 text-blue-600 rounded-lg animate-pulse font-bold text-[11px]">
          Sincronizando novas chaves e atualizando organograma...
        </div>
      )}

      {/* WORKSPACE DO ORGANOGRAMA VISUAL */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 overflow-x-auto min-h-[500px] flex justify-start items-start content-start">
        <div className="flex gap-10 items-start mx-auto">
          {colaboradoresPorLider.topos.length === 0 && !carregando ? (
            <div className="text-center text-slate-400 italic text-[11px] py-12 w-full">
              Nenhum colaborador cadastrado como topo da árvore. Adicione um ou altere o líder de alguém.
            </div>
          ) : (
            colaboradoresPorLider.topos.map(topo => (
              <NoDaArvore key={topo.id} membro={topo} />
            ))
          )}
        </div>
      </div>

      {/* 🔮 MODAL UNIFICADO: CADASTRO E EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-5 rounded-xl border border-slate-200 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-black uppercase text-slate-900 text-[11px] border-b pb-1">
              {modoEdicao ? "⚙️ Modificar Operador na Árvore" : "➕ Inserir Novo Operador na Árvore"}
            </h3>
            
            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Nome Completo:</label>
                <input type="text" value={inputNome} onChange={e => setInputNome(e.target.value)} placeholder="Ex: LUIZ COMERCIAl" className="w-full p-2 border bg-white rounded-lg outline-none font-bold text-slate-800 uppercase" />
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
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Líder / Reporte Direto Inicial:</label>
                <select value={inputSuperior} onChange={e => setInputSuperior(e.target.value)} className="w-full p-2 border rounded-lg outline-none font-bold text-slate-800">
                  <option value="nenhum">Sem líder direto (Topo da Árvore)</option>
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