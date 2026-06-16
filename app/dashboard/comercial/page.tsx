/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface VisitaRow {
  id: string;
  nome: string;
  empresa?: string;
  responsavelSDR: string;
  etapa: string;
  estado: string;
  motivoPerda: string;
  dataCriacao: string;
  email?: string;
  telefone?: string;
  statusComissaoAgendamento: "Pendente" | "Pago";
  statusComissaoComite: "Em Análise" | "Aprovado" | "Reprovado" | "Pago" | "Enviado p/ Análise";
}

interface SDRConfig {
  nome: string;
  valorAgendamento: number;
  valorComite: number;
}

export default function ControleComercialVisitasPage() {
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [configsSDR, setConfigsSDR] = useState<Record<string, SDRConfig>>({});
  const [carregando, setCarregando] = useState(false);
  const [enviandoLeadId, setEnviandoLeadId] = useState<string | null>(null);

  // Filtros
  const [filtroSDR, setFiltroSDR] = useState("");
  const [filtroStatusComite, setFiltroStatusComite] = useState("");
  const [buscaTexto, setBuscaTexto] = useState("");

  useEffect(() => {
    try {
      const salvasVisitas = localStorage.getItem("ned_comercial_visitas");
      const salvasConfigs = localStorage.getItem("ned_comercial_sdr_configs");
      if (salvasVisitas) setVisitas(JSON.parse(salvasVisitas));
      if (salvasConfigs) setConfigsSDR(JSON.parse(salvasConfigs));
    } catch (e) {
      console.error("Erro ao ler cache:", e);
    }
  }, []);

  const persistirDados = (novasVisitas: VisitaRow[], novasConfigs = configsSDR) => {
    setVisitas(novasVisitas);
    setConfigsSDR(novasConfigs);
    localStorage.setItem("ned_comercial_visitas", JSON.stringify(novasVisitas));
    localStorage.setItem("ned_comercial_sdr_configs", JSON.stringify(novasConfigs));
  };

  // 🎯 FIX 1: LEITURA LINEAR ROBUSTA CONTRA BUG DE LINHA ÚNICA
  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCarregando(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Quebra as linhas tratando variações de \r\n e \n do Windows/Mac
        const lines = text.split(/\r?\n/);
        let startIdx = 0;
        
        if (lines[0] && lines[0].includes("sep=")) startIdx = 1;
        while (startIdx < lines.length && !lines[startIdx].trim()) startIdx++;

        const parseLineCSV = (linhaTexto: string) => {
          const colunas = [];
          let dentroDeAspas = false;
          let celulaAcumulada = "";
          for (let i = 0; i < linhaTexto.length; i++) {
            const char = linhaTexto[i];
            if (char === '"') {
              dentroDeAspas = !dentroDeAspas;
            } else if (char === ',' && !dentroDeAspas) {
              colunas.push(celulaAcumulada.trim().replace(/^"|"$/g, ""));
              celulaAcumulada = "";
            } else {
              celulaAcumulada += char;
            }
          }
          colunas.push(celulaAcumulada.trim().replace(/^"|"$/g, ""));
          return colunas;
        };

        const headers = parseLineCSV(lines[startIdx]);
        
        const idxNome = headers.indexOf("Nome");
        const idxEmpresa = headers.indexOf("Empresa");
        const idxEtapa = headers.indexOf("Etapa");
        const idxEstado = headers.indexOf("Estado");
        const idxMotivoLoss = headers.indexOf("Motivo de Perda");
        const idxDataCriacao = headers.indexOf("Data de criação");
        const idxResponsavel = headers.indexOf("Responsável");
        const idxEmail = headers.indexOf("Email");
        const idxTelefone = headers.indexOf("Telefone");

        const listaNovasVisitas: VisitaRow[] = [];
        const sdrsEncontrados = new Set<string>();

        for (let i = startIdx + 1; i < lines.length; i++) {
          const linhaLimpa = lines[i].trim();
          if (!linhaLimpa) continue;

          const colunas = parseLineCSV(linhaLimpa);
          if (colunas.length < headers.length || !colunas[idxNome]) continue;

          const sdrNome = colunas[idxResponsavel] || "Sem SDR Mapeado";
          sdrsEncontrados.add(sdrNome);

          const estadoLead = colunas[idxEstado] || "";
          const motivoPerdaText = colunas[idxMotivoLoss] || "";

          let statusComiteInicial: any = "Em Análise";
          if (estadoLead.toLowerCase() === "perdida" || motivoPerdaText.toLowerCase().includes("crédito") || motivoPerdaText.toLowerCase().includes("recusada")) {
            statusComiteInicial = "Reprovado";
          } else if (estadoLead.toLowerCase() === "ganhou" || estadoLead.toLowerCase() === "aprovado") {
            statusComiteInicial = "Aprovado";
          }

          listaNovasVisitas.push({
            id: `lead-${i}-${Date.now()}`,
            nome: colunas[idxNome],
            empresa: colunas[idxEmpresa] || "",
            responsavelSDR: sdrNome,
            etapa: colunas[idxEtapa] || "",
            estado: estadoLead,
            motivoPerda: motivoPerdaText,
            dataCriacao: colunas[idxDataCriacao] || "-",
            email: colunas[idxEmail] || "",
            telefone: colunas[idxTelefone] || "",
            statusComissaoAgendamento: "Pendente",
            statusComissaoComite: statusComiteInicial
          });
        }

        const novasConfigs = { ...configsSDR };
        sdrsEncontrados.forEach(nomeSdr => {
          if (!novasConfigs[nomeSdr]) {
            novasConfigs[nomeSdr] = { nome: nomeSdr, valorAgendamento: 50, valorComite: 80 };
          }
        });

        persistirDados(listaNovasVisitas, novasConfigs);
        alert(`✅ Sucesso! Planilha processada linha por linha. ${listaNovasVisitas.length} leads comerciais carregados.`);
      } catch (err) {
        console.error(err);
        alert("❌ Erro no processamento do arquivo.");
      } finally {
        setCarregando(false);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // 🎯 FIX 2: INTEGRAÇÃO COM A ESTEIRA DE ENTRADA (EM ANÁLISE)
  const moverLeadParaEsteiraAnalise = async (lead: VisitaRow) => {
    const confirmar = confirm(`🔍 Deseja enviar a empresa "${lead.nome}" diretamente para a lista de Análises Pendentes?`);
    if (!confirmar) return;

    try {
      setEnviandoLeadId(lead.id);
      const dataFormatada = new Date().toISOString().split("T")[0];

      // Insere na tabela 'em_analise' igual ao formulário manual
      const { error } = await supabase.from("em_analise").insert({
        agente_nome: lead.responsavelSDR || "Comercial Ned",
        nome_empresa: lead.nome.trim().toUpperCase(),
        data_envio: dataFormatada,
        pendencias: "Enviado via Esteira Comercial"
      });

      if (error) throw error;

      // Altera o status local do lead para evitar duplicidade de envio
      const atualizadas = visitas.map(v => v.id === lead.id ? { ...v, statusComissaoComite: "Enviado p/ Análise" as any } : v);
      persistirDados(atualizadas);
      
      alert("🚀 Sucesso! Empresa integrada. Ela já apareceu na aba 'Análises Em Comitê' na esteira de entrada.");
    } catch (err: any) {
      alert(`❌ Erro de Integração: ${err.message}`);
    } finally {
      setEnviandoLeadId(null);
    }
  };

  const mudarStatusAgendamento = (id: string, novoStatus: "Pendente" | "Pago") => {
    persistirDados(visitas.map(v => v.id === id ? { ...v, statusComissaoAgendamento: novoStatus } : v));
  };

  const mudarStatusComite = (id: string, novoStatus: any) => {
    persistirDados(visitas.map(v => v.id === id ? { ...v, statusComissaoComite: novoStatus } : v));
  };

  const atualizarValorComissaoSDR = (nomeSdr: string, campo: "valorAgendamento" | "valorComite", valor: number) => {
    const novasConfigs = { ...configsSDR };
    novasConfigs[nomeSdr] = { ...novasConfigs[nomeSdr], [campo]: valor };
    persistirDados(visitas, novasConfigs);
  };

  const listasSDRsUnicos = Object.keys(configsSDR).sort();
  const visitasFiltradas = visitas.filter(v => {
    const bateSdr = !filtroSDR || v.responsavelSDR === filtroSDR;
    const bateComite = !filtroStatusComite || v.statusComissaoComite === filtroStatusComite;
    const bateTexto = !buscaTexto || v.nome.toLowerCase().includes(buscaTexto.toLowerCase());
    return bateSdr && bateComite && bateTexto;
  });

  const kpisGlobais = (() => {
    let totalAgendamentosGanhos = 0;
    let totalComiteGanhos = 0;
    let totalPendenteAnalise = 0;

    visitasFiltradas.forEach(v => {
      const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
      if (v.statusComissaoAgendamento !== "Pago") totalAgendamentosGanhos += cfg.valorAgendamento;
      if (v.statusComissaoComite === "Aprovado") totalComiteGanhos += cfg.valorComite;
      else if (v.statusComissaoComite === "Em Análise") totalPendenteAnalise += cfg.valorComite;
    });

    return { totalAgendamentosGanhos, totalComiteGanhos, totalPendenteAnalise };
  })();

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700">
      
      {/* HEADER BAR */}
      <div className="border-b border-slate-200 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">🎯 Esteira Comercial Integrada</h2>
          <span className="text-xs text-slate-400 font-medium">Controle linear de leads comerciais e integração instantânea com a mesa de análise de crédito.</span>
        </div>
        <div className="flex items-center gap-2">
          {visitas.length > 0 && (
            <button onClick={() => { if(confirm("Zerar painel?")) persistirDados([], {}); }} className="px-3 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold cursor-pointer transition-all">🗑️ Limpar Painel</button>
          )}
          <label className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-sm border border-blue-700 cursor-pointer transition-all flex items-center gap-2">
            📥 Importar CSV Exclusivo
            <input type="file" accept=".csv" onChange={handleImportarCSV} className="hidden" />
          </label>
        </div>
      </div>

      {carregando && <div className="p-8 font-bold text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">⏳ Lendo linhas de forma linear...</div>}

      {visitas.length === 0 ? (
        <div className="p-12 border border-dashed border-slate-300 bg-white rounded-xl text-center space-y-2">
          <div className="text-2xl">🗂️</div>
          <h3 className="font-bold text-slate-700 text-xs">Nenhum dado comercial ativo</h3>
          <p className="text-slate-400 max-w-sm mx-auto text-[11px]">Faça a importação do arquivo CSV extraído do CRM para popular a esteira operacional.</p>
        </div>
      ) : (
        <>
          {/* MATRIZ DE PREÇO SDR */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">⚙️ Ajustar Tabelas de Preço Variáveis por SDR</span>
            <div className="flex flex-wrap gap-3">
              {listasSDRsUnicos.map(nome => {
                const cfg = configsSDR[nome] || { nome, valorAgendamento: 50, valorComite: 80 };
                return (
                  <div key={nome} className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex items-center gap-3">
                    <span className="font-black text-slate-800 px-1 truncate max-w-[120px]">{nome}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold">Agendamento:</span>
                      <input type="number" value={cfg.valorAgendamento} onChange={(e) => atualizarValorComissaoSDR(nome, "valorAgendamento", parseFloat(e.target.value) || 0)} className="w-12 p-0.5 text-center bg-white border border-slate-200 rounded font-bold" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold">Comitê:</span>
                      <input type="number" value={cfg.valorComite} onChange={(e) => atualizarValorComissaoSDR(nome, "valorComite", parseFloat(e.target.value) || 0)} className="w-12 p-0.5 text-center bg-white border border-slate-200 rounded font-bold" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Leads Comercial Ativos</span>
              <div className="text-2xl font-black mt-1 font-mono">{visitasFiltradas.length}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl border-l-4 border-blue-600 shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Agendamentos Pendentes</span>
              <div className="text-2xl font-black mt-1 font-mono text-blue-900">{formatarMoeda(kpisGlobais.totalAgendamentosGanhos)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl border-l-4 border-emerald-600 shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Comitê Aprovado (A Pagar)</span>
              <div className="text-2xl font-black mt-1 font-mono text-emerald-700">{formatarMoeda(kpisGlobais.totalComiteGanhos)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl border-l-4 border-amber-500 shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Diferidos Em Análise</span>
              <div className="text-2xl font-black mt-1 font-mono text-amber-700">{formatarMoeda(kpisGlobais.totalPendenteAnalise)}</div>
            </div>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <input type="text" placeholder="Filtrar por nome do lead..." value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 w-64 font-medium" />
            <select value={filtroSDR} onChange={(e) => setFiltroSDR(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white">
              <option value="">SDR (Todos)</option>
              {listasSDRsUnicos.map(n => <option key={nomeNovaEmpresa} value={n}>{n}</option>)}
            </select>
            <select value={filtroStatusComite} onChange={(e) => setFiltroStatusComite(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white">
              <option value="">Status Comitê (Todos)</option>
              <option value="Em Análise">⏳ Em Análise</option>
              <option value="Aprovado">🟢 Aprovado</option>
              <option value="Reprovado">🔴 Reprovado / Perda</option>
              <option value="Enviado p/ Análise">🚀 Enviado p/ Análise</option>
            </select>
          </div>

          {/* TABELONA ANALÍTICA COM BOTÃO DE INTEGRAÇÃO */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white font-black uppercase text-[11px] border-b border-slate-900">
                  <th className="p-3">Lead Comercial</th>
                  <th className="p-3">SDR Responsável</th>
                  <th className="p-3 text-center">Criação</th>
                  <th className="p-3 text-center bg-blue-950/40">Gatilho 1: Visita</th>
                  <th className="p-3 text-center bg-slate-900">Gatilho 2: Comitê</th>
                  <th className="p-3 text-center">Ações Operacionais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {visitasFiltradas.map((v) => {
                  const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
                  const estaEnviando = enviandoLeadId === v.id;
                  const jaFoiEnviado = v.statusComissaoComite === "Enviado p/ Análise";

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 truncate max-w-[240px]">{v.nome}</div>
                        <span className="text-[10px] text-slate-400 font-normal truncate block">{v.email || v.telefone || "Sem contatos adicionais"}</span>
                      </td>
                      <td className="p-3 text-slate-500 font-bold">{v.responsavelSDR}</td>
                      <td className="p-3 text-center text-slate-500">{v.dataCriacao}</td>
                      
                      {/* GATILHO 1 */}
                      <td className="p-3 bg-blue-50/10 text-center space-y-1">
                        <div className="font-black text-blue-900">{formatarMoeda(cfg.valorAgendamento)}</div>
                        <select value={v.statusComissaoAgendamento} onChange={(e) => mudarStatusAgendamento(v.id, e.target.value as any)} className={`p-0.5 border rounded text-[10px] font-black outline-none ${
                          v.statusComissaoAgendamento === "Pago" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"
                        }`}>
                          <option value="Pendente">⏳ Pendente</option>
                          <option value="Pago">✅ Pago</option>
                        </select>
                      </td>

                      {/* GATILHO 2 */}
                      <td className="p-3 bg-slate-50/50 text-center space-y-1">
                        <div className="font-black text-slate-700">
                          {v.statusComissaoComite === "Reprovado" ? formatarMoeda(0) : formatarMoeda(cfg.valorComite)}
                        </div>
                        <select value={v.statusComissaoComite} onChange={(e) => mudarStatusComite(v.id, e.target.value as any)} className={`p-0.5 border rounded text-[10px] font-black outline-none ${
                          v.statusComissaoComite === "Pago" || v.statusComissaoComite === "Aprovado" 
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                            : v.statusComissaoComite === "Reprovado" 
                            ? "bg-rose-100 text-rose-700 border-rose-200" 
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}>
                          <option value="Em Análise">⏳ Em Análise</option>
                          <option value="Aprovado">🟢 Aprovado (Comitê)</option>
                          <option value="Reprovado">🔴 Reprovado (Perda)</option>
                          <option value="Enviado p/ Análise">🚀 Enviado p/ Análise</option>
                          <option value="Pago">🏁 Confirmado Pago</option>
                        </select>
                      </td>

                      {/* 🚀 BOTÃO DE INTEGRAÇÃO COM ANÁLISES PENDENTES */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => moverLeadParaEsteiraAnalise(v)}
                          disabled={estaEnviando || jaFoiEnviado}
                          className={`px-3 py-1 font-black rounded-lg text-[10px] uppercase shadow-2xs transition-all cursor-pointer ${
                            jaFoiEnviado
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-not-allowed"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          {estaEnviando ? "⏳ Gravando..." : jaFoiEnviado ? "🚀 Na Esteira" : "🔍 Enviar p/ Análise"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}