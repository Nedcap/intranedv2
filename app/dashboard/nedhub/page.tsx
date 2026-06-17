/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Tarefa {
  id: string;
  titulo: string;
  data: string;
  concluida: boolean;
}

interface Lead {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeContato: string;
  telefone: string;
  telefones: string[]; // Suporte a múltiplos números
  email: string;
  estagio: string;
  funilId: "vendas" | "pos_venda";
  dadosCustomizados: Record<string, any>;
  anotacoes?: string;
  tarefas: Tarefa[]; // Sistema de tarefas interno
}

export default function NedHubPage() {
  const [funilAtivo, setFunilAtivo] = useState<"vendas" | "pos_venda">("vendas");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("Consultor");
  const [carregando, setCarregando] = useState(false);
  const [buscandoRobo, setBuscandoRobo] = useState(false);

  // Cores Customizáveis
  const [coresColunas, setCoresColunas] = useState<Record<string, string>>({
    sem_contato: "#ef4444", telefones_inexistente: "#f97316", em_fluxo: "#3b82f6",
    apresentacao_enviada: "#8b5cf6", interessados: "#22c55e", visita_agendada: "#06b6d4",
    em_analise_mesa: "#eab308", convertida_aprovada: "#10b981", nao_convertida: "#64748b",
  });

  // Estados dos Modais
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [leadExpandido, setLeadExpandido] = useState<Lead | null>(null);

  // Estados do Formulário de Cadastro
  const [inputCnpj, setInputCnpj] = useState("");
  const [inputRazao, setInputRazao] = useState("");
  const [inputContato, setInputContato] = useState("");
  const [inputTelefone, setInputTelefone] = useState("");

  // Estados internos da Gaveta de Edição/Templates
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [templateSelecionado, setTemplateSelecionado] = useState("");

  const sincronizarBaseNedHub = async () => {
    try {
      setCarregando(true);
      // 🔥 FIX 1: Trocado .order("id") por .order("criado_em") para impedir o UUID de quebrar a ordenação estável
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
          // 🔥 FIX 2: Garante blindagem caso a coluna ARRAY venha distorcida do Postgres
          telefones: Array.isArray(l.telefones) ? l.telefones : l.telefones ? [l.telefones] : [],
          email: l.email || "",
          estagio: l.estagio || l.estágio || "sem_contato",
          funilId: l.funilId || l.funilid || l.funil_id || "vendas",
          dadosCustomizados: l.campos_customizados || l.camposCustomizados || {},
          anotacoes: l.anotacoes || "",
          tarefas: Array.isArray(l.tarefas) ? l.tarefas : []
        })));
      }
    } catch (err: any) { console.error(err.message); } finally { setCarregando(false); }
  };

  useEffect(() => { sincronizarBaseNedHub(); }, []);

  // 🤖 BUSCA NO BOT LOCAL COM MAPEAMENTO FLEXÍVEL
  const consultarDadosCnpjNoRoboLocal = async (targetCnpj?: string, isUpdateInDrawer = false) => {
    const cnpjAlvo = targetCnpj || inputCnpj;
    const cnpjLimpo = cnpjAlvo.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) return alert("Digite um CNPJ válido com 14 dígitos numéricos.");

    try {
      setBuscandoRobo(true);
      const res = await fetch(`http://localhost:5000/api/prospeccao?cnpj=${cnpjLimpo}`);
      if (res.ok) {
        const dadosBot = await res.json();
        const dados = dadosBot.data || dadosBot.lead || dadosBot;

        if (dados && (dados.razaoSocial || dados.razao_social || dados.nome)) {
          const razaoMapeada = (dados.razaoSocial || dados.razao_social || dados.nome || "").toUpperCase();
          
          if (isUpdateInDrawer && leadExpandido) {
            const ramoMapeado = dados.ramo || dados.atividade_principal || dados.atividade || dados.cnae_fiscal_descricao || "";
            const cnaeMapeado = dados.cnae || dados.cnae_fiscal || dados.cnae_principal || "";
            const enderecoMapeado = dados.logradouro || dados.endereco || dados.logradouro_empresa || "";
            const bairroMapeado = dados.bairro || dados.bairro_empresa || "";
            const cidadeMapeado = dados.municipio || dados.cidade || dados.localidade || "";
            const ufMapeada = dados.uf || dados.estado || "";

            // Mescla de forma explícita para não perder chaves antigas do JSONB
            setLeadExpandido(prev => {
              if (!prev) return null;
              return {
                ...prev,
                razaoSocial: razaoMapeada,
                dadosCustomizados: {
                  ...(prev.dadosCustomizados || {}),
                  ramo: ramoMapeado,
                  cnae: cnaeMapeado,
                  endereco: enderecoMapeado,
                  bairro: bairroMapeado,
                  cidade: cidadeMapeado,
                  uf: ufMapeada
                }
              };
            });
            alert("⚡ Dados da Receita carregados na tela! Clique agora no botão preto '💾 Salvar Todo o Contrato' para gravar no banco.");
          } else {
            setInputRazao(razaoMapeada);
            if (dados.telefone || dados.celular) setInputTelefone(dados.telefone || dados.celular);
            if (dados.contato || dados.nome_contato) setInputContato(dados.contato || dados.nome_contato);
          }
        } else {
          if (isUpdateInDrawer) alert("ℹ️ O robô local não retornou registros estruturados para este CNPJ.");
        }
      } else {
        if (isUpdateInDrawer) alert("⚠️ Endpoint do Robô não retornou sucesso (200).");
      }
    } catch (err) {
      alert("❌ Erro de conexão: A API local (http://localhost:5000) está offline.");
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
        campos_customizados: {}, 
        tarefas: []
      };
      const { error } = await supabase.from("crm_leads").insert([payload]);
      if (error) throw error;
      setModalNovoLead(false);
      setInputCnpj(""); setInputRazao(""); setInputContato(""); setInputTelefone("");
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(err.message); }
  };

  const atualizarEstagioNoBanco = async (cardId: string, novoEstagio: string) => {
    await supabase.from("crm_leads").update({ estagio: novoEstagio }).eq("id", cardId);
    await sincronizarBaseNedHub();
  };

  const handleExcluirLead = async (cardId: string, razaoSocial: string) => {
    if (!confirm(`⚠️ ATENÇÃO: Deseja mesmo deletar permanentemente a empresa "${razaoSocial}" do NedHub? Esta ação não pode ser desfeita.`)) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("crm_leads").delete().eq("id", cardId);
      if (error) throw error;
      await sincronizarBaseNedHub();
    } catch (err: any) {
      alert(`Erro ao excluir lead: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const salvarDadosGaveta = async (leadAtualizado: Lead) => {
    try {
      setCarregando(true);
      const pacoteCamposCustomizados = {
        ...(leadAtualizado.dadosCustomizados || {})
      };

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
          campos_customizados: pacoteCamposCustomizados
        })
        .eq("id", leadAtualizado.id);

      if (error) throw error;
      
      setLeadExpandido(null);
      await sincronizarBaseNedHub();
      alert("✅ Contrato e Dados da Receita gravados com sucesso no banco de dados!");
    } catch (err: any) { 
      alert(`Erro ao salvar no Supabase: ${err.message}`); 
    } finally {
      setCarregando(false);
    }
  };

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

  const dispararEmailClienteLocal = () => {
    if (!leadExpandido || !templateSelecionado) return;
    const tmpl = templates.find(t => t.id === templateSelecionado);
    if (!tmpl) return;

    const assuntoFormatado = tmpl.assunto.replace(/{empresa}/g, leadExpandido.razaoSocial).replace(/{contato}/g, leadExpandido.nomeContato);
    const corpoFormatado = tmpl.corpo.replace(/{empresa}/g, leadExpandido.razaoSocial).replace(/{contato}/g, leadExpandido.nomeContato);

    const mailtoUrl = `mailto:${leadExpandido.email}?subject=${encodeURIComponent(assuntoFormatado)}&body=${encodeURIComponent(corpoFormatado)}`;
    window.location.href = mailtoUrl;
  };

  const dispararEmailViaResendAPI = async () => {
    if (!leadExpandido || !templateSelecionado) return;
    if (!leadExpandido.email) return alert("Insira o e-mail do cliente para disparar via API.");
    
    const tmpl = templates.find(t => t.id === templateSelecionado);
    if (!tmpl) return;

    const assuntoFormatado = tmpl.assunto.replace(/{empresa}/g, leadExpandido.razaoSocial).replace(/{contato}/g, leadExpandido.nomeContato);
    const corpoFormatado = tmpl.corpo.replace(/{empresa}/g, leadExpandido.razaoSocial).replace(/{contato}/g, leadExpandido.nomeContato);

    try {
      const res = await fetch("/api/comercial/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: leadExpandido.email, subject: assuntoFormatado, text: corpoFormatado })
      });

      if (!res.ok) throw new Error("Falha no servidor Resend.");
      alert("🚀 E-mail enviado via API Resend com sucesso!");
    } catch (err: any) {
      alert(`Erro no disparo Resend: ${err.message}`);
    }
  };

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col font-sans text-slate-700 bg-slate-50 text-[11px] overflow-hidden p-4 space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 bg-white p-4 rounded-xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">🚀 NedHub Central v4</h2>
            <p className="text-xs text-slate-400">Cards com tarefas agendadas sobem automaticamente no grid.</p>
          </div>
          <select value={funilAtivo} onChange={(e) => setFunilAtivo(e.target.value as any)} className="p-2 border border-blue-300 rounded-lg bg-blue-50 text-blue-900 font-black uppercase text-[10px] outline-none">
            <option value="vendas">📋 Pipeline: Funil de Vendas (SDR)</option>
            <option value="pos_venda">💼 Pipeline: Pós Venda & Comercial</option>
          </select>
        </div>
        <button onClick={() => setModalNovoLead(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-xs">+ Novo Negócio</button>
      </div>

      {/* GRID KANBAN */}
      <div className="flex-1 grid gap-3 h-full min-h-0 overflow-hidden" style={{ gridTemplateColumns: `repeat(${colunasVisíveis.length}, minmax(0, 1fr))` }}>
        {colunasVisíveis.map(col => {
          const colorCurrent = coresColunas[col.id] || "#cbd5e1";
          return (
            <div key={col.id} onDragOver={handleOnDragOver} onDrop={(e) => handleOnDrop(e, col.id)} className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
              <div className="p-3 bg-white font-black text-slate-800 border-b border-slate-200 uppercase flex justify-between items-center text-[9px]" style={{ borderTop: `4px solid ${colorCurrent}` }}>
                <span>{col.nome}</span>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={colorCurrent} onChange={(e) => setCoresColunas(prev => ({ ...prev, [col.id]: e.target.value }))} className="w-3 h-3 cursor-pointer p-0 bg-transparent border-0" />
                  <span className="bg-slate-200 px-2 py-0.5 rounded-full font-mono">{col.cards.length}</span>
                </div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1 content-start bg-slate-50/40">
                {col.cards.map((lead: any) => (
                  <CardLead key={lead.id} lead={lead} corColuna={colorCurrent} onExpandir={setLeadExpandido} onExcluir={handleExcluirLead} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* GAVETA EXPANDIDA */}
      {leadExpandido && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50 transition-all">
          <div className="bg-white h-full max-w-2xl w-full flex flex-col shadow-2xl border-l border-slate-200 animate-slide-left">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-[9px] font-mono font-bold uppercase text-amber-400">Edição e Ações do Contrato</span>
                <input 
                  type="text" 
                  value={leadExpandido.razaoSocial} 
                  onChange={(e) => setLeadExpandido({ ...leadExpandido, razaoSocial: e.target.value })} 
                  className="bg-transparent text-base font-black border-b border-transparent hover:border-slate-500 focus:border-blue-500 outline-none w-[450px] text-white p-0.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setLeadExpandido({
                    ...leadExpandido, 
                    funilId: leadExpandido.funilId === "vendas" ? "pos_venda" : "vendas",
                    estagio: leadExpandido.funilId === "vendas" ? "visita_agendada" : "sem_contato"
                  })}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[9px] rounded-lg shadow-sm"
                >
                  ➡️ Mudar para {leadExpandido.funilId === "vendas" ? "Pós-Venda" : "Funil Vendas"}
                </button>
                <button onClick={() => setLeadExpandido(null)} className="text-xl font-bold text-slate-400 hover:text-white px-2">✕</button>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-y-auto text-[11px]">
              {/* SEÇÃO DADOS DE INTELIGÊNCIA */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                  <h3 className="font-black uppercase text-[10px] tracking-wider text-amber-400">🏢 Dados de Inteligência (Robô Receita)</h3>
                  <button
                    type="button"
                    onClick={() => consultarDadosCnpjNoRoboLocal(leadExpandido.cnpj, true)}
                    disabled={buscandoRobo}
                    className="px-2 py-1 bg-amber-500 text-slate-950 font-black uppercase text-[8px] rounded hover:bg-amber-400 transition-all disabled:opacity-50"
                  >
                    {buscandoRobo ? "⏳ Carregando..." : "🔄 Sincronizar Dados da Receita"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase font-bold">CNPJ Vinculado:</span>
                    <span className="text-white font-bold">{leadExpandido.cnpj}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase font-bold">CNAE Fiscal:</span>
                    <span className="text-amber-200 font-bold">{leadExpandido.dadosCustomizados?.cnae || "Não mapeado"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[8px] uppercase font-bold">Ramo de Atividade / Principal:</span>
                    <span className="text-white font-bold block bg-slate-950 p-1.5 rounded border border-slate-800 text-[9px] uppercase">
                      {leadExpandido.dadosCustomizados?.ramo || "Aguardando leitura do bot..."}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[8px] uppercase font-bold">Endereço Completo:</span>
                    <span className="text-slate-300 font-bold block text-[10px]">
                      {leadExpandido.dadosCustomizados?.endereco 
                        ? `${leadExpandido.dadosCustomizados.endereco}, ${leadExpandido.dadosCustomizados?.bairro || ""} - ${leadExpandido.dadosCustomizados?.cidade || ""}/${leadExpandido.dadosCustomizados?.uf || ""}`
                        : "Endereço não sincronizado pelo SQLite"}
                    </span>
                  </div>
                </div>
              </div>

              {/* CONTATOS */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-wider border-b pb-1">👤 Dados de Contato e Comunicação</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Nome do Contato Principal</label>
                    <input type="text" value={leadExpandido.nomeContato} onChange={(e) => setLeadExpandido({ ...leadExpandido, nomeContato: e.target.value })} className="w-full p-2 border bg-white rounded-lg outline-none font-bold text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">E-mail Corporativo</label>
                    <input type="email" value={leadExpandido.email} onChange={(e) => setLeadExpandido({ ...leadExpandido, email: e.target.value })} placeholder="exemplo@empresa.com" className="w-full p-2 border bg-white rounded-lg outline-none text-slate-800 font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Lista de Telefones / WhatsApps</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {leadExpandido.telefones?.map((tel, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-white border px-2 py-1 rounded-md font-mono text-[10px] text-slate-700 font-bold">
                        <span>{tel}</span>
                        <a href={`https://web.whatsapp.com/send?phone=55${tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="Chamar no WhatsApp" className="text-emerald-600 hover:text-emerald-700">💬</a>
                        <button onClick={() => {
                          const novosTels = leadExpandido.telefones.filter((_, i) => i !== idx);
                          setLeadExpandido({ ...leadExpandido,  telefones: novosTels });
                        }} className="text-red-500 font-bold hover:text-red-700 ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} placeholder="DDD + Número (ex: 41999999999)" className="p-2 border rounded-lg bg-white flex-1 font-mono outline-none" />
                    <button onClick={() => {
                      if (!novoTelefone) return;
                      setLeadExpandido({ ...leadExpandido,  telefones: [...(leadExpandido.telefones || []), novoTelefone] });
                      setNovoTelefone("");
                    }} className="px-3 bg-slate-800 text-white font-black uppercase text-[9px] rounded-lg">+ Add Tel</button>
                  </div>
                </div>
              </div>

              {/* TEMPLATES DE EMAIL */}
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200/60 space-y-3">
                <h3 className="font-black text-purple-900 uppercase text-[10px] tracking-wider border-b border-purple-200 pb-1">✉️ Disparo Automatizado de E-mail</h3>
                <div className="space-y-2">
                  <select value={templateSelecionado} onChange={e => setTemplateSelecionado(e.target.value)} className="w-full p-2 border border-purple-300 rounded-lg bg-white text-slate-800 outline-none font-bold">
                    <option value="">-- Selecione um template de e-mail --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={dispararEmailClienteLocal} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[9px] rounded-lg shadow-sm">
                      💻 Abrir no Outlook / Gmail (Editar)
                    </button>
                    <button onClick={dispararEmailViaResendAPI} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[9px] rounded-lg shadow-sm">
                      🚀 Enviar Direto (Via Resend API)
                    </button>
                  </div>
                </div>
              </div>

              {/* TAREFAS INTERNAS */}
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/60 space-y-3">
                <h3 className="font-black text-amber-900 uppercase text-[10px] tracking-wider border-b border-amber-200 pb-1">📅 Agendamento de Tarefas e Alertas</h3>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-1.5">
                    <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Ação Comercial</label>
                    <input type="text" value={novaTarefaTitulo} onChange={e => setNovaTarefaTitulo(e.target.value)} placeholder="Ex: Retornar ligação da diretoria" className="w-full p-2 border bg-white rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Data de Retorno</label>
                    <input type="date" value={novaTarefaData} onChange={e => setNovaTarefaData(e.target.value)} className="w-full p-2 border bg-white rounded-lg outline-none font-mono" />
                  </div>
                  <button onClick={() => {
                    if (!novaTarefaTitulo || !novaTarefaData) return alert("Preencha o título e a data da tarefa.");
                    const task: Tarefa = { id: Math.random().toString(), titulo: novaTarefaTitulo, data: novaTarefaData, concluida: false };
                    setLeadExpandido({ ...leadExpandido, tarefas: [...(leadExpandido.tarefas || []), task] });
                    setNovaTarefaTitulo(""); setNovaTarefaData("");
                  }} className="w-full p-2 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[9px] h-9 rounded-lg shadow-xs">Agendar</button>
                </div>

                <div className="space-y-1.5 max-h-[150px] overflow-y-auto pt-2">
                  {leadExpandido.tarefas?.map(t => (
                    <div key={t.id} className={`flex justify-between items-center p-2 rounded-lg border font-mono text-[10px] ${t.concluida ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' : 'bg-white border-amber-200 text-slate-800 font-bold'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={t.concluida} onChange={(e) => {
                          const modificadas = leadExpandido.tarefas.map(task => task.id === t.id ? { ...task, concluida: e.target.checked } : task);
                          setLeadExpandido({ ...leadExpandido, tarefas: modificadas });
                        }} className="w-3.5 h-3.5 cursor-pointer" />
                        <span>🔔 {t.data} - {t.titulo}</span>
                      </div>
                      <button onClick={() => {
                        const limpas = leadExpandido.tarefas.filter(task => task.id !== t.id);
                        setLeadExpandido({ ...leadExpandido, tarefas: limpas });
                      }} className="text-red-500 hover:text-red-700 font-bold font-sans">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">📝 Observações Gerais e Histórico de Negociações</label>
                <textarea rows={3} value={leadExpandido.anotacoes || ""} onChange={(e) => setLeadExpandido({ ...leadExpandido, anotacoes: e.target.value })} placeholder="Digite anotações livres sobre o cliente aqui..." className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-amber-50/10 text-slate-800" />
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t flex justify-end gap-2">
              <button onClick={() => setLeadExpandido(null)} className="px-4 py-2 bg-slate-300 text-slate-700 font-bold rounded-lg uppercase">Cancelar</button>
              <button onClick={() => salvarDadosGaveta(leadExpandido)} className="px-5 py-2 bg-slate-950 text-white font-black rounded-lg uppercase tracking-wider shadow-md">💾 Salvar Todo o Contrato</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO */}
      {modalNovoLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-black uppercase text-slate-900 text-[11px] border-b pb-1">🚀 Iniciar Nova Originação Comercial</h3>
            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">CNPJ da Empresa:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Somente números (14 dígitos)" 
                    value={inputCnpj} 
                    onChange={e => {
                      setInputCnpj(e.target.value);
                      if(e.target.value.replace(/\D/g, "").length === 14) {
                        setTimeout(() => consultarDadosCnpjNoRoboLocal(), 100);
                      }
                    }} 
                    className="flex-1 p-2 border bg-slate-50 font-mono rounded-lg outline-none text-slate-800 font-bold" 
                  />
                  <button 
                    type="button"
                    onClick={() => consultarDadosCnpjNoRoboLocal()}
                    disabled={buscandoRobo}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[9px] rounded-lg transition-all disabled:opacity-40"
                  >
                    {buscandoRobo ? "⏳..." : "🔍 Puxar Robô"}
                  </button>
                </div>
              </div>
              <div><label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Razão Social (Nome Oficial):</label><input type="text" placeholder="Nome corporativo completo" value={inputRazao} onChange={e => setInputRazao(e.target.value)} className="w-full p-2 border bg-slate-50 uppercase rounded-lg outline-none text-slate-800 font-black" /></div>
              <div><label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Nome do Decisor / Contato:</label><input type="text" placeholder="Ex: Diretor Financeiro João" value={inputContato} onChange={e => setInputContato(e.target.value)} className="w-full p-2 border bg-slate-50 rounded-lg outline-none text-slate-800 font-bold" /></div>
              <div><label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Telefone Principal:</label><input type="text" placeholder="Ex: 41999999999" value={inputTelefone} onChange={e => setInputTelefone(e.target.value)} className="w-full p-2 border bg-slate-50 font-mono rounded-lg outline-none text-slate-800 font-bold" /></div>
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

function CardLead({ lead, corColuna, onExpandir, onExcluir }: { lead: Lead; corColuna: string; onExpandir: (l: Lead) => void; onExcluir: (id: string, name: string) => void }) {
  const handleOnDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData("cardId", id); };
  const hojeStr = new Date().toISOString().split("T")[0];
  const possuiRetornoUrgente = lead.tarefas?.some(t => !t.concluida && t.data <= hojeStr);

  return (
    <div 
      draggable
      onDragStart={(e) => handleOnDragStart(e, lead.id)}
      className={`bg-white p-3 border rounded-xl shadow-xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing relative ${possuiRetornoUrgente ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-400 ring-offset-1' : 'border-slate-200'}`}
      style={{ borderLeft: `4px solid ${corColuna}` }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="overflow-hidden flex-1">
          <span className="text-[8px] font-mono text-slate-400 block font-bold">CNPJ: {lead.cnpj}</span>
          <h4 className="font-black text-slate-900 tracking-tight leading-tight uppercase truncate">{lead.razaoSocial}</h4>
        </div>
      </div>

      <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg space-y-0.5 border border-slate-100 font-medium">
        <p>👤 <span className="font-bold text-slate-800">{lead.nomeContato || "-"}</span></p>
        <p>📧 <span className="font-mono text-slate-600 truncate block max-w-[150px]">{lead.email || "-"}</span></p>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[9px]">
        <button onClick={() => onExcluir(lead.id, lead.razaoSocial)} className="text-red-500 hover:text-red-700 font-bold p-1 uppercase tracking-tighter transition-colors">
          🗑️ Excluir
        </button>
        <button onClick={() => onExpandir(lead)} className="px-2.5 py-1 bg-slate-900 hover:bg-blue-600 text-white font-black uppercase rounded text-[8px] transition-all shadow-3xs">
          ⚙️ Abrir
        </button>
      </div>
    </div>
  );
}