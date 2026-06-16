/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";

// ============================================================================
// 🧱 INTERFACES DE FLUXO COMERCIAL
// ============================================================================
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
  // Status de controle manual de fluxo de caixas das comissões
  statusComissaoAgendamento: "Pendente" | "Pago";
  statusComissaoComite: "Em Análise" | "Aprovado" | "Reprovado" | "Pago";
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

  // Estados de Filtros de Tela
  const [filtroSDR, setFiltroSDR] = useState("");
  const [filtroStatusComite, setFiltroStatusComite] = useState("");
  const [buscaTexto, setBuscaTexto] = useState("");

  // 📥 CARGA INICIAL DO ESTADO PERSISTIDO
  useEffect(() => {
    try {
      const salvasVisitas = localStorage.getItem("ned_comercial_visitas");
      const salvasConfigs = localStorage.getItem("ned_comercial_sdr_configs");
      if (salvasVisitas) setVisitas(JSON.parse(salvasVisitas));
      if (salvasConfigs) setConfigsSDR(JSON.parse(salvasConfigs));
    } catch (e) {
      console.error("Erro ao ler cache local comercial:", e);
    }
  }, []);

  // 💾 SALVAMENTO AUTOMÁTICO EM CASO O USUÁRIO MUDE STATUS DE PAGAMENTO
  const persistirDados = (novasVisitas: VisitaRow[], novasConfigs = configsSDR) => {
    setVisitas(novasVisitas);
    setConfigsSDR(novasConfigs);
    localStorage.setItem("ned_comercial_visitas", JSON.stringify(novasVisitas));
    localStorage.setItem("ned_comercial_sdr_configs", JSON.stringify(novasConfigs));
  };

  // 🚀 MOTOR INTERNO DE PARSE DO EXCEL/CSV EXCLUSIVO
  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCarregando(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split("\n");
        let startIdx = 0;
        
        // Remove cabeçalho fantasma do excel (sep=,) se existir
        if (lines[0] && lines[0].includes("sep=")) {
          startIdx = 1;
        }

        while (startIdx < lines.length && !lines[startIdx].trim()) {
          startIdx++;
        }

        // State Machine de caractere para quebrar as colunas respeitando aspas internas
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
        
        // Mapeia os índices das colunas exatas enviadas no arquivo
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
          if (colunas.length < headers.length) continue;

          const sdrNome = colunas[idxResponsavel] || "Sem SDR Mapeado";
          sdrsEncontrados.add(sdrNome);

          const estadoLead = colunas[idxEstado] || "";
          const motivoPerdaText = colunas[idxMotivoLoss] || "";

          // Regra de Negócio Padrão do Comitê Baseada nos Estados do CRM
          let statusComiteInicial: "Em Análise" | "Aprovado" | "Reprovado" = "Em Análise";
          if (estadoLead.toLowerCase() === "perdida" || motivoPerdaText.toLowerCase().includes("crédito") || motivoPerdaText.toLowerCase().includes("recusada")) {
            statusComiteInicial = "Reprovado";
          } else if (estadoLead.toLowerCase() === "ganhou" || estadoLead.toLowerCase() === "aprovado") {
            statusComiteInicial = "Aprovado";
          }

          listaNovasVisitas.push({
            id: `${colunas[idxNome] || "id"}-${i}`,
            nome: colunas[idxNome] || "Desconhecido",
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

        // Gera a matriz de comissões variáveis mantendo o padrão R$ 50 / R$ 80 se for SDR novo
        const novasConfigs = { ...configsSDR };
        sdrsEncontrados.forEach(nomeSdr => {
          if (!novasConfigs[nomeSdr]) {
            novasConfigs[nomeSdr] = { nome: nomeSdr, valorAgendamento: 50, valorComite: 80 };
          }
        });

        persistirDados(listaNovasVisitas, novasConfigs);
        alert(`✅ Sucesso! ${listaNovasVisitas.length} registros de visitas comerciais importados e conciliados.`);
      } catch (err) {
        console.error(err);
        alert("❌ Erro ao ler a estrutura de colunas do CSV. Verifique a codificação.");
      } finally {
        setCarregando(false);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // Alteradores Dinâmicos de Status manuais para Controle de Fluxo
  const mudarStatusAgendamento = (id: string, novoStatus: "Pendente" | "Pago") => {
    const atualizadas = visitas.map(v => v.id === id ? { ...v, statusComissaoAgendamento: novoStatus } : v);
    persistirDados(atualizadas);
  };

  const mudarStatusComite = (id: string, novoStatus: "Em Análise" | "Aprovado" | "Reprovado" | "Pago") => {
    const atualizadas = visitas.map(v => v.id === id ? { ...v, statusComissaoComite: novoStatus } : v);
    persistirDados(atualizadas);
  };

  const atualizarValorComissaoSDR = (nomeSdr: string, campo: "valorAgendamento" | "valorComite", valor: number) => {
    const novasConfigs = { ...configsSDR };
    novasConfigs[nomeSdr] = { ...novasConfigs[nomeSdr], [campo]: valor };
    persistirDados(visitas, novasConfigs);
  };

  const limparBancoLocal = () => {
    if (confirm("⚠️ Deseja zerar todo o histórico de visitas importado nesta máquina?")) {
      persistirDados([], {});
    }
  };

  // ============================================================================
  // 🧮 CÁLCULO DE MÉTRICAS E RECALCULO DINÂMICO DOS SOMAS GERAIS
  // ============================================================================
  const listasSDRsUnicos = Object.keys(configsSDR).sort();

  const visitasFiltradas = visitas.filter(v => {
    const bateSdr = !filtroSDR || v.responsavelSDR === filtroSDR;
    const bateComite = !filtroStatusComite || v.statusComissaoComite === filtroStatusComite;
    const bateTexto = !buscaTexto || v.nome.toLowerCase().includes(buscaTexto.toLowerCase()) || (v.empresa && v.empresa.toLowerCase().includes(buscaTexto.toLowerCase()));
    return bateSdr && bateComite && bateTexto;
  });

  const kpisGlobais = (() => {
    let totalAgendamentosGanhos = 0;
    let totalComiteGanhos = 0;
    let totalPendenteAnalise = 0;

    visitasFiltradas.forEach(v => {
      const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
      
      // Etapa 1 sempre gera receita de agendamento
      if (v.statusComissaoAgendamento !== "Pago") {
        totalAgendamentosGanhos += cfg.valorAgendamento;
      }
      
      // Etapa 2 depende do status do comitê
      if (v.statusComissaoComite === "Aprovado") {
        totalComiteGanhos += cfg.valorComite;
      } else if (v.statusComissaoComite === "Em Análise") {
        totalPendenteAnalise += cfg.valorComite;
      }
    });

    return { totalAgendamentosGanhos, totalComiteGanhos, totalPendenteAnalise };
  })();

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700">
      
      {/* CORDÃO DE COMANDO SUPERIOR */}
      <div className="border-b border-slate-200 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">🎯 Esteira de Conciliação de Visitas e Comissões SDR</h2>
          <span className="text-xs text-slate-400 font-medium">Controle as duas pontas da receita: faturamento de agendamentos imediatos e bônus diferidos por aprovações em comitê.</span>
        </div>
        <div className="flex items-center gap-2">
          {visitas.length > 0 && (
            <button onClick={limparBancoLocal} className="px-3 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold cursor-pointer transition-all">
              🗑️ Limpar Painel
            </button>
          )}
          <label className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-sm border border-blue-700 cursor-pointer transition-all flex items-center gap-2">
            📥 Importar CSV Exclusivo
            <input type="file" accept=".csv" onChange={handleImportarCSV} className="hidden" />
          </label>
        </div>
      </div>

      {carregando && <div className="p-10 font-bold text-center animate-pulse text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">⏳ Processando linhas e calculando comissões variáveis... Aguarde!</div>}

      {visitas.length === 0 ? (
        <div className="p-14 border border-dashed border-slate-300 bg-white rounded-xl text-center space-y-3">
          <div className="text-3xl">🗂️</div>
          <h3 className="font-bold text-slate-700 text-sm">Nenhuma planilha comercial importada nesta sessão</h3>
          <p className="text-slate-400 max-w-sm mx-auto text-[11px]">Clique no botão superior "Importar CSV Exclusivo" para ler o arquivo de leads do seu CRM e orquestrar a folha de comissões.</p>
        </div>
      ) : (
        <>
          {/* CONFIGURAÇÃO DE VALORES VARIÁVEIS POR PESSOA */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-3">⚙️ Configuração Dinâmica de Tabelas de Preço por SDR</span>
            <div className="flex flex-wrap gap-4">
              {listasSDRsUnicos.map(nome => {
                const cfg = configsSDR[nome] || { nome, valorAgendamento: 50, valorComite: 80 };
                return (
                  <div key={nome} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-3">
                    <span className="font-black text-slate-800 text-xs truncate max-w-[130px]">{nome}</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400">Agendou ($):</label>
                      <input type="number" value={cfg.valorAgendamento} onChange={(e) => atualizarValorComissaoSDR(nome, "valorAgendamento", parseFloat(e.target.value) || 0)} className="w-14 p-1 text-center bg-white border border-slate-300 rounded font-bold text-slate-800" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400">Aprovou ($):</label>
                      <input type="number" value={cfg.valorComite} onChange={(e) => atualizarValorComissaoSDR(nome, "valorComite", parseFloat(e.target.value) || 0)} className="w-14 p-1 text-center bg-white border border-slate-300 rounded font-bold text-slate-800" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INDICADORES KPI DE RETORNO DO CAIXA COMERCIAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Volume de Visitas Listado</span>
              <div className="text-2xl font-black mt-1 font-mono">{visitasFiltradas.length} <span className="text-xs text-slate-400 font-normal">leads</span></div>
            </div>
            <div className="bg-white border-l-4 border-blue-600 border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Comissão Agendamentos Pendente</span>
              <div className="text-2xl font-black mt-1 text-blue-900 font-mono">{formatarMoeda(kpisGlobais.totalAgendamentosGanhos)}</div>
            </div>
            <div className="bg-white border-l-4 border-emerald-600 border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Comissão Comitê Aprovada (A Pagar)</span>
              <div className="text-2xl font-black mt-1 text-emerald-700 font-mono">{formatarMoeda(kpisGlobais.totalComiteGanhos)}</div>
            </div>
            <div className="bg-white border-l-4 border-amber-500 border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] font-black text-slate-400 block uppercase">Prospecções Em Análise (Diferido)</span>
              <div className="text-2xl font-black mt-1 text-amber-700 font-mono">{formatarMoeda(kpisGlobais.totalPendenteAnalise)}</div>
            </div>
          </div>

          {/* BARRA DE FILTRAGEM MULTI-DIRECIONAL */}
          <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <input type="text" placeholder="Buscar Empresa ou Lead..." value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-medium w-64 outline-none focus:border-blue-500" />
            
            <select value={filtroSDR} onChange={(e) => setFiltroSDR(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none cursor-pointer bg-white">
              <option value="">SDR / Responsável (Todos)</option>
              {listasSDRsUnicos.map(nome => <option key={nome} value={nome}>{nome}</option>)}
            </select>

            <select value={filtroStatusComite} onChange={(e) => setFiltroStatusComite(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none cursor-pointer bg-white">
              <option value="">Status Comitê (Todos)</option>
              <option value="Em Análise">⏳ Em Análise</option>
              <option value="Aprovado">🟢 Aprovado em Comitê</option>
              <option value="Reprovado">🔴 Reprovado / Perda</option>
              <option value="Pago">🏁 Pago / Finalizado</option>
            </select>
          </div>

          {/* TABELONA ANALÍTICA DE CONCILIAÇÃO DE DUAS PONTAS */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white font-black uppercase text-[11px] tracking-wider select-none border-b border-slate-900">
                  <th className="p-3">Lead / Empresa</th>
                  <th className="p-3">SDR Responsável</th>
                  <th className="p-3 text-center">Data Agendado</th>
                  <th className="p-3 text-center bg-blue-950/40 border-x border-slate-700/60">📦 Etapa 1: Agendamento</th>
                  <th className="p-3 text-center bg-slate-900 border-r border-slate-700/60">🏛️ Etapa 2: Comitê</th>
                  <th className="p-3 text-right">Comissão Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {visitasFiltradas.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic">Nenhum registro encontrado para a combinação de filtros ativa.</td></tr>
                ) : (
                  visitasFiltradas.map((v) => {
                    const cfg = configsSDR[v.responsavelSDR] || { valorAgendamento: 50, valorComite: 80 };
                    
                    // Cálculo da comissão total ganha na linha
                    let totalLinha = cfg.valorAgendamento;
                    if (v.statusComissaoComite === "Aprovado" || v.statusComissaoComite === "Pago") {
                      totalLinha += cfg.valorComite;
                    }

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 truncate max-w-[260px]" title={v.nome}>{v.nome}</div>
                          <span className="text-[10px] text-slate-400 font-normal truncate max-w-[260px] block">{v.email || v.telefone || "Sem contatos adicionais"}</span>
                        </td>
                        <td className="p-3 text-slate-500 font-bold">{v.responsavelSDR}</td>
                        <td className="p-3 text-center text-slate-500 font-bold">{v.dataCriacao}</td>
                        
                        {/* 🎯 CONTROLES PONTA 1: AGENDAMENTO (D+1) */}
                        <td className="p-3 bg-blue-50/10 border-x border-slate-100 text-center space-y-1">
                          <div className="font-black text-blue-900 text-xs">{formatarMoeda(cfg.valorAgendamento)}</div>
                          <select value={v.statusComissaoAgendamento} onChange={(e) => mudarStatusAgendamento(v.id, e.target.value as any)} className={`p-1 border rounded text-[10px] font-black outline-none cursor-pointer ${
                            v.statusComissaoAgendamento === "Pago" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"
                          }`}>
                            <option value="Pendente">⏳ Pendente</option>
                            <option value="Pago">✅ Pago</option>
                          </select>
                        </td>

                        {/* 🎯 CONTROLES PONTA 2: COMITÊ / DIFERIDO (D+60) */}
                        <td className="p-3 bg-slate-50/50 border-r border-slate-100 text-center space-y-1">
                          <div className="font-black text-slate-700 text-xs">
                            {v.statusComissaoComite === "Reprovado" ? formatarMoeda(0) : formatarMoeda(cfg.valorComite)}
                          </div>
                          <select value={v.statusComissaoComite} onChange={(e) => mudarStatusComite(v.id, e.target.value as any)} className={`p-1 border rounded text-[10px] font-black outline-none cursor-pointer ${
                            v.statusComissaoComite === "Pago" || v.statusComissaoComite === "Aprovado" 
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                              : v.statusComissaoComite === "Reprovado" 
                              ? "bg-rose-100 text-rose-700 border-rose-200" 
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}>
                            <option value="Em Análise">⏳ Em Análise</option>
                            <option value="Aprovado">🟢 Aprovado (Comitê)</option>
                            <option value="Reprovado">🔴 Reprovado (Perda)</option>
                            <option value="Pago">🏁 Confirmado Pago</option>
                          </select>
                        </td>

                        <td className="p-3 text-right font-black text-slate-900 text-xs font-mono">{formatarMoeda(totalLinha)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}