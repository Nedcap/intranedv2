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
  estagio: "prospeccao" | "contato" | "proposta" | "analise";
  criado_por?: string;
  dadosCustomizados: Record<string, any>;
}

interface CampoCustomizadoConfig {
  id: string;
  label: string;
  tipo: "text" | "number" | "date";
}

export default function NedHubPage() {
  const [abaAtiva, setAbaAtiva] = useState<number>(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userRole, setUserRole] = useState<string>("Consultor"); // Padrão de segurança restrito
  const [userId, setUserId] = useState<string>("");
  const [carregando, setCarregando] = useState(false);

  // Estados para os atributos criados "Ao Vivo"
  const [camposCustomizados, setCamposCustomizados] = useState<CampoCustomizadoConfig[]>([]);
  const [novoCampoLabel, setNovoCampoLabel] = useState("");
  const [novoCampoTipo, setNovoCampoTipo] = useState<"text" | "number" | "date">("text");

  // Estados do Modal de Criação de Oportunidades
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [inputCnpj, setInputCnpj] = useState("");
  const [inputRazao, setInputRazao] = useState("");
  const [inputContato, setInputContato] = useState("");
  const [inputTelefone, setInputTelefone] = useState("");
  const [valoresCamposCustomizados, setValoresCamposCustomizados] = useState<Record<string, any>>({});

  // 🔐 Sincronização Segura via RLS com o Supabase
  const sincronizarBaseNedHub = async () => {
    try {
      setCarregando(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        const role = user.user_metadata?.role || "Consultor";
        setUserRole(role);

        // O RLS do banco intercepta essa chamada e filtra o retorno automaticamente
        const { data: dbLeads, error } = await supabase
          .from("crm_leads")
          .select("*")
          .order("criado_em", { ascending: false });
        
        if (error) throw error;
        
        if (dbLeads) {
          setLeads(dbLeads.map((l: any) => ({
            id: l.id,
            cnpj: l.cnpj,
            razaoSocial: l.razao_social,
            nomeContato: l.nome_contato,
            telefone: l.telefone,
            estagio: l.estagio_id || "prospeccao",
            criado_por: l.criado_por,
            dadosCustomizados: l.campos_customizados || {}
          })));
        }
      }
    } catch (err: any) {
      console.error("Falha na sincronização da esteira:", err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizarBaseNedHub();
  }, []);

  // Criação de campos dinâmicos protegida para nível Master
  const handleCriarCampoAoVivo = () => {
    if (userRole !== "Master") {
      alert("⛔ Permissão Negada: Apenas administradores do nível Master podem alterar o layout do CRM.");
      return;
    }
    if (!novoCampoLabel.trim()) return;
    const novo: CampoCustomizadoConfig = {
      id: Math.random().toString(),
      label: novoCampoLabel.toUpperCase().trim(),
      tipo: novoCampoTipo
    };
    setCamposCustomizados([...camposCustomizados, novo]);
    setNovoCampoLabel("");
    alert(`⚡ Campo "${novo.label}" anexado ao dicionário global.`);
  };

  // Simulação de preenchimento automático (Futura conexão com os seus 16GB locais via localhost:5000)
  const handleConsultarCnpjReceita = async () => {
    const cnpjLimpo = inputCnpj.replace(/\D/g, "");
    if (!cnpjLimpo) return;
    try {
      setInputRazao("PROSPECT ENCONTRADO NA BASE LOCAL DA RECEITA");
      setInputContato("Sócio/Diretor Administrativo");
    } catch (err) {
      console.log("Ponte offline, utilizando entrada manual");
    }
  };

  // Gravação física no banco (O Supabase injeta o seu UUID na coluna criado_por automaticamente)
  const handleSalvarNovoLead = async () => {
    if (!inputCnpj) return;
    try {
      const payload = {
        cnpj: inputCnpj,
        razao_social: inputRazao || "Razão Social Manual",
        nome_contato: inputContato,
        telefone: inputTelefone,
        estagio_id: "prospeccao",
        campos_customizados: valoresCamposCustomizados
      };

      const { error } = await supabase.from("crm_leads").insert([payload]);
      if (error) throw error;

      setModalNovoLead(false);
      setInputCnpj(""); setInputRazao(""); setInputContato(""); setInputTelefone(""); setValoresCamposCustomizados({});
      await sincronizarBaseNedHub();
    } catch (err: any) {
      alert(`Erro na gravação segura: ${err.message}`);
    }
  };

  // Movimentação de Cards por clique com atualização em tempo real no banco
  const moverEstagioCard = async (id: string, direcao: "proximo" | "voltar") => {
    const ordemEstagios = ["prospeccao", "contato", "proposta", "analise"];
    const cardAlvo = leads.find(l => l.id === id);
    if (!cardAlvo) return;

    const idxAtual = ordemEstagios.indexOf(cardAlvo.estagio);
    let novoIdx = idxAtual + (direcao === "proximo" ? 1 : -1);
    if (novoIdx < 0) novoIdx = 0;
    if (novoIdx > 3) novoIdx = 3;

    const novoEstagio = ordemEstagios[novoIdx];

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ estagio_id: novoEstagio })
        .eq("id", id);

      if (error) throw error;
      await sincronizarBaseNedHub();
    } catch (err: any) {
      alert(`Falha na movimentação do ativo: ${err.message}`);
    }
  };

  // Agrupamento computado das colunas do Kanban
  const colunasKanban = useMemo(() => {
    return {
      prospeccao: leads.filter(l => l.estagio === "prospeccao"),
      contato: leads.filter(l => l.estagio === "contato"),
      proposta: leads.filter(l => l.estagio === "proposta"),
      analise: leads.filter(l => l.estagio === "analise")
    };
  }, [leads]);

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col font-sans text-slate-700 bg-slate-50 text-[11px] overflow-hidden p-4 space-y-4">
      
      {/* BARRA DE CONTROLE SUPERIOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 bg-white p-4 rounded-xl shadow-2xs gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            🚀 NedHub — Originação Comercial Unificada
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400">Ambiente blindado por criptografia RLS e restrição de carteira.</p>
            <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[8px] ${userRole === "Master" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
              Escopo de Visão: {userRole}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAbaAtiva(0)} className={`px-4 py-2 font-black rounded-lg uppercase tracking-wider transition-all ${abaAtiva === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>📊 Funil Kanban</button>
          {userRole === "Master" && (
            <button onClick={() => setAbaAtiva(1)} className={`px-4 py-2 font-black rounded-lg uppercase tracking-wider transition-all ${abaAtiva === 1 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>⚙️ Customizar Campos Ao Vivo</button>
          )}
          <button onClick={() => setModalNovoLead(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase tracking-wider transition-all shadow-xs">+ Novo Prospect (CNPJ)</button>
        </div>
      </div>

      {carregando && (
        <div className="p-3 font-bold text-center bg-blue-50 text-blue-700 border border-blue-100 rounded-lg animate-pulse">
          ⏳ Autenticando canal seguro e aplicando políticas de isolamento de dados...
        </div>
      )}

      {/* RENDERIZADOR DAS COLUNAS INDEPENDENTES */}
      {abaAtiva === 0 && !carregando && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 h-full min-h-0 overflow-hidden">
          
          <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
            <div className="p-3 bg-white font-black text-slate-800 border-b border-slate-200 uppercase flex justify-between items-center tracking-wider text-[10px]">
              <span>🔍 1. Prospecção Ativa</span>
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">{colunasKanban.prospeccao.length}</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {colunasKanban.prospeccao.map(lead => (
                <CardLead key={lead.id} lead={lead} camposConf={camposCustomizados} onMover={moverEstagioCard} />
              ))}
            </div>
          </div>

          <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
            <div className="p-3 bg-white font-black text-blue-800 border-b border-slate-200 uppercase flex justify-between items-center tracking-wider text-[10px]">
              <span>📞 2. Contato Efetivado</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">{colunasKanban.contato.length}</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {colunasKanban.contato.map(lead => (
                <CardLead key={lead.id} lead={lead} camposConf={camposCustomizados} onMover={moverEstagioCard} />
              ))}
            </div>
          </div>

          <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
            <div className="p-3 bg-white font-black text-amber-800 border-b border-slate-200 uppercase flex justify-between items-center tracking-wider text-[10px]">
              <span>✉️ 3. Proposta Enviada</span>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono">{colunasKanban.proposta.length}</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {colunasKanban.proposta.map(lead => (
                <CardLead key={lead.id} lead={lead} camposConf={camposCustomizados} onMover={moverEstagioCard} />
              ))}
            </div>
          </div>

          <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-xl overflow-hidden h-full">
            <div className="p-3 bg-white font-black text-emerald-800 border-b border-slate-200 uppercase flex justify-between items-center tracking-wider text-[10px]">
              <span>⚖️ 4. Mesa de Crédito</span>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">{colunasKanban.analise.length}</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
              {colunasKanban.analise.map(lead => (
                <CardLead key={lead.id} lead={lead} camposConf={camposCustomizados} onMover={moverEstagioCard} />
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ABA 1: CUSTOMIZAÇÃO DE ATRIBUTOS AO VIVO */}
      {abaAtiva === 1 && userRole === "Master" && (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 space-y-6 overflow-y-auto">
          <div className="max-w-xl">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">🎛️ Motor de Atributos Customizados</h3>
            <p className="text-xs text-slate-400 mt-1">Injete novas regras e campos na esteira em tempo real de execução.</p>
            
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nome do Atributo (Label)</label>
                <input type="text" placeholder="Ex: LIMITE ESTIMADO, INFOS DE MERCADO" value={novoCampoLabel} onChange={e => setNovoCampoLabel(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none uppercase mt-1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Tipagem</label>
                <select value={novoCampoTipo} onChange={e => setNovoCampoTipo(e.target.value as any)} className="w-full p-2 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none mt-1 bg-white">
                  <option value="text">Texto Livre</option>
                  <option value="number">Numérico / Moeda</option>
                  <option value="date">Data</option>
                </select>
              </div>
              <button onClick={handleCriarCampoAoVivo} className="w-full p-2 bg-slate-900 text-white font-black rounded-lg uppercase tracking-wider text-[10px] hover:bg-slate-800 transition-all">
                ⚡ INJETAR EM TODA A ESTEIRA GLOBAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUSPENSO */}
      {modalNovoLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white font-black uppercase tracking-wider flex justify-between items-center text-[10px]">
              <span>📥 Cadastrar Nova Oportunidade Segura no NedHub</span>
              <button onClick={() => setModalNovoLead(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase">CNPJ Alvo (Prospecção)</label>
                  <input type="text" placeholder="Apenas números" value={inputCnpj} onChange={e => setInputCnpj(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 bg-amber-50/20" />
                </div>
                <button type="button" onClick={handleConsultarCnpjReceita} className="p-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg uppercase tracking-wider text-[10px] h-9">
                  🔍 Consultar
                </button>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase">Razão Social</label>
                <input type="text" value={inputRazao} onChange={e => setInputRazao(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-bold text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase">Nome do Contato Principal</label>
                  <input type="text" value={inputContato} onChange={e => setInputContato(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-medium text-slate-800" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase">Telefone</label>
                  <input type="text" value={inputTelefone} onChange={e => setInputTelefone(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-medium text-slate-800" />
                </div>
              </div>

              {/* CAMPOS EM TEMPO REAL DENTRO DO CADASTRO */}
              {camposCustomizados.length > 0 && (
                <div className="border-t border-dashed border-slate-200 pt-3 space-y-2">
                  <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider">📋 Atributos Dinâmicos Adicionados</span>
                  {camposCustomizados.map(campo => (
                    <div key={campo.id}>
                      <label className="block text-[9px] font-black text-slate-500 uppercase">{campo.label}</label>
                      <input 
                        type={campo.tipo} 
                        onChange={e => setValoresCamposCustomizados({ ...valoresCamposCustomizados, [campo.label]: e.target.value })}
                        className="w-full p-2 border border-blue-200 rounded-lg font-bold text-slate-800 bg-blue-50/10 focus:bg-white transition-all mt-0.5" 
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setModalNovoLead(false)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg uppercase tracking-wider">Cancelar</button>
              <button onClick={handleSalvarNovoLead} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase tracking-wider shadow-sm">Gravar sob Propriedade</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// COMPONENTE DO CARD
function CardLead({ lead, camposConf, onMover }: { lead: Lead; camposConf: CampoCustomizadoConfig[]; onMover: (id: string, dir: "proximo" | "voltar") => void }) {
  return (
    <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-2xs hover:shadow-xs transition-all space-y-2 group">
      <div>
        <span className="text-[8px] font-mono font-bold text-slate-400 tracking-wider">CNPJ: {lead.cnpj}</span>
        <h4 className="font-black text-slate-900 tracking-tight leading-tight uppercase group-hover:text-blue-600 transition-colors">{lead.razaoSocial}</h4>
      </div>

      <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg space-y-0.5 border border-slate-100">
        <p>👤 <span className="font-medium text-slate-700">{lead.nomeContato || "-"}</span></p>
        <p>📞 <span className="font-mono text-slate-600">{lead.telefone || "-"}</span></p>
      </div>

      {Object.keys(lead.dadosCustomizados).length > 0 && (
        <div className="bg-blue-50/30 p-2 border border-blue-100 rounded-lg space-y-1 text-[9px]">
          {Object.entries(lead.dadosCustomizados).map(([chave, valor]: any) => (
            <div key={chave} className="font-mono">
              <span className="text-slate-400 font-bold">{chave}:</span> <span className="text-blue-900 font-black">{valor}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
        <button onClick={() => onMover(lead.id, "voltar")} disabled={lead.estagio === "prospeccao"} className="px-2 py-0.5 bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-md font-bold transition-colors">◀</button>
        <span className="text-[8px] uppercase tracking-widest text-emerald-600 font-black">🔒 Exclusivo</span>
        <button onClick={() => onMover(lead.id, "proximo")} disabled={lead.estagio === "analise"} className="px-2 py-0.5 bg-slate-900 text-white hover:bg-blue-600 disabled:opacity-30 rounded-md font-bold transition-colors">▶</button>
      </div>
    </div>
  );
}