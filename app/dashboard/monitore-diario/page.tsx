/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 UTILS DE LIMPEZA E CÁLCULO
// ============================================================================
const normalizarTexto = (txt: string) => {
  if (!txt) return "";
  return txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Extrai apenas os números e garante que temos a raiz (8 primeiros dígitos)
const extrairRaizCnpj = (cnpj: string) => {
  if (!cnpj) return "";
  const apenasNumeros = cnpj.replace(/\D/g, "");
  return apenasNumeros.substring(0, 8).padStart(8, "0");
};

const fM = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v || 0));
const fD = (str: string) => str ? str.split("-").reverse().join("/") : "-";

export default function MonitoreDiarioPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Estados para o Upload
  const [processando, setProcessando] = useState(false);
  const [statusProcessamento, setStatusProcessamento] = useState("");

  const carregarDiario = async () => {
    try {
      setCarregando(true);

      const { data: maxDateList } = await supabase
        .from("historico_consolidado")
        .select("data_processamento")
        .neq("cedente", `CACHE_BUSTER_${Date.now()}`)
        .order("data_processamento", { ascending: false })
        .limit(1);

      if (!maxDateList || maxDateList.length === 0) {
        setDados([]);
        return;
      }

      const ultimaData = maxDateList[0].data_processamento;

      const [resHist, resCadastro] = await Promise.all([
        supabase
          .from("historico_consolidado")
          .select("*")
          .eq("data_processamento", ultimaData)
          .limit(10000),
        supabase
          .from("cadastro_cedentes")
          .select("cedente, cnpj, risco_sec, risco_fidc, limite")
          .limit(10000)
      ]);

      if (resHist.data && resHist.data.length > 0) {
        const filtrados = resHist.data.filter(r => {
          const evo = parseFloat(r.evolucao || 0);
          const temRestritivos = [
            r.total_pefin, r.total_refin, r.total_protesto, 
            r.total_acao_jud, r.total_div_vencida
          ].some(val => parseFloat(val || 0) > 0);

          return evo !== 0 || temRestritivos || (r.resumo_movimento && r.resumo_movimento.trim() !== "");
        });

        setDados(filtrados.map(linha => {
          const raizLinha = extrairRaizCnpj(linha.cnpj_cliente);
          const match = resCadastro.data?.find(c => extrairRaizCnpj(c.cnpj) === raizLinha);
          
          const riscoConsolidated = match ? (parseFloat(match.risco_sec || 0) + parseFloat(match.risco_fidc || 0)) : 0;
          return { ...linha, risco_aberto: riscoConsolidated };
        }));
      }
    } catch (err) { 
      console.error(err); 
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDiario();
  }, []);

  // ============================================================================
  // 🤖 MOTOR DE PROCESSAMENTO DO ARQUIVO SERASA
  // ============================================================================
  const processarArquivoSerasa = async (event: React.ChangeEvent<HTMLInputElement>, dispararEmail: boolean) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setProcessando(true);
      const resumoGlobalDisparo: any[] = [];

      setStatusProcessamento("Carregando base do CRM...");
      const { data: cedentesDB } = await supabase
        .from("cadastro_cedentes")
        .select("id, cedente, cnpj, responsavel_id, grupo_economico, limite")
        .not("cnpj", "is", null);

      for (let idxFile = 0; idxFile < files.length; idxFile++) {
        const file = files[idxFile];
        setStatusProcessamento(`Lendo arquivo ${idxFile + 1}/${files.length}...`);

        const texto = await file.text();
        const linhas = texto.split(/\r?\n/);
        if (linhas.length === 0) continue;

        let dataArquivo = new Date().toISOString().split("T")[0];
        const matchData = linhas[0].match(/(\d{2})\/(\d{2})\/(\d{4})/);
        
        if (matchData) {
          dataArquivo = `${matchData[3]}-${matchData[2]}-${matchData[1]}`;
        }

        setStatusProcessamento(`[${fD(dataArquivo)}] Minerando inteligência...`);
        const clientesHoje: Record<string, any> = {};
        const escopoAtual: Record<string, "EMPRESA" | "SOCIO"> = {};
        const socioAtivo: Record<string, string> = {};

        // 🧠 Códigos Estratégicos
        const codigosChave = ["010102", "010104", "010117", "030102", "021105", "041099", "040101", "040102", "040202", "040301"];

        for (const linha of linhas) {
          if (linha.length < 40) continue;
          if (linha.substring(9, 10) !== "1") continue;

          // FATIAMENTO ABSOLUTO DO BLOCO E CNPJ
          const cnpjBaseRaw = linha.substring(19, 28);
          const blocoCodigo = linha.substring(28, 34);

          if (!codigosChave.includes(blocoCodigo)) continue;

          const cnpjBase = cnpjBaseRaw.replace(/\D/g, "").padStart(8, "0").slice(-8);

          if (cnpjBase === "00000000" || !cnpjBase) continue;

          if (!clientesHoje[cnpjBase]) {
            clientesHoje[cnpjBase] = { 
              restritivos: [], 
              socios: {}, 
              nada_consta: false, 
              cedente_serasa: "N/A",
              cnpj_completo_serasa: cnpjBase + "000100",
              jsonb: { cadastro: {}, consultas: [], comportamento: [], detalhes_dividas: [] }
            };
            escopoAtual[cnpjBase] = "EMPRESA";
          }

          // --- INÍCIO DA EXTRAÇÃO DETALHADA COM POSIÇÕES ABSOLUTAS ---
          
          if (blocoCodigo === "010102") {
            escopoAtual[cnpjBase] = "EMPRESA";
            if (clientesHoje[cnpjBase].cedente_serasa === "N/A") {
              clientesHoje[cnpjBase].cedente_serasa = linha.substring(34, 94).trim();
            }
            continue;
          }

          if (blocoCodigo === "010104" && escopoAtual[cnpjBase] === "EMPRESA") {
            const cidadeBruta = linha.substring(34, 74);
            clientesHoje[cnpjBase].jsonb.cadastro.cidade = cidadeBruta.replace(/\d+$/, "").replace(/\s{2,}/g, " - ").trim();
            continue;
          }

          if (blocoCodigo === "030102" && escopoAtual[cnpjBase] === "EMPRESA") {
            const dataConsulta = linha.substring(34, 42);
            const nomeBruto = linha.substring(42, 87);
            clientesHoje[cnpjBase].jsonb.consultas.push({ 
              data: dataConsulta, 
              instituicao: nomeBruto.replace(/\d+$/, "").trim() 
            });
            continue;
          }

          if (blocoCodigo === "021105" && escopoAtual[cnpjBase] === "EMPRESA") {
            const tipo = linha.substring(34, 48).trim();
            const mes = linha.substring(48, 55).trim();
            const avaliacao = linha.substring(55, 85).replace(/-/g, "").trim();

            if (tipo && mes && avaliacao) {
              clientesHoje[cnpjBase].jsonb.comportamento.push({
                tipo: tipo,
                mes: mes,
                avaliacao: avaliacao
              });
            }
            continue;
          }

          if (blocoCodigo === "040301" && escopoAtual[cnpjBase] === "EMPRESA") {
            // 🛡️ FATIAMENTO ABSOLUTO DA DÍVIDA
            const dataOcorrencia = linha.substring(43, 51);
            
            // O valor ocupa exatas 15 posições, sempre da 54 até a 69
            const valorBruto = linha.substring(54, 69).replace(/\D/g, "");
            const valorFormatado = parseFloat(valorBruto) / 100;
            
            // A Praça/Origem vem logo depois do valor, da posição 69 em diante
            let praca = linha.substring(69, 109);
            
            // 🧹 LIXEIRO ATIVADO
            praca = praca.replace(/(Z1\s*)?IPZ[A-Z0-9]+/g, ""); 
            praca = praca.replace(/\s{2,}/g, " - ").replace(/(-\s*)+$/, "").trim(); 
            
            if (valorFormatado > 0) {
              clientesHoje[cnpjBase].jsonb.detalhes_dividas.push({
                data: dataOcorrencia, 
                valor: valorFormatado, 
                praca: praca
              });
            }
            continue;
          }

          if (blocoCodigo === "010117") {
            escopoAtual[cnpjBase] = "SOCIO";
            const nomeSocio = linha.substring(57, 117).trim() || "SOCIO_DESCONHECIDO";
            socioAtivo[cnpjBase] = nomeSocio;
            if (!clientesHoje[cnpjBase].socios[nomeSocio]) clientesHoje[cnpjBase].socios[nomeSocio] = [];
            continue;
          }

          // --- FIM DA EXTRAÇÃO DETALHADA ---

          if (blocoCodigo === "041099") {
            if (escopoAtual[cnpjBase] === "EMPRESA") clientesHoje[cnpjBase].nada_consta = true;
            continue;
          }

          const partes = linha.trim().split(/\s+/);
          if (partes.length < 2) continue;
          const blocoValor = partes[partes.length - 2] || "";
          const valDigits = blocoValor.replace(/\D/g, "");
          if (!valDigits || valDigits.length > 15) continue;

          let tipo = "";
          let valor = 0;

          if (blocoCodigo === "040101") { tipo = "PEFIN"; valor = parseFloat(valDigits); } 
          else if (blocoCodigo === "040102") { tipo = "REFIN"; valor = parseFloat(valDigits); } 
          else if (blocoCodigo === "040202") {
            const lNorm = normalizarTexto(linha);
            if (lNorm.includes("PROTESTO")) tipo = "PROTESTO";
            else if (lNorm.includes("JUD") || lNorm.includes("ACAO")) tipo = "AÇÃO JUDICIAL";
            else if (lNorm.includes("VENCIDA") || lNorm.includes("DIVIDA")) tipo = "DÍVIDA VENCIDA";
            else continue;
            valor = parseFloat(valDigits.length > 2 ? valDigits.slice(0, -2) : "0");
          }

          if (isNaN(valor) || valor > 9999999999 || !isFinite(valor)) continue;

          if (tipo) {
            const gaveta = escopoAtual[cnpjBase];
            if (gaveta === "EMPRESA") {
              if (linha.includes("IPZ1")) continue;
              if (!clientesHoje[cnpjBase].restritivos.some((r: any) => r.tipo === tipo)) {
                clientesHoje[cnpjBase].restritivos.push({ tipo, valor });
              }
            } else if (gaveta === "SOCIO") {
              const sName = socioAtivo[cnpjBase];
              if (sName && !clientesHoje[cnpjBase].socios[sName].some((r: any) => r.tipo === tipo)) {
                clientesHoje[cnpjBase].socios[sName].push({ tipo, valor });
              }
            }
          }
        }

        setStatusProcessamento(`[${fD(dataArquivo)}] Salvando lotes no banco...`);
        const cnpjsAproximados = Object.keys(clientesHoje).map(c => c + "000100");
        const { data: histDB } = await supabase
          .from("historico_consolidado")
          .select("*")
          .in("cnpj_cliente", cnpjsAproximados)
          .order("data_processamento", { ascending: false });

        const registrosHistorico: any[] = [];
        const registrosSocios: any[] = [];

        for (const [cnpjBase, dadosHoje] of Object.entries(clientesHoje)) {
          const cedenteOficial = cedentesDB?.find(c => extrairRaizCnpj(c.cnpj) === cnpjBase);

          const cnpjParaSalvar = cedenteOficial ? cedenteOficial.cnpj : dadosHoje.cnpj_completo_serasa;
          const nomeParaSalvar = cedenteOficial ? cedenteOficial.cedente : dadosHoje.cedente_serasa;
          const idResponsavel = cedenteOficial ? cedenteOficial.responsavel_id : null;

          if (cedenteOficial) {
             dadosHoje.jsonb.comercial = {
               grupo_economico: cedenteOficial.grupo_economico,
               limite_credito: cedenteOficial.limite,
               status_banco: "CLIENTE_BASE"
             };
          } else {
             dadosHoje.jsonb.comercial = { status_banco: "PROSPECTO_AVULSO" };
          }

          const regsAnteriores = histDB?.filter(h => h.cnpj_cliente === cnpjParaSalvar && h.data_processamento <= dataArquivo) || [];
          
          let saldoAnterior = 0;
          const vFinais: Record<string, number> = { PEFIN: 0, REFIN: 0, PROTESTO: 0, "AÇÃO JUDICIAL": 0, "DÍVIDA VENCIDA": 0 };

          if (regsAnteriores.length > 0) {
            saldoAnterior = parseFloat(regsAnteriores[0].saldo_atual) || 0;
            vFinais.PEFIN = parseFloat(regsAnteriores[0].total_pefin) || 0;
            vFinais.REFIN = parseFloat(regsAnteriores[0].total_refin) || 0;
            vFinais.PROTESTO = parseFloat(regsAnteriores[0].total_protesto) || 0;
            vFinais["AÇÃO JUDICIAL"] = parseFloat(regsAnteriores[0].total_acao_jud) || 0;
            vFinais["DÍVIDA VENCIDA"] = parseFloat(regsAnteriores[0].total_div_vencida) || 0;
          }

          const vOriginais = { ...vFinais };

          if (dadosHoje.nada_consta && dadosHoje.restritivos.length === 0) {
            Object.keys(vFinais).forEach(k => vFinais[k] = 0);
          } else {
            dadosHoje.restritivos.forEach((r: any) => { vFinais[r.tipo] = r.valor; });
          }

          const saldoAtual = Object.values(vFinais).reduce((a, b) => a + b, 0);
          const evolucao = saldoAtual - saldoAnterior;

          const mudancas: string[] = [];
          Object.keys(vFinais).forEach(k => { if (vFinais[k] !== vOriginais[k]) mudancas.push(k); });
          const resumoTexto = (dadosHoje.nada_consta && dadosHoje.restritivos.length === 0) ? "Atualização: Nada Consta" : (mudancas.length > 0 ? `Movimentação: ${mudancas.join(", ")}` : "Atualização Cadastral Simétrica");

          registrosHistorico.push({
            data_processamento: dataArquivo, 
            cnpj_cliente: cnpjParaSalvar,
            cedente: nomeParaSalvar,
            responsavel_id: idResponsavel,
            saldo_anterior: saldoAnterior, 
            evolucao, 
            saldo_atual: saldoAtual, 
            resumo_movimento: resumoTexto,
            total_pefin: vFinais.PEFIN, 
            total_refin: vFinais.REFIN, 
            total_protesto: vFinais.PROTESTO,
            total_acao_jud: vFinais["AÇÃO JUDICIAL"], 
            total_div_vencida: vFinais["DÍVIDA VENCIDA"],
            detalhes_completos: dadosHoje.jsonb
          });

          if (evolucao !== 0) resumoGlobalDisparo.push({ cnpj: cnpjParaSalvar, cedente: nomeParaSalvar, evolucao, resumo: resumoTexto });

          if (dadosHoje.socios) {
            for (const [nomeSocio, restSocio] of Object.entries(dadosHoje.socios)) {
              const vSocio: Record<string, number> = { PEFIN: 0, REFIN: 0, PROTESTO: 0, "AÇÃO JUDICIAL": 0, "DÍVIDA VENCIDA": 0 };
              (restSocio as any[]).forEach(r => { vSocio[r.tipo] = r.valor; });
              const sTotalSocio = Object.values(vSocio).reduce((a, b) => a + b, 0);

              if (sTotalSocio > 0) {
                registrosSocios.push({
                  data_processamento: dataArquivo, 
                  cnpj_empresa: cnpjParaSalvar, 
                  nome_socio: nomeSocio,
                  responsavel_id: idResponsavel,
                  total_pefin: vSocio.PEFIN, 
                  total_refin: vSocio.REFIN, 
                  total_protesto: vSocio.PROTESTO,
                  total_acao_jud: vSocio["AÇÃO JUDICIAL"], 
                  total_div_vencida: vSocio["DÍVIDA VENCIDA"], 
                  saldo_total: sTotalSocio
                });
              }
            }
          }
        }

        await supabase.from("historico_consolidado").delete().eq("data_processamento", dataArquivo);
        await supabase.from("restritivos_socios").delete().eq("data_processamento", dataArquivo);

        for (let i = 0; i < registrosHistorico.length; i += 500) {
          await supabase.from("historico_consolidado").insert(registrosHistorico.slice(i, i + 500));
        }
        for (let i = 0; i < registrosSocios.length; i += 500) {
          await supabase.from("restritivos_socios").insert(registrosSocios.slice(i, i + 500));
        }
      }

      if (dispararEmail && resumoGlobalDisparo.length > 0) {
        setStatusProcessamento("Disparando Alertas por E-mail...");
        const respostaEmail = await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "monitore", resumoGlobalDisparo })
        });
        if (!respostaEmail.ok) console.error("Aviso: Falha no disparo de e-mail.");
      }

      alert(`🎉 Sucesso! ${files.length} arquivo(s) importado(s) com êxito.`);
      carregarDiario(); 

    } catch (e: any) {
      alert(`❌ Erro no processamento: ${e.message}`);
    } finally {
      setProcessando(false);
      setStatusProcessamento("");
      event.target.value = "";
    }
  };

  // ============================================================================
  // 📊 KPIS DA TELA 
  // ============================================================================
  const kpis = useMemo(() => {
    let piora = 0;
    let melhora = 0;
    let estaveis = 0;
    
    dados.forEach(d => {
      const evo = parseFloat(d.evolucao || 0);
      if (evo > 0) piora++;
      else if (evo < 0) melhora++;
      else estaveis++;
    });

    return { total: dados.length, piora, melhora, estaveis };
  }, [dados]);

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando painel de monitoramento...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 font-sans text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🚀 HEADER PREMIUM COM GRADIENTE */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight mb-2">🔍 Monitoramento Diário</h1>
          <p className="text-blue-200 opacity-90 text-sm font-medium">
            Acompanhe as oscilações de risco da sua carteira processadas via bureau Serasa.
          </p>
        </div>

        {/* 🎛️ BOTÕES DE UPLOAD DUPLOS (MÚLTIPLOS ARQUIVOS) */}
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <label className={`flex-1 sm:flex-none justify-center px-6 py-3.5 bg-slate-800/80 hover:bg-slate-700 text-white font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-sm transition-all flex items-center gap-2 border border-slate-600 ${processando ? "opacity-50 pointer-events-none" : ""}`}>
            {processando ? `⏳` : "🤫 Reprocessar em Lote (Sem E-mail)"}
            <input type="file" accept=".txt" multiple className="hidden" onChange={(e) => processarArquivoSerasa(e, false)} />
          </label>

          <label className={`flex-1 sm:flex-none justify-center px-6 py-3.5 bg-white text-blue-900 hover:bg-slate-50 font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-xl transition-all flex items-center gap-2 border border-transparent hover:border-blue-100 ${processando ? "opacity-50 pointer-events-none animate-pulse" : ""}`}>
            {processando ? `⏳ ${statusProcessamento}` : "📥 Importar TXT e Notificar Equipe"}
            <input type="file" accept=".txt" multiple className="hidden" onChange={(e) => processarArquivoSerasa(e, true)} />
          </label>
        </div>
      </div>

      {/* 📊 CARDS DE RESUMO MASTIGADO (TITANIUM DESIGN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total na Data Atual</div>
          <div className="text-3xl font-black font-mono text-slate-800">{kpis.total}</div>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-rose-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">🚨 Pioras (Risco Aumentou)</div>
          <div className="text-3xl font-black font-mono text-slate-800">{kpis.piora}</div>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">✅ Melhoras (Risco Caiu)</div>
          <div className="text-3xl font-black font-mono text-slate-800">{kpis.melhora}</div>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded-xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">⚖️ Estáveis (Sem Ocorrências)</div>
          <div className="text-3xl font-black font-mono text-slate-800">{kpis.estaveis}</div>
        </div>
      </div>

      {/* 📋 TABELA DE MOVIMENTAÇÕES (CLEAN UI) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px] text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Data</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-40">CNPJ</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Cedente</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50/50">Risco Aberto</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Saldo Ant.</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Evolução</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-800 bg-slate-100/50">Saldo Atual</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Resumo da Ocorrência</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">PEFIN</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">REFIN</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Protestos</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Ações Jud.</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Dív. Vencida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {dados.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center p-12 text-slate-400 font-bold italic">
                    Nenhuma movimentação ou registro disponível para a data de hoje. Aguardando upload.
                  </td>
                </tr>
              ) : (
                dados.map((item, idx) => {
                  const evo = parseFloat(item.evolucao || 0);
                  const isProspecto = item.detalhes_completos?.comercial?.status_banco === "PROSPECTO_AVULSO";

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="p-4 text-center text-slate-400 font-mono text-xs whitespace-nowrap">{fD(item.data_processamento)}</td>
                      <td className="p-4 font-mono text-slate-400 text-xs whitespace-nowrap group-hover:text-blue-600 transition-colors">{item.cnpj_cliente}</td>
                      <td className="p-4 font-black text-slate-800 truncate max-w-[250px] uppercase" title={item.cedente}>
                        {isProspecto && <span className="inline-block mr-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 text-[9px] rounded uppercase font-black tracking-wider shadow-sm">Avulso</span>}
                        {item.cedente}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-blue-700 bg-blue-50/30 whitespace-nowrap">{fM(item.risco_aberto)}</td>
                      <td className="p-4 text-right text-slate-400 font-mono whitespace-nowrap">{fM(item.saldo_anterior)}</td>
                      
                      <td className="p-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center justify-end gap-1 font-black px-2.5 py-1 rounded text-[11px] min-w-[120px] shadow-sm ${evo === 0 ? "text-slate-500 bg-slate-100 border border-slate-200" : evo > 0 ? "text-rose-700 bg-rose-50 border border-rose-200" : "text-emerald-700 bg-emerald-50 border border-emerald-200"}`}>
                          {evo === 0 ? "•" : evo > 0 ? "▲" : "▼"} {fM(evo)}
                        </span>
                      </td>
                      
                      <td className="p-4 text-right font-mono font-black text-slate-900 bg-slate-50/50 whitespace-nowrap">{fM(item.saldo_atual)}</td>
                      <td className="p-4 text-slate-500 text-[11px] leading-tight pr-4 font-semibold">{item.resumo_movimento || "Estável"}</td>
                      
                      {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(k => {
                        const val = parseFloat(item[k]);
                        return (
                          <td key={k} className={`p-4 text-right font-mono text-xs whitespace-nowrap ${val > 0 ? "text-rose-600 font-black bg-rose-50/30" : "text-slate-300 font-medium"}`}>
                            {fM(item[k])}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}