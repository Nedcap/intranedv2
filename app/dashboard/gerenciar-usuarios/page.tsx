/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
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
  
  // 🛡️ Permissões Granulares (Contém telas AND botões específicos: {"/dashboard/comite": true, "/dashboard/comite:btn_forcar_veredito": false})
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({});
  
  // 🏢 Isolamento de Dados por Carteira
  const [verApenasCarteira, setVerApenasCarteira] = useState(false);
  
  // 🔔 Alertas e Ponto
  const [notificacoesConfig, setNotificacoesConfig] = useState<Record<string, boolean>>({});
  const [batePonto, setBatePonto] = useState(false);

  // 🛡️ Função utilitária para pegar o JWT Token nativo do Supabase
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
      
      if (!res.ok) {
        throw new Error("Falha ao carregar usuários. Acesso negado ou erro no servidor.");
      }
      
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

  const iniciarEdicao = (user: any) => {
    setSelecionado(user);
    setNome(user.nome || "");
    setEmail(user.email || "");
    setSenha(""); 
    setBatePonto(!!user.bate_ponto);
    
    // Flag de Restrição de Carteira
    setVerApenasCarteira(!!user.ver_apenas_carteira);
    
    const cargoSalvo = user.cargo || "Comercial";
    setCargo(cargoSalvo);

    // Carrega o dicionário de permissões (seja mapa antigo ou mapa granular novo)
    const permsBanco = user.permissoes || {};
    const novasPerms: Record<string, boolean> = {};

    if (Array.isArray(permsBanco)) {
      permsBanco.forEach((p: string) => novasPerms[p] = true);
    } else if (typeof permsBanco === "object") {
      Object.keys(permsBanco).forEach((k) => {
        novasPerms[k] = !!permsBanco[k];
      });
    }
    
    setPermissoes(novasPerms);
    setNotificacoesConfig(user.notificacoes_config || {});
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
    setVerApenasCarteira(false);
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    try {
      setSalvando(true);
      const emailTratado = email.trim().toLowerCase();

      if (!selecionado && !senha.trim()) {
        alert("A senha de acesso inicial é obrigatória para novos usuários.");
        setSalvando(false);
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
          permissoes: permissoes, // Envia o mapa granular completo (telas + botões)
          ver_apenas_carteira: verApenasCarteira, // Flag de isolamento de dados
          notificacoes_config: notificacoesConfig,
          bate_ponto: batePonto 
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error || "Erro desconhecido na API.");
      }

      alert(selecionado ? "🎉 Alçadas, botões e permissões atualizados!" : "🎉 Novo operador registrado com sucesso!");
      
      limparFormulario();
      await carregarUsuarios();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao persistir informações: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const alternarPermissaoChave = (key: string) => {
    setPermissoes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const alternarNotificacao = (key: string) => {
    setNotificacoesConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const contarModulos = (perms: any) => {
    if (!perms) return 0;
    if (Array.isArray(perms)) return perms.length;
    return Object.keys(perms).filter(k => k.startsWith("/") && !k.includes(":") && perms[k] === true).length;
  };

  const contarAcoesBotao = (perms: any) => {
    if (!perms || typeof perms !== "object" || Array.isArray(perms)) return 0;
    return Object.keys(perms).filter(k => k.includes(":") && perms[k] === true).length;
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
          <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">⚙️ Controle de Acessos & Alçadas Granulares</h2>
          <span className="text-xs text-slate-500 font-medium">Configure módulos, permissões de botões e isolamento de carteira por operador.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* FORMULÁRIO DE GESTÃO */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs space-y-5">
          <h3 className="text-xs font-black text-slate-800 uppercase border-b border-slate-100 pb-3 tracking-wide flex justify-between items-center">
            <span>{selecionado ? "⚙️ Customizar Operador" : "➕ Adicionar Operador Técnico"}</span>
            {selecionado && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">ID: {selecionado.id.slice(0, 8)}...</span>}
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
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Cargo / Nível de Perfil:</label>
              <select 
                value={cargo} 
                onChange={(e) => setCargo(e.target.value)} 
                className="w-full p-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-800 shadow-sm"
              >
                <option value="SDR">SDR (Prospecção e Qualificação)</option>
                <option value="Comercial">Comercial (Gerente de Carteira)</option>
                <option value="Operacional">Operacional (Mesa de Crédito/Checagem)</option>
                <option value="Diretor">Diretor (Comitê de Crédito)</option>
                <option value="Master">Master (Acesso Irrestrito + Configurações)</option>
              </select>
            </div>

            {/* 🏢 ISOLAMENTO DE DADOS (CARTEIRA DO COMERCIALL) */}
            <div className="flex flex-col space-y-1.5 pt-3 border-t border-slate-100">
              <label className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">
                Restrição e Isolamento de Dados:
              </label>
              <label className="flex items-center gap-3 p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100/60 transition-all shadow-xs">
                <input
                  type="checkbox"
                  checked={verApenasCarteira}
                  onChange={(e) => setVerApenasCarteira(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-amber-900 uppercase">
                    🔒 Limitar Acesso Apenas à Própria Carteira
                  </span>
                  <span className="text-[9px] text-amber-700 font-medium">
                    O usuário enxergará unicamente cedentes/leads vinculados ao nome/e-mail dele.
                  </span>
                </div>
              </label>
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

            {/* 🎯 CHECKLIST DE TELAS E BOTÕES GRANULARES */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-2">
                Módulos Habilitados e Ações por Botão:
              </label>
              
              <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-72 overflow-y-auto pr-2 custom-scrollbar shadow-inner">
                {MAPA_DE_ROTAS?.map(r => {
                  const estaAtivo = !!permissoes[r.path];
                  const acoesTela = ACOES_POR_ROTA[r.path] || [];

                  return (
                    <div key={r.path} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2 shadow-2xs">
                      
                      {/* Checkbox da Rota Pai */}
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="checkbox" 
                            checked={estaAtivo} 
                            onChange={() => alternarPermissaoChave(r.path)} 
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer focus:ring-blue-500" 
                          />
                          <span className="text-xs font-black text-slate-800 uppercase">{r.icone} {r.nome}</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{r.path}</span>
                      </label>

                      {/* Sub-Ações Granulares (Apenas se a tela pai estiver ativa) */}
                      {estaAtivo && acoesTela.length > 0 && (
                        <div className="pl-6 pt-1.5 border-t border-slate-100 space-y-1.5 bg-slate-50/70 p-2 rounded-md">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Alçadas de Botão nesta tela:</span>
                          {acoesTela.map(acao => {
                            const chaveAcao = `${r.path}:${acao.key}`;
                            const acaoAtiva = permissoes[chaveAcao] !== false; // Por padrão ativo se a tela for ativa, a menos que explicitamente desativada

                            return (
                              <label key={acao.key} className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer hover:text-slate-900 select-none">
                                <input 
                                  type="checkbox" 
                                  checked={acaoAtiva} 
                                  onChange={() => alternarPermissaoChave(chaveAcao)} 
                                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer focus:ring-indigo-500" 
                                />
                                <span>{acao.icone} {acao.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* CHECKLIST DE NOTIFICAÇÕES GRANULARES */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-2">
                Alertas e Notificações (Sininho Global):
              </label>
              
              <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {GRUPOS_NOTIFICACOES.map((grupo, idx) => {
                  const todasAtivas = grupo.opcoes.every(op => notificacoesConfig[op.key]);
                  return (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-inner">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-1.5">
                        <span className="font-extrabold text-[9px] uppercase tracking-widest text-slate-400">
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
                      
                      <div className="space-y-1">
                        {grupo.opcoes.map(n => (
                          <label key={n.key} className="flex items-center gap-2.5 p-1 rounded hover:bg-white transition-colors cursor-pointer text-xs font-bold text-slate-700">
                            <input 
                              type="checkbox" 
                              checked={!!notificacoesConfig[n.key]} 
                              onChange={() => alternarNotificacao(n.key)} 
                              className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300 cursor-pointer focus:ring-amber-500" 
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
                  <th className="p-4 w-32">Perfil / Carteira</th>
                  <th className="p-4 text-center w-36">Alçadas (Telas/Ações)</th>
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
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                          u.cargo === 'Master' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          u.cargo === 'Diretor' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          u.cargo === 'Operacional' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          u.cargo === 'SDR' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {u.cargo || "Comercial"}
                        </span>
                        {u.ver_apenas_carteira && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="Verá apenas empresas da própria carteira">
                            🔒 Carteira Própria
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center text-slate-500 font-bold text-[11px] leading-tight">
                      <div className="flex flex-col items-center gap-1">
                        <span>{u.cargo === 'Master' ? "Acesso VIP Total" : `🔓 ${contarModulos(u.permissoes)} telas (${contarAcoesBotao(u.permissoes)} botões)`}</span>
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 rounded uppercase">
                          🔔 {contarAlertas(u.notificacoes_config)} alertas
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
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}