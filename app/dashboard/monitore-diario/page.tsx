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

  // ============================================================================
  // 🎨 ESTADOS DE UI
  // ============================================================================
  const [modoVisualizacao, setModoVisualizacao] = useState<"DOSSIE" | "TABELA">("DOSSIE");
  const [selecionado, setSelecionado] = useState<any | null>(null);
  const [busca, setBusca] = useState("");

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

        const codigosChave = ["010102", "010104", "010117", "030102", "021105", "041099", "040101", "040102", "040202", "040301"];

        for (const linha of linhas) {
          if (linha.length < 40) continue;
          if (linha.substring(9, 10) !== "1") continue;

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
            const dataOcorrencia = linha.substring(43, 51);
            const valorBruto = linha.substring(54, 69).replace(/\D/g, "");
            const valorFormatado = parseFloat(valorBruto) / 100;
            let praca = linha.substring(69, 109);
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
        
        const cnpjsParaBuscar = Object.keys(clientesHoje).map(cnpjBase => {
          const cedenteOficial = cedentesDB?.find(c => extrairRaizCnpj(c.cnpj) === cnpjBase);
          return cedenteOficial ? cedenteOficial.cnpj : (cnpjBase + "000100");
        });

        const { data: histDB } = await supabase
          .from("historico_consolidado")
          .select("*")
          .in("cnpj_cliente", cnpjsParaBuscar)
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

          const regsAnteriores = histDB?.filter(h => h.cnpj_cliente === cnpjParaSalvar && h.data_processamento < dataArquivo) || [];
          
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

          // ⚠️ AJUSTE: Passando o objeto 'detalhes' e os saldos para o payload do E-mail
          if (evolucao !== 0) {
            resumoGlobalDisparo.push({ 
              cnpj: cnpjParaSalvar, 
              cedente: nomeParaSalvar, 
              saldo_anterior: saldoAnterior,
              saldo_atual: saldoAtual,
              evolucao, 
              resumo: resumoTexto,
              detalhes: {
                pefin: vFinais.PEFIN,
                refin: vFinais.REFIN,
                protesto: vFinais.PROTESTO,
                jud: vFinais["AÇÃO JUDICIAL"],
                vencida: vFinais["DÍVIDA VENCIDA"]
              }
            });
          }

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
  // 📊 KPIS DA TELA E FILTROS DE BUSCA
  // ============================================================================
  const kpis = useMemo(() => {
    let piora = 0; let melhora = 0; let estaveis = 0;
    dados.forEach(d => {
      const evo = parseFloat(d.evolucao || 0);
      if (evo > 0) piora++;
      else if (evo < 0) melhora++;
      else estaveis++;
    });
    return { total: dados.length, piora, melhora, estaveis };
  }, [dados]);

  const dadosFiltrados = useMemo(() => {
    if (!busca) return dados;
    const b = busca.toLowerCase();
    return dados.filter(d => (d.cedente || "").toLowerCase().includes(b) || (d.cnpj_cliente || "").includes(b));
  }, [dados, busca]);

  // ============================================================================
  // 🧩 RENDERIZADOR DO PAINEL DOSSIÊ (DIREITA)
  // ============================================================================
  const renderizarDossie = () => {
    if (!selecionado) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 p-12 text-center bg-slate-50/50">
          <span className="text-6xl filter drop-shadow-sm opacity-40">📊</span>
          <h2 className="text-lg font-bold uppercase tracking-widest text-slate-500">Selecione uma Empresa</h2>
          <p className="text-sm max-w-sm">Escolha uma empresa na lista lateral para ver os detalhes exatos da oscilação de risco de hoje.</p>
        </div>
      );
    }

    const evo = parseFloat(selecionado.evolucao || 0);
    const isProspecto = selecionado.detalhes_completos?.comercial?.status_banco === "PROSPECTO_AVULSO";

    return (
      <div className="p-6 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header do Dossiê */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {isProspecto ? (
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] uppercase font-black rounded tracking-widest">Avulso</span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] uppercase font-black rounded tracking-widest">Base</span>
              )}
              <span className="text-slate-400 font-mono text-sm">{selecionado.cnpj_cliente}</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">{selecionado.cedente}</h2>
          </div>
          
          <div className="text-right flex flex-col items-end">
            <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Risco Exposto</span>
            <span className="text-2xl font-mono font-black text-blue-300">{fM(selecionado.risco_aberto)}</span>
          </div>
        </div>

        {/* Resumo e Oscilação */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-center">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Status da Movimentação</span>
            <span className="text-sm font-bold text-slate-700">{selecionado.resumo_movimento || "Nenhuma ocorrência grave"}</span>
          </div>
          
          <div className="lg:col-span-2 grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Anterior</span>
              <span className="font-mono text-lg font-bold text-slate-600">{fM(selecionado.saldo_anterior)}</span>
            </div>
            <div className={`flex flex-col items-center justify-center text-center border-x border-slate-200 px-2 ${evo > 0 ? 'bg-rose-50/50' : evo < 0 ? 'bg-emerald-50/50' : ''}`}>
              <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${evo > 0 ? 'text-rose-600' : evo < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>Oscilação</span>
              <span className={`font-mono text-xl font-black flex items-center gap-1 ${evo > 0 ? 'text-rose-600' : evo < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {evo > 0 ? "▲" : evo < 0 ? "▼" : "•"} {fM(Math.abs(evo))}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Atual</span>
              <span className="font-mono text-lg font-black text-slate-900">{fM(selecionado.saldo_atual)}</span>
            </div>
          </div>
        </div>

        {/* Grid de Restritivos */}
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 border-b border-slate-200 pb-2 mt-6">Composição da Dívida Atual</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "PEFIN", key: "total_pefin", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
            { label: "REFIN", key: "total_refin", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
            { label: "Protestos", key: "total_protesto", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
            { label: "Ações Jud.", key: "total_acao_jud", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
            { label: "Dív. Vencida", key: "total_div_vencida", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
          ].map((item, idx) => {
            const val = parseFloat(selecionado[item.key] || 0);
            const temValor = val > 0;
            return (
              <div key={idx} className={`border rounded-xl p-4 text-center transition-all ${temValor ? `${item.bg} ${item.border}` : 'bg-white border-slate-100 opacity-60'}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{item.label}</div>
                <div className={`font-mono text-sm md:text-base font-black ${temValor ? item.color : 'text-slate-400'}`}>
                  {fM(val)}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando painel de monitoramento...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 font-sans text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🚀 HEADER */}
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight mb-2">🔍 Monitoramento Diário</h1>
          <p className="text-blue-200 opacity-90 text-sm font-medium">Acompanhe as oscilações de risco da sua carteira.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <label className={`flex-1 sm:flex-none justify-center px-6 py-3.5 bg-slate-800/80 hover:bg-slate-700 text-white font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-sm transition-all flex items-center gap-2 border border-slate-600 ${processando ? "opacity-50 pointer-events-none" : ""}`}>
            {processando ? `⏳` : "🤫 Reprocessar em Lote"}
            <input type="file" accept=".txt" multiple className="hidden" onChange={(e) => processarArquivoSerasa(e, false)} />
          </label>
          <label className={`flex-1 sm:flex-none justify-center px-6 py-3.5 bg-white text-blue-900 hover:bg-slate-50 font-black rounded-xl text-[10px] uppercase cursor-pointer shadow-xl transition-all flex items-center gap-2 border border-transparent hover:border-blue-100 ${processando ? "opacity-50 pointer-events-none animate-pulse" : ""}`}>
            {processando ? `⏳ ${statusProcessamento}` : "📥 Importar TXT e Notificar"}
            <input type="file" accept=".txt" multiple className="hidden" onChange={(e) => processarArquivoSerasa(e, true)} />
          </label>
        </div>
      </div>

      {/* 📊 CONTROLES E KPIS */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-xl p-4 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Processados Hoje</div>
            <div className="text-2xl font-black font-mono text-slate-800">{kpis.total}</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-rose-500 rounded-xl p-4 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-1">Pioras (Subiu)</div>
            <div className="text-2xl font-black font-mono text-slate-800">{kpis.piora}</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-xl p-4 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Melhoras (Caiu)</div>
            <div className="text-2xl font-black font-mono text-slate-800">{kpis.melhora}</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded-xl p-4 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Estáveis</div>
            <div className="text-2xl font-black font-mono text-slate-800">{kpis.estaveis}</div>
          </div>
        </div>

        {/* TOGGLE DOSSIÊ / TABELA */}
        <div className="bg-white border border-slate-200 p-1.5 rounded-xl flex shadow-sm shrink-0">
          <button 
            onClick={() => setModoVisualizacao("DOSSIE")}
            className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modoVisualizacao === "DOSSIE" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}
          >
            📋 Modo Dossiê
          </button>
          <button 
            onClick={() => setModoVisualizacao("TABELA")}
            className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modoVisualizacao === "TABELA" ? "bg-slate-800 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}
          >
            📑 Modo Tabela
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🔮 MODO DOSSIÊ (MASTER-DETAIL) */}
      {/* ========================================================= */}
      {modoVisualizacao === "DOSSIE" && (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-320px)] min-h-[500px]">
          
          {/* SIDEBAR LISTA */}
          <div className="w-full lg:w-[380px] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <input
                type="text"
                placeholder="Buscar cedente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full px-4 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner bg-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50">
              {dadosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400 font-medium">Nenhum cedente processado hoje.</div>
              ) : (
                dadosFiltrados.map((item, idx) => {
                  const evo = parseFloat(item.evolucao || 0);
                  const isSelected = selecionado?.id === item.id;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelecionado(item)}
                      className={`w-full text-left p-4 rounded-xl transition-all flex items-center justify-between group border
                        ${isSelected ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-500/20' : 'border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm'}
                      `}
                    >
                      <div className="overflow-hidden pr-3">
                        <div className={`text-xs font-black truncate uppercase tracking-tight ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{item.cedente}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{item.cnpj_cliente}</div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded shadow-sm flex items-center gap-1
                          ${evo > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                            evo < 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                            'bg-slate-100 text-slate-500 border border-slate-200'}
                        `}>
                          {evo > 0 ? "▲" : evo < 0 ? "▼" : "•"} {fM(Math.abs(evo))}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* PAINEL PRINCIPAL DOSSIÊ */}
          <div className="flex-1 overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-sm">
            {renderizarDossie()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 📊 MODO TABELA (CENTRALIZADA E OTIMIZADA) */}
      {/* ========================================================= */}
      {modoVisualizacao === "TABELA" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[1700px] text-[13px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Data</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">CNPJ</th>
                  <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Cedente</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50/50">Risco Aberto</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Saldo Ant.</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Evolução</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-800 bg-slate-100/50">Saldo Atual</th>
                  <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-64">Resumo da Ocorrência</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">PEFIN</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">REFIN</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Protestos</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Ações Jud.</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Dív. Vencida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {dadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center p-12 text-slate-400 font-bold italic">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                  dadosFiltrados.map((item, idx) => {
                    const evo = parseFloat(item.evolucao || 0);
                    const isProspecto = item.detalhes_completos?.comercial?.status_banco === "PROSPECTO_AVULSO";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="p-4 text-slate-400 font-mono text-xs whitespace-nowrap">{fD(item.data_processamento)}</td>
                        <td className="p-4 font-mono text-slate-400 text-xs whitespace-nowrap group-hover:text-blue-600 transition-colors">{item.cnpj_cliente}</td>
                        {/* Apenas Cedente e Resumo mantidos à esquerda (text-left) */}
                        <td className="p-4 text-left font-black text-slate-800 truncate max-w-[250px] uppercase" title={item.cedente}>
                          {isProspecto && <span className="inline-block mr-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 text-[9px] rounded uppercase font-black tracking-wider shadow-sm">Avulso</span>}
                          {item.cedente}
                        </td>
                        <td className="p-4 font-mono font-black text-blue-700 bg-blue-50/30 whitespace-nowrap">{fM(item.risco_aberto)}</td>
                        <td className="p-4 text-slate-400 font-mono whitespace-nowrap">{fM(item.saldo_anterior)}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center gap-1 font-black px-2.5 py-1 rounded text-[11px] min-w-[100px] shadow-sm ${evo === 0 ? "text-slate-500 bg-slate-100 border border-slate-200" : evo > 0 ? "text-rose-700 bg-rose-50 border border-rose-200" : "text-emerald-700 bg-emerald-50 border border-emerald-200"}`}>
                            {evo === 0 ? "•" : evo > 0 ? "▲" : "▼"} {fM(Math.abs(evo))}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-black text-slate-900 bg-slate-50/50 whitespace-nowrap">{fM(item.saldo_atual)}</td>
                        <td className="p-4 text-left text-slate-500 text-[11px] leading-tight pr-4 font-semibold">{item.resumo_movimento || "Estável"}</td>
                        
                        {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(k => {
                          const val = parseFloat(item[k]);
                          return (
                            <td key={k} className={`p-4 font-mono text-xs whitespace-nowrap ${val > 0 ? "text-rose-600 font-black bg-rose-50/30" : "text-slate-300 font-medium"}`}>
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
      )}
    </div>
  );
}