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
      if (!res.ok) throw new Error("Falha ao carregar usuários.");
      const data = await res.json();
      setUsuarios(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarUsuarios(); }, []);

  const iniciarCriacao = () => {
    setSelecionado(null);
    setIsCriando(true);
    setNome(""); setEmail(""); setSenha(""); setCargo("Comercial");
    setPermissoes({}); setNotificacoesConfig({}); setBatePonto(false); setVerApenasCarteira(false);
  };

  const iniciarEdicao = (user: any) => {
    setSelecionado(user);
    setIsCriando(false);
    setNome(user.nome || ""); setEmail(user.email || ""); setSenha(""); 
    setBatePonto(!!user.bate_ponto); setVerApenasCarteira(!!user.ver_apenas_carteira); setCargo(user.cargo || "Comercial");

    const permsBanco = user.permissoes || {};
    const novasPerms: Record<string, boolean> = {};
    if (Array.isArray(permsBanco)) permsBanco.forEach((p: string) => novasPerms[p] = true);
    else if (typeof permsBanco === "object") Object.keys(permsBanco).forEach((k) => novasPerms[k] = !!permsBanco[k]);
    
    setPermissoes(novasPerms);
    setNotificacoesConfig(user.notificacoes_config || {});
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    try {
      setSalvando(true);
      const emailTratado = email.trim().toLowerCase();

      if (!selecionado && !senha.trim()) return alert("Senha obrigatória para novos usuários.");

      const method = selecionado ? "PUT" : "POST";
      const headers = await obterTokenHeaders();

      const response = await fetch("/api/usuarios", {
        method, headers,
        body: JSON.stringify({
          userId: selecionado ? selecionado.id : undefined,
          nome: nome.trim(), email: emailTratado, senha: senha.trim() || undefined,
          cargo, permissoes, ver_apenas_carteira: verApenasCarteira, notificacoes_config: notificacoesConfig, bate_ponto: batePonto 
        }),
      });

      if (!response.ok) throw new Error("Erro na API.");
      alert(selecionado ? "✅ Operador atualizado!" : "✅ Novo operador registrado!");
      
      await carregarUsuarios();
      if (!selecionado) { setSelecionado(null); setIsCriando(false); }
    } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setSalvando(false); }
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
    const lower = buscaUsuario.toLowerCase();
    return usuarios.filter(u => 
      (u.nome?.toLowerCase().includes(lower)) || (u.email?.toLowerCase().includes(lower)) || (u.cargo?.toLowerCase().includes(lower))
    );
  }, [usuarios, buscaUsuario]);

  const exibeFormulario = isCriando || selecionado;

  if (carregando && usuarios.length === 0) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">Carregando Motor de Acessos...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8 font-sans text-[#0f172a]">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER GLOBAL (AESTHETIC DOSSIÊ) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-xl border border-[#e2e8f0] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
          <div>
            <h1 className="text-[1.8rem] font-black uppercase tracking-[-0.5px] text-[#1e3a8a] m-0 leading-tight">Motor de Acessos & Segurança</h1>
            <div className="text-[0.95rem] font-medium text-[#64748b] mt-1 font-mono">GERENCIAMENTO ESTRUTURAL DE EQUIPES</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ========================================== */}
          {/* LEFT COL: LISTA (Estilo Cards Sólidos) */}
          {/* ========================================== */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            
            <button 
              onClick={iniciarCriacao}
              className="w-full py-4 bg-[#2563eb] hover:bg-[#1e3a8a] text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-[0_10px_30px_-5px_rgba(37,99,235,0.3)] border border-[#1e3a8a]"
            >
              + Adicionar Operador
            </button>

            <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
                <input 
                  type="text" 
                  placeholder="FILTRAR NOME OU E-MAIL..." 
                  value={buscaUsuario}
                  onChange={e => setBuscaUsuario(e.target.value)}
                  className="w-full p-3 bg-white border border-[#e2e8f0] rounded-lg text-xs font-bold outline-none focus:border-[#2563eb] uppercase tracking-wide text-[#0f172a]"
                />
              </div>

              <div className="flex flex-col max-h-[700px] overflow-y-auto custom-scrollbar">
                {usuariosFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-[#64748b] font-bold uppercase text-[10px] tracking-widest">
                    Nenhum registro localizado.
                  </div>
                ) : (
                  usuariosFiltrados.map((u, idx) => {
                    const isSelected = selecionado?.id === u.id;
                    return (
                      <div 
                        key={u.id} 
                        onClick={() => iniciarEdicao(u)}
                        className={`p-5 cursor-pointer transition-all border-l-[6px] border-b border-b-[#e2e8f0] ${isSelected ? "bg-white border-l-[#2563eb] shadow-lg relative z-10" : "bg-[#f8fafc] border-l-transparent hover:bg-white"}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-lg shrink-0 ${isSelected ? "bg-[#1e3a8a] text-white" : "bg-[#e2e8f0] text-[#64748b]"}`}>
                            {getInitials(u.nome)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-black uppercase truncate text-sm tracking-tight ${isSelected ? "text-[#1e3a8a]" : "text-[#0f172a]"}`}>{u.nome}</h4>
                            <p className="text-[10px] text-[#64748b] font-mono truncate mb-2">{u.email}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-black uppercase tracking-widest bg-[#e2e8f0] text-[#0f172a] px-2 py-0.5 rounded">
                                {u.cargo || "Comercial"}
                              </span>
                              {u.ver_apenas_carteira && <span className="text-[9px] font-black uppercase tracking-widest bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5] px-2 py-0.5 rounded">🔒 Isolado</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* RIGHT COL: DETAIL (Estilo Dossiê Header) */}
          {/* ========================================== */}
          <div className="lg:col-span-8">
            {!exibeFormulario ? (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-16 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] h-full flex flex-col items-center justify-center min-h-[500px]">
                <div className="text-[4rem] mb-4 opacity-50">🛡️</div>
                <h3 className="text-xl font-black text-[#1e3a8a] uppercase tracking-wide">Área de Configuração</h3>
                <p className="text-sm text-[#64748b] font-medium mt-2 max-w-sm mx-auto">Selecione um operador no menu lateral para mapear alçadas e políticas de segurança.</p>
              </div>
            ) : (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
                
                {/* HEADER TIPO DOSSIÊ */}
                <div className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-stretch gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  
                  <div className="z-10">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2">
                      {isCriando ? "Novo Cadastro de Operador" : "Credenciais de Acesso"}
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight mb-2 leading-none">
                      {nome || "NOVO OPERADOR"}
                    </h2>
                    {selecionado && <div className="font-mono text-[11px] text-white/80 bg-black/20 inline-block px-3 py-1 rounded">ID: {selecionado.id}</div>}
                  </div>
                  
                  <div className="flex flex-col items-end gap-3 z-10 min-w-[200px]">
                    <div className="bg-white/20 backdrop-blur-md border border-white/30 px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs w-full text-center shadow-lg">
                      PERFIL: <span className="text-[#fde047]">{cargo}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] w-full text-center">
                      STATUS: ATIVO
                    </div>
                  </div>
                </div>

                {/* FORM BODY */}
                <form onSubmit={salvarUsuario} className="p-8 bg-[#f8fafc] space-y-10">
                  
                  {/* SEÇÃO 1 */}
                  <section>
                    <h2 className="text-[1.1rem] font-black text-[#1e3a8a] uppercase tracking-[0.5px] border-b-2 border-[#e2e8f0] pb-3 mb-6 flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-[#2563eb] rounded-full block"></span> 1. Dados Cadastrais
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="bg-white p-4 border border-[#e2e8f0] rounded-xl shadow-sm">
                        <div className="text-[10px] font-black uppercase text-[#64748b] tracking-widest mb-2">Nome Oficial</div>
                        <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="EX: DIEGO NED" className="w-full bg-transparent font-black text-[#0f172a] text-sm uppercase outline-none" />
                      </div>
                      <div className="bg-white p-4 border border-[#e2e8f0] rounded-xl shadow-sm">
                        <div className="text-[10px] font-black uppercase text-[#64748b] tracking-widest mb-2">E-mail Corporativo</div>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@nedcapital.com" className="w-full bg-transparent font-mono font-bold text-[#0f172a] text-sm outline-none" />
                      </div>
                      <div className="bg-white p-4 border border-[#e2e8f0] rounded-xl shadow-sm">
                        <div className="text-[10px] font-black uppercase text-[#64748b] tracking-widest mb-2">{selecionado ? "Nova Senha" : "Senha Matriz *"}</div>
                        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" className="w-full bg-transparent font-mono font-bold text-[#0f172a] text-sm outline-none" />
                      </div>
                      <div className="bg-white p-4 border border-[#e2e8f0] rounded-xl shadow-sm">
                        <div className="text-[10px] font-black uppercase text-[#64748b] tracking-widest mb-2">Hierarquia</div>
                        <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full bg-transparent font-black text-[#0f172a] text-sm uppercase outline-none cursor-pointer">
                          <option value="SDR">SDR (Prospecção)</option>
                          <option value="Comercial">Comercial (Gerente)</option>
                          <option value="Operacional">Operacional (Mesa)</option>
                          <option value="Diretor">Diretor (Comitê)</option>
                          <option value="Master">Master (Irrestrito)</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* SEÇÃO 2 */}
                  <section>
                    <h2 className="text-[1.1rem] font-black text-[#1e3a8a] uppercase tracking-[0.5px] border-b-2 border-[#e2e8f0] pb-3 mb-6 flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-[#ca8a04] rounded-full block"></span> 2. Protocolos de Restrição
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <label className={`bg-white border-l-[6px] border-t border-r border-b p-5 rounded-xl cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-0.5 ${verApenasCarteira ? 'border-l-[#dc2626] border-[#e2e8f0] bg-[#fef2f2]' : 'border-[#e2e8f0] border-l-[#cbd5e1]'}`}>
                        <div className="flex items-start gap-4">
                          <input type="checkbox" checked={verApenasCarteira} onChange={(e) => setVerApenasCarteira(e.target.checked)} className="mt-1 w-4 h-4 text-[#dc2626] border-slate-300 focus:ring-[#dc2626]" />
                          <div>
                            <div className="font-black text-[11px] uppercase tracking-widest text-[#0f172a] mb-1">Isolamento de Carteira</div>
                            <div className="text-[11px] text-[#64748b] font-medium leading-relaxed">Bloqueia o acesso global. O usuário verá estritamente clientes atrelados a ele.</div>
                          </div>
                        </div>
                      </label>

                      <label className={`bg-white border-l-[6px] border-t border-r border-b p-5 rounded-xl cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-0.5 ${batePonto ? 'border-l-[#16a34a] border-[#e2e8f0] bg-[#f0fdf4]' : 'border-[#e2e8f0] border-l-[#cbd5e1]'}`}>
                        <div className="flex items-start gap-4">
                          <input type="checkbox" checked={batePonto} onChange={(e) => setBatePonto(e.target.checked)} className="mt-1 w-4 h-4 text-[#16a34a] border-slate-300 focus:ring-[#16a34a]" />
                          <div>
                            <div className="font-black text-[11px] uppercase tracking-widest text-[#0f172a] mb-1">Ponto Eletrônico (RH)</div>
                            <div className="text-[11px] text-[#64748b] font-medium leading-relaxed">Condiciona a navegação do sistema ao registro diário de jornada de trabalho.</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </section>

                  {/* SEÇÃO 3 */}
                  <section>
                    <h2 className="text-[1.1rem] font-black text-[#1e3a8a] uppercase tracking-[0.5px] border-b-2 border-[#e2e8f0] pb-3 mb-6 flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-[#2563eb] rounded-full block"></span> 3. Alçadas de Acesso (Módulos)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {MAPA_DE_ROTAS?.map(r => {
                        const estaAtivo = !!permissoes[r.path];
                        const acoesTela = ACOES_POR_ROTA[r.path] || [];

                        return (
                          <div key={r.path} className={`bg-white border-t-[4px] border-l border-r border-b rounded-xl shadow-sm transition-all ${estaAtivo ? 'border-t-[#2563eb] border-[#e2e8f0]' : 'border-t-[#cbd5e1] border-[#e2e8f0]'}`}>
                            <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#f8fafc]">
                              <input type="checkbox" checked={estaAtivo} onChange={() => alternarPermissaoChave(r.path)} className="w-4 h-4 text-[#2563eb] focus:ring-[#2563eb]" />
                              <span className={`font-black text-xs uppercase tracking-widest ${estaAtivo ? 'text-[#1e3a8a]' : 'text-[#64748b]'}`}>{r.icone} {r.nome}</span>
                            </label>

                            {estaAtivo && acoesTela.length > 0 && (
                              <div className="px-4 pb-4 pt-2 bg-[#f8fafc] border-t border-[#e2e8f0]">
                                <div className="text-[9px] font-black uppercase text-[#64748b] tracking-widest mb-3">Ações liberadas nesta tela:</div>
                                <div className="space-y-2">
                                  {acoesTela.map(acao => {
                                    const chaveAcao = `${r.path}:${acao.key}`;
                                    const acaoAtiva = permissoes[chaveAcao] !== false; 
                                    return (
                                      <label key={acao.key} className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" checked={acaoAtiva} onChange={() => alternarPermissaoChave(chaveAcao)} className="w-3.5 h-3.5 text-[#1e3a8a] focus:ring-[#1e3a8a]" />
                                        <span className="text-[11px] font-bold text-[#334155] group-hover:text-[#0f172a] transition-colors">{acao.icone} {acao.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* SEÇÃO 4 */}
                  <section>
                    <h2 className="text-[1.1rem] font-black text-[#1e3a8a] uppercase tracking-[0.5px] border-b-2 border-[#e2e8f0] pb-3 mb-6 flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-[#dc2626] rounded-full block"></span> 4. Matriz de Notificações
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {GRUPOS_NOTIFICACOES.map((grupo, idx) => {
                        const todasAtivas = grupo.opcoes.every(op => notificacoesConfig[op.key]);
                        return (
                          <div key={idx} className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4 border-b border-[#e2e8f0] pb-3">
                              <span className="font-black text-[10px] uppercase tracking-widest text-[#0f172a]">{grupo.categoria}</span>
                              <button type="button" onClick={() => toggleCategoriaNotificacao(grupo)} className="text-[9px] font-black text-[#dc2626] uppercase hover:underline">
                                {todasAtivas ? "[ DESATIVAR ]" : "[ ATIVAR ]"}
                              </button>
                            </div>
                            <div className="space-y-3">
                              {grupo.opcoes.map(n => (
                                <label key={n.key} className="flex items-center gap-3 cursor-pointer group">
                                  <input type="checkbox" checked={!!notificacoesConfig[n.key]} onChange={() => alternarNotificacao(n.key)} className="w-4 h-4 text-[#dc2626] focus:ring-[#dc2626]" />
                                  <span className="text-[11px] font-bold text-[#334155] group-hover:text-[#0f172a] transition-colors">{n.icone} {n.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                </form>

                {/* FOOTER ACTIONS */}
                <div className="bg-[#e2e8f0]/40 p-6 border-t border-[#e2e8f0] flex justify-end gap-4">
                  <button type="button" onClick={() => { setSelecionado(null); setIsCriando(false); }} className="px-8 py-3 bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-sm">
                    Cancelar
                  </button>
                  <button type="button" onClick={salvarUsuario} disabled={salvando} className="px-10 py-3 bg-[#1e3a8a] hover:bg-[#2563eb] text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(30,58,138,0.4)] disabled:opacity-50 flex items-center gap-2">
                    {salvando ? "PROCESSANDO..." : (isCriando ? "EFETIVAR CADASTRO" : "SALVAR DIRETRIZES")}
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}