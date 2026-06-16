/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";

interface TituloEstoque {
  id: string;
  cedente: string;
  sacado: string;
  documento: string;
  vencimento: string;
  valorNominal: number;
  precoAquisicao: number;
  prazoDias: number;
  // Colunas calculadas em tempo real
  colunaPrazoMassa: number;
  colunaTaxaMassa: number;
  taxaFinalCalculada: number;
}

interface AgrupamentoCedente {
  cedente: string;
  valorNominalTotal: number;
  taxaMediaPonderada: number;
  prazoMedioPonderado: number;
  titulos: TituloEstoque[];
}

export default function AnaliseEstoqueCedentesPage() {
  const [titulos, setTitulos] = useState<TituloEstoque[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [cedenteExpandido, setCedenteExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const handleImportarEstoque = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCarregando(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/);
        let startIdx = 0;

        // Pula o delimitador sep= se houver
        if (lines[0] && lines[0].includes("sep=")) startIdx = 1;
        // Pula linhas vazias até achar o cabeçalho real
        while (startIdx < lines.length && !lines[startIdx].trim()) startIdx++;

        const parseLineCSV = (linhaTexto: string) => {
          const colunas = [];
          let dentroDeAspas = false;
          let celulaAcumulada = "";
          for (let i = 0; i < linhaTexto.length; i++) {
            const char = linhaTexto[i];
            if (char === '"') dentroDeAspas = !insideQuote = !dentroDeAspas;
            else if (char === ',' && !dentroDeAspas) {
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

        // Localiza as colunas chaves da planilha do fundo
        const idxCedente = headers.indexOf("NOME_DO_CEDENTE");
        const idxSacado = headers.indexOf("NOME_DO_SACADO");
        const idxDoc = headers.indexOf("NUMERO_DOCUMENTO");
        const idxVencimento = headers.indexOf("DATA_DE_VENCIMENTO_AJUSTADA");
        const idxNominal = headers.indexOf("VALOR_NOMINAL");
        const idxPrecoAquisicao = headers.indexOf("PRECO_DE_AQUISICAO");
        const idxPrazoNativo = headers.indexOf("PRAZO_ATUAL"); // Dias corridos restantes

        const listaTitulos: TituloEstoque[] = [];

        for (let i = startIdx + 1; i < lines.length; i++) {
          const linha = lines[i].trim();
          if (!linha) continue;

          const colunas = parseLineCSV(linha);
          if (!colunas[idxCedente] || !colunas[idxNominal]) continue;

          const valorNominal = parseFloat(colunas[idxNominal]) || 0;
          const precoAquisicao = parseFloat(colunas[idxPrecoAquisicao]) || valorNominal;
          // Se o prazo vier zerado ou quebrado, garante o mínimo de 1 dia para não dividir por zero
          const prazoDias = Math.max(parseInt(colunas[idxPrazoNativo]) || 1, 1);

          // 🛠️ MOTOR DE CÁLCULO DAS 4 COLUNAS EXCEL (INLINE)
          // Coluna C: Taxa Final
          const taxaFinalCalculada = Math.pow(1 + (valorNominal - precoAquisicao) / (precoAquisicao || 1), 30 / prazoDias) - 1;
          // Coluna A: Prazo * Valor Nominal
          const colunaPrazoMassa = prazoDias * valorNominal;
          // Coluna B: Taxa * Valor Nominal
          const colunaTaxaMassa = taxaFinalCalculada * valorNominal;

          listaTitulos.push({
            id: `t-${i}-${Date.now()}`,
            cedente: colunas[idxCedente].toUpperCase(),
            sacado: colunas[idxSacado] || "SACADO NÃO IDENTIFICADO",
            documento: colunas[idxDoc] || "-",
            vencimento: colunas[idxVencimento] || "-",
            valorNominal,
            precoAquisicao,
            prazoDias,
            colunaPrazoMassa,
            colunaTaxaMassa,
            taxaFinalCalculada
          });
        }

        setTitulos(listaTitulos);
        alert(`🎯 Sucesso! ${listaTitulos.length} títulos processados e recalculados.`);
      } catch (err) {
        console.error(err);
        alert("❌ Erro ao converter o estoque do FIDC.");
      } finally {
        setCarregando(false);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // 📈 COMPILADOR DA DINÂMICA EM TEMPO REAL (MEMORIZADO CONTRA TRAVAMENTOS)
  const carteiraCedentes = useMemo(() => {
    const mapa: Record<string, TituloEstoque[]> = {};
    
    titulos.forEach(t => {
      if (!mapa[t.cedente]) mapa[t.cedente] = [];
      mapa[t.cedente].push(t);
    });

    return Object.keys(mapa).map(nomeCedente => {
      const lista = mapa[nomeCedente];
      const valorNominalTotal = lista.reduce((acc, curr) => acc + curr.valorNominal, 0);
      const somaMassaTaxa = lista.reduce((acc, curr) => acc + curr.colunaTaxaMassa, 0);
      const somaMassaPrazo = lista.reduce((acc, curr) => acc + curr.colunaPrazoMassa, 0);

      return {
        cedente: nomeCedente,
        valorNominalTotal,
        taxaMediaPonderada: valorNominalTotal > 0 ? (somaMassaTaxa / valorNominalTotal) * 100 : 0,
        prazoMedioPonderado: valorNominalTotal > 0 ? (somaMassaPrazo / valorNominalTotal) : 0,
        titulos: lista
      };
    }).sort((a, b) => b.valorNominalTotal - a.valorNominalTotal); // Maiores carteiras no topo
  }, [titulos]);

  const filtrados = useMemo(() => {
    return carteiraCedentes.filter(c => c.cedente.toLowerCase().includes(busca.toLowerCase()));
  }, [carteiraCedentes, busca]);

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700">
      
      {/* HEADER */}
      <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">💼 Visão Geral do Estoque por Cedente</h2>
          <p className="text-xs text-slate-400">Inserção e recálculo automático das massas de taxa e prazo médio ponderado do fundo.</p>
        </div>
        <label className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-xs">
          📊 Soltar Estoque Diário (.CSV)
          <input type="file" accept=".csv" onChange={handleImportarEstoque} className="hidden" />
        </label>
      </div>

      {carregando && <div className="p-6 font-bold text-center bg-blue-50 text-blue-700 rounded-xl border border-blue-100">⏳ Calculando matriz de risco e agregando cedentes...</div>}

      {titulos.length > 0 && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <input type="text" placeholder="🔍 Digite para buscar um Cedente específico..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-medium" />
        </div>
      )}

      {/* RENDERIZADOR DOS CARDS DINÂMICOS */}
      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="p-12 border border-dashed border-slate-300 rounded-xl text-center text-slate-400 font-medium bg-white">
            Nenhum estoque carregado no momento. Insira o arquivo diário para gerar a tabela dinâmica.
          </div>
        ) : (
          filtrados.map((item) => {
            const isExpandido = cedenteExpandido === item.cedente;

            return (
              <div key={item.cedente} className={`bg-white border transition-all rounded-xl shadow-2xs overflow-hidden ${isExpandido ? "border-blue-500 ring-1 ring-blue-500/20" : "border-slate-200 hover:border-slate-300"}`}>
                
                {/* LINHA RESUMO (SOMA DA DINÂMICA) */}
                <div onClick={() => setCedenteExpandido(isExpandido ? null : item.cedente)} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none bg-gradient-to-r from-white to-slate-50/30">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-black tracking-wider text-blue-600">Cedente Parceiro</span>
                    <h3 className="font-black text-slate-900 text-[13px] tracking-tight">{item.cedente}</h3>
                  </div>

                  <div className="flex items-center gap-8 text-right self-stretch sm:self-auto justify-between sm:justify-end">
                    <div className="px-2">
                      <span className="text-[9px] uppercase text-slate-400 block font-bold">Valor Nominal</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{formatarMoeda(item.valorNominalTotal)}</span>
                    </div>
                    <div className="px-2">
                      <span className="text-[9px] uppercase text-slate-400 block font-bold">Taxa Média P.M.</span>
                      <span className="font-mono font-black text-emerald-600">{item.taxaMediaPonderada.toFixed(2)}% a.m.</span>
                    </div>
                    <div className="px-2">
                      <span className="text-[9px] uppercase text-slate-400 block font-bold">Prazo Médio</span>
                      <span className="font-mono font-black text-blue-900">{Math.round(item.prazoMedioPonderado)} dias</span>
                    </div>
                    <div className="text-slate-400 font-bold px-2">{isExpandido ? "▲" : "▼"}</div>
                  </div>
                </div>

                {/* 🔍 COMPONENTE EXPANDIDO (DETALHADO POR TÍTULO E SACADO) */}
                {isExpandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-fadeIn">
                    <div className="mb-2 flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">📦 Composição da Carteira ({item.titulos.length} Títulos Ativos)</span>
                    </div>
                    
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[10px] font-black uppercase border-b border-slate-900">
                            <th className="p-2">Sacado / Sacado Devedor</th>
                            <th className="p-2 text-center">Nº Documento</th>
                            <th className="p-2 text-center">Vencimento</th>
                            <th className="p-2 text-center">Prazo (Dias)</th>
                            <th className="p-2 text-right">Valor Nominal</th>
                            <th className="p-2 text-right">Preço Aquisição</th>
                            <th className="p-2 text-right">Taxa Final (Calc)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                          {item.titulos.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-2 font-bold text-slate-900 truncate max-w-[300px]">{t.sacado}</td>
                              <td className="p-2 text-center font-mono text-slate-500">{t.documento}</td>
                              <td className="p-2 text-center text-slate-500">{t.vencimento}</td>
                              <td className="p-2 text-center font-mono text-blue-900 font-bold">{t.prazoDias} d</td>
                              <td className="p-2 text-right font-mono text-slate-900">{formatarMoeda(t.valorNominal)}</td>
                              <td className="p-2 text-right font-mono text-slate-500">{formatarMoeda(t.precoAquisicao)}</td>
                              <td className="p-2 text-right font-mono text-emerald-600 font-bold">{(t.taxaFinalCalculada * 100).toFixed(2)}%</td>
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

    </div>
  );
}