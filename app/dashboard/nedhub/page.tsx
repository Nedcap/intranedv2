/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Lead {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeContato: string;
  telefone: string;
  estagio: string;
  funilId: "vendas" | "pos_venda";
  dadosCustomizados: Record<string, any>;
  anotacoes?: string; // Campo novo para histórico
}

export default function NedHubPage() {
  const [funilAtivo, setFunilAtivo] = useState<"vendas" | "pos_venda">("vendas");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userRole, setUserRole] = useState<string>("Consultor");
  const [carregando, setCarregando] = useState(false);

  // 🎨 Estado das Cores Customizadas por Coluna (salva temporariamente em memória)
  const [coresColunas, setCoresColunas] = useState<Record<string, string>>({
    sem_contato: "#ef4444",       // Vermelho
    telefone_inexistente: "#f97316", // Laranja
    em_fluxo: "#3b82f6",          // Azul
    apresentacao_enviada: "#8b5cf6", // Roxo
    interessados: "#22c55e",      // Verde
    visita_agendada: "#06b6d4",   // Ciano
    em_analise_mesa: "#eab308",   // Amarelo
    convertida_aprovada: "#10b981", // Esmeralda
    nao_convertida: "#64748b",    // Slate
  });

  // Estados dos Modais
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [leadExpandido, setLeadExpandido] = useState<Lead | null>(null);

  // Estados do Formulário de Cadastro
  const [inputCnpj, setInputCnpj] = useState("");
  const [inputRazao, setInputRazao] = useState("");
  const [inputContato, setInputContato] = useState("");
  const [inputTelefone, setInputTelefone] = useState("");
  const [valoresCamposCustomizados, setValoresCamposCustomizados] = useState<Record<string, any>>({});

  // Sincroniza dados com o Supabase
  const sincronizarBaseNedHub = async () => {
    try {
      setCarregando(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserRole(user.user_metadata?.role || "Consultor");
      } catch (e) { console.warn(e); }

      const { data: dbLeads, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("id", { ascending: false });
      
      if (error) throw error;
      
      if (dbLeads) {
        setLeads(dbLeads.map((l: any) => ({
          id: l.id,
          cnpj: l.cnpj,
          razaoSocial: l.razaoSocial || l.razaosocial || l.razao_social || "",
          nomeContato: l.nomeContato || l.nomecontato || l.nome_contato || "",
          telefone: l.telefone || "",
          estagio: l.estagio || l.estágio || "sem_contato",
          funilId: l.funilId || l.funilid || l.funil_id || "vendas",
          dadosCustomizados: l.campos_customizados || {},
          anotacoes: l.anotacoes || ""
        })));
      }
    } catch (err: any) {
      console.error("Erro ao sincronizar:", err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizarBaseNedHub();
  }, []);

  // API Local do Bot
  const handleConsultarCnpjReceita = async () => {
    const cnpjLimpo = inputCnpj.replace(/\D/g, "");
    if (!cnpjLimpo) return alert("Digite um CNPJ primeiro.");
    try {
      const resposta = await fetch(`http://localhost:5000/api/prospeccao?cnpj=${cnpjLimpo}`);
      if (!resposta.ok) throw new Error("CNPJ não encontrado na base do bot.");
      const dadosReal = await resposta.json();
      setInputRazao(dadosReal.razaoSocial);
      setInputContato("Diretoria / Sócio");
      setValoresCamposCustomizados({
        "RAMO": dadosReal.ramoAtividade,
        "SITE": dadosReal.website || "Não informado",
        "CIDADE/UF": dadosReal.localizacao,
        "FANTASIA": dadosReal.nomeFantasia || "Não informado"
      });
    } catch (err: any) {
      alert(`⚠️ Nota: ${err.message}. Digitação manual liberada.`);
    }
  };

  // Salvar Lead
  const handleSalvarNovoLead = async () => {
    if (!inputCnpj || !inputRazao) return alert("CNPJ e Razão Social são obrigatórios.");
    try {
      const payload = {
        cnpj: inputCnpj,
        razaoSocial: inputRazao,
        nomeContato: inputContato,
        telefone: inputTelefone,
        funilId: funilAtivo,
        estagio: funilAtivo === "vendas" ? "sem_contato" : "visita_agendada",
        campos_customizados: valoresCamposCustomizados,
        anotacoes: ""
      };
      const { error } = await supabase.from("crm_leads").insert([payload]);
      if (error) throw error;
      setModalNovoLead(false);
      setInputCnpj(""); setInputRazao(""); setInputContato(""); setInputTelefone(""); setValoresCamposCustomizados({});
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(`Erro ao salvar: ${err.message}`); }
  };

  // 🔄 Função de atualização de estágio no banco (usada tanto por cliques quanto por Drag & Drop)
  const atualizarEstagioNoBanco = async (cardId: string, novoEstagio: string) => {
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ estagio: novoEstagio })
        .eq("id", cardId);
      if (error) throw error;
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(err.message); }
  };

  // Salvar Anotações de dentro do card expandido
  const handleSalvarAnotacoes = async () => {
    if (!leadExpandido) return;
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ anotacoes: leadExpandido.anotacoes })
        .eq("id", leadExpandido.id);
      if (error) throw error;
      alert("Informações salvas com sucesso!");
      setLeadExpandido(null);
      await sincronizarBaseNedHub();
    } catch (err: any) { alert(`Erro ao salvar observações: ${err.message}`); }
  };

  // 🫳 Elementos nativos de Drag and Drop
  const handleOnDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleOnDrop = (e: React.DragEvent, estagioDestino: string) => {
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId) atualizarEstagioNoBanco(cardId, estagioDestino);
  };

  const colunasVisíveis = useMemo(() => {
    const filtrados = leads.filter(l => l.funilId === funilAtivo);
    if (funilAtivo === "vendas") {
      return [
        { id: "sem_contato", nome: "🚫 Sem Contato", cards: filtrados.filter(l => l.estagio === "sem_contato") },
        { id: "telefone_inexistente", nome: "📞 Tel. Inexistente", cards: filtrados.filter(l => l.estagio === "telefone_inexistente") },
        { id: "em_fluxo", nome: "🔄 Em Fluxo", cards: filtrados.filter(l => l.estagio === "em_fluxo") },
        { id: "apresentacao_enviada", nome: "✉️ Apresentação", cards: filtrados.filter(l => l.estagio === "apresentacao_enviada") },
        { id: "interessados", nome: "🔥 Interessados", cards: filtrados.filter(l => l.estagio === "interessados") },
      ];
    } else {
      return [
        { id: "visita_agendada", nome: "📅 Visita Agendada", cards: filtrados.filter(l => l.estagio === "visita_agendada") },
        { id: "em_analise_mesa", nome: "⚖️ Mesa de Risco", cards: filtrados.filter(l => l.estagio === "em_analise_mesa") },
        { id: "convertida_aprovada", nome: "💰 Convertida", cards: filtrados.filter(l => l.estagio === "convertida_aprovada") },
        { id: "nao_convertida", nome: "❌ Não Convertida", cards: filtrados.filter(l => l.estagio === "nao_convertida") },
      ];
    }
  }, [leads, funilAtivo]);

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col font-sans text-slate-700 bg-slate-50 text-[11px] overflow-hidden p-4 space-y-4">
      
      {/* CONTROL HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 bg-white p-4 rounded-xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">🚀 NedHub Central</h2>
            <p className="text-xs text-slate-400">Originação integrada. Arraste os cards para mudar o estágio.</p>
          </div>
          <select value={funilAtivo} onChange={(e) => setFunilAtivo(e.target.value as any)} className="p-2 border border-blue-300 rounded-lg bg-blue-50 text-blue-900 font-black uppercase text-[10px] outline-none shadow-xs">
            <option value="vendas">📋 Pipeline: Funil de Vendas (SDR)</option>
            <option value="pos_venda">💼 Pipeline: Pós Venda & Comercial</option>
          </select>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-black uppercase flex items-center">Visão: {userRole}</span>
          <button onClick={() => setModalNovoLead(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase tracking-wider shadow-xs">+ Novo Negócio</button>
        </div>
      </div>

      {carregando && <div className="p-2 text-center font-bold bg-blue-50 text-blue-600 rounded-lg animate-pulse">Sincronizando pipelines...</div>}

      {/* KANBAN GRID COM DRAG & DROP NATIVO */}
      {!carregando && (
        <div className="flex-1 grid gap-3 h-full min-h-0 overflow-hidden" style={{ gridTemplateColumns: `repeat(${colunasVisíveis.length}, minmax(0, 1fr))` }}>
          {colunasVisíveis.map(col => {
            const corAtual = coresColunas[col.id] || "#cbd5e1";
            return (
              <div 
                key={col.id} 
                onDragOver={handleOnDragOver}
                onDrop={(e) => handleOnDrop(e, col.id)}
                className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full transition-all duration-200"
              >
                {/* Cabeçalho da Aba Customizável por Cor */}
                <div className="p-3 bg-white font-black text-slate-800 border-b border-slate-200 uppercase flex justify-between items-center tracking-wider text-[9px]" style={{ borderTop: `4px solid ${corAtual}` }}>
                  <span className="flex items-center gap-1.5">
                    {col.nome}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Seletor de cores discreto no topo direito de cada coluna */}
                    <input 
                      type="color" 
                      value={corAtual} 
                      onChange={(e) => setCoresColunas(prev => ({ ...prev, [col.id]: e.target.value }))}
                      className="w-3 h-3 border-0 rounded-sm cursor-pointer p-0 bg-transparent outline-none" 
                      title="Mudar cor da coluna"
                    />
                    <span className="bg-slate-200 px-2 py-0.5 rounded-full font-mono text-slate-700">{col.cards.length}</span>
                  </div>
                </div>

                {/* Zona de Soltura dos Cards */}
                <div className="p-2 space-y-2 overflow-y-auto flex-1 content-start bg-slate-50/40">
                  {col.cards.map(lead => (
                    <CardLead key={lead.id} lead={lead} corColuna={corAtual} onExpandir={setLeadExpandido} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO */}
      {modalNovoLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] shadow-xl">
            <div className="p-4 bg-slate-900 text-white font-black uppercase text-[10px] flex justify-between items-center">
              <span>Criar Negociação ({funilAtivo === "vendas" ? "Vendas" : "Pós Venda"})</span>
              <button onClick={() => setModalNovoLead(false)} className="text-sm hover:text-red-400">✕</button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">CNPJ da Empresa</label>
                  <input type="text" placeholder="Apenas números" value={inputCnpj} onChange={e => setInputCnpj(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 bg-amber-50/20 outline-none" />
                </div>
                <button type="button" onClick={handleConsultarCnpjReceita} className="p-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg uppercase text-[10px] h-9 shadow-xs">⚡ Puxar Bot</button>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Razão Social</label>
                <input type="text" value={inputRazao} onChange={e => setInputRazao(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Contato</label>
                  <input type="text" value={inputContato} onChange={e => setInputContato(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Telefone / WhatsApp</label>
                  <input type="text" value={inputTelefone} onChange={e => setInputTelefone(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-mono outline-none" />
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setModalNovoLead(false)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg uppercase">Cancelar</button>
              <button onClick={handleSalvarNovoLead} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase shadow-xs">Salvar Negociação</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 GAVETA / MODAL DE CARD EXPANDIDO (EDIÇÃO, WHATSAPP, HISTÓRICO) */}
      {leadExpandido && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-slate-100">
            <div className="p-4 bg-slate-900 text-white font-black uppercase text-[10px] flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-amber-400">CNPJ: {leadExpandido.cnpj}</span>
                <span className="text-base font-black truncate max-w-[400px]">{leadExpandido.razaoSocial}</span>
              </div>
              <button onClick={() => setLeadExpandido(null)} className="text-base text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-[12px]">
              {/* Botão de Ação Rápida WhatsApp */}
              <div className="flex gap-2">
                <a 
                  href={`https://web.whatsapp.com/send?phone=55${leadExpandido.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  💬 Abrir no WhatsApp Web
                </a>
              </div>

              {/* Informações de Contato Basicas */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Pessoa de Contato</span>
                  <span className="font-bold text-slate-800">{leadExpandido.nomeContato || "Não informado"}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Telefone Gravado</span>
                  <span className="font-mono text-slate-700">{leadExpandido.telefone || "Não informado"}</span>
                </div>
              </div>

              {/* Área de Inclusão de Informações / Histórico Comercial */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">📝 Observações e Histórico da Negociação (Livre)</label>
                <textarea 
                  rows={4}
                  value={leadExpandido.anotacoes || ""}
                  onChange={(e) => setLeadExpandido(prev => prev ? { ...prev, anotacoes: e.target.value } : null)}
                  placeholder="Ex: Liguei hoje às 14h, falar com o Estevan amanhã cedo para fechar a proposta..."
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-amber-50/10 font-medium text-slate-800 text-[11px]"
                />
              </div>

              {/* Dados do SQLite do Bot */}
              {Object.keys(leadExpandido.dadosCustomizados).length > 0 && (
                <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-1.5">
                  <span className="text-[9px] font-black text-blue-700 uppercase block border-b border-blue-200 pb-1">Metadados Originais do Bot de Prospecção</span>
                  {Object.entries(leadExpandido.dadosCustomizados).map(([k, v]: any) => (
                    <div key={k} className="font-mono text-[10px] text-slate-600 flex justify-between">
                      <strong className="uppercase text-slate-400">{k}:</strong> 
                      <span className="text-slate-800 font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setLeadExpandido(null)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg uppercase">Fechar</button>
              <button onClick={handleSalvarAnotacoes} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase shadow-md tracking-wider">💾 Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 🃏 COMPONENTE CARD REESCRITO COM SUPORTE A DRAG NATIVE & EXPANSÃO
function CardLead({ lead, corColuna, onExpandir }: { lead: Lead; corColuna: string; onExpandir: (l: Lead) => void }) {
  
  // Inicia o evento de arrastar anexando o ID do card
  const handleOnDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("cardId", id);
  };

  return (
    <div 
      draggable
      onDragStart={(e) => handleOnDragStart(e, lead.id)}
      className="bg-white p-3 border border-slate-200 rounded-xl shadow-xs hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing group relative"
      style={{ borderLeft: `3px solid ${corColuna}` }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="overflow-hidden flex-1">
          <span className="text-[8px] font-mono font-bold text-slate-400 block">CNPJ: {lead.cnpj}</span>
          <h4 className="font-black text-slate-900 tracking-tight leading-tight uppercase truncate group-hover:text-blue-600 transition-colors">{lead.razaoSocial}</h4>
        </div>
        
        {/* 🔍 Botãozinho no canto superior direito para Expandir o card */}
        <button 
          onClick={() => onExpandir(lead)}
          className="p-1 bg-slate-100 hover:bg-slate-900 text-slate-500 hover:text-white rounded-md text-[9px] font-bold transition-all shadow-2xs"
          title="Expandir informações"
        >
          👁️ Ver / Editar
        </button>
      </div>

      <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg space-y-0.5 border border-slate-100">
        <p>👤 <span className="font-medium text-slate-700">{lead.nomeContato || "-"}</span></p>
        <p>📞 <span className="font-mono text-slate-600">{lead.telephone || lead.telefone || "-"}</span></p>
      </div>

      {lead.anotacoes && (
        <div className="text-[9px] text-slate-500 italic truncate bg-amber-50/30 px-1.5 py-0.5 rounded border border-amber-100/50">
          📝 {lead.anotacoes}
        </div>
      )}

      <div className="flex justify-between items-center pt-1 gap-2">
        <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-mono">🫳 Arraste para mover</span>
        <span className="text-[8px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">🔒 Ned Capital</span>
      </div>
    </div>
  );
}