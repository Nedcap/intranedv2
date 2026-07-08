/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";

// Configuração ORIGINAL das Etapas (Usada para gerar o Formulário Expansível)
const STEPS_SEC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_sec", label: "Documentos" },
  { key: "dt_geracao_contrato_sec", label: "Geração Contrato" },
  { key: "dt_assinatura_contrato_sec", label: "Assinatura" },
  { key: "dt_apto_sec", label: "Apto Operar" }
];

const STEPS_FIDC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_fidc", label: "Documentos" },
  { key: "dt_geracao_contrato_fidc", label: "Ger. Contrato" },
  { key: "dt_assinatura_contrato_fidc", label: "Assinatura" },
  { key: "dt_envio_gestora_fidc", label: "Envio Gestora" },
  { key: "dt_aprovacao_gestora_fidc", label: "Aprov. Gestora" },
  { key: "dt_envio_admin_fidc", label: "Envio Admin" },
  { key: "dt_aprovacao_admin_fidc", label: "Aprov. Admin" },
  { key: "dt_apto_fidc", label: "Apto Operar" }
];

// Configuração VISUAL (Para forçar as Timelines a terem o mesmo tamanho e alinhamento)
const VISUAL_STEPS_SEC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_sec", label: "Documentos" },
  { key: "dt_geracao_contrato_sec", label: "Ger. Contrato" }, // Ajustado nome p/ alinhar c/ FIDC
  { key: "dt_assinatura_contrato_sec", label: "Assinatura" },
  { key: "na_1", label: "Envio Gestora", isNA: true },
  { key: "na_2", label: "Aprov. Gestora", isNA: true },
  { key: "na_3", label: "Envio Admin", isNA: true },
  { key: "na_4", label: "Aprov. Admin", isNA: true },
  { key: "dt_apto_sec", label: "Apto Operar" }
];

const VISUAL_STEPS_FIDC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_fidc", label: "Documentos" },
  { key: "dt_geracao_contrato_fidc", label: "Ger. Contrato" },
  { key: "dt_assinatura_contrato_fidc", label: "Assinatura" },
  { key: "dt_envio_gestora_fidc", label: "Envio Gestora" },
  { key: "dt_aprovacao_gestora_fidc", label: "Aprov. Gestora" },
  { key: "dt_envio_admin_fidc", label: "Envio Admin" },
  { key: "dt_aprovacao_admin_fidc", label: "Aprov. Admin" },
  { key: "dt_apto_fidc", label: "Apto Operar" }
];

// Utilitário para formatar datas na Tooltip
const formatarDataBr = (dataString: string) => {
  if (!dataString) return "";
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
};

