/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MAPA_DE_ROTAS } from "@/lib/rotas";

export default function GerenciarUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Estados do Formulário
  const [selecionado, setSelecionado] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("Comercial");
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({});

  const carregarUsuarios = async () => {
    try {
      setCarregando(true);
      const { data } = await supabase.from("usuarios").select("*").order("nome", { ascending: true });
      if (data) setUsuarios(data);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const iniciarEdicao = (user: any) => {
    setSelecionado(user);
    setNome(user.nome || "");
    setEmail(user.email || "");
    setSenha(""); // Senha em branco por segurança na edição
    
    const cargoSalvo = user.cargo || "Comercial";
    // 🎯 Fix: Sintaxe Javascript/TypeScript nativa corrigida (sem elif)
    if (cargoSalvo.toLowerCase() === "comercial") {
      setCargo("Comercial");
    } else if (cargoSalvo.toLowerCase() === "operacional") {
      setCargo("Operacional");
    } else if (cargoSalvo.toLowerCase() === "master") {
      setCargo("Master");
    } else {
      setCargo(cargoSalvo);
    }

    // Mapeia permissões salvas para o checklist do front-end
    const novasPerms: Record<string, boolean> = {};
    MAPA_DE_ROTAS.forEach(r => {
      novasPerms[r.path] = Array.isArray(user.permissoes) && user.permissoes.includes(r.path);
    });
    setPermissoes(novasPerms);
  };

  const limparFormulario = () => {
    setSelecionado(null);
    setNome("");
    setEmail("");
    setSenha("");
    setCargo("Comercial");
    setPermissoes({});
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    try {
      // Transforma o objeto de booleanos em uma array de strings limpa
      const arrayPermissoes = Object.keys(permissoes).filter(k => permissoes[k] === true);
      const emailTratado = email.trim().toLowerCase();

      if (selecionado) {
        // Modo Edição
        const payloadUpdate: any = {
          nome: nome.trim(),
          email: emailTratado,
          cargo: cargo,
          permissoes: arrayPermissoes
        };

        // Só atualiza a senha se o administrador digitou algo no campo
        if (senha.trim()) {
          payloadUpdate.senha = senha.trim();
        }

        const { error } = await supabase.from("usuarios").update(payloadUpdate).eq("id", selecionado.id);
        if (error) throw error;
        alert("🎉 Usuário atualizado com sucesso!");
      } else {
        // Modo Cadastro Novo
        if (!senha.trim()) {
          alert("A senha é obrigatória para novos usuários.");
          return;
        }

        const { error } = await supabase.from("usuarios").insert([{
          nome: nome.trim(),
          email: emailTratado,
          senha: senha.trim(),
          cargo: cargo,
          permissoes: arrayPermissoes
        }]);

        if (error) throw error;
        alert("🎉 Novo colaborador registrado no sistema!");
      }

      limparFormulario();
      carregarUsuarios();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar: ${err.message}`);
    }
  };

  const alternarPermissao = (path: string) => {
    setPermissoes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando central de acessos...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-6 text-[13px]">
      <div className="border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">⚙️ Gerenciar Usuários e Permissões</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Formulário de Ação */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-2">
            {selecionado ? "📝 Editar Perfil" : "➕ Criar Novo Usuário"}
          </h3>
          <form onSubmit={salvarUsuario} className="space-y-3.5">
            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-600">Nome Completo</label>
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Diego Ned" className="p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-600">E-mail Corporativo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@nedcapital.com.br" className="p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-600">{selecionado ? "Nova Senha (deixe em branco p/ manter)" : "Senha de Acesso"}</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={selecionado ? "••••••" : "Mínimo 6 dígitos"} className="p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-600">Cargo / Alçada</label>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="p-2 border border-slate-200 rounded-lg outline-none bg-white focus:border-blue-500 font-bold">
                <option value="Comercial">Comercial (Filtro por Carteira)</option>
                <option value="Operacional">Operacional (Acesso Geral)</option>
                <option value="Master">Master (Acesso Completo + Configurações)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block font-black text-slate-500 text-[11px] uppercase tracking-wider mb-2">Abas Habilitadas:</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {MAPA_DE_ROTAS.map(r => (
                  <label key={r.path} className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs font-semibold">
                    <input type="checkbox" checked={!!permissoes[r.path]} onChange={() => alternarPermissao(r.path)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
                    <span>{r.icone} {r.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button type="submit" className="flex-1 p-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs uppercase tracking-tight">
                {selecionado ? "Salvar Alterações" : "Registrar"}
              </button>
              {selecionado && (
                <button type="button" onClick={limparFormulario} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg cursor-pointer transition-colors">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Listagem de Colaboradores */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
                  <th className="p-3.5">Nome</th>
                  <th className="p-3.5">E-mail</th>
                  <th className="p-3.5">Perfil</th>
                  <th className="p-3.5 text-center">Módulos</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900">{u.nome}</td>
                    <td className="p-3.5 text-slate-500 font-mono text-xs">{u.email}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        u.cargo === 'Master' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                        u.cargo === 'Operacional' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.cargo || "Comercial"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-slate-400 font-bold">
                      {u.cargo === 'Master' ? "Todos" : `${Array.isArray(u.permissoes) ? u.permissoes.length : 0} abas`}
                    </td>
                    <td className="p-3.5 text-center">
                      <button onClick={() => iniciarEdicao(u)} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs cursor-pointer transition-colors shadow-xs uppercase tracking-tight">
                        ⚙️ CONFIGURAR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}