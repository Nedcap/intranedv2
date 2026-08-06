/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { MAPA_DE_ROTAS } from "@/lib/rotas";
import { supabase } from "@/lib/supabase";

// 🎯 DICIONÁRIO DE AÇÕES E BOTÕES GRANULARES POR TELA
const ACOES_POR_ROTA: Record<string, { key: string; label: string; icone: string }[]> = {
  "/dashboard/comite": [
    { key: "btn_votar", label: "Computar Voto na Mesa", icone: "🗳️" },
    { key: "btn_decisao_final", label: "Crivo de Decisão Final (Diretoria)", icone: "🏁" },
    { key: "btn_forcar_veredito", label: "Ação Executiva: Forçar Veredito", icone: "⚡" },
    { key: "btn_chat", label: "Enviar Mensagens na Mesa de Debates", icone: "💬" }
  ],
  "/dashboard/motor-credito/analise": [
    { key: "btn_adicionar_empresa", label: "Adicionar Nova Empresa Manualmente", icone: "➕" },
    { key: "btn_deletar_analise", label: "Excluir Análise da Esteira", icone: "🗑️" },
    { key: "btn_reprocessar_ia", label: "Forçar Reprocessamento pelo Motor V8", icone: "🤖" },
    { key: "btn_exportar_drive", label: "Exportar Dossiê para Google Drive", icone: "📤" }
  ],
  "/dashboard/gerenciar-usuarios": [
    { key: "btn_criar_usuario", label: "Cadastrar Novos Operadores", icone: "👤" },
    { key: "btn_editar_permissoes", label: "Alterar Alçadas de Segurança", icone: "⚙️" },
    { key: "btn_redefinir_senha", label: "Redefinir Senhas de Acesso", icone: "🔑" }
  ],
  "/dashboard/financeiro": [
    { key: "btn_fechar_comissoes", label: "Efetivar Fechamento de Comissões", icone: "💵" },
    { key: "btn_aprovar_pagamentos", label: "Aprovar Lançamentos de Pagamento", icone: "✅" }
  ],
  "/dashboard/prospeccao": [
    { key: "btn_exportar_leads", label: "Exportar Planilhas de Prospectos", icone: "📊" },
    { key: "btn_atribuir_carteira", label: "Vincular Lead a Comercial", icone: "🎯" }
  ]
};

// 🔥 NOTIFICAÇÕES GRANULARES
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

// Helper para as cores dos cargos
const getCargoStyle = (cargo: string) => {
  switch (cargo) {
    case 'Master': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Diretor': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'Operacional': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'SDR': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default: return 'bg-amber-100 text-amber-700 border-amber-200';
  }
};

