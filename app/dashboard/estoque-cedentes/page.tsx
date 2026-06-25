/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface TituloEstoque {
  id?: string;
  cedente: string;
  sacado: string;
  documento: string;
  vencimento: string;
  valorNominal: number;
  precoAquisicao: number;
  prazoDias: number;
  colunaPrazoMassa: number;
  colunaTaxaMassa: number;
  taxaFinalCalculada: number;
}

export default function AnaliseEstoqueCedentesPage() {
  const [titulos, setTitulos] = useState<TituloEstoque[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [statusTexto, setStatusStatusTexto] = useState("");
  const [cedenteExpandido, setCedenteExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("nominal_desc"); // Padrão: Maior Valor

  const buscarEstoqueDoBanco = async () => {
    try {
      setCarregando(true);
      setStatusStatusTexto("Sincronizando com o Supabase...");
      const { data, error } = await supabase
        .from("estoque_fidc")
        .select("*")
        .order("valor_nominal", { ascending: false });

      if (error) throw error;
      if (data) {
        const mapeados = data.map((d: any) => ({
          id: d.id,
          cedente: d.cedente,
          sacado: d.sacado,
          documento: d.documento,
          vencimento: d.vencimento,
          valorNominal: Number(d.valor_nominal),
          precoAquisicao: Number(d.preco_aquisicao),
          prazoDias: Number(d.prazo_dias),
          colunaPrazoMassa: Number(d.coluna_prazo_massa),
          colunaTaxaMassa: Number(d.coluna_taxa_massa),
          taxaFinalCalculada: Number(d.taxa_final_calculada)
        }));
        setTitulos(mapeados);
      }
    } catch (err: any) {
      console.error("Erro ao ler banco:", err);
    } finally {
      setCarregando(false);
      setStatusStatusTexto("");
    }
  };

  useEffect(() => {
    buscarEstoqueDoBanco();
  }, []);

  const handleImportarEstoqueDestrutivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmar = confirm("⚠️ ATENÇÃO: Deseja expurgar o estoque antigo e rodar o recálculo ponderado oficial?");
    if (!confirmar) return;

    setCarregando(true);
    try {
      setStatusStatusTexto("Limpando registros do estoque anterior...");
      await supabase.from("estoque_fidc").delete().neq("cedente", "");

      setStatusStatusTexto("Lendo arquivo local...");
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/);
        
        const parseLineCSV = (linhaTexto: string, separador: string = ",") => {
          const colunas = [];
          let dentroDeAspas = false;
          let celulaAcumulada = "";
          for (let i = 0; i < linhaTexto.length; i++) {
            const char = linhaTexto[i];
            if (char === '"') dentroDeAspas = !dentroDeAspas;
            else if (char === separador && !dentroDeAspas) {
              colunas.push(celulaAcumulada.trim().replace(/^"|"$/g, ""));
              celulaAcumulada = "";
            } else {
              celulaAcumulada += char;
            }
          }
          colunas.push(celulaAcumulada.trim().replace(/^"|"$/g, ""));
          return colunas;
        };

        let startIdx = -1;
        let separadorDefinido = ",";
        
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
          const l = lines[i];
          if (l.includes("NOME_DO_CEDENTE")) {
            startIdx = i;
            if ((l.match(/;/g) || []).length > (l.match(/,/g) || []).length) {
              separadorDefinido = ";";
            }
            break;
          }
        }

        if (startIdx === -1) {
          alert("❌ Erro: Não foi encontrada a linha de cabeçalhos com 'NOME_DO_CEDENTE'.");
          setCarregando(false);
          return;
        }

        const headers = parseLineCSV(lines[startIdx], separadorDefinido);

        const idxCedente = headers.indexOf("NOME_DO_CEDENTE");
        const idxSacado = headers.indexOf("NOME_DO_SACADO");
        const idxDoc = headers.indexOf("NUMERO_DOCUMENTO");
        const idxAquisicao = headers.indexOf("DATA_DE_AQUISICAO");      
        const idxVencimento = headers.indexOf("DATA_DE_VENCIMENTO");    
        const idxPrecoAquisicao = headers.indexOf("PRECO_DE_AQUISICAO");
        const idxNominal = headers.indexOf("VALOR_NOMINAL");            

        const payloadParaInsercao: any[] = [];

        const limparNumero = (valStr: string) => {
          if (!valStr) return 0;
          let s = valStr.trim();
          if (s.includes(",") && s.includes(".")) {
            s = s.replace(/\./g, "").replace(",", ".");
          } else if (s.includes(",")) {
            s = s.replace(",", ".");
          }
          return parseFloat(s) || 0;
        };

        const obterPrazoCorridoAbsoluto = (txtInicio: string, txtFim: string) => {
          if (!txtInicio || !txtFim) return 1;
          const strI = txtInicio.trim().split(" ")[0];
          const strF = txtFim.trim().split(" ")[0];
          
          const pI = strI.includes("-") ? strI.split("-") : strI.split("/");
          const pF = strF.includes("-") ? strF.split("-") : strF.split("/");
          
          if (pI.length < 3 || pF.length < 3) return 1;
          
          let timeI, timeF;
          if (strI.includes("-")) {
            timeI = Date.UTC(parseInt(pI[0], 10), parseInt(pI[1], 10) - 1, parseInt(pI[2], 10));
            timeF = Date.UTC(parseInt(pF[0], 10), parseInt(pF[1], 10) - 1, parseInt(pF[2], 10));
          } else {
            timeI = Date.UTC(parseInt(pI[2], 10), parseInt(pI[1], 10) - 1, parseInt(pI[0], 10));
            timeF = Date.UTC(parseInt(pF[2], 10), parseInt(pF[1], 10) - 1, parseInt(pF[0], 10));
          }
          
          const diff = timeF - timeI;
          return Math.max(Math.round(diff / (1000 * 60 * 60 * 24)), 1);
        };

        for (let i = startIdx + 1; i < lines.length; i++) {
          const linha = lines[i].trim();
          if (!linha) continue;

          const colunas = parseLineCSV(linha, separadorDefinido);
          if (!colunas[idxCedente] || colunas[idxCedente].includes("NOME_DO_CEDENTE") || !colunas[idxNominal]) continue;

          const valorNominal = limparNumero(colunas[idxNominal]);
          const precoAquisicao = limparNumero(colunas[idxPrecoAquisicao]);

          if (valorNominal <= 0 || precoAquisicao <= 0) continue;
          
          const prazoCorridoD3 = obterPrazoCorridoAbsoluto(colunas[idxAquisicao], colunas[idxVencimento]);
          const fRentabilidade = 1 + (valorNominal - precoAquisicao) / precoAquisicao;
          const taxaFinalCalculadaC3 = Math.pow(fRentabilidade, 30 / prazoCorridoD3) - 1;

          const colunaPrazoMassaA3 = prazoCorridoD3 * valorNominal;
          const colunaTaxaMassaB3 = taxaFinalCalculadaC3 * valorNominal;

          payloadParaInsercao.push({
            cedente: colunas[idxCedente].toUpperCase().trim(),
            sacado: colunas[idxSacado] || "SACADO NÃO IDENTIFICADO",
            documento: colunas[idxDoc] || "-",
            vencimento: colunas[idxVencimento] || "-",
            valor_nominal: valorNominal,
            preco_aquisicao: precoAquisicao,
            prazo_dias: prazoCorridoD3,
            coluna_prazo_massa: colunaPrazoMassaA3,
            coluna_taxa_massa: colunaTaxaMassaB3,
            taxa_final_calculada: taxaFinalCalculadaC3
          });
        }

        setStatusStatusTexto(`Injetando carga unificada de ${payloadParaInsercao.length} registros no banco...`);
        
        // Inserção em lotes de 500 para não estourar payload do Supabase
        const chunk = 500;
        for (let i = 0; i < payloadParaInsercao.length; i += chunk) {
          const { error: insertError } = await supabase.from("estoque_fidc").insert(payloadParaInsercao.slice(i, i + chunk));
          if (insertError) throw insertError;
        }

        alert(`🏁 Concluído com sucesso! ${payloadParaInsercao.length} registros sincronizados.`);
        await buscarEstoqueDoBanco();
      };
      reader.readAsText(file, "UTF-8");
    } catch (err: any) {
      alert(`❌ Falha operacional: ${err.message}`);
      setCarregando(false);
    }
  };

  // 📈 BLOCOS DE CARD E AGREGAÇÃO DA CARTEIRA TOTAL
  const totaisGerais = useMemo(() => {
    if (titulos.length === 0) return { nominal: 0, taxaMed: 0, prazoMed: 0 };
    const nominalTotal = titulos.reduce((acc, curr) => acc + curr.valorNominal, 0);
    const somaMassaTaxa = titulos.reduce((acc, curr) => acc + curr.colunaTaxaMassa, 0);
    const somaMassaPrazo = titulos.reduce((acc, curr) => acc + curr.colunaPrazoMassa, 0);

    return {
      nominal: nominalTotal,
      taxaMed: nominalTotal > 0 ? (somaMassaTaxa / nominalTotal) * 100 : 0,
      prazoMed: nominalTotal > 0 ? (somaMassaPrazo / nominalTotal) : 0
    };
  }, [titulos]);

  const carteiraCedentes = useMemo(() => {
    const mapa: Record<string, TituloEstoque[]> = {};
    titulos.forEach(t => {
      if (!mapa[t.cedente]) mapa[t.cedente] = [];
      mapa[t.cedente].push(t);
    });

    return Object.keys(mapa).map(nomeCedente => {
      const lista = mapa[nomeCedente];
      const valorNominalTotal = lista.reduce((acc, curr) => acc + curr.valorNominal, 0);
      
      const { somaMassaTaxa, somaMassaPrazo } = lista.reduce((acumulador, item) => {
        acumulador.somaMassaTaxa += item.colunaTaxaMassa;
        acumulador.somaMassaPrazo += item.colunaPrazoMassa;
        return acumulador;
      }, { somaMassaTaxa: 0, somaMassaPrazo: 0 });

      return {
        cedente: nomeCedente,
        valorNominalTotal,
        taxaMediaPonderada: valorNominalTotal > 0 ? (somaMassaTaxa / valorNominalTotal) * 100 : 0,
        prazoMedioPonderado: valorNominalTotal > 0 ? (somaMassaPrazo / valorNominalTotal) : 0,
        titulos: lista
      };
    });
  }, [titulos]);

  // 🔍 FILTRO E SISTEMA DE ORDENAÇÃO DINÂMICA
  const filtradosEDecorados = useMemo(() => {
    const filtrados = carteiraCedentes.filter(c => 
      c.cedente.toLowerCase().includes(busca.toLowerCase())
    );

    return filtrados.sort((a, b) => {
      if (ordenacao === "nominal_desc") return b.valorNominalTotal - a.valorNominalTotal;
      if (ordenacao === "nominal_asc") return a.valorNominalTotal - b.valorNominalTotal;
      if (ordenacao === "taxa_desc") return b.taxaMediaPonderada - a.taxaMediaPonderada;
      if (ordenacao === "taxa_asc") return a.taxaMediaPonderada - b.taxaMediaPonderada;
      if (ordenacao === "prazo_desc") return b.prazoMedioPonderado - a.prazoMedioPonderado;
      if (ordenacao === "prazo_asc") return a.prazoMedioPonderado - b.prazoMedioPonderado;
      return 0;
    });
  }, [carteiraCedentes, busca, ordenacao]);

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">💼 Auditoria Gerencial de Estoque</h2>
          <span className="text-xs text-slate-500 font-medium">Consolidação de Massa Ponderada Absoluta com base no Valor Nominal.</span>
        </div>
        <label className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-md uppercase tracking-wider text-xs disabled:opacity-50">
          📥 Carregar Base Oficial (.CSV)
          <input type="file" accept=".csv" onChange={handleImportarEstoqueDestrutivo} className="hidden" disabled={carregando} />
        </label>
      </div>

      {/* 📊 CARDS DE RESUMO OPERACIONAL (MESA DE CESSÃO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border-l-4 border-l-slate-800 border-y border-r border-slate-200 p-6 rounded-xl shadow-xs">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">Estoque Nominal Total</span>
          <div className="text-3xl font-mono font-black text-slate-900 truncate" title={formatarMoeda(totaisGerais.nominal)}>
            {formatarMoeda(totaisGerais.nominal)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-semibold">Soma absoluta de ativos integrados</p>
        </div>

        <div className="bg-white border-l-4 border-l-emerald-500 border-y border-r border-slate-200 p-6 rounded-xl shadow-xs">
          <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Taxa Média Ponderada</span>
          <div className="text-3xl font-mono font-black text-emerald-700 truncate">
            {totaisGerais.taxaMed.toFixed(4)}% <span className="text-base font-sans font-bold text-slate-400">a.m.</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-semibold">Massa de taxa ÷ Peso Nominal</p>
        </div>

        <div className="bg-white border-l-4 border-l-blue-600 border-y border-r border-slate-200 p-6 rounded-xl shadow-xs">
          <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider block mb-1">Prazo Médio Global</span>
          <div className="text-3xl font-mono font-black text-blue-800 truncate">
            {totaisGerais.prazoMed.toFixed(2)} <span className="text-base font-sans font-bold text-slate-400">dias</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-semibold">Prazo real decorrido no estoque</p>
        </div>
      </div>

      {/* LOADING */}
      {carregando && (
        <div className="p-8 font-bold text-center text-xs uppercase tracking-widest bg-slate-50 text-slate-500 rounded-xl border border-slate-200 animate-pulse shadow-inner">
          ⏳ {statusTexto || "Processando Matriz Dinâmica..."}
        </div>
      )}

      {/* 🔍 FILTROS E CONTRÔLES DE ORDENAÇÃO */}
      {!carregando && titulos.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔎</span>
            <input 
              type="text" 
              placeholder="Buscar por nome do cedente homologado..." 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)} 
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none font-bold text-xs text-slate-800 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" 
            />
          </div>
          <div className="w-full md:w-auto flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Ordenar por:</span>
            <select 
              value={ordenacao} 
              onChange={(e) => setOrdenacao(e.target.value)}
              className="p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 outline-none cursor-pointer text-xs focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            >
              <option value="nominal_desc">Maior Valor Nominal</option>
              <option value="nominal_asc">Menor Valor Nominal</option>
              <option value="taxa_desc">Maior Taxa Média</option>
              <option value="taxa_asc">Menor Taxa Média</option>
              <option value="prazo_desc">Maior Prazo Médio</option>
              <option value="prazo_asc">Menor Prazo Médio</option>
            </select>
          </div>
        </div>
      )}

      {/* LISTA GERENCIAL DE CEDENTES */}
      {!carregando && (
        <div className="space-y-3">
          {filtradosEDecorados.length === 0 ? (
            <div className="p-16 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-bold bg-white">
              Nenhum dado ativo no painel. Insira a base crua diária para consolidar as ponderações.
            </div>
          ) : (
            filtradosEDecorados.map((item) => {
              const isExpandido = cedenteExpandido === item.cedente;

              return (
                <div key={item.cedente} className={`bg-white border transition-all rounded-xl overflow-hidden ${isExpandido ? "border-blue-300 ring-4 ring-blue-50 shadow-md" : "border-slate-200 hover:border-blue-200 hover:shadow-md shadow-xs"}`}>
                  
                  {/* HEADER DO ACORDEÃO */}
                  <div onClick={() => setCedenteExpandido(isExpandido ? null : item.cedente)} className={`p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 cursor-pointer select-none transition-colors ${isExpandido ? "bg-blue-50/30" : "hover:bg-slate-50/50"}`}>
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Cedente Parceiro</span>
                      <h3 className="font-black text-slate-900 text-sm tracking-tight uppercase truncate" title={item.cedente}>{item.cedente}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 xl:gap-8 text-left xl:text-right w-full xl:w-auto justify-between xl:justify-end">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-black uppercase tracking-wider">Valor Nominal</span>
                        <span className="font-mono font-black text-slate-900 text-base">{formatarMoeda(item.valorNominalTotal)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 block font-black uppercase tracking-wider">Taxa Média</span>
                        <span className="font-mono font-black text-emerald-700 text-base">{item.taxaMediaPonderada.toFixed(3)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-700 block font-black uppercase tracking-wider">Prazo Médio</span>
                        <span className="font-mono font-black text-blue-800 text-base">{item.prazoMedioPonderado.toFixed(1)} <span className="text-xs font-sans">dias</span></span>
                      </div>
                      <div className={`text-slate-400 font-black text-lg transition-transform duration-300 ${isExpandido ? "rotate-180 text-blue-600" : ""}`}>
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* TABELA DE TÍTULOS (EXPANDIDA) */}
                  {isExpandido && (
                    <div className="border-t border-blue-100 bg-slate-50 p-5">
                      <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-inner">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                              <th className="p-3 w-64">Sacado</th>
                              <th className="p-3 text-center w-32">Nº Documento</th>
                              <th className="p-3 text-center w-32">Vencimento</th>
                              <th className="p-3 text-center w-32">Prazo Corrido (D3)</th>
                              <th className="p-3 text-right w-40">Valor Nominal (Y3)</th>
                              <th className="p-3 text-right w-40">Taxa Individual (C3)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                            {item.titulos.map((t, idx) => (
                              <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                <td className="p-3 font-bold text-slate-900 truncate max-w-[250px]" title={t.sacado}>{t.sacado}</td>
                                <td className="p-3 text-center font-mono text-[11px] text-slate-500">{t.documento}</td>
                                <td className="p-3 text-center text-slate-500 text-xs">{t.vencimento}</td>
                                <td className="p-3 text-center font-mono text-blue-700 font-bold bg-blue-50/30 border-x border-slate-50">{t.prazoDias} dias</td>
                                <td className="p-3 text-right font-mono text-slate-900 font-bold">{formatarMoeda(t.valorNominal)}</td>
                                <td className="p-3 text-right font-mono text-emerald-600 font-black bg-emerald-50/30 border-l border-slate-50">{(t.taxaFinalCalculada * 100).toFixed(4)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}