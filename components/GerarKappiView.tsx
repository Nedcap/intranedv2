/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

interface KappiDiligencia {
  id: string;
  cnpj: string;
  empresa_nome: string;
  kappi_diligence_id: string | null;
  kappi_status: "PENDENTE" | "AGUARDANDO" | "CONCLUIDO" | "ERRO";
  kappi_dados_brutos: any;
  criado_em: string;
}

export default function GerarKappiView() {
  const supabase = createClient();
  const [documentoInput, setDocumentoInput] = useState("");
  const [empresaInput, setEmpresaInput] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<"PJ" | "PF">("PJ");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingSyncId, setLoadingSyncId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<KappiDiligencia[]>([]);
  const [filtroText, setFiltroText] = useState("");

  // Carrega histórico da tabela 'analises' no Supabase
  const carregarHistorico = async () => {
    const { data, error } = await supabase
      .from("analises")
      .select("id, cnpj, empresa_nome, kappi_diligence_id, kappi_status, kappi_dados_brutos, criado_em")
      .order("criado_em", { ascending: false });

    if (!error && data) {
      setHistorico(data as KappiDiligencia[]);
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

    setLoadingStart(true);
    try {
      // Dispara o robô da Kappi
      const resStart = await fetch("/api/kappi/requests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rf_id: docLimpo }),
      });

      const dataStart = await resStart.json();
      if (!resStart.ok || !dataStart.success) {
        throw new Error(dataStart.error || "Erro ao iniciar na Kappi");
      }

      const diligenceId = dataStart.diligence_id;

      // Grava na tabela 'analises' do Supabase
      const { error: errSupa } = await supabase.from("analises").insert({
        cnpj: docLimpo,
        empresa_nome: empresaInput || (tipoPessoa === "PJ" ? "Empresa Não Informada" : "Pessoa Física"),
        kappi_diligence_id: diligenceId,
        kappi_status: "AGUARDANDO",
        status: "aberta",
      });

      if (errSupa) throw errSupa;

      setDocumentoInput("");
      setEmpresaInput("");
      await carregarHistorico();
      alert("🔍 Diligência iniciada com sucesso! Aguarde cerca de 4 minutos para resgatar o relatório.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoadingStart(false);
    }
  };

  // 2. RESGATAR / SINCRONIZAR RESULTADO (END)
  const handleResgatarDados = async (item: KappiDiligencia) => {
    if (!item.kappi_diligence_id) return;

    setLoadingSyncId(item.id);
    try {
      const tipo = item.cnpj.length <= 11 ? "PF" : "PJ";
      const resEnd = await fetch(`/api/kappi/requests/end?id=${item.kappi_diligence_id}&tipo=${tipo}`);
      const dataEnd = await resEnd.json();

      if (!resEnd.ok || !dataEnd.success) {
        throw new Error(dataEnd.error || "Ainda processando ou erro na consulta");
      }

      // Atualiza o Supabase com o JSON filtrado
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

  // 3. BAIXAR RELATÓRIO PDF DA KAPPI
  const handleBaixarPdfOficial = async (diligenceId: string) => {
    try {
      const res = await fetch(`https://gateway-hhgatnejsq-uc.a.run.app/diligences/report/${diligenceId}`);
      const data = await res.json();
      if (data.link) {
        window.open(data.link, "_blank");
      } else {
        alert("Link do PDF indisponível no momento.");
      }
    } catch {
      alert("Erro ao buscar PDF oficial da Kappi.");
    }
  };

  const historicoFiltrado = historico.filter(
    (item) =>
      item.empresa_nome?.toLowerCase().includes(filtroText.toLowerCase()) ||
      item.cnpj?.includes(filtroText)
  );

  return (
    <div className="w-full max-w-[1200px] mx-auto p-6 font-sans text-slate-800 space-y-8">
      {/* CABEÇALHO DA VIEW */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase letter-spacing tracking-wider mb-1">
            <span>🕵️‍♂️ KAPPI INTELLIGENCE</span>
            <span>•</span>
            <span>MOTOR DE COMPLIANCE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
            Consultas & Diligências Públicas
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Emissão de certidões, processos judiciais, CNDs e checagem reputacional automatizada via robôs de inteligência.
          </p>
        </div>
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 p-3 rounded-xl flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            Kappi API Gateway: Online
          </span>
        </div>
      </div>

      {/* CARD 1: FORMULÁRIO DE NOVA SOLICITAÇÃO */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <span className="text-lg">⚡</span>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
            Nova Solicitação Avulsa
          </h2>
        </div>

        <form onSubmit={handleSolicitarNova} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">
              Tipo
            </label>
            <select
              value={tipoPessoa}
              onChange={(e) => setTipoPessoa(e.target.value as "PJ" | "PF")}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="PJ">PJ (CNPJ)</option>
              <option value="PF">PF (CPF)</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">
              Documento ({tipoPessoa === "PJ" ? "CNPJ 14 dígitos" : "CPF 11 dígitos"})
            </label>
            <input
              type="text"
              placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              value={documentoInput}
              onChange={(e) => setDocumentoInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">
              Nome da Empresa / Pessoa (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Razão Social ou Nome do Titular"
              value={empresaInput}
              onChange={(e) => setEmpresaInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loadingStart}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase px-4 py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loadingStart ? "⏳ Disparando..." : "🚀 Disparar RPA"}
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: TABELA DE HISTÓRICO E GESTÃO */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Histórico de Diligências Solicitadas
            </h2>
          </div>

          {/* FILTRO DE BUSCA */}
          <input
            type="text"
            placeholder="🔍 Filtrar por nome ou CNPJ/CPF..."
            value={filtroText}
            onChange={(e) => setFiltroText(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="p-3">Entidade / Documento</th>
                <th className="p-3">Protocolo Kappi</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Solicitado em</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 font-medium">
                    Nenhuma diligência encontrada no banco de dados.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((item) => {
                  const status = item.kappi_status || "PENDENTE";
                  const qtdAnalises = item.kappi_dados_brutos?.analyses?.length || 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* EMPRESA & CNPJ */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.empresa_nome}</div>
                        <div className="text-[11px] font-mono text-slate-500">{item.cnpj}</div>
                      </td>

                      {/* PROTOCOLO */}
                      <td className="p-3 font-mono text-indigo-950 font-bold">
                        {item.kappi_diligence_id || "-"}
                      </td>

                      {/* STATUS BADGE */}
                      <td className="p-3 text-center">
                        {status === "AGUARDANDO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                            Aguardando (4 min)
                          </span>
                        )}
                        {status === "CONCLUIDO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            ✅ Concluído ({qtdAnalises} RPAs)
                          </span>
                        )}
                        {status === "PENDENTE" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                            ⏸️ Pendente
                          </span>
                        )}
                        {status === "ERRO" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                            ❌ Erro
                          </span>
                        )}
                      </td>

                      {/* DATA DE CRIAÇÃO */}
                      <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                        {new Date(item.criado_em).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* AÇÕES DE BOTÕES */}
                      <td className="p-3 text-right space-x-2">
                        {/* Botão de Resgatar / Atualizar */}
                        {status === "AGUARDANDO" && (
                          <button
                            onClick={() => handleResgatarDados(item)}
                            disabled={loadingSyncId === item.id}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] px-3 py-1.5 rounded uppercase transition-all disabled:opacity-50"
                            title="Resgatar dados da Kappi após os 4 minutos"
                          >
                            {loadingSyncId === item.id ? "🔄 Baixando..." : "🔄 Resgatar Dados"}
                          </button>
                        )}

                        {/* Botão de Baixar PDF da Kappi */}
                        {status === "CONCLUIDO" && item.kappi_diligence_id && (
                          <button
                            onClick={() => handleBaixarPdfOficial(item.kappi_diligence_id!)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] px-3 py-1.5 rounded uppercase transition-all shadow-sm"
                            title="Download do PDF Oficial carimbado pela Kappi"
                          >
                            📄 Baixar PDF
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
    </div>
  );
}