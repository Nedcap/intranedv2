/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
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
    // 🔥 AJUSTE: Viewport travado na altura da tela (h-screen)
    <div className="h-screen bg-slate-50 text-slate-700 p-4 md:p-6 font-sans antialiased text-[13px] flex flex-col overflow-hidden">
      <div className="max-w-[1700px] mx-auto w-full flex flex-col h-full gap-5">
        
        {/* ================= HEADER & SEARCH (FIXOS NO TOPO) ================= */}
        <div className="shrink-0 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase animate-pulse shadow-sm">
                  Google BigQuery
                </span>
                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase shadow-sm">
                  GPT-4o-Mini AI
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                🧠 Motor de Prospecção <span className="text-indigo-600">B2B</span>
              </h1>
            </div>
          </div>

          {/* BOX DE ENTRADA / PROMPT */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
            <form onSubmit={executarMineraaoInteligente} className="space-y-4 pl-2">
              <div>
                <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-2">
                  Descreva o Alvo Comercial (Segmento, Nicho, Produto e Região)
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Quero indústrias farmacêuticas ou laboratórios de manipulação em Maringá PR..."
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[80px] resize-none shadow-inner"
                  disabled={carregando}
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Profundidade:</span>
                  <span className="bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2.5 py-1 rounded-lg text-[10px] tracking-tight shadow-sm flex items-center gap-1.5 uppercase">
                    🛡️ Máx. 50 Registros
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={carregando || !prompt.trim()}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-[11px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {carregando ? "⏳ Extraindo do BigQuery..." : "⚡ Iniciar Extração Inteligente"}
                </button>
              </div>
            </form>
          </div>

          {/* METADADOS DA INTERPRETAÇÃO DA IA */}
          {perfilAI && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">🎯 Nicho Mapeado (IA)</span>
                <div className="text-xs font-bold text-slate-800 capitalize truncate" title={perfilAI.atividade}>{perfilAI.atividade || "Busca Geral"}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">📍 Região Alvo</span>
                <div className="text-xs font-bold text-indigo-700 uppercase truncate">
                  {perfilAI.cidade_nome ? `${perfilAI.cidade_nome} / ${perfilAI.uf}` : `Todo o Estado de ${perfilAI.uf || "Indefinido"}`}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">🏷️ CNAEs Sniper</span>
                <div className="flex flex-wrap gap-1">
                  {(perfilAI.codigos_cnae || perfilAI.familias_cnae || []).length > 0 ? (
                    (perfilAI.codigos_cnae || perfilAI.familias_cnae || []).slice(0, 3).map(c => (
                      <span key={c} className="bg-white text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-200 shadow-sm truncate max-w-[80px]">
                        {c}*
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">Busca abrangente</span>
                  )}
                  {(perfilAI.codigos_cnae || perfilAI.familias_cnae || []).length > 3 && (
                    <span className="text-[9px] font-bold text-slate-400 self-center">+{((perfilAI.codigos_cnae || perfilAI.familias_cnae || []).length) - 3}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= ÁREA DE CONTEÚDO SCROLLABLE (TABELA E INSPEÇÃO) ================= */}
        <div className="flex-1 min-h-0 flex gap-5">
          
          {/* TABELA DE LEADS */}
          <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col transition-all duration-300 overflow-hidden ${
            leadSelecionado ? "w-full lg:w-2/3 shrink-0" : "w-full"
          }`}>
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <span className="font-black text-slate-700 uppercase tracking-widest text-[11px] flex items-center gap-2">
                🎯 Dossiês Extraídos 
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-mono font-bold text-[10px] shadow-sm">{leads.length} leads</span>
              </span>
              
              {leads.length > 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportarListaParaCSV}
                    className="bg-white border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 text-[10px] uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    📥 CSV
                  </button>
                  <button 
                    onClick={limparTodaAEstreia}
                    className="bg-rose-50 border border-rose-200 text-rose-600 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-100 text-[10px] uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    🗑️ Limpar
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                  <tr className="text-slate-500 uppercase text-[9px] font-black tracking-widest border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm">
                    <th className="p-3.5 w-16 text-center">Score</th>
                    <th className="p-3.5 w-36">CNPJ</th>
                    <th className="p-3.5">Razão Social / Identificação</th>
                    <th className="p-3.5 w-40">Localização</th>
                    <th className="p-3.5 w-40">CNAE Principal</th>
                    <th className="p-3.5 w-24 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-16">
                        {carregando ? (
                          <div className="flex flex-col items-center gap-3 text-indigo-500">
                             <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                             <span className="font-bold uppercase tracking-widest text-xs">Cruzando tabelas na nuvem do Google BigQuery...</span>
                          </div>
                        ) : (
                          <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Área de trabalho vazia. Descreva um alvo acima para minerar!</div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const isSelected = leadSelecionado?.cnpj === lead.cnpj;
                      return (
                        <tr 
                          key={lead.cnpj} 
                          className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${
                            isSelected ? "bg-indigo-50/80 border-l-[4px] border-l-indigo-600 shadow-inner" : "border-l-[4px] border-l-transparent"
                          }`}
                          onClick={() => setLeadSelecionado(lead)}
                        >
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-1 rounded font-black font-mono text-[9px] shadow-sm tracking-wider ${
                              (lead.score || 0) >= 8 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                              (lead.score || 0) >= 5 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                              {lead.score} PT
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-600 select-all">{formatarCnpj(lead.cnpj)}</td>
                          <td className="p-3.5">
                            <div className={`font-black uppercase truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{lead.razao_social}</div>
                            {lead.nome_fantasia && lead.nome_fantasia !== lead.razao_social && (
                              <div className="text-[10px] text-slate-500 font-bold lowercase truncate tracking-tight mt-0.5">⭐ {lead.nome_fantasia}</div>
                            )}
                          </td>
                          <td className="p-3.5 uppercase text-slate-500 font-bold text-[10px]">{lead.cidadeExtenso} / {lead.uf}</td>
                          <td className="p-3.5">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono font-bold text-[9px] border border-slate-200 shadow-sm truncate max-w-[120px] inline-block" title={lead.cnae_principal}>
                              {lead.cnae_principal}
                            </span>
                          </td>
                          <td className="p-3.5 text-center flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social || lead.cnpj)}`, "_blank")}
                              className="bg-white text-slate-600 border border-slate-300 font-bold px-2 py-1.5 rounded hover:bg-slate-50 text-[10px] cursor-pointer shadow-sm transition-colors"
                              title="Pesquisar no Google"
                            >
                              🔍 G
                            </button>
                            <button
                              onClick={() => eliminarLeadDaLista(lead.cnpj)}
                              className="bg-rose-50 text-rose-600 border border-rose-200 font-bold px-2 py-1.5 rounded hover:bg-rose-500 hover:text-white text-[10px] cursor-pointer shadow-sm transition-colors"
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

          {/* SIDE GAVETA: DETALHES COMPLETOS (Ocupa o terço direito, rola interno) */}
          {leadSelecionado && (
            <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-lg animate-in slide-in-from-right-8 duration-300 overflow-hidden shrink-0">
              
              <div className="bg-indigo-900 p-5 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <span className="bg-indigo-800 text-indigo-200 border border-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-inner">
                    Inspeção de Lead
                  </span>
                  <button 
                    onClick={() => setLeadSelecionado(null)}
                    className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-rose-500 rounded-full text-white font-black transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-tight leading-tight relative z-10">
                  {leadSelecionado.razao_social}
                </h3>
                {leadSelecionado.nome_fantasia && leadSelecionado.nome_fantasia !== leadSelecionado.razao_social && (
                  <div className="text-xs font-bold text-indigo-300 uppercase mt-1 relative z-10">★ {leadSelecionado.nome_fantasia}</div>
                )}
                <div className="font-mono font-bold text-white/80 text-xs mt-2 relative z-10">{formatarCnpj(leadSelecionado.cnpj)}</div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 bg-slate-50/50">
                
                {/* Cartão de Dados Cadastrais */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Região / Matriz</span>
                    <span className="text-slate-800 text-xs uppercase font-black text-right">{leadSelecionado.cidadeExtenso} - {leadSelecionado.uf}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Bairro</span>
                    <span className="text-slate-700 text-xs font-bold truncate max-w-[150px]" title={leadSelecionado.bairro}>{leadSelecionado.bairro || "NÃO INFORMADO"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Situação Cadastral</span>
                    <span className="text-xs font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded shadow-sm">
                      {leadSelecionado.situacao}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">CNAE Principal</span>
                    <span className="text-indigo-600 font-mono font-bold text-[11px] truncate max-w-[150px]" title={leadSelecionado.cnae_principal}>{leadSelecionado.cnae_principal}</span>
                  </div>
                  
                  {leadSelecionado.capital_social && leadSelecionado.capital_social > 0 ? (
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Capital Social</span>
                      <span className="text-emerald-700 font-black font-mono text-[13px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
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
                        className="text-blue-600 font-bold hover:underline text-[11px] truncate max-w-[160px] bg-blue-50 px-2 py-1 rounded border border-blue-100 shadow-sm"
                      >
                        🌐 Acessar Site
                      </a>
                    </div>
                  )}
                </div>

                {/* Bloco Google Maps / Classificação */}
                {leadSelecionado.google_categoria && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Classificação Comercial (Google Maps)</span>
                    <span className="text-sm font-black text-indigo-900 capitalize flex items-center gap-2">
                      <span>📍</span> {leadSelecionado.google_categoria}
                    </span>
                  </div>
                )}

              </div>

              {/* RODAPÉ DA GAVETA: AÇÕES E DELEGAÇÃO */}
              <div className="p-5 bg-white border-t border-slate-200 shrink-0 space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    👤 Delegar para Carteira Comercial:
                  </label>
                  <select 
                    value={agenteAlvo}
                    onChange={(e) => setAgenteAlvo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase shadow-sm"
                  >
                    {equipeDisponivel.map(membro => (
                      <option key={membro.id} value={membro.nome}>{membro.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => window.open(`https://cnpj.biz/${leadSelecionado.cnpj.replace(/\D/g, "")}`, "_blank")}
                    className="w-full bg-white text-slate-700 border border-slate-300 py-3 rounded-xl font-black text-center hover:bg-slate-50 text-[10px] uppercase tracking-wider cursor-pointer shadow-sm transition-all"
                  >
                    ⚡ Cartão CNPJ
                  </button>
                  <button
                    onClick={enviarParaNedHub}
                    disabled={vinculando}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-center shadow-md transition-all cursor-pointer text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {vinculando ? "⏳ Gravando..." : "📤 Enviar NedHub"}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* GLOBAL SCROLLBAR STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

    </div>
  );
}