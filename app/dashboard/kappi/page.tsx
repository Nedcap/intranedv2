/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";

interface KappiItem {
  id: string;
  cnpj: string;
  empresa_nome: string;
  kappi_diligence_id: string | null;
  kappi_status: "PENDENTE" | "AGUARDANDO" | "CONCLUIDO" | "ERRO";
  kappi_dados_brutos: any;
  criado_em: string;
  comercial?: string;
}

export default function KappiDashboardPage() {
  const supabase = createClient();

  // Estados dos Formulários e Filtros
  const [documentoInput, setDocumentoInput] = useState("");
  const [empresaInput, setEmpresaInput] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"PJ" | "PF">("PJ");
  const [filtroText, setFiltroText] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  // Estados de Carregamento
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingSyncId, setLoadingSyncId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<KappiItem[]>([]);
  const [modalDetalhes, setModalDetalhes] = useState<KappiItem | null>(null);

  // Carrega histórico do Supabase
  const carregarHistorico = async () => {
    const { data, error } = await supabase
      .from("analises")
      .select("id, cnpj, empresa_nome, kappi_diligence_id, kappi_status, kappi_dados_brutos, criado_em, comercial")
      .order("criado_em", { ascending: false });

    if (!error && data) {
      setHistorico(data as KappiItem[]);
    }
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  // 1. SOLICITAR NOVA ANÁLISE (START)
  const handleSolicitarNova = async (e: React.FormEvent) => {
    e.preventDefault();
    const docLimpo = documentoInput.replace(/\D/g, "");

    if (!docLimpo) return alert("Informe um CPF ou CNPJ válido.");
    if (tipoPessoa === "PJ" && docLimpo.length !== 14) return alert("CNPJ deve conter 14 dígitos.");
    if (tipoPessoa === "PF" && docLimpo.length !== 11) return alert("CPF deve conter 11 dígitos.");

    setLoadingStart(true);
    try {
      // Dispara o robô da Kappi no nosso backend
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

      // Grava na tabela 'analises' do Supabase
      const { error: errSupa } = await supabase.from("analises").insert({
        cnpj: docLimpo,
        empresa_nome: empresaInput.trim() || (tipoPessoa === "PJ" ? "Pessoa Jurídica Avulsa" : "Pessoa Física Avulsa"),
        kappi_diligence_id: diligenceId,
        kappi_status: "AGUARDANDO",
        status: "aberta",
      });

      if (errSupa) throw errSupa;

      setDocumentoInput("");
      setEmpresaInput("");
      await carregarHistorico();
      alert("🔍 Diligência disparada com sucesso! Aguarde cerca de 4 minutos e clique em 'Resgatar Dados'.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoadingStart(false);
    }
  };

  // 2. RESGATAR RESULTADO (END)
  const handleResgatarDados = async (item: KappiItem) => {
    if (!item.kappi_diligence_id) return;

    setLoadingSyncId(item.id);
    try {
      const tipo = item.cnpj.length <= 11 ? "PF" : "PJ";
      const resEnd = await fetch(`/api/kappi/requests/end?id=${item.kappi_diligence_id}&tipo=${tipo}`);
      const dataEnd = await resEnd.json();

      if (!resEnd.ok || !dataEnd.success) {
        throw new Error(dataEnd.error || "Ainda em processamento pelos robôs da Kappi.");
      }

      // Salva o JSON filtrado no Supabase
      const { error: errUpd } = await supabase
        .from("analises")
        .update({
          kappi_status: "CONCLUIDO",
          kappi_dados_brutos: dataEnd.data,
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
  const totalAguardando = historico.filter((h) => h.kappi_status === "AGUARDANDO").length;
  const totalConcluidas = historico.filter((h) => h.kappi_status === "CONCLUIDO").length;

  // Filtragem
  const historicoFiltrado = useMemo(() => {
    return historico.filter((item) => {
      const matchText =
        item.empresa_nome?.toLowerCase().includes(filtroText.toLowerCase()) ||
        item.cnpj?.includes(filtroText) ||
        item.kappi_diligence_id?.toLowerCase().includes(filtroText.toLowerCase());

      const matchStatus = filtroStatus === "TODOS" || item.kappi_status === filtroStatus;

      return matchText && matchStatus;
    });
  }, [historico, filtroText, filtroStatus]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans space-y-8">
      {/* 1. TOP BAR / HERO */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1">
            <span>🛡️ MOTOR DE COMPLIANCE V2</span>
            <span>•</span>
            <span className="text-emerald-400">REST API INTEGRATED</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white">
            Painel de Diligências Kappi
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-xl font-medium">
            Execução assíncrona de RPAs para emissão de CNDs, varredura de processos judiciais, certidões federais e restritivos.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 px-4 py-3 rounded-xl shadow-inner">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gateway Sandbox</div>
            <div className="text-xs font-bold font-mono text-emerald-400">hhgatnejsq.a.run.app</div>
          </div>
        </div>
      </div>

      {/* 2. CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Pesquisado</div>
            <div className="text-2xl font-black font-mono text-white mt-1">{totalConsultas}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold">
            📈
          </div>
        </div>

        <div className="bg-slate-800/60 border border-amber-500/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase text-amber-400 tracking-wider">Aguardando (4 min)</div>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1">{totalAguardando}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold">
            ⏳
          </div>
        </div>

        <div className="bg-slate-800/60 border border-emerald-500/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">Diligências Concluídas</div>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-1">{totalConcluidas}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
            ✅
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Taxa de Conclusão</div>
            <div className="text-2xl font-black font-mono text-indigo-300 mt-1">
              {totalConsultas > 0 ? ((totalConcluidas / totalConsultas) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold">
            🎯
          </div>
        </div>
      </div>

      {/* 3. FORMULÁRIO DE NOVA SOLICITAÇÃO AVULSA */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3">
          <span className="text-xl">⚡</span>
          <h2 className="text-sm font-black uppercase tracking-wider text-white">
            Disparar Nova Consulta Assíncrona
          </h2>
        </div>

        <form onSubmit={handleSolicitarNova} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
              Escopo Alvo
            </label>
            <select
              value={tipoPessoa}
              onChange={(e) => setTipoPessoa(e.target.value as "PJ" | "PF")}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="PJ">PJ (CNPJ)</option>
              <option value="PF">PF (CPF)</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
              Documento ({tipoPessoa === "PJ" ? "CNPJ 14 dígitos" : "CPF 11 dígitos"})
            </label>
            <input
              type="text"
              placeholder={tipoPessoa === "PJ" ? "00000000000100" : "00000000000"}
              value={documentoInput}
              onChange={(e) => setDocumentoInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
              Razão Social / Nome da Entidade
            </label>
            <input
              type="text"
              placeholder="Ex: Empresa de Tecnologia LTDA"
              value={empresaInput}
              onChange={(e) => setEmpresaInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loadingStart}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase px-4 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-indigo-400/30 active:scale-95"
            >
              {loadingStart ? "⏳ Disparando..." : "🚀 Disparar Robôs"}
            </button>
          </div>
        </form>
      </div>

      {/* 4. TABELA DE HISTÓRICO DE CONSULTAS */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              Esteira de Diligências Registradas
            </h2>
          </div>

          {/* FILTROS DE BUSCA */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="AGUARDANDO">Aguardando (4 min)</option>
              <option value="CONCLUIDO">Concluídas</option>
              <option value="ERRO">Com Erro</option>
            </select>

            <input
              type="text"
              placeholder="🔍 Filtrar nome, documento ou ID..."
              value={filtroText}
              onChange={(e) => setFiltroText(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-700/80 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="p-3.5">Empresa / Documento</th>
                <th className="p-3.5">Protocolo Kappi (ID)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Criado em</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs font-semibold">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                    Nenhuma diligência encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((item) => {
                  const status = item.kappi_status || "PENDENTE";
                  const qtdAnalises = item.kappi_dados_brutos?.analyses?.length || 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                      {/* NOME / DOCUMENTO */}
                      <td className="p-3.5">
                        <div className="font-bold text-white text-sm">{item.empresa_nome}</div>
                        <div className="text-[11px] font-mono text-emerald-400 mt-0.5">{item.cnpj}</div>
                      </td>

                      {/* PROTOCOLO */}
                      <td className="p-3.5 font-mono text-indigo-300 font-bold">
                        {item.kappi_diligence_id || "-"}
                      </td>

                      {/* STATUS BADGES */}
                      <td className="p-3.5 text-center">
                        {status === "AGUARDANDO" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            Aguardando (4 min)
                          </span>
                        )}
                        {status === "CONCLUIDO" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase">
                            ✅ Concluído ({qtdAnalises} Robôs)
                          </span>
                        )}
                        {status === "PENDENTE" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-slate-700 text-slate-300 border border-slate-600 uppercase">
                            ⏸️ Pendente
                          </span>
                        )}
                        {status === "ERRO" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-300 border border-rose-500/30 uppercase">
                            ❌ Erro
                          </span>
                        )}
                      </td>

                      {/* DATA */}
                      <td className="p-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {new Date(item.criado_em).toLocaleDateString("pt-BR", {
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
                        {status === "AGUARDANDO" && (
                          <button
                            onClick={() => handleResgatarDados(item)}
                            disabled={loadingSyncId === item.id}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg uppercase transition-all disabled:opacity-50 shadow"
                            title="Resgatar dados da Kappi após os 4 minutos"
                          >
                            {loadingSyncId === item.id ? "🔄 Baixando..." : "🔄 Resgatar Dados"}
                          </button>
                        )}

                        {/* Botão de Ver JSON Filtrado */}
                        {status === "CONCLUIDO" && (
                          <button
                            onClick={() => setModalDetalhes(item)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg uppercase transition-all shadow"
                          >
                            👁️ Ver Dados
                          </button>
                        )}

                        {/* Botão de Baixar PDF da Kappi */}
                        {status === "CONCLUIDO" && item.kappi_diligence_id && (
                          <button
                            onClick={() => handleBaixarPdfOficial(item.kappi_diligence_id!)}
                            className="bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-extrabold text-[10px] px-3 py-1.5 rounded-lg uppercase transition-all shadow"
                            title="Download do PDF Oficial carimbado pela Kappi"
                          >
                            📄 PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DE VISUALIZAÇÃO DOS DADOS DA DILIGÊNCIA */}
      {modalDetalhes && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* MODAL HEADER */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                  Dossiê Filtrado • Escopo Kappi
                </div>
                <h3 className="text-lg font-black text-white">{modalDetalhes.empresa_nome}</h3>
                <p className="text-xs font-mono text-slate-400">CNPJ/CPF: {modalDetalhes.cnpj}</p>
              </div>

              <button
                onClick={() => setModalDetalhes(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black px-3 py-1.5 rounded-lg text-xs transition-all"
              >
                ✕ FECHAR
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* ROBÔS ENCONTRADOS */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wider">
                  Análises Filtradas pelo Escopo ({modalDetalhes.kappi_dados_brutos?.analyses?.length || 0})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalDetalhes.kappi_dados_brutos?.analyses?.map((analise: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-white text-xs">{analise.title}</span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            analise.ok
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {analise.ok ? "Sem Apontamentos" : "Com Restrições"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-1">
                        <div>
                          Categoria: <span className="text-slate-200">{analise.type}</span>
                        </div>
                        {analise.status && (
                          <div className="line-clamp-2">
                            Status: <span className="text-slate-300">{analise.status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JSON COMPLETO BRUTO */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-2 tracking-wider">
                  Estrutura JSON Completa
                </h4>
                <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-64">
                  {JSON.stringify(modalDetalhes.kappi_dados_brutos, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}