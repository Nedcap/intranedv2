/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";

export default function CadastroPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; perfil: string } | null>(null);
  
  // Controle de Edição de Nome do Cedente (Trava de Segurança)
  const [cedentesEmEdicaoDeNome, setCedentesEmEdicaoDeNome] = useState<Record<string, boolean>>({});

  // NOVO: Controle de Expansão de Linhas para Revelação Progressiva
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});

  // Controle de Ordenação Master
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "cedente",
    direction: "asc"
  });

  // Estado para filtro dinâmico através do clique nos cards
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
      cedente: "", 
      limite: "",
      taxa: "",
      docs_ok: null,
      obs: "",
      data_5: null,
      data_6: null,
      data_7: null,
      data_8: null,
      data_9: null,
      apto: null,
      comercial: usuarioAtual?.perfil === "comercial" ? usuarioAtual.nome : "",
      _isNovo: true,
      _isEditado: true
    };
    
    setFiltroStatus("TODOS"); 
    setCedentes([novaLinha, ...cedentes]);
    // Força a nova linha a nascer expandida para facilitar o preenchimento inicial
    setLinhasExpandidas(prev => ({ ...prev, [`novo-0`]: true }));
  };

  const toggleEditarNome = (idOuIndex: string) => {
    setCedentesEmEdicaoDeNome(prev => ({ ...prev, [idOuIndex]: !prev[idOuIndex] }));
  };

  const toggleExpandirLinha = (idOuIndex: string) => {
    setLinhasExpandidas(prev => ({ ...prev, [idOuIndex]: !prev[idOuIndex] }));
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const handleExpandirTudo = () => {
    const novoEstado: Record<string, boolean> = {};
    const jaEstaoTodosAbertos = Object.keys(linhasExpandidas).length === cedentesProcessados.length;
    
    if (!jaEstaoTodosAbertos) {
      cedentesProcessados.forEach((c, idx) => {
        const key = c.id || `novo-${idx}`;
        novoEstado[key] = true;
      });
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
          cedente: limparNome(item.cedente), 
          limite: item.limite || "", 
          taxa: item.taxa || "", 
          docs_ok: item.docs_ok, 
          obs: item.obs || "",
          data_5: item.data_5 || null, 
          data_6: item.data_6 || null, 
          data_7: item.data_7 || null, 
          data_8: item.data_8 || null, 
          data_9: item.data_9 || null,
          apto: item.apto, 
          comercial: item.comercial, 
          atualizado_em: new Date().toISOString()
        };

        if (item.id) {
          payload.id = item.id;
        }

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
      alert(`❌ Erro ao salvar os dados no Supabase: ${err.message}`); 
    } finally { 
      setSalvando(false); 
    }
  };

  // KPIs
  const analiseEsteira = useMemo(() => {
    let total = cedentes.length;
    let pendenteEnvio = 0;
    let aguardandoAssinatura = 0;
    let aptos = 0;
    let somaDiasSla = 0;
    let totalContratosAssinados = 0;

    cedentes.forEach(c => {
      if (c.apto === true) {
        aptos++;
      } else {
        if (!c.data_5 && !c.data_7) pendenteEnvio++;
        else if ((c.data_5 && !c.data_6) || (c.data_7 && !c.data_8)) aguardandoAssinatura++;
      }

      if (c.data_5 && c.data_6) {
        const d1 = new Date(c.data_5);
        const d2 = new Date(c.data_6);
        somaDiasSla += Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        totalContratosAssinados++;
      }
    });

    const slaMedio = totalContratosAssinados > 0 ? (somaDiasSla / totalContratosAssinados).toFixed(0) : "0";

    return { total, pendenteEnvio, aguardandoAssinatura, aptos, slaMedio };
  }, [cedentes]);

  // Filtro e Ordenação Combinados
  const cedentesProcessados = useMemo(() => {
    let resultado = cedentes.filter(c => {
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "APTO") return c.apto === true;
      if (filtroStatus === "PENDENTE_ENVIO") return c.apto !== true && !c.data_5 && !c.data_7;
      if (filtroStatus === "AGUARDANDO_ASSINATURA") {
        return c.apto !== true && ((c.data_5 && !c.data_6) || (c.data_7 && !c.data_8));
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

      if (typeof valA === "string") {
        return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortConfig.direction === "asc" ? valA - valB : valB - valA;
    });

    return resultado;
  }, [cedentes, filtroStatus, sortConfig]);

  return (
    <div className="space-y-6 w-full mx-auto pb-10 text-[13px] font-sans text-slate-700 px-4 print:p-0" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">📇 Esteira de Cadastro e Conversão</h2>
          <span className="text-xs text-slate-500 font-medium">Controle operacional de auditoria de documentos, fluxos de contratos e liberação de chaves.</span>
        </div>
        <div className="flex gap-3 shrink-0">
          <button 
            onClick={adicionarNovaLinha} 
            disabled={salvando} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-xs cursor-pointer shadow-sm transition-all"
          >
            ➕ Novo Cedente
          </button>
          <button 
            onClick={salvarAlteracoes} 
            disabled={salvando} 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-xs cursor-pointer shadow-sm transition-all"
          >
            {salvando ? "⏳ Gravando..." : "💾 Salvar Alterações"}
          </button>
        </div>
      </div>

      {/* PAINEL DE METRICAS OPERACIONAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={() => setFiltroStatus("TODOS")} className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-center ${filtroStatus === "TODOS" ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Geral</span>
          <span className="text-2xl font-black font-mono mt-1">{cedentes.length}</span>
        </button>
        <button onClick={() => setFiltroStatus("PENDENTE_ENVIO")} className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-rose-500 flex flex-col justify-center ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-500 text-white border-rose-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
          <span className="text-[10px] font-black uppercase tracking-wider shadow-sm">🛑 Pendente Envio</span>
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

      {/* TABELA MASTER-DETAIL CLEAN */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-[10px] tracking-wider select-none h-11 text-center">
                <th className="w-12 p-2">
                  <button onClick={handleExpandirTudo} title="Expandir/Recolher Tudo" className="w-6 h-6 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded font-black flex items-center justify-center border border-slate-300 shadow-xs cursor-pointer text-xs">
                    ↕️
                  </button>
                </th>
                <th onClick={() => handleSort("cedente")} className="p-2 text-left cursor-pointer hover:bg-slate-100 pl-4">Cedente {sortConfig.key === "cedente" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                {usuarioAtual?.perfil !== "comercial" && (
                  <th onClick={() => handleSort("comercial")} className="p-2 text-blue-600 cursor-pointer hover:bg-slate-100 w-44">Comercial Resp. {sortConfig.key === "comercial" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                )}
                <th onClick={() => handleSort("limite")} className="p-2 cursor-pointer hover:bg-slate-100 w-44">Limite {sortConfig.key === "limite" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                <th onClick={() => handleSort("taxa")} className="p-2 cursor-pointer hover:bg-slate-100 w-28">Taxa (%) {sortConfig.key === "taxa" && (sortConfig.direction === "asc" ? "▲" : "▼")}</th>
                <th className="p-2 w-28">Docs Auditados</th>
                <th className="p-2 w-24">Apto</th>
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
                    
                    {/* LINHA MASTER (CLEAN - SEM DATAS POLUINDO) */}
                    <tr className={`hover:bg-slate-50/50 transition-colors h-12 ${isOpen ? "bg-slate-50/70" : ""} ${item._isNovo ? "bg-blue-50/20" : ""}`}>
                      <td className="p-2 text-center">
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
                           <input type="text" value={item.comercial || ""} onChange={(e) => handleInputChange(index, "comercial", e.target.value)} className="w-full max-w-[140px] p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold text-blue-700 bg-transparent" placeholder="Comercial" />
                        </td>
                      )}

                      <td className="p-2 text-center">
                        <input type="text" value={item.limite || ""} onChange={(e) => handleLimiteInputChange(index, e.target.value)} className="w-full max-w-[140px] p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold font-mono text-slate-700 bg-transparent" placeholder="R$ 0,00" />
                      </td>
                      
                      <td className="p-2 text-center">
                        <input type="text" value={item.taxa || ""} onChange={(e) => handleInputChange(index, "taxa", e.target.value)} className="w-full max-w-[80px] p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold font-mono text-slate-600 bg-transparent" placeholder="0,00%" />
                      </td>

                      <td className="p-2 text-center">
                        <div className="flex gap-2 justify-center text-xs font-bold">
                          <label className="text-emerald-600 cursor-pointer flex items-center gap-0.5"><input type="radio" checked={item.docs_ok === true} onChange={() => handleInputChange(index, "docs_ok", true)} /> ✔</label>
                          <label className="text-red-500 cursor-pointer flex items-center gap-0.5"><input type="radio" checked={item.docs_ok === false} onChange={() => handleInputChange(index, "docs_ok", false)} /> ✖</label>
                        </div>
                      </td>

                      <td className="p-2 text-center">
                        <div className="flex gap-2 justify-center text-xs font-bold">
                          <label className="text-emerald-600 cursor-pointer flex items-center gap-0.5" title="Apto"><input type="radio" checked={item.apto === true} onChange={() => handleInputChange(index, "apto", true)} /> 🎉</label>
                          <label className="text-red-500 cursor-pointer flex items-center gap-0.5" title="Travado"><input type="radio" checked={item.apto === false} onChange={() => handleInputChange(index, "apto", false)} /> 🛑</label>
                        </div>
                      </td>
                    </tr>

                    {/* LINHA DETAIL (O PAINEL DA ESTEIRA OCULTA QUE SE ABRE NO CLIQUE) */}
                    {isOpen && (
                      <tr>
                        <td colSpan={usuarioAtual?.perfil !== "comercial" ? 7 : 6} className="bg-slate-100/60 p-4 border-b border-slate-200">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                            
                            {/* Bloco Securitizadora */}
                            <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                <span className="font-black text-blue-700 text-[11px] uppercase tracking-wider">🏦 Fluxo Securitizadora</span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.data_5 ? (item.data_6 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800") : "bg-rose-100 text-rose-800"}`}>
                                  {item.data_5 ? (item.data_6 ? "Contrato Assinado" : "Em Assinatura") : "Não Enviado"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Data de Envio:</span>
                                  <input type="date" value={item.data_5 || ""} onChange={(e) => handleInputChange(index, "data_5", e.target.value)} className="p-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Data Assinatura:</span>
                                  <input type="date" value={item.data_6 || ""} onChange={(e) => handleInputChange(index, "data_6", e.target.value)} className="p-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-blue-500" />
                                </div>
                              </div>
                            </div>

                            {/* Bloco FIDC */}
                            <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                <span className="font-black text-purple-700 text-[11px] uppercase tracking-wider">🔮 Fluxo FIDC</span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.data_7 ? (item.data_8 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800") : "bg-rose-100 text-rose-800"}`}>
                                  {item.data_7 ? (item.data_8 ? "Contrato Assinado" : "Em Assinatura") : "Não Enviado"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Data de Envio:</span>
                                  <input type="date" value={item.data_7 || ""} onChange={(e) => handleInputChange(index, "data_7", e.target.value)} className="p-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Data Assinatura:</span>
                                  <input type="date" value={item.data_8 || ""} onChange={(e) => handleInputChange(index, "data_8", e.target.value)} className="p-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-blue-500" />
                                </div>
                              </div>
                            </div>

                            {/* Bloco Administrativo & Observações */}
                            <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100 lg:col-span-1">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 h-6">
                                <span className="font-black text-slate-600 text-[11px] uppercase tracking-wider">⚙️ Configurações Internas</span>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex flex-col gap-1 sm:w-1/3">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">Cadastro Adm:</span>
                                  <input type="date" value={item.data_9 || ""} onChange={(e) => handleInputChange(index, "data_9", e.target.value)} className="p-1.5 border border-slate-200 rounded text-xs font-mono font-bold text-slate-600 bg-white cursor-pointer outline-none focus:border-blue-500 w-full" />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Observações de Trava / Impasse:</span>
                                  <textarea value={item.obs || ""} onChange={(e) => handleInputChange(index, "obs", e.target.value)} className="w-full p-1 border border-slate-200 rounded text-xs h-[31px] resize-none outline-none focus:border-blue-500 bg-white font-medium text-slate-700 leading-tight" placeholder="Ex: No aguardo das certidões..." />
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
  );
}