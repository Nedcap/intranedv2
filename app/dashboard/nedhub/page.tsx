/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Tarefa {
  id: string;
  titulo: string;
  data: string;
  horario?: string;
  gerenteId?: string;
  concluida: boolean;
}

interface Lead {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeContato: string;
  telefone: string;
  telefones: string[];
  email: string;
  estagio: string;
  funilId: "vendas" | "pos_venda";
  dadosCustomizados: Record<string, any>;
  anotacoes?: string;
  tarefas: Tarefa[];
  atualizadoEm?: string;
}

// Mock de Usuários do Sistema para Simulação de Níveis e Agendas
const GERENTES_COMERCIAIS = [
  { id: "gerente_1", nome: "Rodrigo Silva (Sul)" },
  { id: "gerente_2", nome: "Mariana Costa (SP/RJ)" },
];

export default function NedHubPage() {
  const [funilAtivo, setFunilAtivo] = useState<"vendas" | "pos_venda">("vendas");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  // 🔐 CONTROLE DE GESTÃO: Mude para 'SDR' para testar os bloqueios de exclusão/edição ou 'Diretor' para liberar tudo
  const [userRole, setUserRole] = useState<"Diretor" | "Consultor" | "SDR">("Diretor");
  const [gerenteSelecionadoAgenda, setGerenteSelecionadoAgenda] = useState<string>("gerente_1");

  const [carregando, setCarregando] = useState(false);
  const [buscandoRobo, setBuscandoRobo] = useState(false);

  // Estado das Agendas Livres configuradas pelos Gerentes Comerciais
  const [horariosDisponiveisGerentes, setHorariosDisponiveisGerentes] = useState<Record<string, string[]>>({
    "gerente_1": ["2026-06-18 09:00", "2026-06-18 14:00", "2026-06-19 10:00", "2026-06-19 16:00"],
    "gerente_2": ["2026-06-18 11:00", "2026-06-18 15:30", "2026-06-20 09:30"],
  });

  const [coresColunas, setCoresColunas] = useState<Record<string, string>>({
    sem_contato: "#ef4444", telefones_inexistente: "#f97316", em_fluxo: "#3b82f6",
    apresentacao_enviada: "#8b5cf6", interessados: "#22c55e", visita_agendada: "#06b6d4",
    em_analise_mesa: "#eab308", convertida_aprovada: "#10b981", nao_convertida: "#64748b",
  });

  // Modais
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [leadExpandido, setLeadExpandido] = useState<Lead | null>(null);
  const [modalCalendarioPopup, setModalCalendarioPopup] = useState<{ aberto: boolean; lead: Lead | null }>({ aberto: false, lead: null });
  const [abaAtivaConfig, setAbaAtivaConfig] = useState<"kanban" | "auditoria_direcao">("kanban");

  // Formulário de Cadastro
  const [inputCnpj, setInputCnpj] = useState("");
  const [inputRazao, setInputRazao] = useState("");
  const [inputContato, setInputContato] = useState("");
  const [inputTelefone, setInputTelefone] = useState("");
  const [dadosAutomotivosBot, setDadosAutomotivosBot] = useState<Record<string, any>>({});

  // Gaveta interna
  const [novoTelefone, setNovoTelefone] = useState("");
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [novoHorarioDisponivel, setNovoHorarioDisponivel] = useState("");

  const sincronizarBaseNedHub = async () => {
    try {
      setCarregando(true);
      const { data: dbLeads, error } = await supabase.from("crm_leads").select("*").order("criado_em", { ascending: false });
      const { data: dbTemplates } = await supabase.from("crm_email_templates").select("*");
      
      if (error) throw error;
      if (dbTemplates) setTemplates(dbTemplates);
      if (dbLeads) {
        setLeads(dbLeads.map((l: any) => ({
          id: l.id, cnpj: l.cnpj,
          razaoSocial: l.razaoSocial || l.razaosocial || l.razao_social || "",
          nomeContato: l.nomeContato || l.nomecontato || l.nome_contato || "",
          telefone: l.telefone || "",
          telefones: Array.isArray(l.telefones) ? l.telefones : l.telefones ? [l.telefones] : [],
          email: l.email || "",
          estagio: l.estagio || l.estágio || "sem_contato",
          funilId: l.funilId || l.funilid || l.funil_id || "vendas",
          dadosCustomizados: l.campos_customizados || l.camposCustomizados || {},
          anotacoes: l.anotacoes || "",
          tarefas: Array.isArray(l.tarefas) ? l.tarefas : [],
          atualizadoEm: l.atualizado_em || l.criado_em
        })));
      }
    } catch (err: any) { console.error(err.message); } finally { setCarregando(false); }
  };

  useEffect(() => { sincronizarBaseNedHub(); }, []);

  // 🤖 BUSCA INTELIGENTE ANTECIPADA: Dispara direto no input do Cadastro
  const consultarDadosCnpjNoRoboLocal = async (targetCnpj: string) => {
    const cnpjLimpo = targetCnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) return;

    try {
      setBuscandoRobo(true);
      const res = await fetch(`http://localhost:5000/api/prospeccao?cnpj=${cnpjLimpo}`);
      if (res.ok) {
        const dadosBot = await res.json();
        const dados = dadosBot.data || dadosBot.lead || dadosBot;

        if (dados && (dados.razaoSocial || dados.razao_social || dados.nome)) {
          setInputRazao((dados.razaoSocial || dados.razao_social || dados.nome || "").toUpperCase());
          if (dados.telefone || dados.celular) setInputTelefone(dados.telefone || dados.celular);
          if (dados.contato || dados.nome_contato) setInputContato(dados.contato || dados.nome_contato);
          
          // Guarda os dados de inteligência adicionais para salvar de uma vez só
          setDadosAutomotivosBot({
            ramo: dados.ramo || dados.atividade_principal || dados.atividade || "",
            cnae: dados.cnae || dados.cnae_fiscal || "",
            endereco: dados.logradouro || dados.endereco || "",
            bairro: dados.bairro || "",
            cidade: dados.municipio || dados.cidade || "",
            uf: dados.uf || ""
          });
        }
      }
    } catch (err) {
      console.log("Robô offline ou indisponível no momento.");
    } finally {
      setBuscandoRobo(false);
    }
  };

  const handleSalvarNovoLead = async () => {
    if (!inputCnpj || !inputRazao) return alert("CNPJ e Razão Social são obrigatórios.");
    try {
      const payload = {
        cnpj: inputCnpj.replace(/\D/g, ""), 
        razaoSocial: inputRazao.toUpperCase().trim(), 
        nomeContato: inputContato.trim(),
        telefone: inputTelefone, 
        telefones: inputTelefone ? [inputTelefone] : [], 
        email: "",
        funilId: funilAtivo, 
        estagio: funilAtivo === "vendas" ? "sem_contato" : "visita_agendada",
        campos_customizados: dadosAutomotivosBot, 
        tarefas: []
      };
      const { error } = await supabase.from("crm_leads").insert([payload]);
      if (error) throw error;
      setModalNovoLead(false);
      setInputCnpj(""); setInputRazao(""); setInputContato(""); setInputTelefone(""); setDadosAutomotivosBot({});
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(err.message); }
  };

  const atualizarEstagioNoBanco = async (cardId: string, novoEstagio: string) => {
    await supabase.from("crm_leads").update({ estagio: novoEstagio }).eq("id", cardId);
    await sincronizarBaseNedHub();
  };

  const handleExcluirLead = async (cardId: string, razaoSocial: string) => {
    // Trava de segurança para SDR
    if (userRole === "SDR") return alert("❌ Acesso Negado: Usuários SDR não têm permissão para deletar dados do NedHub.");
    
    if (!confirm(`⚠️ CONFIRMAÇÃO DIRETORIA: Deseja mesmo deletar a empresa "${razaoSocial}"?`)) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("crm_leads").delete().eq("id", cardId);
      if (error) throw error;
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(err.message); } finally { setCarregando(false); }
  };

  const salvarDadosGaveta = async (leadAtualizado: Lead) => {
    try {
      setCarregando(true);
      const { error } = await supabase
        .from("crm_leads")
        .update({
          razaoSocial: leadAtualizado.razaoSocial,
          nomeContato: leadAtualizado.nomeContato,
          email: leadAtualizado.email,
          telefones: leadAtualizado.telefones,
          anotacoes: leadAtualizado.anotacoes,
          tarefas: leadAtualizado.tarefas,
          funilId: leadAtualizado.funilId,
          estagio: leadAtualizado.estagio,
          campos_customizados: leadAtualizado.dadosCustomizados || {}
        })
        .eq("id", leadAtualizado.id);

      if (error) throw error;
      setLeadExpandido(null);
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(err.message); } finally { setCarregando(false); }
  };

  const agendarHorarioGerentePeloSdr = async (dataHora: string) => {
    if (!modalCalendarioPopup.lead) return;
    const leadAlvo = modalCalendarioPopup.lead;
    const [data, hora] = dataHora.split(" ");
    
    const novaAgendaTarefa: Tarefa = {
      id: Math.random().toString(),
      titulo: `Reunião Comercial - Ref: ${GERENTES_COMERCIAis_Map(gerenteSelecionadoAgenda)}`,
      data: data,
      horario: hora,
      gerenteId: gerenteSelecionadoAgenda,
      concluida: false
    };

    const tarefasAtualizadas = [...(leadAlvo.tarefas || []), novaAgendaTarefa];
    
    // Remove o horário livre do gerente já que foi preenchido
    setHorariosDisponiveisGerentes(prev => ({
      ...prev,
      [gerenteSelecionadoAgenda]: prev[gerenteSelecionadoAgenda].filter(h => h !== dataHora)
    }));

    // Atualiza diretamente no banco para garantir consistência imediata
    await supabase.from("crm_leads").update({ tarefas: tarefasAtualizadas, estagio: "visita_agendada" }).eq("id", leadAlvo.id);
    setModalCalendarioPopup({ aberto: false, lead: null });
    await sincronizarBaseNedHub();
    alert("📅 Sucesso! Horário travado na agenda do comercial e card atualizado.");
  };

  const GERENTES_COMERCIAis_Map = (id: string) => GERENTES_COMERCIAIS.find(g => g.id === id)?.nome || "";

  const handleOnDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleOnDrop = (e: React.DragEvent, estagioDestino: string) => {
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId) atualizarEstagioNoBanco(cardId, estagioDestino);
  };

  const colunasVisíveis = useMemo(() => {
    const filtrados = leads.filter(l => l.funilId === funilAtivo);
    const leadsComFlagPrioridade = filtrados.map(lead => {
      const hojeStr = new Date().toISOString().split("T")[0];
      const temTarefaUrgente = lead.tarefas.some(t => !t.concluida && t.data <= hojeStr);
      return { ...lead, urgente: temTarefaUrgente };
    });
    const ordenados = leadsComFlagPrioridade.sort((a, b) => (a.urgente === b.urgente ? 0 : a.urgente ? -1 : 1));
    const extrairPorEstagio = (estagio: string) => ordenados.filter(l => l.estagio === estagio);

    if (funilAtivo === "vendas") {
      return [
        { id: "sem_contato", nome: "🚫 Sem Contato", cards: extrairPorEstagio("sem_contato") },
        { id: "telefone_inexistente", nome: "📞 Tel. Inexistente", cards: extrairPorEstagio("telefone_inexistente") },
        { id: "em_fluxo", nome: "🔄 Em Fluxo", cards: extrairPorEstagio("em_fluxo") },
        { id: "apresentacao_enviada", nome: "✉️ Apresentação", cards: extrairPorEstagio("apresentacao_enviada") },
        { id: "interessados", nome: "🔥 Interessados", cards: extrairPorEstagio("interessados") },
      ];
    } else {
      return [
        { id: "visita_agendada", nome: "📅 Visita Agendada", cards: extrairPorEstagio("visita_agendada") },
        { id: "em_analise_mesa", nome: "⚖️ Mesa de Risco", cards: extrairPorEstagio("em_analise_mesa") },
        { id: "convertida_aprovada", nome: "💰 Convertida", cards: extrairPorEstagio("convertida_aprovada") },
        { id: "nao_convertida", nome: "❌ Não Convertida", cards: extrairPorEstagio("nao_convertida") },
      ];
    }
  }, [leads, funilAtivo]);

  // Indicadores de Controle de Gestão (Visão Diretores)
  const metricasAuditoria = useMemo(() => {
    const hojeStr = new Date().toISOString().split("T")[0];
    let totais = 0;
    let atrasadas = 0;
    let semDadosCompletos = 0;

    leads.forEach(l => {
      totais += l.tarefas.length;
      atrasadas += l.tarefas.filter(t => !t.concluida && t.data < hojeStr).length;
      if (!l.dadosCustomizados?.ramo || !l.email) semDadosCompletos++;
    });

    return { totais, atrasadas, semDadosCompletos };
  }, [leads]);

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col font-sans text-slate-700 bg-slate-50 text-[11px] overflow-hidden p-4 space-y-4">
      
      {/* CONTROLE SUPERIOR DE AMBIENTE & ROLES */}
      <div className="flex bg-slate-900 text-white p-2.5 rounded-xl justify-between items-center text-[10px] font-mono">
        <div className="flex items-center gap-4">
          <span>👑 NÍVEL DE ACESSO ATUAL:</span>
          <div className="flex gap-1.5">
            {["Diretor", "Consultor", "SDR"].map((role: any) => (
              <button key={role} onClick={() => setUserRole(role)} className={`px-3 py-1 rounded font-bold uppercase text-[9px] ${userRole === role ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {role}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAbaAtivaConfig("kanban")} className={`px-3 py-1 rounded uppercase font-bold ${abaAtivaConfig === 'kanban' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>📋 Workspace Kanban</button>
          <button onClick={() => setAbaAtivaConfig("auditoria_direcao")} className={`px-3 py-1 rounded uppercase font-bold ${abaAtivaConfig === 'auditoria_direcao' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}>📊 Painel do Diretor (Auditoria SDR)</button>
        </div>
      </div>

      {abaAtivaConfig === "auditoria_direcao" ? (
        /* 📊 PAINEL DE CONTROLE DE GESTÃO DA DIRETORIA */
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-5 space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase">📊 Painel de Controle de Gestão e Auditoria Operacional</h2>
            <p className="text-slate-400 text-[10px]">Visão exclusiva para monitorar o cumprimento de prazos, tratamento de leads e qualidade dos dados dos SDRs.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-slate-400 block font-bold uppercase text-[8px]">Total de Lembretes Criados</span>
              <span className="text-xl font-black text-slate-800 font-mono">{metricasAuditoria.totais}</span>
            </div>
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
              <span className="text-red-500 block font-bold uppercase text-[8px]">🚨 Lembretes/Agendas Atrasadas (Não Cumpridas)</span>
              <span className="text-xl font-black text-red-600 font-mono">{metricasAuditoria.atrasadas}</span>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <span className="text-amber-600 block font-bold uppercase text-[8px]">⚠️ Contratos Sem Sincronização Completa</span>
              <span className="text-xl font-black text-amber-700 font-mono">{metricasAuditoria.semDadosCompletos}</span>
            </div>
          </div>

          {/* LISTAGEM COMPREENSIVA DE AUDITORIA */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left font-mono text-[10px]">
              <thead className="bg-slate-100 border-b font-sans uppercase text-[8px] text-slate-500">
                <tr>
                  <th className="p-2.5">Empresa / Lead</th>
                  <th className="p-2.5">Estágio Atual</th>
                  <th className="p-2.5">Última Modificação</th>
                  <th className="p-2.5">Tarefas Pendentes</th>
                  <th className="p-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-bold font-sans text-slate-900">{lead.razaoSocial}</td>
                    <td className="p-2.5 uppercase"><span className="px-1.5 py-0.5 rounded text-[8px] text-white font-sans font-bold" style={{ backgroundColor: coresColunas[lead.estagio] }}>{lead.estagio}</span></td>
                    <td className="p-2.5 text-slate-500">{lead.atualizadoEm ? new Date(lead.atualizadoEm).toLocaleString() : "-"}</td>
                    <td className="p-2.5 font-bold text-slate-700">{lead.tarefas.filter(t => !t.concluida).length} pendente(s)</td>
                    <td className="p-2.5 text-right"><button onClick={() => { setLeadExpandido(lead); setAbaAtivaConfig("kanban"); }} className="text-blue-600 hover:underline font-sans font-bold">Inspecionar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN WORKSPACE */
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 bg-white p-4 rounded-xl shadow-xs gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">🚀 NedHub Central v5</h2>
                <p className="text-xs text-slate-400">Dados do bot inseridos no cadastro. Bloqueio operacional ativo para SDR.</p>
              </div>
              <select value={funilAtivo} onChange={(e) => setFunilAtivo(e.target.value as any)} className="p-2 border border-blue-300 rounded-lg bg-blue-50 text-blue-900 font-black uppercase text-[10px] outline-none">
                <option value="vendas">📋 Pipeline: Funil de Vendas (SDR)</option>
                <option value="pos_venda">💼 Pipeline: Pós Venda & Comercial</option>
              </select>
            </div>
            <button onClick={() => setModalNovoLead(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-xs">+ Novo Negócio</button>
          </div>

          <div className="flex-1 grid gap-3 h-full min-h-0 overflow-hidden" style={{ gridTemplateColumns: `repeat(${colunasVisíveis.length}, minmax(0, 1fr))` }}>
            {colunasVisíveis.map(col => {
              const colorCurrent = coresColunas[col.id] || "#cbd5e1";
              return (
                <div key={col.id} onDragOver={handleOnDragOver} onDrop={(e) => handleOnDrop(e, col.id)} className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
                  <div className="p-3 bg-white font-black text-slate-800 border-b border-slate-200 uppercase flex justify-between items-center text-[9px]" style={{ borderTop: `4px solid ${colorCurrent}` }}>
                    <span>{col.nome}</span>
                    <span className="bg-slate-200 px-2 py-0.5 rounded-full font-mono">{col.cards.length}</span>
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto flex-1 content-start bg-slate-50/40">
                    {col.cards.map((lead: any) => (
                      <CardLead key={lead.id} lead={lead} corColuna={colorCurrent} onExpandir={setLeadExpandido} onExcluir={handleExcluirLead} onAbrirCalendario={(l) => setModalCalendarioPopup({ aberto: true, lead: l })} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 🔍 GAVETA EXPANDIDA (COM TRAVA DE EDIÇÃO PARA SDR) */}
      {leadExpandido && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50 transition-all">
          <div className="bg-white h-full max-w-2xl w-full flex flex-col shadow-2xl border-l border-slate-200">
            
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-[9px] font-mono font-bold uppercase text-amber-400">Visualização de Registro</span>
                <input 
                  type="text" 
                  disabled={userRole === "SDR"}
                  value={leadExpandido.razaoSocial} 
                  onChange={(e) => setLeadExpandido({ ...leadExpandido, razaoSocial: e.target.value })} 
                  className="bg-transparent text-base font-black border-b border-transparent focus:border-blue-500 outline-none w-[450px] text-white p-0.5 disabled:opacity-70"
                />
              </div>
              <button onClick={() => setLeadExpandido(null)} className="text-xl font-bold text-slate-400 hover:text-white px-2">✕</button>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-y-auto text-[11px]">
              
              {/* INFOS EXCLUSIVAS DA RECEITA (BLOQUEADO PARA SDR ALTERAR) */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="font-black uppercase text-[10px] tracking-wider text-amber-400">🏢 Inteligência de Mercado Estruturada</h3>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                  <div><span className="text-slate-500 block text-[8px] uppercase font-bold">CNPJ:</span><span className="text-white font-bold">{leadExpandido.cnpj}</span></div>
                  <div><span className="text-slate-500 block text-[8px] uppercase font-bold">CNAE Fiscal:</span><span className="text-amber-200 font-bold">{leadExpandido.dadosCustomizados?.cnae || "Não Cadastrado"}</span></div>
                  <div className="col-span-2"><span className="text-slate-500 block text-[8px] uppercase font-bold">Ramo de Atividade:</span><span className="text-white block bg-slate-950 p-1.5 rounded border border-slate-800 text-[9px] uppercase">{leadExpandido.dadosCustomizados?.ramo || "Grave através da automação de cadastro."}</span></div>
                </div>
                {userRole === "SDR" && <p className="text-[8px] text-slate-400 italic">🔒 Alterações nos dados analíticos da empresa necessitam de permissão da diretoria.</p>}
              </div>

              {/* Contatos */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-wider border-b pb-1">👤 Dados de Contato</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Nome do Contato Principal</label>
                    <input type="text" disabled={userRole === "SDR"} value={leadExpandido.nomeContato} onChange={(e) => setLeadExpandido({ ...leadExpandido, nomeContato: e.target.value })} className="w-full p-2 border bg-white rounded-lg text-slate-800 font-bold disabled:bg-slate-100" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">E-mail</label>
                    <input type="email" disabled={userRole === "SDR"} value={leadExpandido.email} onChange={(e) => setLeadExpandido({ ...leadExpandido, email: e.target.value })} className="w-full p-2 border bg-white rounded-lg font-mono text-slate-800 disabled:bg-slate-100" />
                  </div>
                </div>
              </div>

              {/* Agenda Histórica Interna */}
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/60 space-y-2">
                <h3 className="font-black text-amber-900 uppercase text-[10px] tracking-wider border-b border-amber-200 pb-1">📅 Compromissos e Agendamentos</h3>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                  {leadExpandido.tarefas?.map(t => (
                    <div key={t.id} className={`flex justify-between items-center p-2 rounded-lg border font-mono text-[10px] ${t.concluida ? 'bg-slate-100 text-slate-400 line-through' : 'bg-white border-amber-200 text-slate-800 font-bold'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={t.concluida} onChange={(e) => {
                          const mod = leadExpandido.tarefas.map(task => task.id === t.id ? { ...task, concluida: e.target.checked } : task);
                          setLeadExpandido({ ...leadExpandido, tarefas: mod });
                        }} className="w-3.5 h-3.5 cursor-pointer" />
                        <span>🔔 Agenda: {t.data} {t.horario ? `@ ${t.horario}` : ''} - {t.titulo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco de Notas */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">📝 Observações Gerais</label>
                <textarea rows={3} value={leadExpandido.anotacoes || ""} onChange={(e) => setLeadExpandido({ ...leadExpandido, anotacoes: e.target.value })} className="w-full p-3 border border-slate-300 rounded-xl text-slate-800" />
              </div>

            </div>

            <div className="p-3 bg-slate-100 border-t flex justify-end gap-2">
              <button onClick={() => setLeadExpandido(null)} className="px-4 py-2 bg-slate-300 text-slate-700 font-bold rounded-lg uppercase">Cancelar</button>
              <button onClick={() => salvarDadosGaveta(leadExpandido)} className="px-5 py-2 bg-slate-950 text-white font-black rounded-lg uppercase tracking-wider shadow-md">💾 Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* 📅 POPUP DE CALENDÁRIO COMERCIAL EXCLUSIVO */}
      {modalCalendarioPopup.aberto && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-black text-slate-900 uppercase text-[11px]">🗓️ Central de Janelas Disponíveis do Comercial</h3>
                <p className="text-slate-400 text-[9px]">SDR seleciona a agenda livre do gerente e efetua a reserva direta para o lead.</p>
              </div>
              <button onClick={() => setModalCalendarioPopup({ aberto: false, lead: null })} className="text-lg font-black hover:text-red-500">✕</button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-3">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Visualizar Calendário de:</label>
                <select value={gerenteSelecionadoAgenda} onChange={e => setGerenteSelecionadoAgenda(e.target.value)} className="w-full p-2 border bg-white rounded-lg font-bold text-slate-800 outline-none text-[10px]">
                  {GERENTES_COMERCIAIS.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>

              {/* 🛑 SEÇÃO DO COMERCIAL: Cadastra novas janelas de espaço livre */}
              {(userRole === "Diretor" || userRole === "Consultor") && (
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="block text-[8px] font-black uppercase text-amber-600">➕ Liberar Nova Janela de Horário (Ação do Comercial)</span>
                  <div className="flex gap-2">
                    <input type="datetime-local" value={novoHorarioDisponivel} onChange={e => setNovoHorarioDisponivel(e.target.value)} className="p-1.5 border rounded text-[10px] bg-slate-50 font-mono outline-none flex-1" />
                    <button onClick={() => {
                      if(!novoHorarioDisponivel) return;
                      const formatada = novoHorarioDisponivel.replace("T", " ");
                      setHorariosDisponiveisGerentes(prev => ({
                        ...prev,
                        [gerenteSelecionadoAgenda]: [...(prev[gerenteSelecionadoAgenda] || []), formatada].sort()
                      }));
                      setNovoHorarioDisponivel("");
                    }} className="px-3 py-1 bg-slate-900 text-white font-bold rounded text-[9px] uppercase">Liberar Espaço</button>
                  </div>
                </div>
              )}

              {/* Grid de Horários Livres para Escolha do SDR */}
              <div>
                <span className="block text-[9px] uppercase font-bold text-slate-500 mb-1.5">Horários Disponíveis Identificados:</span>
                <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {horariosDisponiveisGerentes[gerenteSelecionadoAgenda]?.length === 0 ? (
                    <p className="text-slate-400 italic text-[9px] col-span-2 text-center py-4 bg-white rounded border">Nenhum horário livre cadastrado para este comercial.</p>
                  ) : (
                    horariosDisponiveisGerentes[gerenteSelecionadoAgenda]?.map((horario, index) => (
                      <button 
                        key={index} 
                        onClick={() => agendarHorarioGerentePeloSdr(horario)}
                        className="p-2 bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 text-emerald-800 hover:text-white rounded-xl text-center font-mono font-bold transition-all text-[10px]"
                      >
                        📅 {horario}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO LEAD (COM EXECUÇÃO DE ROBÔ ANTECIPADA) */}
      {modalNovoLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <div>
              <h3 className="font-black uppercase text-slate-900 text-[11px]">🚀 Iniciar Nova Originação Comercial</h3>
              <p className="text-slate-400 text-[9px]">Ao preencher os 14 números do CNPJ o robô local faz a varredura completa automática.</p>
            </div>
            
            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">CNPJ da Empresa:</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Somente números (14 dígitos)" 
                    maxLength={14}
                    value={inputCnpj} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "");
                      setInputCnpj(val);
                      if(val.length === 14) consultarDadosCnpjNoRoboLocal(val);
                    }} 
                    className="w-full p-2 border bg-slate-50 font-mono rounded-lg outline-none text-slate-800 font-bold" 
                  />
                  {buscandoRobo && <span className="absolute right-2 top-2 text-amber-500 font-bold animate-pulse">🤖 Lendo...</span>}
                </div>
              </div>

              <div><label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Razão Social:</label><input type="text" placeholder="Puxado automaticamente pelo bot" value={inputRazao} onChange={e => setInputRazao(e.target.value)} className="w-full p-2 border bg-slate-50 uppercase rounded-lg outline-none text-slate-800 font-black" /></div>
              <div><label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Nome do Decisor:</label><input type="text" placeholder="Nome do contato principal" value={inputContato} onChange={e => setInputContato(e.target.value)} className="w-full p-2 border bg-slate-50 rounded-lg outline-none text-slate-800 font-bold" /></div>
              <div><label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Telefone Principal:</label><input type="text" placeholder="Fixo ou celular" value={inputTelefone} onChange={e => setInputTelefone(e.target.value)} className="w-full p-2 border bg-slate-50 font-mono rounded-lg outline-none text-slate-800 font-bold" /></div>
            </div>

            <div className="flex justify-end gap-2 text-[10px] pt-2 border-t">
              <button onClick={() => setModalNovoLead(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg uppercase">Sair</button>
              <button onClick={handleSalvarNovoLead} className="px-4 py-1.5 bg-blue-600 text-white font-black rounded-lg uppercase shadow-md">Salvar Lead</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function CardLead({ lead, corColuna, onExpandir, onExcluir, onAbrirCalendario }: { lead: Lead; corColuna: string; onExpandir: (l: Lead) => void; onExcluir: (id: string, name: string) => void; onAbrirCalendario: (l: Lead) => void }) {
  const handleOnDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData("cardId", id); };
  const hojeStr = new Date().toISOString().split("T")[0];
  const possuiRetornoUrgente = lead.tarefas?.some(t => !t.concluida && t.data <= hojeStr);

  return (
    <div 
      draggable
      onDragStart={(e) => handleOnDragStart(e, lead.id)}
      className={`bg-white p-3 border rounded-xl shadow-xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing relative ${possuiRetornoUrgente ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-400 ring-offset-1 animate-pulse-slow' : 'border-slate-200'}`}
      style={{ borderLeft: `4px solid ${corColuna}` }}
    >
      {possuiRetornoUrgente && (
        <span className="absolute top-2 right-2 bg-amber-600 text-white text-[7px] px-1.5 py-0.5 font-black uppercase rounded animate-bounce">
          ⚠️ Retorno Hoje!
        </span>
      )}

      <div className="flex justify-between items-start gap-2">
        <div className="overflow-hidden flex-1">
          <span className="text-[8px] font-mono text-slate-400 block font-bold">CNPJ: {lead.cnpj}</span>
          <h4 className="font-black text-slate-900 tracking-tight leading-tight uppercase truncate">{lead.razaoSocial}</h4>
        </div>
      </div>

      {/* BOTÃO DE CALENDÁRIO DA AGENDA DENTRO DO CARD */}
      <button 
        onClick={() => onAbrirCalendario(lead)}
        className="w-full py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-600 text-blue-700 hover:text-white font-black uppercase tracking-wider rounded-lg text-center transition-all text-[8px]"
      >
        🗓️ Marcar Reunião Comercial
      </button>

      <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg space-y-0.5 border border-slate-100 font-medium">
        <p>👤 <span className="font-bold text-slate-800">{lead.nomeContato || "-"}</span></p>
      </div>

      {lead.tarefas?.filter(t => !t.concluida).length > 0 && (
        <div className="text-[8px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold w-fit border border-amber-200">
          ⏳ {lead.tarefas.filter(t => !t.concluida).length} compromisso(s)
        </div>
      )}

      <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[9px]">
        {/* O Botão de excluir sumirá visualmente via código de ação acima caso a função barre, mas mantemos o clique monitorado pelo nível */}
        <button onClick={() => onExcluir(lead.id, lead.razaoSocial)} className="text-red-500 hover:text-red-700 font-bold p-1 uppercase tracking-tighter transition-colors">
          🗑️ Excluir
        </button>
        <button onClick={() => onExpandir(lead)} className="px-2.5 py-1 bg-slate-900 hover:bg-blue-600 text-white font-black uppercase rounded text-[8px] transition-all">
          ⚙️ Abrir Card
        </button>
      </div>
    </div>
  );
}