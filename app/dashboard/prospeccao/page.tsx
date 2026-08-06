/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Lead {
  cnpj: string;
  cnpj_raiz: string; 
  matriz_filial: string; 
  situacao: string; 
  data_abertura: string; 
  cnae_principal: string;
  cnaes_secundarios?: string;
  bairro: string;
  cep: string; 
  uf: string;
  municipio_rf: string; 
  razao_social: string; 
  nome_fantasia?: string; 
  natureza_juridica?: string;
  capital_social?: number;
  google_categoria?: string;
  google_endereco?: string;
  website?: string;
  lat?: number;
  lng?: number;
  score?: number; 
  cidadeExtenso?: string;
}

interface PerfilAI {
  atividade: string;
  cidade_nome: string | null;
  codigo_municipio: string | null;
  uf: string;
  codigos_cnae?: string[];
  familias_cnae?: string[];
  termos_fortes?: string[];
  termos_fracos?: string[];
}

const obterIdsSubordinados = (usuarios: any[], liderId: string, visitados = new Set<string>()): string[] => {
  if (visitados.has(liderId)) return [];
  visitados.add(liderId);

  let resultado: string[] = [liderId];

  const subDiretos = usuarios.filter(u => {
    const lideres = u.permissoes?.lider_ids || (u.permissoes?.lider_id ? [u.permissoes.lider_id] : []);
    return Array.isArray(lideres) && lideres.includes(liderId);
  });

  subDiretos.forEach(sub => {
    resultado = [...resultado, ...obterIdsSubordinados(usuarios, sub.id, visitados)];
  });

  return Array.from(new Set(resultado));
};

