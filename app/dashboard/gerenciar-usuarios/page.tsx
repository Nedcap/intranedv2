/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MAPA_DE_ROTAS, obterRotasMaster } from "@/lib/rotas"; // 🔄 Mantendo a conexão com a Central Única

export default function GerenciarUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);

  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("Comercial");
  const [abasPermitidas, setAbasPermitidas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function carregarUsuarios() {
    try {
      setCarregandoLista(true);
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, email, senha, cargo, permissoes")
        .order("nome", { ascending: true });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const iniciarEdicao = (user: any) => {
    setIdSelecionado(user.id);
    setNome(user.nome);
    setEmail(user.email);
    setSenha(user.senha);
    setCargo(user.cargo || "Comercial");
    
    if (Array.isArray(user.permissoes)) {
      setAbasPermitidas(user.permissoes);
    } else if (user.permissoes && typeof user.permissoes === "object") {
      const chavesValidas = Object.keys(user.permissoes).filter(key => user.permissoes[key] === true);
      setAbasPermitidas(chavesValidas);
    } else {
      setAbasPermitidas([]);
    }
  };

  const cancelarEdicao = () => {
    setIdSelecionado(null);
    setNome("");
    setEmail("");
    setSenha("");
    setCargo("Comercial");
    setAbasPermitidas([]);
  };

  const toggleRota = (path: string) => {
    if (abasPermitidas.includes(path)) {
      setAbasPermitidas(abasPermitidas.filter((rota) => rota !== path));
    } else {
      setAbasPermitidas([...abasPermitidas, path]);
    }
  };

  const handleSalvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const dadosUsuario = {
      nome,
      email: email.trim(),
      senha,
      cargo,
      permissoes: cargo === "Master" ? obterRotasMaster() : abasPermitidas
    };

    try {
      if (idSelecionado) {
        const { error } = await supabase
          .from("usuarios")
          .update(dadosUsuario)
          .eq("id", idSelecionado);

        if (error) throw error;
        alert("🎉 Usuário atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("usuarios")
          .insert([dadosUsuario]);

        if (error) throw error;
        alert("🎉 Novo usuário criado com sucesso!");
      }

      cancelarEdicao();
      await carregarUsuarios();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao processar operação: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-[13px] font-sans">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Controle de Acessos</h2>
        <p className="text-slate-500 text-sm mt-1">Gerencie os colaboradores da Ned Capital, defina cargos e configure permissões de telas baseadas na Central de Rotas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Colaboradores Registrados</h3>
          </div>

          {carregandoLista ? (
            <div className="p-8 text-center text-slate-400 font-bold animate-pulse">Carregando lista de acessos...</div>
          ) : usuarios.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhum usuário localizado no banco de dados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-3">Colaborador</th>
                    <th className="p-3">Cargo</th>
                    <th className="p-3 text-center">Telas Habilitadas</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {usuarios.map((user) => (
                    <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${idSelecionado === user.id ? "bg-blue-50/40" : ""}`}>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{user.nome}</div>
                        <div className="text-xs text-slate-400 font-medium font-mono mt-0.5">{user.email}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          user.cargo === "Master" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                          user.cargo === "Operacional" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {user.cargo || "Comercial"}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs text-slate-500 font-bold">
                        {user.cargo === "Master" ? "Todas" : `${Array.isArray(user.permissoes) ? user.permissoes.length : 0} / ${MAPA_DE_ROTAS.length}`}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => iniciarEdicao(user)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`lg:col-span-5 bg-white border rounded-xl shadow-sm transition-all p-6 ${
          idSelecionado ? "border-amber-300 shadow-amber-100/50" : "border-slate-200"
        }`}>
          <div className="mb-6">
            <h3 className="text-base font-black text-slate-900">
              {idSelecionado ? "🔄 Alterar Cadastro" : "➕ Criar Novo Acesso"}
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {idSelecionado ? `Editando as credenciais de: ${nome}` : "Defina as credenciais de login e os privilégios."}
            </p>
          </div>

          <form onSubmit={handleSalvarUsuario} className="space-y-4">
            <div className="space-y-1">
              <label className="block font-bold text-slate-600">Nome Completo</label>
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800" />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-600">E-mail Corporativo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600">Senha</label>
                <input type="text" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha de acesso" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600">Cargo / Hierarquia</label>
                <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-xs outline-none cursor-pointer focus:border-blue-500">
                  <option value="Comercial">Comercial</option>
                  <option value="Operacional">Operacional</option>
                  <option value="Diretor">Diretoria</option>
                  <option value="Master">Master</option>
                </select>
              </div>
            </div>

            <hr className="border-slate-100 my-2" />

            <div className="space-y-2">
              <label className="block font-bold text-slate-700 text-xs uppercase tracking-wider">Módulos Habilitados (Central de Rotas)</label>
              {cargo === "Master" ? (
                <div className="p-3 bg-purple-50 text-purple-800 border border-purple-100 font-bold text-xs rounded-lg">
                  💡 Usuários com perfil 'Master' possuem passe livre automático em todas as telas mapeadas na central.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MAPA_DE_ROTAS.map((rota) => (
                    <label key={rota.path} className="flex items-center gap-2.5 p-2.5 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={Array.isArray(abasPermitidas) && abasPermitidas.includes(rota.path)}
                        onChange={() => toggleRota(rota.path)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-700 text-xs">{rota.icone} {rota.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-4">
              {idSelecionado && (
                <button 
                  type="button" 
                  onClick={cancelarEdicao}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit" 
                disabled={salvando}
                className={`px-6 py-2 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer ${
                  idSelecionado 
                    ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10" 
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/10"
                }`}
              >
                {salvando ? "Processando..." : idSelecionado ? "💾 Atualizar Usuário" : "🚀 Cadastrar Usuário"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}