export default function CadastroPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; perfil: string } | null>(null);
  
  const [cedentesEmEdicaoDeNome, setCedentesEmEdicaoDeNome] = useState<Record<string, boolean>>({});
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "cedente",
    direction: "asc"
  });
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTE_ENVIO" | "AGUARDANDO_ASSINATURA" | "APTO">("TODOS");

  const carregarCadastro = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    carregarCadastro();
  }, [carregarCadastro]);

  const buscarAprovadasDoComite = async () => {
    try {
      setSincronizando(true);
      
      const { data: analises, error: errAnalises } = await supabase
        .from("analises")
        .select("empresa_nome, comercial, status, criado_em");
      
      if (errAnalises) throw errAnalises;
      if (!analises) return;

      const aprovadas = analises.filter(a => {
        const st = (a.status || "").toLowerCase();
        return st.includes("aprovado") || st.includes("finalizado") || st.includes("com restritivo");
      });

      const nomesNaEsteira = new Set(cedentes.map(c => c.cedente.toUpperCase().trim()));
      const novosCedentes = [];

      for (const analise of aprovadas) {
        const nomeLimpo = limparNome(analise.empresa_nome).toUpperCase();
        
        if (!nomesNaEsteira.has(nomeLimpo)) {
           const dtComiteRaw = analise.criado_em;
           const dtComiteFormatada = dtComiteRaw ? dtComiteRaw.split('T')[0] : null;

           novosCedentes.push({
             cedente: nomeLimpo,
             comercial: analise.comercial,
             dt_aprovacao_comite: dtComiteFormatada,
             atualizado_em: new Date().toISOString()
           });
           nomesNaEsteira.add(nomeLimpo);
        }
      }

      if (novosCedentes.length > 0) {
        const { error } = await supabase.from("cadastro_cedentes").insert(novosCedentes);
        if (error) throw error;
        alert(`🎉 Sucesso! ${novosCedentes.length} novas empresas aprovadas no comitê foram integradas à Esteira.`);
        await carregarCadastro();
      } else {
        alert("💡 A Esteira já está atualizada! Nenhuma nova empresa aprovada no comitê para integrar.");
      }

    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro ao buscar aprovações do comitê: ${err.message}`);
    } finally {
      setSincronizando(false);
    }
  };

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
          dt_documentos_sec: item.dt_documentos_sec || null, dt_geracao_contrato_sec: item.dt_geracao_contrato_sec || null,
          dt_assinatura_contrato_sec: item.dt_assinatura_contrato_sec || null, dt_apto_sec: item.dt_apto_sec || null,
          dt_documentos_fidc: item.dt_documentos_fidc || null, dt_geracao_contrato_fidc: item.dt_geracao_contrato_fidc || null,
          dt_assinatura_contrato_fidc: item.dt_assinatura_contrato_fidc || null, dt_envio_gestora_fidc: item.dt_envio_gestora_fidc || null,
          dt_aprovacao_gestora_fidc: item.dt_aprovacao_gestora_fidc || null, dt_envio_admin_fidc: item.dt_envio_admin_fidc || null,
          dt_aprovacao_admin_fidc: item.dt_aprovacao_admin_fidc || null, dt_apto_fidc: item.dt_apto_fidc || null,
          comercial: item.comercial, atualizado_em: new Date().toISOString()
        };

        if (item.id) payload.id = item.id;
        const { error } = await supabase.from("cadastro_cedentes").upsert(payload);
        if (error) throw error;
      }
      
      alert("🎉 Alterações gravadas com sucesso!");
      setCedentesEmEdicaoDeNome({});
      setLinhasExpandidas({});
      await carregarCadastro();
    } catch (err: any) { 
      alert(`❌ Erro ao salvar os dados: ${err.message}`); 
    } finally { 
      setSalvando(false); 
    }
  };

  const analiseEsteira = useMemo(() => {
    let pendenteEnvio = 0, aguardandoAssinatura = 0, aptos = 0, somaDiasSla = 0, totalContratosAssinados = 0;

    cedentes.forEach(c => {
      const isApto = c.dt_apto_sec || c.dt_apto_fidc;
      if (isApto) aptos++;
      else {
        if (!c.dt_aprovacao_comite) pendenteEnvio++;
        else if ((c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || (c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc)) aguardandoAssinatura++;
      }
      if (c.dt_aprovacao_comite && (c.dt_assinatura_contrato_sec || c.dt_assinatura_contrato_fidc)) {
        const d1 = new Date(c.dt_aprovacao_comite);
        const d2 = new Date(c.dt_assinatura_contrato_sec || c.dt_assinatura_contrato_fidc);
        somaDiasSla += Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        totalContratosAssinados++;
      }
    });

    return { pendenteEnvio, aguardandoAssinatura, aptos, slaMedio: totalContratosAssinados > 0 ? (somaDiasSla / totalContratosAssinados).toFixed(0) : "0" };
  }, [cedentes]);

  const cedentesProcessados = useMemo(() => {
    let resultado = cedentes.filter(c => {
      const isApto = c.dt_apto_sec || c.dt_apto_fidc;
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "APTO") return !!isApto;
      if (filtroStatus === "PENDENTE_ENVIO") return !isApto && !c.dt_aprovacao_comite;
      if (filtroStatus === "AGUARDANDO_ASSINATURA") return !isApto && ((c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || (c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc));
      return true;
    });

    resultado.sort((a: any, b: any) => {
      let valA = a[sortConfig.key], valB = b[sortConfig.key];
      if (sortConfig.key === "limite") {
        valA = parseFloat(String(valA || "").replace(/\D/g, "")) || 0;
        valB = parseFloat(String(valB || "").replace(/\D/g, "")) || 0;
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }
      if (typeof valA === "string") return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortConfig.direction === "asc" ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
    });

    return resultado;
  }, [cedentes, filtroStatus, sortConfig]);

  // =============== COMPONENTE DE TIMELINE MODERNA COM FAKE STEPS (INATIVOS) ===============
  const renderTimelineUI = (visualSteps: any[], item: any, type: "SEC" | "FIDC") => {
    const isFidc = type === "FIDC";
    
    const doneLineClass = isFidc ? "bg-purple-200" : "bg-blue-200";
    const doneDotClass = isFidc ? "bg-purple-500 border-purple-500" : "bg-blue-500 border-blue-500";
    
    const currentBorderClass = isFidc ? "border-purple-600" : "border-blue-600";
    const currentPulseBg = isFidc ? "bg-purple-600" : "bg-blue-600";
    const currentTextClass = isFidc ? "text-purple-700" : "text-blue-700";

    const passedEmptyDotClass = isFidc ? "border-purple-300 bg-purple-50" : "border-blue-300 bg-blue-50";

    // Filtra apenas os steps válidos (não N/A) para calcular em que ponto da esteira estamos
    const validSteps = visualSteps.filter(s => !s.isNA);

    // Encontra o index (dentro do array reduzido) da última etapa válida preenchida
    let lastFilledValidIndex = -1;
    for (let i = validSteps.length - 1; i >= 0; i--) {
      if (item[validSteps[i].key]) {
        lastFilledValidIndex = i;
        break;
      }
    }

    // A etapa atual é a próxima etapa válida disponível
    const currentValidStepIndex = lastFilledValidIndex === validSteps.length - 1 ? -1 : lastFilledValidIndex + 1;
    const currentValidStepKey = currentValidStepIndex !== -1 ? validSteps[currentValidStepIndex].key : null;
    
    // Descobre o index no array COMPLETO (visual) onde a etapa piscante deve ficar
    const currentVisualIndex = currentValidStepKey ? visualSteps.findIndex(s => s.key === currentValidStepKey) : -1;

    return (
      <div className="flex w-full relative pt-2 pb-1">
        {visualSteps.map((step, idx) => {
          const isNA = !!step.isNA; // Se for uma etapa fake (apenas para manter o alinhamento visual)
          const isDone = !isNA && !!item[step.key];
          const isCurrent = !isNA && idx === currentVisualIndex;
          const isLast = idx === visualSteps.length - 1;
          
          const isPassedAndEmpty = !isNA && !isDone && (currentVisualIndex === -1 || idx < currentVisualIndex);
          const isLineActive = currentVisualIndex === -1 ? true : idx < currentVisualIndex;

          let circleClasses = "w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all duration-300 border-2 ";
          if (isNA) {
            // Estilo para etapas "Fantasma" -> Preenchidas, Apagadinhas e com X
            circleClasses += "bg-slate-200 border-slate-300 text-slate-400 opacity-60";
          } else if (isDone) {
            circleClasses += `${doneDotClass} text-white opacity-50`;
          } else if (isCurrent) {
            circleClasses += `bg-white border-[3px] ${currentBorderClass} shadow-md`;
          } else if (isPassedAndEmpty) {
            circleClasses += passedEmptyDotClass;
          } else {
            circleClasses += "bg-white border-slate-200";
          }

          return (
            <div key={step.key} className={`relative flex flex-col items-center group ${isLast ? "flex-none w-12" : "flex-1"}`}>
              {!isLast && (
                <div className={`absolute top-2.5 left-1/2 w-full h-1 -z-10 transition-all duration-500 ${isLineActive ? doneLineClass : "bg-slate-200/60 rounded-full"}`} />
              )}
              <div className="relative flex items-center justify-center">
                {isCurrent && <div className={`absolute w-8 h-8 rounded-full animate-ping opacity-30 ${currentPulseBg}`} />}
                <div className={circleClasses}>
                  
                  {isNA ? (
                    // Ícone de X para etapas Inativas (Fantasma)
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${currentPulseBg}`} />
                  ) : null}

                </div>
              </div>
              <span className={`text-[9px] mt-1.5 text-center leading-tight transition-colors absolute top-7 w-20 
                ${isNA ? "text-slate-400 font-medium opacity-60" : 
                  isDone ? "text-slate-400 font-semibold" : 
                  isCurrent ? `${currentTextClass} font-black` : 
                  isPassedAndEmpty ? "text-slate-700 font-bold" : 
                  "text-slate-400 font-medium"}
              `}>
                {step.label}
              </span>
              {isDone && !isNA && (
                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2.5 rounded-md shadow-lg pointer-events-none z-50 whitespace-nowrap">
                  {formatarDataBr(item[step.key])}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* HEADER MODERNO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Esteira de Cadastro e Aprovações</h2>
            </div>
            <span className="text-sm text-slate-500 font-medium ml-12">Monitoramento de cadastro, conversão e emissão de contratos.</span>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button 
              onClick={buscarAprovadasDoComite} 
              disabled={sincronizando || carregando} 
              className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sincronizando ? (
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Sincronizar Comitê
            </button>

            <button onClick={adicionarNovaLinha} disabled={salvando || carregando} className="flex-1 md:flex-none px-4 py-2.5 bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              Novo Manual
            </button>
            <button onClick={salvarAlteracoes} disabled={salvando || carregando} className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 w-full md:w-auto">
              {salvando ? (
                 <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              )}
              {salvando ? "Gravando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* PAINEL DE KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <button onClick={() => setFiltroStatus("TODOS")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "TODOS" ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md text-slate-800"}`}>
            <span className={`text-[11px] font-bold uppercase tracking-widest block mb-2 ${filtroStatus === "TODOS" ? "text-slate-400" : "text-slate-500"}`}>Total em Esteira</span>
            <span className="text-4xl font-black">{cedentes.length}</span>
          </button>
          
          <button onClick={() => setFiltroStatus("PENDENTE_ENVIO")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-50 border-rose-200 shadow-md shadow-rose-100" : "bg-white border-slate-200 hover:border-rose-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-500" : "bg-rose-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Pendente Comitê</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.pendenteEnvio}</span>
          </button>

          <button onClick={() => setFiltroStatus("AGUARDANDO_ASSINATURA")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "bg-amber-50 border-amber-200 shadow-md shadow-amber-100" : "bg-white border-slate-200 hover:border-amber-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "bg-amber-500" : "bg-amber-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Em Assinatura</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.aguardandoAssinatura}</span>
          </button>

          <button onClick={() => setFiltroStatus("APTO")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "APTO" ? "bg-emerald-50 border-emerald-200 shadow-md shadow-emerald-100" : "bg-white border-slate-200 hover:border-emerald-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "APTO" ? "bg-emerald-500" : "bg-emerald-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Aptos a Operar</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.aptos}</span>
          </button>

          <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-600/30 border border-indigo-500">
             <svg className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
             <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-100 block mb-2">SLA Médio Aprovação</span>
             <div className="flex items-baseline gap-1.5">
               <span className="text-4xl font-black">{analiseEsteira.slaMedio}</span>
               <span className="text-sm font-bold text-indigo-200">dias</span>
             </div>
          </div>
        </div>

        {/* ÁREA DA TABELA */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="w-14 px-4 text-center">
                    <button onClick={handleExpandirTudo} title="Expandir/Recolher" className="w-7 h-7 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                    </button>
                  </th>
                  <th onClick={() => handleSort("cedente")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-64">
                    <div className="flex items-center gap-1">Cedente {sortConfig.key === "cedente" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                  {usuarioAtual?.perfil !== "comercial" && (
                    <th onClick={() => handleSort("comercial")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-32">
                      <div className="flex items-center gap-1">Responsável {sortConfig.key === "comercial" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                    </th>
                  )}
                  <th onClick={() => handleSort("limite")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-32">
                    <div className="flex items-center gap-1">Limite R$ {sortConfig.key === "limite" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                  <th onClick={() => handleSort("taxa")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-24">
                    <div className="flex items-center gap-1">Taxa % {sortConfig.key === "taxa" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                  <th className="px-6 min-w-[600px]">Status Operacional (Sec / FIDC)</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {cedentesProcessados.map((item) => {
                  const index = cedentes.findIndex(c => c === item);
                  const identificadorUnico = item.id || `novo-${index}`;
                  const isEditandoNome = !!cedentesEmEdicaoDeNome[identificadorUnico] || item._isNovo;
                  const isOpen = !!linhasExpandidas[identificadorUnico];

                  return (
                    <tr key={identificadorUnico} style={{ display: "contents" }}>
                      
                      <tr className={`group transition-all duration-200 ${isOpen ? "bg-indigo-50/30" : "hover:bg-slate-50"} ${item._isNovo ? "bg-amber-50/30" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => toggleExpandirLinha(identificadorUnico)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-all border ${isOpen ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30" : "bg-white text-slate-400 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 shadow-sm"}`}
                          >
                            <svg className={`w-4 h-4 transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </td>
                        
                        <td className="px-4 py-3">
                          {isEditandoNome ? (
                            <input 
                              type="text" placeholder="NOME DA EMPRESA" value={item.cedente} 
                              onChange={(e) => handleInputChange(index, "cedente", e.target.value.toUpperCase())} 
                              className="w-full p-2 border-2 border-indigo-300 rounded-lg font-black text-sm uppercase bg-white shadow-inner outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                              autoFocus={item._isNovo}
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-slate-800 tracking-tight truncate max-w-[200px]" title={item.cedente}>{item.cedente}</span>
                              <button onClick={() => toggleEditarNome(identificadorUnico)} className="opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {usuarioAtual?.perfil !== "comercial" && (
                          <td className="px-4 py-3">
                             <input type="text" value={item.comercial || ""} onChange={(e) => handleInputChange(index, "comercial", e.target.value)} 
                               className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-md text-sm font-semibold text-indigo-700 bg-transparent transition-all outline-none" 
                               placeholder="Comercial" />
                          </td>
                        )}

                        <td className="px-4 py-3">
                          <input type="text" value={item.limite || ""} onChange={(e) => handleLimiteInputChange(index, e.target.value)} 
                            className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-md text-sm font-bold font-mono text-slate-700 bg-transparent transition-all outline-none" 
                            placeholder="R$ 0,00" />
                        </td>
                        
                        <td className="px-4 py-3">
                          <input type="text" value={item.taxa || ""} onChange={(e) => handleInputChange(index, "taxa", e.target.value)} 
                            className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-md text-sm font-bold font-mono text-slate-600 bg-transparent transition-all outline-none" 
                            placeholder="0,00%" />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] font-black w-8 text-blue-600 bg-blue-50 py-1 rounded-md text-center">SEC</span>
                              <div className="flex-1">{renderTimelineUI(VISUAL_STEPS_SEC, item, "SEC")}</div>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-[10px] font-black w-8 text-purple-600 bg-purple-50 py-1 rounded-md text-center">FIDC</span>
                              <div className="flex-1">{renderTimelineUI(VISUAL_STEPS_FIDC, item, "FIDC")}</div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={usuarioAtual?.perfil !== "comercial" ? 6 : 5} className="bg-slate-50 border-b-2 border-indigo-100 p-6 shadow-inner">
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                              
                              <div className="xl:col-span-3 space-y-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600">🏁</div>
                                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">Início da Esteira</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase">Data Comitê de Crédito</label>
                                    <input type="date" value={item.dt_aprovacao_comite || ""} onChange={(e) => handleInputChange(index, "dt_aprovacao_comite", e.target.value)} 
                                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 hover:bg-white" />
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <label className="flex items-center gap-2 mb-2 text-[10px] text-slate-500 font-bold uppercase">
                                    <div className="w-2 h-2 rounded-full bg-amber-400"></div> Observações e Impasses
                                  </label>
                                  <textarea value={item.obs || ""} onChange={(e) => handleInputChange(index, "obs", e.target.value)} 
                                    className="w-full p-3 border border-slate-300 rounded-lg text-sm h-[88px] resize-none outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 bg-slate-50 hover:bg-white transition-all text-slate-700" 
                                    placeholder="Ex: No aguardo das certidões..." />
                                </div>
                              </div>

                              <div className="xl:col-span-9 space-y-4">
                                <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                                  <div className="flex items-center gap-2 mb-4 ml-2">
                                    <span className="font-black text-blue-800 text-xs uppercase tracking-wider">🏦 Fluxo Securitizadora</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-2">
                                    {/* AQUI CONTINUAMOS RENDERIZANDO APENAS OS STEPS REAIS (5 STEPS) */}
                                    {STEPS_SEC.slice(1).map(step => (
                                      <div key={step.key} className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-blue-600/80 font-bold uppercase truncate" title={step.label}>{step.label}</label>
                                        <input type="date" value={item[step.key] || ""} onChange={(e) => handleInputChange(index, step.key, e.target.value)} 
                                          className="p-2 border border-blue-200 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white shadow-sm transition-all" />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                                  <div className="flex items-center gap-2 mb-4 ml-2">
                                    <span className="font-black text-purple-800 text-xs uppercase tracking-wider">🔮 Fluxo FIDC</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4 ml-2">
                                    {STEPS_FIDC.slice(1).map(step => (
                                      <div key={step.key} className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-purple-600/80 font-bold uppercase truncate" title={step.label}>{step.label}</label>
                                        <input type="date" value={item[step.key] || ""} onChange={(e) => handleInputChange(index, step.key, e.target.value)} 
                                          className="p-2 border border-purple-200 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 bg-white shadow-sm transition-all" />
                                      </div>
                                    ))}
                                  </div>
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
    </div>
  );
}