/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Lead {
  cnpj: string;
  razaoSocial: string;
  cnae_principal: string;
  ramo: string;
  bairro: string;
  cidade: string;
  uf: string;
  score: number;
}

interface PerfilAI {
  atividade: string;
  cidade: string | null;
  uf: string;
  familias_cnae: string[];
  termos_fortes: string[];
  termos_fracos: string[];
}

// 🌲 Função de varredura profunda de equipe (Grafo/Multi-Líderes)
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

  // 👥 Estados da Hierarquia
  const [equipeDisponivel, setEquipeDisponivel] = useState<{id: string, nome: string}[]>([]);
  const [agenteAlvo, setAgenteAlvo] = useState<string>("");
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    carregarEquipeDoUsuario();
  }, []);

  const carregarEquipeDoUsuario = async () => {
    try {
      const userStr = localStorage.getItem("intraned_user");
      if (!userStr) return;
      
      const user = JSON.parse(userStr);
      const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

      // Se for Comercial simples, só pode mandar pra ele mesmo
      if (cargoUser !== "master" && cargoUser !== "diretor" && cargoUser !== "gerente") {
        setEquipeDisponivel([{ id: user.id, nome: user.nome }]);
        setAgenteAlvo(user.nome);
        return;
      }

      // Se for Líder, varre a árvore do Supabase
      const { data: todosUsuarios } = await supabase.from("usuarios").select("id, nome, permissoes");
      
      if (todosUsuarios) {
        if (cargoUser === "master" || cargoUser === "diretor") {
          // Diretor vê todo mundo
          setEquipeDisponivel(todosUsuarios);
        } else {
          // Gerente vê a cascata dele
          const idsPermitidos = obterIdsSubordinados(todosUsuarios, user.id);
          const time = todosUsuarios.filter(u => idsPermitidos.includes(u.id));
          setEquipeDisponivel(time);
        }
        // Deixa o próprio usuário selecionado por padrão
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
    setPerfilAI(null);
    setLeads([]);
    setLeadSelecionado(null);

    try {
      const response = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptUsuario: prompt, limite }),
      });

      const dados = await response.json();

      if (dados.error) throw new Error(dados.error);

      setLeads(dados.leads || []);
      setPerfilAI(dados.perfilAI || null);
    } catch (err: any) {
      alert("❌ Falha na mineração: " + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // 💾 Função para jogar o Lead na Esteira (Comercial)
  const vincularLeadNaEsteira = async () => {
    if (!leadSelecionado || !agenteAlvo) return;
    
    try {
      setVinculando(true);
      const dataFormatada = new Date().toISOString().split("T")[0];
      const agenteId = equipeDisponivel.find(e => e.nome === agenteAlvo)?.id || null;

      const { error } = await supabase.from("em_analise").insert({
        agente_comercial_id: agenteId,
        agente_nome: agenteAlvo,
        nome_empresa: leadSelecionado.razaoSocial.toUpperCase(),
        data_envio: dataFormatada,
        pendencias: "Lead gerado pela IA. Falta documentação."
      });

      if (error) throw error;

      alert(`✅ Sucesso! O Lead foi delegado para a esteira de ${agenteAlvo}.`);
      setLeadSelecionado(null); // Fecha a gaveta
      
      // Remove o lead da lista para não clicar duas vezes
      setLeads(prev => prev.filter(l => l.cnpj !== leadSelecionado.cnpj));
    } catch (err: any) {
      alert(`❌ Erro ao vincular: ${err.message}`);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        {/* HEADER BADASS */}
        <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase animate-pulse">
                Neon Cloud Connected
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
                GPT-4o-Mini Active
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase mt-1.5 flex items-center gap-2">
              🧠 Motor de Prospecção Avançada <span className="text-indigo-400">AI Mining</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Digite o perfil comercial desejado em linguagem livre. O ecossistema decodificará CNAEs e minerará a base do Neon em tempo real.
            </p>
          </div>
        </div>

        {/* BOX DE ENTRADA / PROMPT */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 transition-all group-hover:h-full"></div>
          
          <form onSubmit={executarMineraaoInteligente} className="space-y-4">
            <div>
              <label className="block font-black text-slate-400 uppercase text-[10px] tracking-widest mb-2">
                Descreva o Alvo Comercial (Segmento, Nicho, Produto e Região)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Quero indústrias farmacêuticas ou laboratórios de manipulação em Maringá PR que trabalhem com cosméticos ou suplementos..."
                className="w-full p-4 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[85px] resize-none"
                disabled={carregando}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">Profundidade da busca:</span>
                <select 
                  value={limite} 
                  onChange={(e) => setLimite(Number(e.target.value))}
                  className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-bold outline-none focus:border-indigo-500 cursor-pointer"
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
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                {carregando ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Minerando Base Neon Cloud...
                  </>
                ) : (
                  "⚡ Iniciar Extração Inteligente"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* METADADOS DA INTERPRETAÇÃO DA IA */}
        {perfilAI && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nicho Mapeado</span>
              <div className="text-xs font-bold text-slate-200 capitalize truncate">{perfilAI.atividade}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Região Alvo</span>
              <div className="text-xs font-bold text-indigo-400 uppercase">
                {perfilAI.cidade ? `${perfilAI.cidade} / ${perfilAI.uf}` : `Todo o Estado de ${perfilAI.uf}`}
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Famílias CNAE</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {perfilAI.familias_cnae.map(c => (
                  <span key={c} className="bg-slate-800 text-slate-300 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-700">
                    {c}xx
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Keywords de Score</span>
              <div className="text-xs font-semibold text-emerald-400 truncate mt-0.5" title={perfilAI.termos_fortes.join(', ')}>
                {perfilAI.termos_fortes.join(', ') || "Nenhum termo restrito"}
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL (TABELA + GAVETA DA DIREITA) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          <div className={`bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${
            leadSelecionado ? "lg:col-span-2" : "lg:col-span-3"
          }`}>
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex justify-between items-center">
              <span className="font-black text-slate-300 uppercase tracking-widest text-[11px] flex items-center gap-2">
                🎯 Leads Extraídos <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono font-bold text-[10px]">{leads.length}</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-800">
                    <th className="p-3.5">Score</th>
                    <th className="p-3.5">CNPJ</th>
                    <th className="p-3.5">Razão Social</th>
                    <th className="p-3.5">Cidade/UF</th>
                    <th className="p-3.5">CNAE Principal</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-xs">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-slate-500 font-bold bg-slate-900/20">
                        {carregando ? "Varrendo índices e calculando scores no Neon..." : "Nenhum lead carregado na esteira. Insira um perfil acima."}
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr 
                        key={lead.cnpj} 
                        className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          leadSelecionado?.cnpj === lead.cnpj ? "bg-indigo-600/10 border-l-2 border-l-indigo-500" : ""
                        }`}
                        onClick={() => setLeadSelecionado(lead)}
                      >
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded font-black font-mono text-[10px] tracking-wide ${
                            lead.score >= 7 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}>
                            {lead.score} PTS
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-300 select-all">{formatarCnpj(lead.cnpj)}</td>
                        <td className="p-3.5 font-bold text-slate-100 uppercase truncate max-w-[280px]">{lead.razaoSocial}</td>
                        <td className="p-3.5 uppercase text-slate-400">{lead.cidade} / {lead.uf}</td>
                        <td className="p-3.5 text-slate-400 max-w-[250px] truncate" title={lead.ramo}>
                          <span className="bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] mr-1.5 border border-slate-800">
                            {lead.cnae_principal}
                          </span>
                          {lead.ramo}
                        </td>
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.razaoSocial)}`, "_blank")}
                            className="bg-slate-800 text-slate-200 border border-slate-700 font-bold px-2.5 py-1 rounded-md hover:bg-slate-700 hover:text-white text-[11px] transition-all cursor-pointer"
                          >
                            Google
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-right-5 duration-200 lg:col-span-1 sticky top-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel de Auditoria</span>
                <button 
                  onClick={() => setLeadSelecionado(null)}
                  className="text-slate-500 hover:text-slate-300 font-bold text-xs p-1 cursor-pointer"
                >
                  ✕ Fechar
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">
                    {leadSelecionado.razaoSocial}
                  </h3>
                  <span className="font-mono font-bold text-slate-400 text-xs">{formatarCnpj(leadSelecionado.cnpj)}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-500 font-bold">Estado/Município</span>
                    <span className="text-slate-200 uppercase font-semibold">{leadSelecionado.cidade} - {leadSelecionado.uf}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-500 font-bold">Bairro Cadastrado</span>
                    <span className="text-slate-200 uppercase font-semibold">{leadSelecionado.bairro}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-500 font-bold">CNAE Ativo</span>
                    <span className="text-indigo-400 font-mono font-bold">{leadSelecionado.cnae_principal}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Descrição da Atividade</span>
                  <p className="text-slate-300 font-medium bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                    {leadSelecionado.ramo}
                  </p>
                </div>

                {/* AREA DE DELEGAÇÃO COM HIERARQUIA */}
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2 mt-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Delegar Lead para Operador:
                  </label>
                  <select 
                    value={agenteAlvo}
                    onChange={(e) => setAgenteAlvo(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white outline-none cursor-pointer focus:border-indigo-500 uppercase font-bold"
                  >
                    {equipeDisponivel.map(membro => (
                      <option key={membro.id} value={membro.nome}>{membro.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => window.open(`https://solucoes.receita.fazenda.gov.br/Servicos/CNPJreva/Cnpjreva_Solicitacao.asp?cnpj=${leadSelecionado.cnpj}`, "_blank")}
                    className="w-full bg-slate-950 text-slate-300 border border-slate-800 py-2 rounded-lg font-bold text-center hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-[11px]"
                  >
                    Cartão CNPJ
                  </button>
                  <button
                    onClick={vincularLeadNaEsteira}
                    disabled={vinculando}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-black text-center shadow-md transition-colors cursor-pointer text-[11px] disabled:opacity-50"
                  >
                    {vinculando ? "⏳ Gravando..." : "Vincular Esteira"}
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