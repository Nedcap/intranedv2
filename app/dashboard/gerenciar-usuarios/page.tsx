/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MAPA_DE_ROTAS } from "@/lib/rotas";

// 🔥 ESTRUTURA GRANULAR DE NOTIFICAÇÕES (AGRUPADA POR MÓDULOS)
const GRUPOS_NOTIFICACOES = [
  {
    categoria: "Crédito & Mesa V8",
    opcoes: [
      { key: "analises_status", label: "Mudanças de Status na Esteira", icone: "🚀" },
      { key: "analises_docs", label: "Alerta de Documentos Pendentes/Injetados", icone: "📂" },
      { key: "analises_finalizadas", label: "Dossiês Finalizados / Prontos", icone: "🏁" },
    ]
  },
  {
    categoria: "Comitê de Crédito",
    opcoes: [
      { key: "votos", label: "Votos Lançados pelos Diretores", icone: "🗳️" },
      { key: "chat_comite", label: "Mensagens de Alinhamento na Mesa", icone: "💬" },
    ]
  },
  {
    categoria: "Comercial & Cadastro",
    opcoes: [
      { key: "cadastro_cedentes", label: "Entrada de Novos Cedentes na Base", icone: "🏢" },
      { key: "comercial_leads", label: "Novos Leads / Prospectos Aprovados", icone: "🎯" },
      { key: "comercial_revisao", label: "Pedidos de Revisão de Limite", icone: "🔍" },
    ]
  },
  {
    categoria: "Consultas & Financeiro",
    opcoes: [
      { key: "cons_restritivos", label: "Novos Apontamentos Restritivos (Radar)", icone: "🚨" },
      { key: "fin_comissoes", label: "Fechamento de Cálculos de Comissão", icone: "💵" },
      { key: "fin_checagem", label: "Pendências na Mesa de Checagem", icone: "✅" },
    ]
  }
];

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
  
  // 🔥 Estados Novos (Sininho e RH)
  const [notificacoesConfig, setNotificacoesConfig] = useState<Record<string, boolean>>({});
  const [batePonto, setBatePonto] = useState(false);

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
    setSenha(""); 
    setBatePonto(!!user.bate_ponto); // Carrega a flag de ponto
    
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

    const notifBanco = user.notificacoes_config || {};
    setNotificacoesConfig(notifBanco);
  };

  const limparFormulario = () => {
    setSelecionado(null);
    setNome("");
    setEmail("");
    setSenha("");
    setCargo("Comercial");
    setPermissoes({});
    setNotificacoesConfig({}); 
    setBatePonto(false);
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    try {
      setSalvando(true);
      const emailTratado = email.trim().toLowerCase();

      if (selecionado) {
        const payloadPermissoes = (selecionado?.permissoes && !Array.isArray(selecionado.permissoes)) 
          ? { ...selecionado.permissoes } 
          : {};

        MAPA_DE_ROTAS.forEach(r => {
          if (permissoes[r.path]) {
            payloadPermissoes[r.path] = true;
          } else {
            delete payloadPermissoes[r.path];
          }
        });

        const payloadUpdate: any = {
          nome: nome.trim(),
          email: emailTratado,
          cargo: cargo,
          permissoes: payloadPermissoes,
          notificacoes_config: notificacoesConfig,
          bate_ponto: batePonto 
        };

        // 1. Atualiza dados complementares na tabela pública
        const { error } = await supabase.from("usuarios").update(payloadUpdate).eq("id", selecionado.id);
        if (error) throw error;

        // 🚨 CORREÇÃO: Se uma nova senha foi digitada, envia via PUT para atualizar o Auth Nativo
        if (senha.trim()) {
          const responseAuth = await fetch("/api/usuarios", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: selecionado.id,
              senha: senha.trim()
            }),
          });

          const resultadoAuth = await responseAuth.json();

          if (!responseAuth.ok) {
            throw new Error(resultadoAuth.error || "Falha ao sincronizar a nova senha com o sistema de autenticação.");
          }
        }

        alert("🎉 Permissões, dados e senha atualizados com sucesso!");
      } else {
        if (!senha.trim()) {
          alert("A senha de acesso inicial é obrigatória.");
          setSalvando(false);
          return;
        }

        const payloadPermissoes: Record<string, boolean> = {};
        MAPA_DE_ROTAS.forEach(r => {
          if (permissoes[r.path]) payloadPermissoes[r.path] = true;
        });

        const response = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            email: emailTratado,
            senha: senha.trim(),
            cargo: cargo,
            permissoes: payloadPermissoes,
            notificacoes_config: notificacoesConfig, 
            bate_ponto: batePonto 
          }),
        });

        const resultado = await response.json();

        if (!response.ok) {
          throw new Error(resultado.error || "Erro desconhecido na API");
        }

        if (resultado.user?.id) {
           await supabase.from("usuarios").update({ bate_ponto }).eq("id", resultado.user.id);
        }

        alert("🎉 Novo colaborador registrado AUTOMATICAMENTE no Auth e no Banco!");
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

  const alternarNotificacao = (key: string) => {
    setNotificacoesConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const contarModulos = (perms: any) => {
    if (!perms) return 0;
    if (Array.isArray(perms)) return perms.length;
    return Object.keys(perms).filter(k => k.startsWith("/")).length;
  };

  const contarAlertas = (notifs: any) => {
    if (!notifs) return 0;
    return Object.values(notifs).filter(v => v === true).length;
  };

  const toggleCategoriaNotificacao = (grupo: any) => {
    const todasAtivas = grupo.opcoes.every((op: any) => notificacoesConfig[op.key]);
    const novoEstado = { ...notificacoesConfig };
    
    grupo.opcoes.forEach((op: any) => {
      novoEstado[op.key] = !todasAtivas;
    });
    
    setNotificacoesConfig(novoEstado);
  };

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando painel de acessos...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">⚙️ Controle de Acessos e Usuários</h2>
          <span className="text-xs text-slate-500 font-medium">Gerencie permissões, alçadas e operadores técnicos do sistema.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* FORMULÁRIO DE GESTÃO */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs space-y-5">
          <h3 className="text-xs font-black text-slate-800 uppercase border-b border-slate-100 pb-3 tracking-wide">
            {selecionado ? "⚙️ Customizar Alçada de Segurança" : "➕ Adicionar Operador Técnico"}
          </h3>
          <form onSubmit={salvarUsuario} className="space-y-4 text-xs">
            
            <div className="flex flex-col space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Nome Completo:</label>
              <input 
                type="text" 
                required 
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
                placeholder="Ex: DIEGO NED" 
                className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-800 uppercase shadow-sm" 
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">E-mail Corporativo:</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="nome@nedcapital.com" 
                className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono text-slate-800 shadow-sm" 
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                {selecionado ? "Nova Senha (deixe vazio p/ manter):" : "Senha de Acesso:"}
              </label>
              <input 
                type="password" 
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                placeholder={selecionado ? "••••••••" : "Mínimo 6 caracteres"} 
                className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono text-slate-800 shadow-sm" 
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Cargo / Alçada de Permissão:</label>
              <select 
                value={cargo} 
                onChange={(e) => setCargo(e.target.value)} 
                className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-800 shadow-sm"
              >
                <option value="SDR">SDR (Filtro por Liderança/Próprios)</option>
                <option value="Comercial">Comercial (Filtro por Carteira)</option>
                <option value="Operacional">Operacional (Acesso Geral)</option>
                <option value="Master">Master (Acesso Completo + Configurações)</option>
              </select>
            </div>

            {/* 🔥 CONTROLE DE PONTO (RH) */}
            <div className="flex flex-col space-y-1.5 pt-3 border-t border-slate-100">
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">
                Controle de Jornada (RH):
              </label>
              <label className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-white transition-all shadow-inner">
                <input
                  type="checkbox"
                  checked={batePonto}
                  onChange={(e) => setBatePonto(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-[11px] font-black text-slate-700 uppercase">
                  Exigir Bate-Ponto Eletrônico
                </span>
              </label>
            </div>

            {/* CHECKLIST DE MODULOS */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-2">Módulos Habilitados (Acesso de Tela):</label>
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-48 overflow-y-auto pr-2 shadow-inner">
                {MAPA_DE_ROTAS?.map(r => (
                  <label key={r.path} className="flex items-center gap-3 p-1.5 rounded hover:bg-white transition-colors cursor-pointer text-xs font-bold text-slate-700 border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      checked={!!permissoes[r.path]} 
                      onChange={() => alternarPermissao(r.path)} 
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer focus:ring-blue-500" 
                    />
                    <span>{r.icone} {r.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 🔥 CHECKLIST DE NOTIFICAÇÕES GRANULARES */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-2">
                Alertas e Notificações (Sininho Global):
              </label>
              
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {GRUPOS_NOTIFICACOES.map((grupo, idx) => {
                  const todasAtivas = grupo.opcoes.every(op => notificacoesConfig[op.key]);
                  return (
                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-inner">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                        <span className="font-extrabold text-[10px] uppercase tracking-widest text-slate-400">
                          {grupo.categoria}
                        </span>
                        <button 
                          type="button"
                          onClick={() => toggleCategoriaNotificacao(grupo)}
                          className="text-[9px] font-bold text-blue-600 uppercase hover:underline"
                        >
                          {todasAtivas ? "Desmarcar Grupo" : "Marcar Grupo"}
                        </button>
                      </div>
                      
                      <div className="space-y-1.5">
                        {grupo.opcoes.map(n => (
                          <label key={n.key} className="flex items-center gap-3 p-1.5 rounded hover:bg-white transition-colors cursor-pointer text-xs font-bold text-slate-700 border border-transparent hover:border-slate-200">
                            <input 
                              type="checkbox" 
                              checked={!!notificacoesConfig[n.key]} 
                              onChange={() => alternarNotificacao(n.key)} 
                              className="w-4 h-4 text-amber-500 rounded border-slate-300 cursor-pointer focus:ring-amber-500" 
                            />
                            <span>{n.icone} {n.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button 
                type="submit" 
                disabled={salvando} 
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
              >
                {salvando ? "⏳ Salvando..." : selecionado ? "Gravar Parâmetros" : "Registrar Usuário"}
              </button>
              {selecionado && (
                <button 
                  type="button" 
                  onClick={limparFormulario} 
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs uppercase tracking-wider transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LISTAGEM DE USUÁRIOS COMPILADOS */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                  <th className="p-4 w-56">Nome / Operador</th>
                  <th className="p-4 w-64">E-mail Corporativo</th>
                  <th className="p-4 w-32">Perfil Alçada</th>
                  <th className="p-4 text-center w-36">Módulos/Alertas</th>
                  <th className="p-4 text-right w-24">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-black text-slate-900 uppercase truncate" title={u.nome}>
                      <span className="flex items-center gap-2">
                        {u.nome}
                        {u.bate_ponto && <span title="Registra Ponto Eletrônico">🕒</span>}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs truncate" title={u.email}>
                      {u.email}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                        u.cargo === 'Master' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        u.cargo === 'Operacional' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        u.cargo === 'SDR' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {u.cargo || "Comercial"}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-500 font-bold text-[11px] leading-tight">
                      <div className="flex flex-col items-center gap-1">
                        <span>{u.cargo === 'Master' ? "Acesso Total" : `🔓 ${contarModulos(u.permissoes)} módulos`}</span>
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 rounded uppercase">
                          🔔 {contarAlertas(u.notificacoes_config)} ativos
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => iniciarEdicao(u)} 
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[10px] uppercase cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5 ml-auto"
                      >
                        ⚙️ Config
                      </button>
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 font-bold italic">
                      Nenhum usuário cadastrado no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      
      {/* Scrollbar Customizada da div de notificações */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}