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

      // Busca o histórico do dia e a tabela de cedentes completa
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

        // 🛡️ BLINDAGEM NO FRONT: Cruza o risco atualizado usando a raiz do CNPJ
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
  const processarArquivoSerasa = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessando(true);
      setStatusProcessamento("Lendo arquivo...");

      const texto = await file.text();
      const linhas = texto.split(/\r?\n/);

      if (linhas.length === 0) throw new Error("O arquivo está vazio.");

      let dataArquivo = new Date().toISOString().split("T")[0];
      const matchData = linhas[0].match(/(\d{2})\/(\d{2})\/(\d{4})/);
      
      if (matchData) {
        dataArquivo = `${matchData[3]}-${matchData[2]}-${matchData[1]}`;
      } else {
        console.warn("Aviso: Data não encontrada no cabeçalho. Usando a data de hoje como fallback.");
      }

      setStatusProcessamento("Minerando inteligência do TXT...");
      const clientesHoje: Record<string, any> = {};
      const escopoAtual: Record<string, "EMPRESA" | "SOCIO"> = {};
      const socioAtivo: Record<string, string> = {};

      // 🧠 Códigos Estratégicos Expandidos
      const codigosChave = [
        "010102", "010104", "010117", 
        "030102", 
        "041099", "040101", "040102", "040202", "040301"
      ];

      for (const linha of linhas) {
        if (linha.length < 40) continue;
        if (linha.substring(9, 10) !== "1") continue;

        let idxBloco = -1;
        let blocoCodigo = "";

        for (const cod of codigosChave) {
          const pos = linha.indexOf(cod);
          if (pos !== -1 && (idxBloco === -1 || pos < idxBloco)) {
            idxBloco = pos;
            blocoCodigo = cod;
          }
        }

        if (!blocoCodigo) continue;

        const startCnpj = Math.max(0, idxBloco - 9);
        const cnpjBaseRaw = linha.substring(startCnpj, idxBloco).trim();
        // Garantindo os 8 dígitos da raiz
        const cnpjBase = cnpjBaseRaw.replace(/\D/g, "").padStart(8, "0").slice(-8);

        if (!clientesHoje[cnpjBase]) {
          clientesHoje[cnpjBase] = { 
            restritivos: [], 
            socios: {}, 
            nada_consta: false, 
            cedente_serasa: "N/A", // Guardamos o nome do Serasa como fallback
            cnpj_completo_serasa: cnpjBase + "000100", // Tentativa inicial
            jsonb: {
              cadastro: {},
              consultas: [],
              comportamento: [],
              detalhes_dividas: []
            }
          };
          escopoAtual[cnpjBase] = "EMPRESA";
        }

        // --- INÍCIO DA EXTRAÇÃO DETALHADA ---

        if (blocoCodigo === "010102") {
          escopoAtual[cnpjBase] = "EMPRESA";
          if (clientesHoje[cnpjBase].cedente_serasa === "N/A") {
            clientesHoje[cnpjBase].cedente_serasa = linha.substring(idxBloco + 6, idxBloco + 66).trim();
          }
          continue;
        }

        if (blocoCodigo === "010104" && escopoAtual[cnpjBase] === "EMPRESA") {
          clientesHoje[cnpjBase].jsonb.cadastro.cidade = linha.substring(idxBloco + 6, idxBloco + 46).trim();
          continue;
        }

        if (blocoCodigo === "030102" && escopoAtual[cnpjBase] === "EMPRESA") {
          const dataConsulta = linha.substring(idxBloco + 6, idxBloco + 14);
          const nomeInstituicao = linha.substring(idxBloco + 14, idxBloco + 59).trim();
          clientesHoje[cnpjBase].jsonb.consultas.push({ data: dataConsulta, instituicao: nomeInstituicao });
          continue;
        }

        if (blocoCodigo === "040301" && escopoAtual[cnpjBase] === "EMPRESA") {
          const dataOcorrencia = linha.substring(idxBloco + 15, idxBloco + 23);
          const valorBruto = linha.substring(idxBloco + 23, idxBloco + 45).replace(/\D/g, "");
          const valorFormatado = parseFloat(valorBruto) / 100;
          const praca = linha.substring(idxBloco + 45, idxBloco + 75).trim();
          
          if (valorFormatado > 0) {
            clientesHoje[cnpjBase].jsonb.detalhes_dividas.push({
              data: dataOcorrencia,
              valor: valorFormatado,
              praca: praca
            });
          }
          continue;
        }

        // --- FIM DA EXTRAÇÃO DETALHADA ---

        if (blocoCodigo === "010117") {
          escopoAtual[cnpjBase] = "SOCIO";
          const nomeSocio = linha.substring(idxBloco + 29, idxBloco + 89).trim() || "SOCIO_DESCONHECIDO";
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

      setStatusProcessamento("Cruzando histórico com o Supabase (Via CNPJ)...");

      // 🛡️ Buscamos todos os cedentes para fazer o match perfeito pela RAIZ do CNPJ
      const { data: cedentesDB } = await supabase
        .from("cadastro_cedentes")
        .select("id, cedente, cnpj, responsavel_id, grupo_economico, limite")
        .not("cnpj", "is", null); // Garante que traga apenas quem tem CNPJ

      // Busca histórico anterior para calcular a evolução
      const cnpjsAproximados = Object.keys(clientesHoje).map(c => c + "000100");
      const { data: histDB } = await supabase
        .from("historico_consolidado")
        .select("*")
        .in("cnpj_cliente", cnpjsAproximados)
        .order("data_processamento", { ascending: false });

      const registrosHistorico: any[] = [];
      const registrosSocios: any[] = [];
      const resumoGlobalDisparo: any[] = [];

      for (const [cnpjBase, dadosHoje] of Object.entries(clientesHoje)) {
        
        // 🛡️ A MÁGICA DO MATCH PELA RAIZ DO CNPJ
        // Tentamos achar a empresa oficial no cadastro cruzando os 8 primeiros digitos
        const cedenteOficial = cedentesDB?.find(c => extrairRaizCnpj(c.cnpj) === cnpjBase);

        // Se achou no banco, usamos o CNPJ e Nome oficiais. Se não, usamos o fallback do Serasa (Prospecto)
        const cnpjParaSalvar = cedenteOficial ? cedenteOficial.cnpj : dadosHoje.cnpj_completo_serasa;
        const nomeParaSalvar = cedenteOficial ? cedenteOficial.cedente : dadosHoje.cedente_serasa;
        const idResponsavel = cedenteOficial ? cedenteOficial.responsavel_id : null;

        // Injetando dados financeiros comerciais direto no JSONB para a futura view
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
          cnpj_cliente: cnpjParaSalvar, // CNPJ Normalizado
          cedente: nomeParaSalvar,      // Nome Normalizado
          responsavel_id: idResponsavel, // Vínculo com o CRM
          saldo_anterior: saldoAnterior, 
          evolucao, 
          saldo_atual: saldoAtual, 
          resumo_movimento: resumoTexto,
          total_pefin: vFinais.PEFIN, 
          total_refin: vFinais.REFIN, 
          total_protesto: vFinais.PROTESTO,
          total_acao_jud: vFinais["AÇÃO JUDICIAL"], 
          total_div_vencida: vFinais["DÍVIDA VENCIDA"],
          detalhes_completos: dadosHoje.jsonb // 🚀 O JSON RICO VAI AQUI
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

      setStatusProcessamento("Limpando duplicidades e salvando novo lote...");
      await supabase.from("historico_consolidado").delete().eq("data_processamento", dataArquivo);
      await supabase.from("restritivos_socios").delete().eq("data_processamento", dataArquivo);

      for (let i = 0; i < registrosHistorico.length; i += 500) {
        const { error: errHist } = await supabase.from("historico_consolidado").insert(registrosHistorico.slice(i, i + 500));
        if (errHist) throw new Error(`Erro ao salvar histórico: ${errHist.message}`);
      }
      for (let i = 0; i < registrosSocios.length; i += 500) {
        const { error: errSocio } = await supabase.from("restritivos_socios").insert(registrosSocios.slice(i, i + 500));
        if (errSocio) throw new Error(`Erro ao salvar sócios: ${errSocio.message}`);
      }

      if (resumoGlobalDisparo.length > 0) {
        setStatusProcessamento("Disparando Alertas por E-mail...");
        const respostaEmail = await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "monitore",
            resumoGlobalDisparo: resumoGlobalDisparo
          })
        });
        if (!respostaEmail.ok) console.error("Aviso: Falha no disparo de e-mail.");
      }

      alert(`🎉 Sucesso! Relatório Serasa do dia ${fD(dataArquivo)} importado com sucesso.`);
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

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Varrendo logs e checando permissões...</div>;

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-6 text-[13px] font-sans text-slate-800">
      
      {/* HEADER E BOTÃO DE UPLOAD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-3 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">🔍 Monitoramento Diário (Serasa)</h2>
          <span className="text-xs text-slate-500 font-medium">Acompanhe as oscilações diárias de risco da sua carteira de cedentes.</span>
        </div>

        <label className={`px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase cursor-pointer shadow-md transition-all flex items-center gap-2 ${processando ? "opacity-50 pointer-events-none animate-pulse" : ""}`}>
          {processando ? `⏳ ${statusProcessamento}` : "📥 Subir Relatório Serasa (.TXT)"}
          <input type="file" accept=".txt" className="hidden" onChange={processarArquivoSerasa} />
        </label>
      </div>

      {/* CARDS DE RESUMO MASTIGADO */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total na Data Atual</span>
          <span className="text-2xl font-black font-mono mt-1 text-slate-700">{kpis.total}</span>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-rose-500 p-4 rounded-xl shadow-xs flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">🚨 Pioras (Risco Aumentou)</span>
          <span className="text-2xl font-black font-mono mt-1 text-slate-800">{kpis.piora}</span>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 p-4 rounded-xl shadow-xs flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">✅ Melhoras (Risco Diminuiu)</span>
          <span className="text-2xl font-black font-mono mt-1 text-slate-800">{kpis.melhora}</span>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">⚖️ Estáveis (Sem Ocorrências)</span>
          <span className="text-2xl font-black font-mono mt-1 text-slate-700">{kpis.estaveis}</span>
        </div>
      </div>

      {/* TABELA DE MOVIMENTAÇÕES */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1700px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-[10px] tracking-wider h-11">
                <th className="p-3 text-center">Data</th>
                <th className="p-3 w-40">CNPJ</th>
                <th className="p-3 w-64">Cedente</th>
                <th className="p-3 text-right">Risco Aberto</th>
                <th className="p-3 text-right">Saldo Ant.</th>
                <th className="p-3 text-right">Evolução</th>
                <th className="p-3 text-right">Saldo Atual</th>
                <th className="p-3 w-64">Resumo da Ocorrência</th>
                <th className="p-3 text-right">PEFIN</th>
                <th className="p-3 text-right">REFIN</th>
                <th className="p-3 text-right">Protestos</th>
                <th className="p-3 text-right">Ações Jud.</th>
                <th className="p-3 text-right">Dív. Vencida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {dados.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center p-10 text-slate-400 font-bold italic">
                    Nenhuma movimentação ou registro disponível para a data de hoje. Faça o upload do arquivo Serasa.
                  </td>
                </tr>
              ) : (
                dados.map((item, idx) => {
                  const evo = parseFloat(item.evolucao || 0);
                  // Verifica se é prospecto checando o JSONB
                  const isProspecto = item.detalhes_completos?.comercial?.status_banco === "PROSPECTO_AVULSO";

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-normal whitespace-nowrap">{fD(item.data_processamento)}</td>
                      <td className="p-3 font-mono text-slate-400 text-xs whitespace-nowrap">{item.cnpj_cliente}</td>
                      <td className="p-3 font-black text-slate-900 truncate max-w-[250px]" title={item.cedente}>
                        {isProspecto && <span className="inline-block mr-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] rounded uppercase font-bold tracking-wider">Avulso</span>}
                        {item.cedente}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-blue-700 bg-blue-50/30 whitespace-nowrap">{fM(item.risco_aberto)}</td>
                      <td className="p-3 text-right text-slate-400 whitespace-nowrap">{fM(item.saldo_anterior)}</td>
                      
                      {/* EVOLUÇÃO DESTACADA */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center justify-end gap-1 font-black px-2 py-0.5 rounded text-[11px] w-[120px] shadow-xs ${evo === 0 ? "text-slate-500 bg-slate-100 border border-slate-200" : evo > 0 ? "text-rose-700 bg-rose-50 border border-rose-200" : "text-emerald-700 bg-emerald-50 border border-emerald-200"}`}>
                          {evo === 0 ? "•" : evo > 0 ? "▲" : "▼"} {fM(evo)}
                        </span>
                      </td>
                      
                      <td className="p-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">{fM(item.saldo_atual)}</td>
                      <td className="p-3 text-slate-500 text-[11px] leading-tight pr-4">{item.resumo_movimento || "Estável"}</td>
                      
                      {/* COLUNAS RESTRITIVOS */}
                      {["total_pefin", "total_refin", "total_protesto", "total_acao_jud", "total_div_vencida"].map(k => (
                        <td key={k} className={`p-3 text-right font-mono text-xs whitespace-nowrap ${parseFloat(item[k]) > 0 ? "text-rose-600 font-bold bg-rose-50/40" : "text-slate-300 font-normal"}`}>
                          {fM(item[k])}
                        </td>
                      ))}
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