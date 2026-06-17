/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MAPA_DE_ROTAS } from "@/lib/rotas";

export default function GerenciarUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  
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
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
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
    setSenha(""); // Mantido em branco por segurança
    
    // 🎯 SDR ADICIONADO AQUI
    const cargoSalvo = user.cargo || "Comercial";
    if (cargoSalvo.toLowerCase() === "comercial") {
      setCargo("Comercial");
    } else if (cargoSalvo.toLowerCase() === "sdr") {
      setCargo("SDR");
    } else if (cargoSalvo.toLowerCase() === "operacional") {
      setCargo("Operacional");
    } else if (cargoSalvo.toLowerCase() === "master") {
      setCargo("Master");
    } else {
      setCargo(cargoSalvo);
    }

    // Mapeia permissões salvas restaurando o estado dos checkboxes.
    // Preparado para ler Array antigo ou o JSONB novo sem quebrar.
    const novasPerms: Record<string, boolean> = {};
    const permsBanco = user.permissoes || {};
    const isArray = Array.isArray(permsBanco);

    MAPA_DE_ROTAS.forEach(r => {
      if (isArray) {
        novasPerms[r.path] = permsBanco.includes(r.path);
      } else {
        novasPerms[r.path] = !!permsBanco[r.path];
      }
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
      setSalvando(true);
      const emailTratado = email.trim().toLowerCase();

      // 🛡️ BLINDAGEM DA HIERARQUIA: 
      // Em vez de forçar um Array e apagar a chave "lider_id", mantemos o objeto do banco.
      const payloadPermissoes = (selecionado?.permissoes && !Array.isArray(selecionado.permissoes)) 
        ? { ...selecionado.permissoes } 
        : {};

      // Atualiza apenas os módulos de visualização no JSON
      MAPA_DE_ROTAS.forEach(r => {
        if (permissoes[r.path]) {
          payloadPermissoes[r.path] = true;
        } else {
          delete payloadPermissoes[r.path];
        }
      });

      if (selecionado) {
        // Modo Edição
        const payloadUpdate: any = {
          nome: nome.trim(),
          email: emailTratado,
          cargo: cargo,
          permissoes: payloadPermissoes
        };

        if (senha.trim()) {
          payloadUpdate.senha = senha.trim(); // Ajuste conforme a sua criptografia
        }

        const { error } = await supabase.from("usuarios").update(payloadUpdate).eq("id", selecionado.id);
        if (error) throw error;
        alert("🎉 Permissões e dados atualizados com sucesso!");
      } else {
        // Modo Cadastro Novo
        if (!senha.trim()) {
          alert("A senha de acesso inicial é obrigatória.");
          return;
        }

        const { error } = await supabase.from("usuarios").insert([{
          nome: nome.trim(),
          email: emailTratado,
          senha: senha.trim(),
          cargo: cargo,
          permissoes: payloadPermissoes
        }]);

        if (error) throw error;
        alert("🎉 Novo colaborador registrado no sistema com sucesso!");
      }

      limparFormulario();
      await carregarUsuarios();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao persistir informações: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const alternarPermissao = (path: string) => {
    setPermissoes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Calcula visualmente quantos módulos a pessoa tem, ignorando as chaves internas do sistema (ex: lider_id)
  const contarModulos = (perms: any) => {
    if (!perms) return 0;
    if (Array.isArray(perms)) return perms.length;
    return Object.keys(perms).filter(k => k.startsWith("/")).length;
  };

  if (carregando) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse text-xs uppercase font-mono">Carregando central de acessos e políticas do banco...</div>;

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      
      {/* HEADER DA PÁGINA */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-black text-slate-900 uppercase">⚙️ Painel de Controle de Acessos e Usuários</h1>
        <p className="text-xs text-slate-400">Atribua permissões exclusivas por abas da esteira de crédito e defina regras de visualização de carteira.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* FORMULÁRIO DE GESTÃO */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-[11px] font-black text-slate-900 uppercase border-b border-slate-200/60 pb-2 tracking-wide">
            {selecionado ? "⚙️ Customizar Alçada de Segurança" : "➕ Adicionar Operador Técnico"}
          </h3>
          <form onSubmit={salvarUsuario} className="space-y-4 text-[11px]">
            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-500 uppercase text-[9px]">Nome Completo:</label>
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: DIEGO NED" className="p-2 border bg-white border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold uppercase" />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-500 uppercase text-[9px]">E-mail Corporativo:</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@nedcapital.com" className="p-2 border bg-white border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-slate-800" />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-500 uppercase text-[9px]">{selecionado ? "Nova Senha (deixe vazio p/ manter):" : "Senha de Acesso:"}</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={selecionado ? "••••••••" : "Mínimo 6 caracteres"} className="p-2 border bg-white border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono" />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="font-bold text-slate-500 uppercase text-[9px]">Cargo / Alçada de Permissão:</label>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="p-2 border border-slate-200 rounded-lg outline-none bg-white focus:border-blue-500 font-black text-slate-800">
                {/* 🎯 ADICIONADO O SDR E ORDENADO */}
                <option value="SDR">SDR (Filtro por Liderança/Próprios)</option>
                <option value="Comercial">Comercial (Filtro por Carteira)</option>
                <option value="Operacional">Operacional (Acesso Geral)</option>
                <option value="Master">Master (Acesso Completo + Configurações)</option>
              </select>
            </div>

            {/* CHECKLIST DE MODULOS */}
            <div className="pt-2 border-t border-slate-200/60">
              <label className="block font-black text-slate-500 text-[9px] uppercase tracking-wider mb-2">Módulos/Abas Habilitadas de Forma Direta:</label>
              <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/60 max-h-48 overflow-y-auto pr-1">
                {MAPA_DE_ROTAS?.map(r => (
                  <label key={r.path} className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer text-[11px] font-bold text-slate-800">
                    <input type="checkbox" checked={!!permissoes[r.path]} onChange={() => alternarPermissao(r.path)} className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 cursor-pointer" />
                    <span>{r.icone} {r.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={salvando} className="flex-1 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-lg cursor-pointer transition-all shadow-sm uppercase tracking-wide text-[10px]">
                {salvando ? "Salvando..." : selecionado ? "Gravar Parâmetros" : "Registrar Usuário"}
              </button>
              {selecionado && (
                <button type="button" onClick={limparFormulario} className="p-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-lg cursor-pointer transition-all uppercase text-[10px]">
                  Sair
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LISTAGEM DE USUÁRIOS COMPILADOS */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider">
                  <th className="p-3.5">Nome / Operador</th>
                  <th className="p-3.5">E-mail Corporativo</th>
                  <th className="p-3.5">Perfil Alçada</th>
                  <th className="p-3.5 text-center">Módulos Ativos</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-all">
                    <td className="p-3.5 font-bold text-slate-900 uppercase">{u.nome}</td>
                    <td className="p-3.5 text-slate-500 font-mono text-[10px]">{u.email}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        u.cargo === 'Master' ? 'bg-purple-100 text-purple-700' :
                        u.cargo === 'Operacional' ? 'bg-blue-100 text-blue-700' : 
                        u.cargo === 'SDR' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {u.cargo || "Comercial"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-slate-600 font-bold font-mono">
                      {u.cargo === 'Master' ? "ACESSO TOTAL" : `🔓 ${contarModulos(u.permissoes)} módulos`}
                    </td>
                    <td className="p-3.5 text-right">
                      <button onClick={() => iniciarEdicao(u)} className="px-2.5 py-1 bg-slate-900 hover:bg-blue-600 text-white font-black rounded text-[9px] cursor-pointer transition-all uppercase shadow-xs">
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