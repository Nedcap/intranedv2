/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface KappiDiligencia {
  id: string;
  documento: string;
  diligence_id: string;
  tipo_escopo: "PF" | "PJ";
  status: "AGUARDANDO" | "PROCESSANDO" | "CONCLUIDO" | "ERRO" | "PENDENTE";
  resultado_json: any;
  erro_mensagem?: string | null;
  created_at: string;
}

export default function KappiDashboardPage() {
  // Estados dos Formulários e Filtros
  const [documentoInput, setDocumentoInput] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"PJ" | "PF">("PJ");
  const [filtroText, setFiltroText] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  // Estados de Carregamento
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingSyncId, setLoadingSyncId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<KappiDiligencia[]>([]);
  const [modalDetalhes, setModalDetalhes] = useState<KappiDiligencia | null>(null);

  // Carrega histórico exclusivo da tabela 'kappi_diligencias'
  const carregarHistorico = async () => {
    const { data, error } = await supabase
      .from("kappi_diligencias")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setHistorico(data as KappiDiligencia[]);
    }
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  // 1. SOLICITAR NOVA ANÁLISE NA KAPPI
  const handleSolicitarNova = async (e: React.FormEvent) => {
    e.preventDefault();
    const docLimpo = documentoInput.replace(/\D/g, "");

    if (!docLimpo) return alert("Informe um CPF ou CNPJ válido.");
    if (tipoPessoa === "PJ" && docLimpo.length !== 14) return alert("CNPJ deve conter 14 dígitos.");
    if (tipoPessoa === "PF" && docLimpo.length !== 11) return alert("CPF deve conter 11 dígitos.");

    setLoadingStart(true);
    try {
      const resStart = await fetch("/api/kappi/requests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rf_id: docLimpo }),
      });

      const dataStart = await resStart.json();
      if (!resStart.ok || !dataStart.success) {
        throw new Error(dataStart.error || "Falha no disparo da Kappi.");
      }

      const diligenceId = dataStart.diligence_id;

      // Salva diretamente na tabela dedicada 'kappi_diligencias'
      const { error: errSupa } = await supabase.from("kappi_diligencias").insert({
        documento: docLimpo,
        diligence_id: diligenceId,
        tipo_escopo: tipoPessoa,
        status: "AGUARDANDO",
      });

      if (errSupa) throw errSupa;

      setDocumentoInput("");
      await carregarHistorico();
      alert("🔍 Diligência disparada com sucesso! Aguarde cerca de 4 minutos para resgatar os dados.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoadingStart(false);
    }
  };

  // 2. RESGATAR RESULTADO (END)
  const handleResgatarDados = async (item: KappiDiligencia) => {
    if (!item.diligence_id) return;

    setLoadingSyncId(item.id);
    try {
      const resEnd = await fetch(`/api/kappi/requests/end?id=${item.diligence_id}&tipo=${item.tipo_escopo}`);
      const dataEnd = await resEnd.json();

      if (!resEnd.ok || !dataEnd.success) {
        throw new Error(dataEnd.error || "Ainda em processamento pelos robôs da Kappi.");
      }

      // Salva o JSON filtrado na tabela 'kappi_diligencias'
      const { error: errUpd } = await supabase
        .from("kappi_diligencias")
        .update({
          status: "CONCLUIDO",
          resultado_json: dataEnd.data,
        })
        .eq("id", item.id);

      if (errUpd) throw errUpd;

      await carregarHistorico();
    } catch (err: any) {
      alert(`Aviso: ${err.message}`);
    } finally {
      setLoadingSyncId(null);
    }
  };

  // 3. BUSCAR PDF OFICIAL DA KAPPI
  const handleBaixarPdfOficial = async (diligenceId: string) => {
    try {
      const res = await fetch(`https://gateway-hhgatnejsq-uc.a.run.app/diligences/report/${diligenceId}`);
      const data = await res.json();
      if (data.link) {
        window.open(data.link, "_blank");
      } else {
        alert("Link do PDF temporariamente indisponível.");
      }
    } catch {
      alert("Erro ao resgatar URL do PDF na API da Kappi.");
    }
  };

  // Métricas Calculadas
  const totalConsultas = historico.length;
  const totalAguardando = historico.filter((h) => h.status === "AGUARDANDO" || h.status === "PROCESSANDO").length;
  const totalConcluidas = historico.filter((h) => h.status === "CONCLUIDO").length;

  // Filtragem
  const historicoFiltrado = useMemo(() => {
    return historico.filter((item) => {
      const matchText =
        item.documento?.includes(filtroText) ||
        item.diligence_id?.toLowerCase().includes(filtroText.toLowerCase());

      const matchStatus = filtroStatus === "TODOS" || item.status === filtroStatus;

      return matchText && matchStatus;
    });
  }, [historico, filtroText, filtroStatus]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans space-y-6">
      {/* 1. HEADER / HERO CLEAN */}
      <div className="bg-white border border-slate-200/80 p-6 md:p-8 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <span>🛡️ MOTOR DE COMPLIANCE KAPPI</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold">TABELA ISOLADA DE CONSULTAS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Consultas & Diligências Públicas
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 max-w-xl">
            Histórico e disparos avulsos salvos exclusivamente na tabela <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">kappi_diligencias</code>.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            Gateway Sandbox Ativo
          </span>
        </div>
      </div>

      {/* 2. MÉTRICAS EM CARDS LUMINOSOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total de Consultas</div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{totalConsultas}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold">
            📊
          </div>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-amber-600 tracking-wider">Aguardando (4 min)</div>
            <div className="text-2xl font-extrabold font-mono text-amber-600 mt-1">{totalAguardando}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
            ⏳
          </div>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-emerald-600 tracking-wider">Concluídas</div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-1">{totalConcluidas}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
            ✅
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Taxa de Conclusão</div>
            <div className="text-2xl font-extrabold font-mono text-indigo-600 mt-1">
              {totalConsultas > 0 ? ((totalConcluidas / totalConsultas) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
            🎯
          </div>
        </div>
      </div>

      {/* 3. FORMULÁRIO DISPARAR CONSULTA */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="text-base">⚡</span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Nova Consulta de Diligência Avulsa
          </h2>
        </div>

        <form onSubmit={handleSolicitarNova} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Tipo de Documento
            </label>
            <select
              value={tipoPessoa}
              onChange={(e) => setTipoPessoa(e.target.value as "PJ" | "PF")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="PJ">Pessoa Jurídica (CNPJ)</option>
              <option value="PF">Pessoa Física (CPF)</option>
            </select>
          </div>

          <div className="md:col-span-6">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Documento Alvo ({tipoPessoa === "PJ" ? "CNPJ com 14 dígitos" : "CPF com 11 dígitos"})
            </label>
            <input
              type="text"
              placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              value={documentoInput}
              onChange={(e) => setDocumentoInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loadingStart}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loadingStart ? "⏳ Disparando..." : "🚀 Disparar Robôs"}
            </button>
          </div>
        </form>
      </div>

      {/* 4. TABELA DE CONSULTAS REGISTRADAS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Registros da Tabela Kappi (<code className="lowercase">kappi_diligencias</code>)
            </h2>
          </div>

          {/* FILTROS */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="AGUARDANDO">Aguardando (4 min)</option>
              <option value="CONCLUIDO">Concluídas</option>
              <option value="ERRO">Com Erro</option>
            </select>

            <input
              type="text"
              placeholder="🔍 Buscar por documento ou ID..."
              value={filtroText}
              onChange={(e) => setFiltroText(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 w-full md:w-64 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                <th className="p-3.5">Documento</th>
                <th className="p-3.5 text-center">Tipo</th>
                <th className="p-3.5">Protocolo (ID Kappi)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Data / Hora</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    Nenhuma consulta registrada nesta tabela até o momento.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((item) => {
                  const status = item.status || "PENDENTE";
                  const qtdAnalises = item.resultado_json?.analyses?.length || 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* DOCUMENTO */}
                      <td className="p-3.5 font-mono text-slate-900 font-bold">
                        {item.documento}
                      </td>

                      {/* TIPO */}
                      <td className="p-3.5 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {item.tipo_escopo}
                        </span>
                      </td>

                      {/* PROTOCOLO ID */}
                      <td className="p-3.5 font-mono text-indigo-600 font-bold">
                        {item.diligence_id || "-"}
                      </td>

                      {/* STATUS BADGES */}
                      <td className="p-3.5 text-center">
                        {(status === "AGUARDANDO" || status === "PROCESSANDO") && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Aguardando (4 min)
                          </span>
                        )}
                        {status === "CONCLUIDO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            ✅ Concluído ({qtdAnalises} Robôs)
                          </span>
                        )}
                        {status === "PENDENTE" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                            ⏸️ Pendente
                          </span>
                        )}
                        {status === "ERRO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                            ❌ Erro
                          </span>
                        )}
                      </td>

                      {/* DATA */}
                      <td className="p-3.5 text-center text-slate-500 font-mono text-[11px]">
                        {new Date(item.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* AÇÕES DE BOTÕES */}
                      <td className="p-3.5 text-right space-x-2">
                        {/* Botão de Resgate de Dados */}
                        {(status === "AGUARDANDO" || status === "PROCESSANDO") && (
                          <button
                            onClick={() => handleResgatarDados(item)}
                            disabled={loadingSyncId === item.id}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] px-3 py-1.5 rounded uppercase transition-all disabled:opacity-50"
                            title="Resgatar dados da Kappi após os 4 minutos"
                          >
                            {loadingSyncId === item.id ? "🔄 Baixando..." : "🔄 Resgatar Dados"}
                          </button>
                        )}

                        {/* Botão de Ver JSON Filtrado */}
                        {status === "CONCLUIDO" && (
                          <button
                            onClick={() => setModalDetalhes(item)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1.5 rounded uppercase transition-all shadow-sm"
                          >
                            👁️ Ver Dados
                          </button>
                        )}

                        {/* Botão de Baixar PDF da Kappi */}
                        {status === "CONCLUIDO" && item.diligence_id && (
                          <button
                            onClick={() => handleBaixarPdfOficial(item.diligence_id)}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] px-3 py-1.5 rounded uppercase transition-all shadow-sm"
                            title="Download do PDF Oficial carimbado pela Kappi"
                          >
                            📄 PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DE VISUALIZAÇÃO DOS DADOS DA DILIGÊNCIA */}
      {modalDetalhes && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* MODAL HEADER CLEAN */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">
                  Dossiê Filtrado • Escopo Kappi ({modalDetalhes.tipo_escopo})
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Documento: {modalDetalhes.documento}
                </h3>
                <p className="text-xs font-mono text-slate-500">ID Protocolo: {modalDetalhes.diligence_id}</p>
              </div>

              <button
                onClick={() => setModalDetalhes(null)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
              >
                ✕ FECHAR
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* ROBÔS ENCONTRADOS */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-wider">
                  Análises Filtradas pelo Escopo ({modalDetalhes.resultado_json?.analyses?.length || 0})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalDetalhes.resultado_json?.analyses?.map((analise: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900 text-xs">{analise.title}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            analise.ok
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {analise.ok ? "Sem Apontamentos" : "Com Restrições"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-1">
                        <div>
                          Categoria: <span className="text-slate-700 font-semibold">{analise.type}</span>
                        </div>
                        {analise.status && (
                          <div className="line-clamp-2">
                            Status: <span className="text-slate-700 font-semibold">{analise.status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JSON COMPLETO BRUTO */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider">
                  Estrutura JSON Filtrada
                </h4>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-64 shadow-inner">
                  {JSON.stringify(modalDetalhes.resultado_json, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}