const getInitials = (name: string) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export default function GerenciarUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  
  // Estados de Controle de UI
  const [selecionado, setSelecionado] = useState<any>(null);
  const [isCriando, setIsCriando] = useState(false);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("Comercial");
  
  // 🛡️ Permissões Granulares
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({});
  const [verApenasCarteira, setVerApenasCarteira] = useState(false);
  const [notificacoesConfig, setNotificacoesConfig] = useState<Record<string, boolean>>({});
  const [batePonto, setBatePonto] = useState(false);

  const obterTokenHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token || ""}`
    };
  };

  const carregarUsuarios = async () => {
    try {
      setCarregando(true);
      const headers = await obterTokenHeaders();
      const res = await fetch("/api/usuarios", { method: "GET", headers });
      
      if (!res.ok) throw new Error("Falha ao carregar usuários. Acesso negado.");
      
      const data = await res.json();
      setUsuarios(data);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const iniciarCriacao = () => {
    setSelecionado(null);
    setIsCriando(true);
    setNome("");
    setEmail("");
    setSenha("");
    setCargo("Comercial");
    setPermissoes({});
    setNotificacoesConfig({}); 
    setBatePonto(false);
    setVerApenasCarteira(false);
  };

  const iniciarEdicao = (user: any) => {
    setSelecionado(user);
    setIsCriando(false);
    setNome(user.nome || "");
    setEmail(user.email || "");
    setSenha(""); 
    setBatePonto(!!user.bate_ponto);
    setVerApenasCarteira(!!user.ver_apenas_carteira);
    setCargo(user.cargo || "Comercial");

    const permsBanco = user.permissoes || {};
    const novasPerms: Record<string, boolean> = {};

    if (Array.isArray(permsBanco)) {
      permsBanco.forEach((p: string) => novasPerms[p] = true);
    } else if (typeof permsBanco === "object") {
      Object.keys(permsBanco).forEach((k) => novasPerms[k] = !!permsBanco[k]);
    }
    
    setPermissoes(novasPerms);
    setNotificacoesConfig(user.notificacoes_config || {});
  };

  const fecharPainel = () => {
    setSelecionado(null);
    setIsCriando(false);
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    try {
      setSalvando(true);
      const emailTratado = email.trim().toLowerCase();

      if (!selecionado && !senha.trim()) {
        alert("A senha de acesso inicial é obrigatória para novos usuários.");
        return;
      }

      const method = selecionado ? "PUT" : "POST";
      const headers = await obterTokenHeaders();

      const response = await fetch("/api/usuarios", {
        method,
        headers,
        body: JSON.stringify({
          userId: selecionado ? selecionado.id : undefined,
          nome: nome.trim(),
          email: emailTratado,
          senha: senha.trim() || undefined,
          cargo: cargo,
          permissoes: permissoes,
          ver_apenas_carteira: verApenasCarteira,
          notificacoes_config: notificacoesConfig,
          bate_ponto: batePonto 
        }),
      });

      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.error || "Erro desconhecido na API.");

      alert(selecionado ? "🎉 Configurações do operador atualizadas!" : "🎉 Novo operador registrado com sucesso!");
      
      await carregarUsuarios();
      if (!selecionado) fecharPainel(); // Fecha se estava criando
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao persistir informações: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const alternarPermissaoChave = (key: string) => setPermissoes(prev => ({ ...prev, [key]: !prev[key] }));
  const alternarNotificacao = (key: string) => setNotificacoesConfig(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleCategoriaNotificacao = (grupo: any) => {
    const todasAtivas = grupo.opcoes.every((op: any) => notificacoesConfig[op.key]);
    const novoEstado = { ...notificacoesConfig };
    grupo.opcoes.forEach((op: any) => novoEstado[op.key] = !todasAtivas);
    setNotificacoesConfig(novoEstado);
  };

  const usuariosFiltrados = useMemo(() => {
    if (!buscaUsuario) return usuarios;
    const lowerBusca = buscaUsuario.toLowerCase();
    return usuarios.filter(u => 
      (u.nome && u.nome.toLowerCase().includes(lowerBusca)) || 
      (u.email && u.email.toLowerCase().includes(lowerBusca)) ||
      (u.cargo && u.cargo.toLowerCase().includes(lowerBusca))
    );
  }, [usuarios, buscaUsuario]);

  if (carregando && usuarios.length === 0) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando painel de acessos...</div>;

  const exibeFormulario = isCriando || selecionado;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Gestão de Equipe & Acessos</h2>
            </div>
            <span className="text-sm text-slate-500 font-medium ml-12">Configure módulos, alçadas e isolamento de carteira por operador.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================== */}
          {/* LADO ESQUERDO: LISTA DE USUÁRIOS (MASTER)  */}
          {/* ========================================== */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            <button 
              onClick={iniciarCriacao}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-indigo-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Novo Operador
            </button>

            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="Pesquisar por nome, email ou cargo..." 
                value={buscaUsuario}
                onChange={e => setBuscaUsuario(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm transition-all"
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar pr-1">
              {usuariosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-medium bg-white rounded-xl border border-dashed border-slate-300">
                  Nenhum usuário encontrado.
                </div>
              ) : (
                usuariosFiltrados.map(u => {
                  const isSelected = selecionado?.id === u.id;
                  return (
                    <div 
                      key={u.id} 
                      onClick={() => iniciarEdicao(u)}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${isSelected ? "bg-indigo-50 border-indigo-400 shadow-md transform scale-[1.01]" : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shrink-0 ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {getInitials(u.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`font-extrabold truncate ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>{u.nome}</h4>
                          {u.bate_ponto && <span title="Bate-Ponto Ativo" className="text-xs">🕒</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate mb-1.5">{u.email}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${getCargoStyle(u.cargo)}`}>
                            {u.cargo || "Comercial"}
                          </span>
                          {u.ver_apenas_carteira && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              🔒 Isolado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================== */}
          {/* LADO DIREITO: PAINEL DE EDIÇÃO (DETAIL)    */}
          {/* ========================================== */}
          <div className="lg:col-span-8">
            {!exibeFormulario ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm h-full flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h3 className="text-lg font-black text-slate-700">Selecione um Operador</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">Clique em um usuário na lista ao lado para gerenciar suas alçadas, ou clique em "Novo Operador" para registrar alguém da equipe.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sticky top-6 max-h-[calc(100vh-3rem)]">
                
                {/* Cabeçalho do Card */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      {isCriando ? "✨ Cadastrar Novo Operador" : "⚙️ Configurações do Operador"}
                    </h3>
                    {selecionado && <p className="text-xs text-slate-500 font-mono mt-1">ID: {selecionado.id}</p>}
                  </div>
                  <button onClick={fecharPainel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Corpo Rolável */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                  
                  {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS */}
                  <section>
                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span> Perfil do Colaborador
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Nome Completo</label>
                        <input 
                          type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: DIEGO NED" 
                          className="w-full p-2.5 border border-slate-300 rounded-xl outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-slate-800 uppercase" 
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">E-mail Corporativo</label>
                        <input 
                          type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@nedcapital.com" 
                          className="w-full p-2.5 border border-slate-300 rounded-xl outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono text-slate-800" 
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">{selecionado ? "Nova Senha (vazio = manter)" : "Senha de Acesso *"}</label>
                        <input 
                          type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={selecionado ? "••••••••" : "Mínimo 6 caracteres"} 
                          className="w-full p-2.5 border border-slate-300 rounded-xl outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono text-slate-800" 
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Nível de Hierarquia</label>
                        <select 
                          value={cargo} onChange={(e) => setCargo(e.target.value)} 
                          className="w-full p-2.5 border border-slate-300 rounded-xl outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="SDR">SDR (Prospecção e Qualificação)</option>
                          <option value="Comercial">Comercial (Gerente de Carteira)</option>
                          <option value="Operacional">Operacional (Mesa de Crédito/Checagem)</option>
                          <option value="Diretor">Diretor (Comitê de Crédito)</option>
                          <option value="Master">Master (Acesso Irrestrito)</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <hr className="border-slate-100" />

                  {/* SEÇÃO 2: REGRAS DE CONTA */}
                  <section>
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span> Restrições de Operação
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className={`flex gap-3 p-4 rounded-xl cursor-pointer transition-all border ${verApenasCarteira ? "bg-amber-50 border-amber-300 shadow-sm" : "bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30"}`}>
                        <div className="pt-0.5">
                          <input type="checkbox" checked={verApenasCarteira} onChange={(e) => setVerApenasCarteira(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 uppercase">Isolamento de Carteira</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Limita a visão deste usuário apenas aos cedentes/leads vinculados ao nome dele.</span>
                        </div>
                      </label>

                      <label className={`flex gap-3 p-4 rounded-xl cursor-pointer transition-all border ${batePonto ? "bg-emerald-50 border-emerald-300 shadow-sm" : "bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30"}`}>
                        <div className="pt-0.5">
                          <input type="checkbox" checked={batePonto} onChange={(e) => setBatePonto(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 uppercase">Bate-Ponto RH</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Exige que o colaborador registre o ponto eletrônico ao acessar o sistema.</span>
                        </div>
                      </label>
                    </div>
                  </section>

                  <hr className="border-slate-100" />

                  {/* SEÇÃO 3: ALÇADAS E MÓDULOS */}
                  <section>
                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span> Telas e Alçadas Específicas
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {MAPA_DE_ROTAS?.map(r => {
                        const estaAtivo = !!permissoes[r.path];
                        const acoesTela = ACOES_POR_ROTA[r.path] || [];

                        return (
                          <div key={r.path} className={`rounded-xl border transition-all overflow-hidden ${estaAtivo ? "border-blue-300 bg-blue-50/20 shadow-sm" : "border-slate-200 bg-slate-50/50"}`}>
                            {/* Header da Tela */}
                            <label className={`flex items-center justify-between p-3 cursor-pointer select-none transition-colors ${estaAtivo ? "bg-blue-50/50" : "hover:bg-slate-100"}`}>
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={estaAtivo} onChange={() => alternarPermissaoChave(r.path)} className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer focus:ring-blue-500" />
                                <span className={`text-xs font-black uppercase ${estaAtivo ? "text-blue-900" : "text-slate-600"}`}>{r.icone} {r.nome}</span>
                              </div>
                            </label>

                            {/* Sub-ações */}
                            {estaAtivo && acoesTela.length > 0 && (
                              <div className="p-3 border-t border-blue-100/50 space-y-2 bg-white/60">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Botões permitidos:</span>
                                {acoesTela.map(acao => {
                                  const chaveAcao = `${r.path}:${acao.key}`;
                                  const acaoAtiva = permissoes[chaveAcao] !== false; 
                                  return (
                                    <label key={acao.key} className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-blue-700 select-none group">
                                      <input type="checkbox" checked={acaoAtiva} onChange={() => alternarPermissaoChave(chaveAcao)} className="w-3.5 h-3.5 text-indigo-500 rounded border-slate-300 cursor-pointer focus:ring-indigo-500 transition-all" />
                                      <span className="group-hover:translate-x-0.5 transition-transform">{acao.icone} {acao.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <hr className="border-slate-100" />

                  {/* SEÇÃO 4: NOTIFICAÇÕES */}
                  <section>
                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span> Sininho & Notificações
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {GRUPOS_NOTIFICACOES.map((grupo, idx) => {
                        const todasAtivas = grupo.opcoes.every(op => notificacoesConfig[op.key]);
                        return (
                          <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                            <div className="flex justify-between items-center mb-3">
                              <span className="font-black text-[10px] uppercase tracking-widest text-slate-500">{grupo.categoria}</span>
                              <button type="button" onClick={() => toggleCategoriaNotificacao(grupo)} className="text-[9px] font-bold text-rose-600 uppercase hover:underline">
                                {todasAtivas ? "Desativar Tudo" : "Ativar Tudo"}
                              </button>
                            </div>
                            <div className="space-y-2.5">
                              {grupo.opcoes.map(n => (
                                <label key={n.key} className="flex items-center gap-2.5 cursor-pointer group">
                                  <input type="checkbox" checked={!!notificacoesConfig[n.key]} onChange={() => alternarNotificacao(n.key)} className="w-4 h-4 text-rose-500 rounded border-slate-300 cursor-pointer focus:ring-rose-500" />
                                  <span className="text-xs font-semibold text-slate-700 group-hover:text-rose-700 transition-colors">{n.icone} {n.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                </div>

                {/* Footer do Card (Ações) */}
                <div className="p-6 border-t border-slate-200 bg-white rounded-b-2xl flex justify-end gap-3">
                  <button type="button" onClick={fecharPainel} disabled={salvando} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all">
                    Cancelar
                  </button>
                  <button type="button" onClick={salvarUsuario} disabled={salvando} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-500/30 flex items-center gap-2 disabled:opacity-50">
                    {salvando ? (
                      <><svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processando...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> {isCriando ? "Criar Usuário" : "Salvar Configurações"}</>
                    )}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}