export default function ProspeccaoIAPage() {
  const [prompt, setPrompt] = useState("");
  const [carregando, setCarregando] = useState(false);
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [perfilAI, setPerfilAI] = useState<PerfilAI | null>(null);
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);

  const [equipeDisponivel, setEquipeDisponivel] = useState<{id: string, nome: string}[]>([]);
  const [agenteAlvo, setAgenteAlvo] = useState<string>("");
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    carregarEquipeDoUsuario();
    
    const leadsSalvos = localStorage.getItem("ned_leads_minerados");
    const perfilSalvo = localStorage.getItem("ned_perfil_minerado");
    
    if (leadsSalvos) setLeads(JSON.parse(leadsSalvos));
    if (perfilSalvo) setPerfilAI(JSON.parse(perfilSalvo));
  }, []);

  useEffect(() => {
    if (leads.length > 0) {
      localStorage.setItem("ned_leads_minerados", JSON.stringify(leads));
    } else {
      localStorage.removeItem("ned_leads_minerados");
    }
  }, [leads]);

  useEffect(() => {
    if (perfilAI) {
      localStorage.setItem("ned_perfil_minerado", JSON.stringify(perfilAI));
    } else {
      localStorage.removeItem("ned_perfil_minerado");
    }
  }, [perfilAI]);

  const carregarEquipeDoUsuario = async () => {
    try {
      const userStr = localStorage.getItem("intraned_user");
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

      if (cargoUser !== "master" && cargoUser !== "diretor" && cargoUser !== "gerente") {
        setEquipeDisponivel([{ id: user.id, nome: user.nome }]);
        setAgenteAlvo(user.nome);
        return;
      }

      const { data: todosUsuarios } = await supabase.from("usuarios").select("id, nome, permissoes");
      
      if (todosUsuarios) {
        if (cargoUser === "master" || cargoUser === "diretor") {
          setEquipeDisponivel(todosUsuarios);
        } else {
          const idsPermitidos = obterIdsSubordinados(todosUsuarios, user.id);
          const time = todosUsuarios.filter(u => idsPermitidos.includes(u.id));
          setEquipeDisponivel(time);
        }
        setAgenteAlvo(user.nome);
      }
    } catch (err) {
      console.error("Erro ao carregar hierarquia:", err);
    }
  };

  const executarMineraaoInteligente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setCarregando(true);
    setLeadSelecionado(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tokenJwt = session?.access_token;

      const response = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenJwt}` 
        },
        body: JSON.stringify({ promptUsuario: prompt, limite: 50 }),
      });

      const textoPuro = await response.text();
      let dados;
      
      try {
        dados = JSON.parse(textoPuro);
      } catch (jsonErr) {
        console.error("Erro no retorno da API:", textoPuro);
        throw new Error("A API retornou HTML ou erro fatal. Veja o console (F12).");
      }

      if (dados.error) throw new Error(dados.error);

      const mapeamentoAI: PerfilAI = dados.perfilAI || null;

      const leadsTratados = (dados.leads || []).map((l: any) => {
        const cidadeReal = mapeamentoAI && l.municipio_rf === mapeamentoAI.codigo_municipio
          ? mapeamentoAI.cidade_nome
          : `CÓDIGO ${l.municipio_rf}`;

        return {
          ...l,
          cidadeExtenso: cidadeReal || "Não identificada",
          score: l.score || 10 
        };
      });

      setLeads(prev => {
        const cnpjsExistentes = new Set(prev.map(item => item.cnpj));
        const novosFiltrados = leadsTratados.filter((item: any) => !cnpjsExistentes.has(item.cnpj));
        return [...prev, ...novosFiltrados];
      });
      
      setPerfilAI(mapeamentoAI);
    } catch (err: any) {
      alert("❌ Falha na mineração: " + err.message);
    } finally {
      setCarregando(false);
    }
  };

  const eliminarLeadDaLista = (cnpjParaRemover: string) => {
    if (leadSelecionado?.cnpj === cnpjParaRemover) setLeadSelecionado(null);
    setLeads(prev => prev.filter(l => l.cnpj !== cnpjParaRemover));
  };

  const limparTodaAEstreia = () => {
    if (!confirm("Tem certeza que deseja limpar toda a lista da tela e recomeçar do zero?")) return;
    setLeads([]);
    setPerfilAI(null);
    setLeadSelecionado(null);
    localStorage.removeItem("ned_leads_minerados");
    localStorage.removeItem("ned_perfil_minerado");
  };

  const exportarListaParaCSV = () => {
    if (leads.length === 0) return;
    
    const cabecalho = "CNPJ;Razao Social;Nome Comercial;Cidade;UF;CNAE;Bairro;Situacao;Website\n";
    const linhas = leads.map(l => 
      `"${l.cnpj}";"${l.razao_social}";"${l.nome_fantasia || ''}";"${l.cidadeExtenso}";"${l.uf}";"${l.cnae_principal}";"${l.bairro || ''}";"${l.situacao}";"${l.website || ''}"`
    ).join("\n");
    
    const blob = new Blob([cabecalho + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_minerados_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const enviarParaNedHub = async () => {
    if (!leadSelecionado || !agenteAlvo) return;
    
    try {
      setVinculando(true);
      const agenteId = equipeDisponivel.find(e => e.nome === agenteAlvo)?.id || null;

      const { error } = await supabase.from("crm_leads").insert({
        responsavel_id: agenteId,
        responsavel_nome: agenteAlvo,
        razaoSocial: (leadSelecionado.razao_social || leadSelecionado.cnpj).toUpperCase(),
        cnpj: leadSelecionado.cnpj,
        estagio: "Prospecção", 
        campos_customizados: {
          origem_lead: "BigQuery Cloud Mining (Rico em Dados)",
          score_ia: leadSelecionado.score || 10,
          cnae_principal: leadSelecionado.cnae_principal,
          descricao_ramo: perfilAI?.atividade || "Mapeado via AI",
          cidade: leadSelecionado.cidadeExtenso || leadSelecionado.municipio_rf,
          uf: leadSelecionado.uf,
          bairro: leadSelecionado.bairro,
          situacao_cadastral: leadSelecionado.situacao,
          data_abertura: leadSelecionado.data_abertura,
          capital_social: leadSelecionado.capital_social || 0,
          website: leadSelecionado.website || "",
          google_categoria: leadSelecionado.google_categoria || ""
        }
      });

      if (error) throw error;

      alert(`🚀 Sensacional! Card criado no NedHub de ${agenteAlvo}.`);
      eliminarLeadDaLista(leadSelecionado.cnpj);
    } catch (err: any) {
      alert(`❌ Erro ao enviar para o NedHub: ${err.message}`);
    } finally {
      setVinculando(false);
    }
  };

  const formatarCnpj = (cnpj: string) => {
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) return cnpj;
    return `${limpo.substring(0, 2)}.${limpo.substring(2, 5)}.${limpo.substring(5, 8)}/${limpo.substring(8, 12)}-${limpo.substring(12, 14)}`;
  };

  return (
    <div className="h-screen bg-[#f8fafc] text-slate-800 p-4 md:p-6 font-sans flex flex-col overflow-hidden">
      <div className="max-w-[1800px] w-full mx-auto flex flex-col h-full gap-6">
        
        {/* ================= HEADER E FILTROS (TOPO FIXO) ================= */}
        <div className="shrink-0 flex flex-col xl:flex-row gap-6 items-start xl:items-stretch">
          
          {/* TÍTULO E BADGES */}
          <div className="flex flex-col justify-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-w-[320px] shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase animate-pulse shadow-sm whitespace-nowrap">
                Google BigQuery
              </span>
              <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase shadow-sm whitespace-nowrap">
                GPT-4o-Mini
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">
              Motor de <br/><span className="text-indigo-600">Prospecção B2B</span>
            </h1>
          </div>

          {/* INPUT PRINCIPAL */}
          <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
            <div className="mb-4">
              <label className="block font-black text-slate-500 uppercase text-[11px] tracking-widest mb-2 ml-1">
                Descreva o Alvo Comercial (Nicho, Produto e Região)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Quero indústrias farmacêuticas ou laboratórios de manipulação em Maringá PR..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[70px] resize-none shadow-inner"
                disabled={carregando}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="bg-slate-100 text-slate-600 font-bold px-3 py-2 rounded-lg text-[11px] tracking-wide shadow-sm flex items-center gap-2 uppercase whitespace-nowrap shrink-0">
                🛡️ Profundidade: Máx. 50 Registros
              </span>

              <button
                onClick={executarMineraaoInteligente}
                disabled={carregando || !prompt.trim()}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-[0_4px_14px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0 whitespace-nowrap"
              >
                {carregando ? "⏳ Extraindo..." : "⚡ Iniciar Extração Inteligente"}
              </button>
            </div>
          </div>
          
          {/* METADADOS DA IA (OPCIONAL, SE EXISTIREM) */}
          {perfilAI && (
            <div className="hidden xl:flex flex-col bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-w-[320px] max-w-[380px] gap-3 shrink-0">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">🎯 Nicho Mapeado (IA)</span>
                <div className="text-xs font-bold text-slate-800 capitalize truncate" title={perfilAI.atividade}>{perfilAI.atividade || "Busca Geral"}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">📍 Região Alvo</span>
                <div className="text-xs font-bold text-indigo-700 uppercase truncate">
                  {perfilAI.cidade_nome ? `${perfilAI.cidade_nome} / ${perfilAI.uf}` : `Todo o Estado de ${perfilAI.uf || "Indefinido"}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= ÁREA DE CONTEÚDO SCROLLABLE (TABELA E INSPEÇÃO) ================= */}
        <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
          
          {/* TABELA DE LEADS */}
          <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col transition-all duration-300 overflow-hidden ${
            leadSelecionado ? "w-full lg:w-[65%] xl:w-[70%] shrink-0" : "w-full"
          }`}>
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <span className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-3">
                🎯 Dossiês Extraídos 
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-mono font-black text-[11px] shadow-sm whitespace-nowrap">{leads.length} leads</span>
              </span>
              
              {leads.length > 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportarListaParaCSV}
                    className="bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl hover:bg-slate-50 text-[11px] uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    📥 Exportar CSV
                  </button>
                  <button 
                    onClick={limparTodaAEstreia}
                    className="bg-rose-50 border border-rose-200 text-rose-600 font-bold px-4 py-2 rounded-xl hover:bg-rose-100 text-[11px] uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    🗑️ Limpar
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                  <tr className="text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200 bg-slate-50/90 backdrop-blur-md">
                    <th className="p-4 w-20 text-center">Score</th>
                    <th className="p-4 w-40">CNPJ</th>
                    <th className="p-4 min-w-[250px]">Razão Social / Fantasia</th>
                    <th className="p-4 w-48">Localização</th>
                    <th className="p-4 w-48">CNAE Principal</th>
                    <th className="p-4 w-24 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-xs text-slate-700">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-20">
                        {carregando ? (
                          <div className="flex flex-col items-center gap-4 text-indigo-500">
                             <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                             <span className="font-bold uppercase tracking-widest text-sm text-slate-500">Minerando dados na nuvem do Google...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 opacity-50">
                            <span className="text-5xl">🔭</span>
                            <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Área de trabalho vazia. Descreva um alvo!</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const isSelected = leadSelecionado?.cnpj === lead.cnpj;
                      return (
                        <tr 
                          key={lead.cnpj} 
                          className={`transition-colors cursor-pointer ${
                            isSelected ? "bg-indigo-50/80 border-l-[4px] border-l-indigo-600 shadow-inner" : "border-l-[4px] border-l-transparent hover:bg-slate-50"
                          }`}
                          onClick={() => setLeadSelecionado(lead)}
                        >
                          <td className="p-4 text-center">
                            <span className={`inline-block whitespace-nowrap px-3 py-1.5 rounded-lg font-black font-mono text-[10px] shadow-sm tracking-wider ${
                              (lead.score || 0) >= 8 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                              (lead.score || 0) >= 5 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                              {lead.score} PT
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-600 select-all whitespace-nowrap">{formatarCnpj(lead.cnpj)}</td>
                          <td className="p-4">
                            <div className={`font-black uppercase truncate max-w-[280px] ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{lead.razao_social}</div>
                            {lead.nome_fantasia && lead.nome_fantasia !== lead.razao_social && (
                              <div className="text-[10px] text-slate-500 font-bold lowercase truncate max-w-[280px] mt-1 tracking-tight">⭐ {lead.nome_fantasia}</div>
                            )}
                          </td>
                          <td className="p-4 uppercase text-slate-600 font-bold text-[11px] truncate max-w-[180px] whitespace-nowrap">{lead.cidadeExtenso} / {lead.uf}</td>
                          <td className="p-4">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-mono font-bold text-[10px] border border-slate-200 shadow-sm truncate max-w-[180px] inline-block whitespace-nowrap" title={lead.cnae_principal}>
                              {lead.cnae_principal}
                            </span>
                          </td>
                          <td className="p-4 text-center flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social || lead.cnpj)}`, "_blank")}
                              className="bg-white text-slate-600 border border-slate-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm transition-colors shrink-0"
                              title="Pesquisar no Google"
                            >
                              🔍
                            </button>
                            <button
                              onClick={() => eliminarLeadDaLista(lead.cnpj)}
                              className="bg-white text-rose-500 border border-slate-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 cursor-pointer shadow-sm transition-colors shrink-0"
                              title="Remover Lead"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIDE GAVETA: DETALHES COMPLETOS DO LEAD */}
          {leadSelecionado && (
            <div className="hidden lg:flex w-[35%] xl:w-[30%] bg-white border border-slate-200 rounded-2xl flex-col shadow-lg animate-in slide-in-from-right-8 duration-300 overflow-hidden shrink-0">
              
              <div className="bg-indigo-900 p-6 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <span className="bg-indigo-800 text-indigo-100 border border-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner whitespace-nowrap">
                    Inspeção de Lead
                  </span>
                  <button 
                    onClick={() => setLeadSelecionado(null)}
                    className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-rose-500 rounded-xl text-white font-black transition-colors cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none relative z-10">
                  {leadSelecionado.razao_social}
                </h3>
                {leadSelecionado.nome_fantasia && leadSelecionado.nome_fantasia !== leadSelecionado.razao_social && (
                  <div className="text-sm font-bold text-indigo-300 uppercase mt-2 relative z-10 truncate">★ {leadSelecionado.nome_fantasia}</div>
                )}
                <div className="font-mono font-bold text-white/80 text-xs mt-3 relative z-10 bg-black/20 inline-block px-2.5 py-1 rounded-md">{formatarCnpj(leadSelecionado.cnpj)}</div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 bg-slate-50/50">
                
                {/* Cartão de Dados Cadastrais */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Sede Principal</span>
                    <span className="text-slate-800 text-sm uppercase font-black">{leadSelecionado.cidadeExtenso} - {leadSelecionado.uf}</span>
                    <span className="text-slate-500 text-xs font-bold truncate" title={leadSelecionado.bairro}>{leadSelecionado.bairro || "BAIRRO NÃO INFORMADO"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Status Receita</span>
                    <span className="text-[11px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md shadow-sm whitespace-nowrap">
                      {leadSelecionado.situacao}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 border-b border-slate-100 pb-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">CNAE Primário</span>
                    <span className="text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 font-mono font-bold text-xs truncate" title={leadSelecionado.cnae_principal}>{leadSelecionado.cnae_principal}</span>
                  </div>
                  
                  {leadSelecionado.capital_social && leadSelecionado.capital_social > 0 ? (
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Cap. Social</span>
                      <span className="text-emerald-700 font-black font-mono text-[13px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                        {leadSelecionado.capital_social.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ) : null}

                  {leadSelecionado.website && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Presença Digital</span>
                      <a 
                        href={leadSelecionado.website.startsWith("http") ? leadSelecionado.website : `https://${leadSelecionado.website}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 font-black hover:underline text-[11px] truncate max-w-[140px] bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-100 shadow-sm transition-colors whitespace-nowrap"
                      >
                        🌐 Acessar Site
                      </a>
                    </div>
                  )}
                </div>

                {/* Bloco Google Maps / Classificação */}
                {leadSelecionado.google_categoria && (
                  <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Classificação (Google Maps)</span>
                    <span className="text-sm font-black text-indigo-900 capitalize flex items-center gap-2">
                      <span>📍</span> {leadSelecionado.google_categoria}
                    </span>
                  </div>
                )}

              </div>

              {/* RODAPÉ DA GAVETA: AÇÕES E DELEGAÇÃO */}
              <div className="p-6 bg-white border-t border-slate-200 shrink-0 space-y-5">
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest">
                    👤 Delegar (Carteira Comercial)
                  </label>
                  <select 
                    value={agenteAlvo}
                    onChange={(e) => setAgenteAlvo(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-800 outline-none cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase shadow-sm"
                  >
                    {equipeDisponivel.map(membro => (
                      <option key={membro.id} value={membro.nome}>{membro.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => window.open(`https://cnpj.biz/${leadSelecionado.cnpj.replace(/\D/g, "")}`, "_blank")}
                    className="w-full bg-white text-slate-700 border border-slate-300 py-3.5 rounded-xl font-black text-center hover:bg-slate-50 text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all whitespace-nowrap"
                  >
                    ⚡ Cartão CNPJ
                  </button>
                  <button
                    onClick={enviarParaNedHub}
                    disabled={vinculando}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-black text-center shadow-md transition-all cursor-pointer text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {vinculando ? "⏳ Gravando..." : "📤 Ir pro CRM"}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* GLOBAL SCROLLBAR STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

    </div>
  );
}