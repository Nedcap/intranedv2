/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador"; // Ajuste o import se necessário

// Configuração das Etapas das Timelines
const STEPS_SEC = [
  { key: "dt_aprovacao_comite", label: "Aprovação Comitê" },
  { key: "dt_documentos_sec", label: "Documentos" },
  { key: "dt_geracao_contrato_sec", label: "Geração Contrato" },
  { key: "dt_assinatura_contrato_sec", label: "Assinatura Contrato" },
  { key: "dt_apto_sec", label: "Apto a Operar" }
];

const STEPS_FIDC = [
  { key: "dt_aprovacao_comite", label: "Aprovação Comitê" },
  { key: "dt_documentos_fidc", label: "Documentos" },
  { key: "dt_geracao_contrato_fidc", label: "Geração Contrato" },
  { key: "dt_assinatura_contrato_fidc", label: "Assinatura Contrato" },
  { key: "dt_envio_gestora_fidc", label: "Envio Gestora" },
  { key: "dt_aprovacao_gestora_fidc", label: "Aprovação Gestora" },
  { key: "dt_envio_admin_fidc", label: "Envio Admin" },
  { key: "dt_aprovacao_admin_fidc", label: "Aprovação Admin" },
  { key: "dt_apto_fidc", label: "Apto a Operar" }
];

