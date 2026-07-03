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

// 🔥 INTERFACE ATUALIZADA PARA BATER COM A API "SNIPER"
interface PerfilAI {
  atividade: string;
  cidade_nome: string | null;
  codigo_municipio: string | null;
  uf: string;
  codigos_cnae?: string[]; // Propriedade nova do Sniper
  familias_cnae?: string[]; // Mantido como opcional para não quebrar cache antigo
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
  const [limite, setLimite] = useState(150);
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
      const response = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptUsuario: prompt, limite }),
      });

      // 🛡️ BLINDAGEM DE JSON (Evita erro fatal se voltar HTML)
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
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase animate-pulse">
                Google BigQuery Active
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
                GPT-4o-Mini Active
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-1.5 flex items-center gap-2">
              🧠 Motor de Prospecção Avançada <span className="text-indigo-600">BigQuery Mining v2</span>
            </h1>
          </div>
        </div>

        {/* BOX DE ENTRADA / PROMPT */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 transition-all group-hover:h-full"></div>
          
          <form onSubmit={executarMineraaoInteligente} className="space-y-4">
            <div>
              <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-2">
                Descreva o Alvo Comercial (Segmento, Nicho, Produto e Região)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Quero indústrias farmacêuticas ou laboratórios de manipulação em Maringá PR..."
                className="w-full p-4 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[85px] resize-none"
                disabled={carregando}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-slate-200 mt-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Profundidade da busca:</span>
                <select 
                  value={limite} 
                  onChange={(e) => setLimite(Number(e.target.value))}
                  className="p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 font-bold outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                  disabled={carregando}
                >
                  <option value={50}>50 registros (Rápido)</option>
                  <option value={150}>150 registros (Recomendado)</option>
                  <option value={300}>300 registros (Profundo)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={carregando || !prompt.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {carregando ? "Minerando Base BigQuery Cloud..." : "⚡ Iniciar Extração Inteligente"}
              </button>
            </div>
          </form>
        </div>

        {/* METADADOS DA INTERPRETAÇÃO DA IA */}
        {perfilAI && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 shadow-sm">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nicho Mapeado</span>
              <div className="text-xs font-bold text-slate-800 capitalize truncate">{perfilAI.atividade || "Busca Geral"}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Região Alvo</span>
              <div className="text-xs font-bold text-indigo-600 uppercase">
                {perfilAI.cidade_nome ? `${perfilAI.cidade_nome} / ${perfilAI.uf}` : `Todo o Estado de ${perfilAI.uf || "Indefinido"}`}
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CNAEs Sniper Detectados</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {/* 🛡️ TRATAMENTO SEGURO: Lê a lista nova, ou a antiga do cache, ou exibe vazio sem quebrar */}
                {(perfilAI.codigos_cnae || perfilAI.familias_cnae || []).length > 0 ? (
                  (perfilAI.codigos_cnae || perfilAI.familias_cnae || []).map(c => (
                    <span key={c} className="bg-slate-100 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                      {c}*
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-semibold text-slate-400">Busca abrangente</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL (TABELA + GAVETA DA DIREITA) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${
            leadSelecionado ? "lg:col-span-2" : "lg:col-span-3"
          }`}>
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="font-black text-slate-700 uppercase tracking-widest text-[11px] flex items-center gap-2">
                🎯 Área de Trabalho Ativa <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-mono font-bold text-[10px]">{leads.length} leads</span>
              </span>
              
              {leads.length > 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportarListaParaCSV}
                    className="bg-white border border-slate-300 text-slate-700 font-bold px-3 py-1 rounded hover:bg-slate-50 text-[11px] cursor-pointer"
                  >
                    📥 Exportar CSV
                  </button>
                  <button 
                    onClick={limparTodaAEstreia}
                    className="bg-red-50 border border-red-200 text-red-600 font-bold px-3 py-1 rounded hover:bg-red-100 text-[11px] cursor-pointer"
                  >
                    🗑️ Limpar Lista
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                    <th className="p-3.5">Score</th>
                    <th className="p-3.5">CNPJ</th>
                    <th className="p-3.5">Razão Social / Identificação</th>
                    <th className="p-3.5">Cidade/UF</th>
                    <th className="p-3.5">CNAE Principal</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-xs">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-slate-500 font-bold bg-slate-50">
                        {carregando ? "Cruzando tabelas na nuvem do Google BigQuery..." : "Área de trabalho vazia. Descreva um alvo acima para minerar e acumular leads aqui!"}
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr 
                        key={lead.cnpj} 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          leadSelecionado?.cnpj === lead.cnpj ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""
                        }`}
                        onClick={() => setLeadSelecionado(lead)}
                      >
                        <td className="p-3.5">
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded font-black font-mono text-[10px]">
                            {lead.score} PTS
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-600 select-all">{formatarCnpj(lead.cnpj)}</td>
                        <td className="p-3.5 font-black text-slate-900 uppercase truncate max-w-[280px]">
                          <div>{lead.razao_social}</div>
                          {lead.nome_fantasia && lead.nome_fantasia !== lead.razao_social && (
                            <div className="text-[10px] text-indigo-500 font-semibold lowercase truncate tracking-tight">⭐ {lead.nome_fantasia}</div>
                          )}
                        </td>
                        <td className="p-3.5 uppercase text-slate-500">{lead.cidadeExtenso} / {lead.uf}</td>
                        <td className="p-3.5 text-slate-500 max-w-[250px] truncate">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] mr-1.5 border border-slate-200">
                            {lead.cnae_principal}
                          </span>
                        </td>
                        <td className="p-3.5 text-center flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razao_social || lead.cnpj)}`, "_blank")}
                            className="bg-white text-slate-700 border border-slate-300 font-bold px-2 py-1 rounded hover:bg-slate-50 text-[11px] cursor-pointer"
                          >
                            Google
                          </button>
                          <button
                            onClick={() => eliminarLeadDaLista(lead.cnpj)}
                            className="bg-white text-red-500 border border-red-200 font-bold px-2 py-1 rounded hover:bg-red-50 text-[11px] cursor-pointer"
                            title="Remover da lista"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIDE GAVETA: DETALHES COMPLETOS DO LEAD SELECIONADO */}
          {leadSelecionado && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-lg animate-in slide-in-from-right-5 duration-200 lg:col-span-1 sticky top-6">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Painel de Auditoria Enriquecido</span>
                <button 
                  onClick={() => setLeadSelecionado(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs p-1 cursor-pointer"
                >
                  ✕ Fechar
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">
                    {leadSelecionado.razao_social}
                  </h3>
                  {leadSelecionado.nome_fantasia && leadSelecionado.nome_fantasia !== leadSelecionado.razao_social && (
                    <div className="text-xs font-bold text-indigo-600 uppercase mt-0.5">Fantasia: {leadSelecionado.nome_fantasia}</div>
                  )}
                  <span className="font-mono font-bold text-slate-500 text-xs">{formatarCnpj(leadSelecionado.cnpj)}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-bold">Região</span>
                    <span className="text-slate-800 uppercase font-semibold">{leadSelecionado.cidadeExtenso} - {leadSelecionado.uf}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-bold">Bairro</span>
                    <span className="text-slate-800 uppercase font-semibold">{leadSelecionado.bairro || "NÃO INFORMADO"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-bold">Situação Cadastral</span>
                    <span className="text-slate-800 uppercase font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                      STATUS {leadSelecionado.situacao}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-bold">CNAE Principal</span>
                    <span className="text-indigo-600 font-mono font-bold">{leadSelecionado.cnae_principal}</span>
                  </div>
                  {leadSelecionado.capital_social && leadSelecionado.capital_social > 0 ? (
                    <div className="flex justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-slate-500 font-bold">Capital Social</span>
                      <span className="text-emerald-600 font-bold">
                        {leadSelecionado.capital_social.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  ) : null}
                  {leadSelecionado.website && (
                    <div className="flex justify-between pt-0.5 items-center">
                      <span className="text-slate-500 font-bold">Website</span>
                      <a 
                        href={leadSelecionado.website.startsWith("http") ? leadSelecionado.website : `https://${leadSelecionado.website}`}
                        target="_blank" 
                        className="text-indigo-600 font-bold hover:underline text-[11px] truncate max-w-[150px]"
                      >
                        {leadSelecionado.website} 🔗
                      </a>
                    </div>
                  )}
                </div>

                {leadSelecionado.google_categoria && (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block mb-0.5">Classificação Comercial Google</span>
                    <span className="text-xs font-semibold text-slate-800 capitalize">{leadSelecionado.google_categoria}</span>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-2 mt-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Delegar Lead no NedHub para:
                  </label>
                  <select 
                    value={agenteAlvo}
                    onChange={(e) => setAgenteAlvo(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none cursor-pointer focus:border-indigo-500 uppercase font-bold shadow-sm"
                  >
                    {equipeDisponivel.map(membro => (
                      <option key={membro.id} value={membro.nome}>{membro.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => {
                      const cnpjLimpo = leadSelecionado.cnpj.replace(/\D/g, "");
                      window.open(`https://cnpj.biz/${cnpjLimpo}`, "_blank");
                    }}
                    className="w-full bg-white text-slate-700 border border-slate-300 py-2 rounded-lg font-bold text-center hover:bg-slate-50 text-[11px] cursor-pointer shadow-sm"
                  >
                    Cartão CNPJ ⚡
                  </button>
                  <button
                    onClick={enviarParaNedHub}
                    disabled={vinculando}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-black text-center shadow-md transition-colors cursor-pointer text-[11px] disabled:opacity-50"
                  >
                    {vinculando ? "⏳ Gravando..." : "📤 Enviar p/ NedHub"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}