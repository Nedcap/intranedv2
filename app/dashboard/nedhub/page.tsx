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
}

export default function NedHubPage() {
  const [funilAtivo, setFunilAtivo] = useState<"vendas" | "pos_venda">("vendas");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userRole, setUserRole] = useState<string>("Consultor");
  const [carregando, setCarregando] = useState(false);

  // Estados do Modal de Cadastro
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [inputCnpj, setInputCnpj] = useState("");
  const [inputRazao, setInputRazao] = useState("");
  const [inputContato, setInputContato] = useState("");
  const [inputTelefone, setInputTelefone] = useState("");
  const [valoresCamposCustomizados, setValoresCamposCustomizados] = useState<Record<string, any>>({});

  // Sincroniza os dados com o Supabase
  const sincronizarBaseNedHub = async () => {
    try {
      setCarregando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserRole(user.user_metadata?.role || "Consultor");

        const { data: dbLeads, error } = await supabase
          .from("crm_leads")
          .select("*")
          .order("id", { ascending: false });
        
        if (error) throw error;
        
        if (dbLeads) {
          setLeads(dbLeads.map((l: any) => ({
            id: l.id,
            cnpj: l.cnpj,
            // 🎯 CORREÇÃO: Mapeamento flexível para aceitar variações de caixa do banco (CamelCase ou minúsculo)
            razaoSocial: l.razaoSocial || l.razaosocial || l.razao_social || "",
            nomeContato: l.nomeContato || l.nomecontato || l.nome_contato || "",
            telefone: l.telefone || "",
            estagio: l.estagio || "sem_contato",
            funilId: l.funilId || l.funilid || l.funil_id || "vendas",
            dadosCustomizados: l.campos_customizados || {}
          })));
        }
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

  // 🔌 Chamada para a sua API Local que lê o SQLite do Bot
  const handleConsultarCnpjReceita = async () => {
    const cnpjLimpo = inputCnpj.replace(/\D/g, "");
    if (!cnpjLimpo) {
      alert("Digite um CNPJ primeiro.");
      return;
    }
    
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

  // Salva o novo lead respeitando as colunas exatas do banco
  const handleSalvarNovoLead = async () => {
    if (!inputCnpj || !inputRazao) {
      alert("CNPJ e Razão Social são obrigatórios.");
      return;
    }
    try {
      const payload = {
        cnpj: inputCnpj,
        razaoSocial: inputRazao,
        nomeContato: inputContato,
        telefone: inputTelefone,
        funilId: funilAtivo,
        estagio: funilAtivo === "vendas" ? "sem_contato" : "visita_agendada",
        campos_customizados: valoresCamposCustomizados
      };

      const { error } = await supabase.from("crm_leads").insert([payload]);
      if (error) throw error;

      setModalNovoLead(false);
      setInputCnpj(""); setInputRazao(""); setInputContato(""); setInputTelefone(""); setValoresCamposCustomizados({});
      await sincronizarBaseNedHub();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    }
  };

  // Move o card lateralmente nas colunas
  const moverEstagioCard = async (id: string, direcao: "proximo" | "voltar") => {
    const estágiosVendas = ["sem_contato", "telefone_inexistente", "em_fluxo", "apresentacao_enviada", "interessados"];
    const estágiosPosVenda = ["visita_agendada", "em_analise_mesa", "convertida_aprovada", "nao_convertida"];
    
    const listaEstagios = funilAtivo === "vendas" ? estágiosVendas : estágiosPosVenda;
    const card = leads.find(l => l.id === id);
    if (!card) return;

    const idxAtual = listaEstagios.indexOf(card.estagio);
    const novoIdx = idxAtual + (direcao === "proximo" ? 1 : -1);
    
    if (novoIdx < 0 || novoIdx >= listaEstagios.length) return;

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ estagio: listaEstagios[novoIdx] })
        .eq("id", id);

      if (error) throw error;
      await sincronizarBaseNedHub();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Montagem dinâmica das colunas conforme o pipeline selecionado
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
        { id: "convertida_aprovada", nome: "💰 Convertida (Comissão)", cards: filtrados.filter(l => l.estagio === "convertida_aprovada") },
        { id: "nao_convertida", nome: "❌ Não Convertida", cards: filtrados.filter(l => l.estagio === "nao_convertida") },
      ];
    }
  }, [leads, funilAtivo]);

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col font-sans text-slate-700 bg-slate-50 text-[11px] overflow-hidden p-4 space-y-4">
      
      {/* HEADER / CONTROL PANEL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 bg-white p-4 rounded-xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">🚀 NedHub Central</h2>
            <p className="text-xs text-slate-400">Originação integrada à base local do Bot de Prospecção.</p>
          </div>
          
          {/* SWITCHER DE FUNIL DO RD STATION */}
          <select 
            value={funilAtivo} 
            onChange={(e) => setFunilAtivo(e.target.value as any)}
            className="p-2 border border-blue-300 rounded-lg bg-blue-50 text-blue-900 font-black uppercase text-[10px] outline-none cursor-pointer shadow-xs"
          >
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

      {/* DASHBOARD KANBAN GRID */}
      {!carregando && (
        <div className="flex-1 grid gap-3 h-full min-h-0 overflow-hidden" style={{ gridTemplateColumns: `repeat(${colunasVisíveis.length}, minmax(0, 1fr))` }}>
          {colunasVisíveis.map(col => (
            <div key={col.id} className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
              <div className="p-3 bg-white font-black text-slate-800 border-b border-slate-200 uppercase flex justify-between items-center tracking-wider text-[9px]">
                <span>{col.nome}</span>
                <span className="bg-slate-200 px-2 py-0.5 rounded-full font-mono">{col.cards.length}</span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1 content-start">
                {col.cards.map(lead => (
                  <CardLead key={lead.id} lead={lead} onMover={moverEstagioCard} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CADASTRO INTELLIGENT */}
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
                  <input type="text" placeholder="Apenas números" value={inputCnpj} onChange={e => setInputCnpj(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 bg-amber-50/20 outline-none focus:border-amber-500" />
                </div>
                <button type="button" onClick={handleConsultarCnpjReceita} className="p-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg uppercase text-[10px] h-9 tracking-wider shadow-xs">⚡ Puxar Bot</button>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Razão Social / Nome da Negociação</label>
                <input type="text" value={inputRazao} onChange={e => setInputRazao(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Contato Principal</label>
                  <input type="text" value={inputContato} onChange={e => setInputContato(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Telefone / WhatsApp</label>
                  <input type="text" value={inputTelefone} onChange={e => setInputTelefone(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-mono outline-none" />
                </div>
              </div>

              {Object.keys(valoresCamposCustomizados).length > 0 && (
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 space-y-1">
                  <span className="text-[9px] font-black text-blue-700 uppercase block mb-1">Metadados do SQLite do Bot:</span>
                  {Object.entries(valoresCamposCustomizados).map(([k, v]: any) => (
                    <div key={k} className="font-mono text-[9px] text-slate-600"><strong>{k}:</strong> {v}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setModalNovoLead(false)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg uppercase">Cancelar</button>
              <button onClick={handleSalvarNovoLead} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase tracking-wider shadow-xs">Salvar Negociação</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function CardLead({ lead, onMover }: { lead: Lead; onMover: (id: string, dir: "proximo" | "voltar") => void }) {
  return (
    <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-xs hover:shadow-md transition-all space-y-2 group">
      <div>
        <span className="text-[8px] font-mono font-bold text-slate-400 tracking-wider block">CNPJ: {lead.cnpj}</span>
        <h4 className="font-black text-slate-900 tracking-tight leading-tight uppercase truncate group-hover:text-blue-600 transition-colors">{lead.razaoSocial}</h4>
      </div>

      <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg space-y-0.5 border border-slate-100">
        <p>👤 <span className="font-medium text-slate-700">{lead.nomeContato || "-"}</span></p>
        <p>📞 <span className="font-mono text-slate-600">{lead.telefone || "-"}</span></p>
      </div>

      {Object.keys(lead.dadosCustomizados).length > 0 && (
        <div className="bg-slate-50/50 p-1.5 rounded-lg space-y-0.5 text-[8px] font-mono border border-slate-100 text-slate-600">
          {Object.entries(lead.dadosCustomizados).slice(0, 3).map(([k, v]: any) => (
            <div key={k} className="truncate"><span className="text-slate-400 font-bold">{k}:</span> {v}</div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 gap-2">
        <button onClick={() => onMover(lead.id, "voltar")} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold transition-colors">◀</button>
        <span className="text-[8px] uppercase tracking-widest text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">🔒 Ned Capital</span>
        <button onClick={() => onMover(lead.id, "proximo")} className="px-2 py-1 bg-slate-900 text-white hover:bg-blue-600 rounded-md font-bold transition-colors">▶</button>
      </div>
    </div>
  );
}