export default function CadastroPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; perfil: string } | null>(null);
  
  const [cedentesEmEdicaoDeNome, setCedentesEmEdicaoDeNome] = useState<Record<string, boolean>>({});
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "cedente",
    direction: "asc"
  });
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTE_ENVIO" | "AGUARDANDO_ASSINATURA" | "APTO">("TODOS");

  useEffect(() => {
    async function carregarCadastro() {
      try {
        setCarregando(true);
        const userStr = localStorage.getItem("intraned_user");
        let query = supabase.from("cadastro_cedentes").select("*");

        if (userStr) {
          const user = JSON.parse(userStr);
          const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
          setUsuarioAtual({ nome: user.nome, perfil: cargoUser });

          if (cargoUser === "comercial") {
            query = query.eq("comercial", user.nome);
          }
        }

        const { data } = await query;
        if (data) {
          setCedentes(data.map(item => ({ ...item, _isEditado: false, _isNovo: false })));
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setCarregando(false); 
      }
    }
    carregarCadastro();
  }, []);

  const handleInputChange = (index: number, campo: string, valor: any) => {
    const novos = [...cedentes]; 
    novos[index][campo] = valor;
    novos[index]["_isEditado"] = true;
    setCedentes(novos);
  };

  const handleLimiteInputChange = (index: number, valorRaw: string) => {
    const apenasNumeros = valorRaw.replace(/\D/g, "");
    if (!apenasNumeros) {
      handleInputChange(index, "limite", "");
      return;
    }
    const valorNumerico = parseFloat(apenasNumeros) / 100;
    const formatado = valorNumerico.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    handleInputChange(index, "limite", formatado);
  };

  const adicionarNovaLinha = () => {
    const novaLinha = {
      cedente: "", limite: "", taxa: "", obs: "",
      // Novos campos de data zerados
      dt_aprovacao_comite: null,
      dt_documentos_sec: null, dt_geracao_contrato_sec: null, dt_assinatura_contrato_sec: null, dt_apto_sec: null,
      dt_documentos_fidc: null, dt_geracao_contrato_fidc: null, dt_assinatura_contrato_fidc: null, 
      dt_envio_gestora_fidc: null, dt_aprovacao_gestora_fidc: null, dt_envio_admin_fidc: null, dt_aprovacao_admin_fidc: null, dt_apto_fidc: null,
      
      comercial: usuarioAtual?.perfil === "comercial" ? usuarioAtual.nome : "",
      _isNovo: true, _isEditado: true
    };
    
    setFiltroStatus("TODOS"); 
    setCedentes([novaLinha, ...cedentes]);
    setLinhasExpandidas(prev => ({ ...prev, [`novo-0`]: true }));
  };

  const toggleEditarNome = (idOuIndex: string) => setCedentesEmEdicaoDeNome(prev => ({ ...prev, [idOuIndex]: !prev[idOuIndex] }));
  const toggleExpandirLinha = (idOuIndex: string) => setLinhasExpandidas(prev => ({ ...prev, [idOuIndex]: !prev[idOuIndex] }));
  const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc" }));
  
  const handleExpandirTudo = () => {
    const novoEstado: Record<string, boolean> = {};
    const jaEstaoTodosAbertos = Object.keys(linhasExpandidas).length === cedentesProcessados.length;
    if (!jaEstaoTodosAbertos) {
      cedentesProcessados.forEach((c, idx) => novoEstado[c.id || `novo-${idx}`] = true);
    }
    setLinhasExpandidas(novoEstado);
  };

  const salvarAlteracoes = async () => {
    try {
      setSalvando(true);
      const linhasInvalidas = cedentes.filter(c => c._isNovo && (!c.cedente || c.cedente.trim() === ""));
      if (linhasInvalidas.length > 0) {
        alert("⚠️ Preencha o nome do Cedente nas novas linhas antes de salvar!");
        setSalvando(false);
        return;
      }

      const alvosEnvio = cedentes.filter(c => c._isEditado || c._isNovo);
      if (alvosEnvio.length === 0) {
        alert("💡 Nenhuma alteração pendente para salvar.");
        setSalvando(false);
        return;
      }

      for (const item of alvosEnvio) {
        const payload: any = {
          cedente: limparNome(item.cedente), limite: item.limite || "", taxa: item.taxa || "", obs: item.obs || "",
          dt_aprovacao_comite: item.dt_aprovacao_comite || null,
          dt_documentos_sec: item.dt_documentos_sec || null,
          dt_geracao_contrato_sec: item.dt_geracao_contrato_sec || null,
          dt_assinatura_contrato_sec: item.dt_assinatura_contrato_sec || null,
          dt_apto_sec: item.dt_apto_sec || null,
          dt_documentos_fidc: item.dt_documentos_fidc || null,
          dt_geracao_contrato_fidc: item.dt_geracao_contrato_fidc || null,
          dt_assinatura_contrato_fidc: item.dt_assinatura_contrato_fidc || null,
          dt_envio_gestora_fidc: item.dt_envio_gestora_fidc || null,
          dt_aprovacao_gestora_fidc: item.dt_aprovacao_gestora_fidc || null,
          dt_envio_admin_fidc: item.dt_envio_admin_fidc || null,
          dt_aprovacao_admin_fidc: item.dt_aprovacao_admin_fidc || null,
          dt_apto_fidc: item.dt_apto_fidc || null,
          comercial: item.comercial, atualizado_em: new Date().toISOString()
        };

        if (item.id) payload.id = item.id;
        const { error } = await supabase.from("cadastro_cedentes").upsert(payload);
        if (error) throw error;
      }
      
      alert("🎉 Alterações gravadas com sucesso no banco!");
      setCedentesEmEdicaoDeNome({});
      setLinhasExpandidas({});
      const { data } = await supabase.from("cadastro_cedentes").select("*").order("cedente", { ascending: true });
      if (data) setCedentes(data.map(item => ({ ...item, _isEditado: false, _isNovo: false })));
    } catch (err: any) { 
      console.error(err);
      alert(`❌ Erro ao salvar os dados: ${err.message}`); 
    } finally { 
      setSalvando(false); 
    }
  };

  // Atualização dos KPIs baseada nas novas Timelines
  const analiseEsteira = useMemo(() => {
    let total = cedentes.length;
    let pendenteEnvio = 0;
    let aguardandoAssinatura = 0;
    let aptos = 0;
    let somaDiasSla = 0;
    let totalContratosAssinados = 0;

    cedentes.forEach(c => {
      const isApto = c.dt_apto_sec || c.dt_apto_fidc; // Considera apto se qualquer uma das esteiras finalizou
      if (isApto) {
        aptos++;
      } else {
        if (!c.dt_aprovacao_comite) pendenteEnvio++;
        else if (
          (c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || 
          (c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc)
        ) {
          aguardandoAssinatura++;
        }
      }

      // SLA baseado na assinatura mais rápida após o comitê
      if (c.dt_aprovacao_comite && (c.dt_assinatura_contrato_sec || c.dt_assinatura_contrato_fidc)) {
        const d1 = new Date(c.dt_aprovacao_comite);
        const d2 = new Date(c.dt_assinatura_contrato_sec || c.dt_assinatura_contrato_fidc);
        somaDiasSla += Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        totalContratosAssinados++;
      }
    });

    const slaMedio = totalContratosAssinados > 0 ? (somaDiasSla / totalContratosAssinados).toFixed(0) : "0";
    return { total, pendenteEnvio, aguardandoAssinatura, aptos, slaMedio };
  }, [cedentes]);

  const cedentesProcessados = useMemo(() => {
    let resultado = cedentes.filter(c => {
      const isApto = c.dt_apto_sec || c.dt_apto_fidc;
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "APTO") return !!isApto;
      if (filtroStatus === "PENDENTE_ENVIO") return !isApto && !c.dt_aprovacao_comite;
      if (filtroStatus === "AGUARDANDO_ASSINATURA") {
        return !isApto && ((c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || (c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc));
      }
      return true;
    });

    resultado.sort((a: any, b: any) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (sortConfig.key === "limite") {
        valA = parseFloat(String(valA || "").replace(/\D/g, "")) || 0;
        valB = parseFloat(String(valB || "").replace(/\D/g, "")) || 0;
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }
      if (typeof valA === "string") return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortConfig.direction === "asc" ? valA - valB : valB - valA;
    });

    return resultado;
  }, [cedentes, filtroStatus, sortConfig]);

  // Função Renderizadora da Timeline Visual
  const renderTimeline = (steps: { key: string; label: string }[], item: any, isFidc: boolean) => {
    const colorBase = isFidc ? "purple" : "blue";
    
    return (
      <div className="flex items-center w-full relative h-6">
        {steps.map((step, idx) => {
          const isDone = !!item[step.key];
          const isLast = idx === steps.length - 1;
          const nextDone = isLast ? false : !!item[steps[idx + 1].key];

          return (
            <div key={step.key} className={`flex items-center ${isLast ? "" : "flex-1"}`} title={`${step.label}${isDone ? ` (${item[step.key]})` : ""}`}>
              {/* Bolinha do Status */}
              <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center z-10 transition-colors border shadow-xs 
                ${isDone 
                  ? `bg-${colorBase}-500 border-${colorBase}-600 text-white` 
                  : "bg-slate-100 border-slate-300"
                }`}>
                {isDone && <span className="text-[7px] font-black">✓</span>}
              </div>
              
              {/* Linha Conectora */}
              {!isLast && (
                <div className={`h-[2px] w-full -ml-1 -mr-1 transition-colors ${nextDone ? `bg-${colorBase}-400` : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full mx-auto pb-10 text-[13px] font-sans text-slate-700 px-4 print:p-0" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">📇 Esteira de Cadastro e Conversão</h2>
          <span className="text-xs text-slate-500 font-medium">Acompanhe as timelines operacionais de Sec e FIDC.</span>
        </div>
        <div className="flex gap-3 shrink-0">
          <button onClick={adicionarNovaLinha} disabled={salvando} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-xs shadow-sm transition-all">
            ➕ Novo Cedente
          </button>
          <button onClick={salvarAlteracoes} disabled={salvando} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs shadow-sm transition-all">
            {salvando ? "⏳ Gravando..." : "💾 Salvar Alterações"}
          </button>
        </div>
      </div>

      {/* PAINEL DE METRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={() => setFiltroStatus("TODOS")} className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-center ${filtroStatus === "TODOS" ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Geral</span>
          <span className="text-2xl font-black font-mono mt-1">{cedentes.length}</span>
        </button>
        <button onClick={() => setFiltroStatus("PENDENTE_ENVIO")} className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-rose-500 flex flex-col justify-center ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-500 text-white border-rose-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-black uppercase tracking-wider shadow-sm">🛑 Pendente Comitê</span>
          <span className="text-2xl font-black font-mono mt-1">{analiseEsteira.pendenteEnvio}</span>
        </button>
        <button onClick={() => setFiltroStatus("AGUARDANDO_ASSINATURA")} className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-amber-500 flex flex-col justify-center ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "bg-amber-500 text-white border-amber-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-black uppercase tracking-wider">⏳ Em Assinatura</span>
          <span className="text-2xl font-black font-mono mt-1">{analiseEsteira.aguardandoAssinatura}</span>
        </button>
        <button onClick={() => setFiltroStatus("APTO")} className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-emerald-500 flex flex-col justify-center ${filtroStatus === "APTO" ? "bg-emerald-500 text-white border-emerald-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-black uppercase tracking-wider">🎉 Apto a Operar</span>
          <span className="text-2xl font-black font-mono mt-1">{analiseEsteira.aptos}</span>
        </button>
        <div className="p-4 rounded-xl border border-slate-200 bg-blue-50/50 border-l-4 border-l-blue-600 flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">⏱️ SLA Médio de Assinatura</span>
          <span className="text-2xl font-black font-mono mt-1 text-slate-800">{analiseEsteira.slaMedio} <span className="text-sm font-bold text-slate-500">dias</span></span>
        </div>
      </div>

      {/* TABELA MASTER-DETAIL */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-[10px] tracking-wider select-none h-11 text-center">
                <th className="w-12 p-2">
                  <button onClick={handleExpandirTudo} title="Expandir/Recolher Tudo" className="w-6 h-6 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded font-black flex items-center justify-center border border-slate-300 shadow-xs cursor-pointer text-xs">
                    ↕️
                  </button>
                </th>
                <th onClick={() => handleSort("cedente")} className="p-2 text-left cursor-pointer hover:bg-slate-100 pl-4">Cedente {sortConfig.key === "cedente" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                {usuarioAtual?.perfil !== "comercial" && (
                  <th onClick={() => handleSort("comercial")} className="p-2 text-blue-600 cursor-pointer hover:bg-slate-100 w-32">Comercial Resp. {sortConfig.key === "comercial" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                )}
                <th onClick={() => handleSort("limite")} className="p-2 cursor-pointer hover:bg-slate-100 w-32">Limite {sortConfig.key === "limite" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                <th onClick={() => handleSort("taxa")} className="p-2 cursor-pointer hover:bg-slate-100 w-24">Taxa (%) {sortConfig.key === "taxa" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                <th className="p-2 w-[400px]">Progresso da Esteira Operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {cedentesProcessados.map((item) => {
                const index = cedentes.findIndex(c => c === item);
                const identificadorUnico = item.id || `novo-${index}`;
                const isEditandoNome = !!cedentesEmEdicaoDeNome[identificadorUnico] || item._isNovo;
                const isOpen = !!linhasExpandidas[identificadorUnico];

                return (
                  <tr key={identificadorUnico} style={{ display: "contents" }}>
                    
                    {/* LINHA MASTER */}
                    <tr className={`hover:bg-slate-50/50 transition-colors ${isOpen ? "bg-slate-50/70" : ""} ${item._isNovo ? "bg-blue-50/20" : ""}`}>
                      <td className="p-2 text-center h-16">
                        <button 
                          onClick={() => toggleExpandirLinha(identificadorUnico)}
                          className="w-5 h-5 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-300 shadow-xs flex items-center justify-center font-bold text-xs cursor-pointer"
                        >
                          {isOpen ? "−" : "+"}
                        </button>
                      </td>
                      <td className="p-2 pl-4">
                        {isEditandoNome ? (
                          <input 
                            type="text" 
                            placeholder="NOME DA EMPRESA" 
                            value={item.cedente} 
                            onChange={(e) => handleInputChange(index, "cedente", e.target.value.toUpperCase())} 
                            className="w-full max-w-sm p-1 border border-blue-300 rounded font-black text-xs uppercase bg-white shadow-sm outline-none focus:border-blue-500" 
                            autoFocus={item._isNovo}
                          />
                        ) : (
                          <div className="flex items-center justify-between group max-w-sm">
                            <span className="font-bold text-slate-900 truncate" title={item.cedente}>{item.cedente}</span>
                            <button 
                              onClick={() => toggleEditarNome(identificadorUnico)}
                              className="opacity-0 group-hover:opacity-100 text-[9px] text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer shadow-xs ml-2"
                            >
                              ✏️ Editar
                            </button>
                          </div>
                        )}
                      </td>

                      {usuarioAtual?.perfil !== "comercial" && (
                        <td className="p-2 text-center">
                           <input type="text" value={item.comercial || ""} onChange={(e) => handleInputChange(index, "comercial", e.target.value)} className="w-full max-w-[120px] p-1 border border-transparent hover:border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold text-blue-700 bg-transparent transition-all" placeholder="Comercial" />
                        </td>
                      )}

                      <td className="p-2 text-center">
                        <input type="text" value={item.limite || ""} onChange={(e) => handleLimiteInputChange(index, e.target.value)} className="w-full max-w-[120px] p-1 border border-transparent hover:border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold font-mono text-slate-700 bg-transparent transition-all" placeholder="R$ 0,00" />
                      </td>
                      
                      <td className="p-2 text-center">
                        <input type="text" value={item.taxa || ""} onChange={(e) => handleInputChange(index, "taxa", e.target.value)} className="w-full max-w-[70px] p-1 border border-transparent hover:border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold font-mono text-slate-600 bg-transparent transition-all" placeholder="0,00%" />
                      </td>

                      {/* COLUNA DA TIMELINE DUPLA */}
                      <td className="p-2 pl-4 pr-6">
                        <div className="flex flex-col gap-2 py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black w-8 text-blue-600 uppercase text-right">SEC</span>
                            {renderTimeline(STEPS_SEC, item, false)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black w-8 text-purple-600 uppercase text-right">FIDC</span>
                            {renderTimeline(STEPS_FIDC, item, true)}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* LINHA DETAIL (PAINEL EXPANSÍVEL DE EDIÇÃO DE DATAS) */}
                    {isOpen && (
                      <tr>
                        <td colSpan={usuarioAtual?.perfil !== "comercial" ? 6 : 5} className="bg-slate-100/80 p-4 border-b border-slate-200 shadow-inner">
                          <div className="space-y-4 max-w-6xl">
                            
                            {/* Bloco 1: Comum & Observações */}
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm w-full sm:w-64">
                                <span className="font-black text-slate-700 text-[10px] uppercase block mb-2">🏁 Início da Esteira</span>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Aprovação Comitê:</span>
                                  <input type="date" value={item.dt_aprovacao_comite || ""} onChange={(e) => handleInputChange(index, "dt_aprovacao_comite", e.target.value)} className="p-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 outline-none focus:border-blue-500 w-full" />
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex-1">
                                <span className="font-black text-slate-700 text-[10px] uppercase block mb-2">📝 Observações / Impasses</span>
                                <textarea value={item.obs || ""} onChange={(e) => handleInputChange(index, "obs", e.target.value)} className="w-full p-2 border border-slate-200 rounded text-xs h-[42px] resize-none outline-none focus:border-blue-500 text-slate-700" placeholder="Registrar travamentos ou pendências aqui..." />
                              </div>
                            </div>

                            {/* Bloco 2: Securitizadora */}
                            <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100 shadow-sm">
                              <span className="font-black text-blue-700 text-[11px] uppercase tracking-wider mb-3 block">🏦 Fluxo Securitizadora</span>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {STEPS_SEC.slice(1).map(step => (
                                  <div key={step.key} className="flex flex-col gap-1">
                                    <span className="text-[9px] text-blue-600/70 font-bold uppercase">{step.label}:</span>
                                    <input type="date" value={item[step.key] || ""} onChange={(e) => handleInputChange(index, step.key, e.target.value)} className="p-1.5 border border-blue-200 rounded text-xs font-mono font-bold text-slate-600 outline-none focus:border-blue-500 bg-white" />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Bloco 3: FIDC */}
                            <div className="bg-purple-50/40 p-3 rounded-lg border border-purple-100 shadow-sm">
                              <span className="font-black text-purple-700 text-[11px] uppercase tracking-wider mb-3 block">🔮 Fluxo FIDC</span>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-4">
                                {STEPS_FIDC.slice(1).map(step => (
                                  <div key={step.key} className="flex flex-col gap-1">
                                    <span className="text-[9px] text-purple-600/70 font-bold uppercase">{step.label}:</span>
                                    <input type="date" value={item[step.key] || ""} onChange={(e) => handleInputChange(index, step.key, e.target.value)} className="p-1.5 border border-purple-200 rounded text-xs font-mono font-bold text-slate-600 outline-none focus:border-purple-500 bg-white" />
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}