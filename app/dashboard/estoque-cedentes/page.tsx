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

  const buscarEstoqueDoBanco = async () => {
    try {
      setCarregando(true);
      setStatusStatusTexto("Buscando base consolidada do Supabase...");
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

    const confirmar = confirm("⚠️ ATENÇÃO: Deseja expurgar a base de estoque diária antiga e rodar o recálculo ponderado oficial?");
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
          
          const pI = strI.split("-");
          const pF = strF.split("-");
          
          if (pI.length < 3 || pF.length < 3) return 1;
          
          const timeI = Date.UTC(parseInt(pI[0], 10), parseInt(pI[1], 10) - 1, parseInt(pI[2], 10));
          const timeF = Date.UTC(parseInt(pF[0], 10), parseInt(pF[1], 10) - 1, parseInt(pF[2], 10));
          
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
          
          // 📊 [Coluna D] PRAZO = S3 - R3
          const prazoCorridoD3 = obterPrazoCorridoAbsoluto(colunas[idxAquisicao], colunas[idxVencimento]);
          
          // 📈 [Coluna C] TAXA FINAL = ((1 + (Y3 - W3) / W3) ^ (30 / D3)) - 1
          const fRentabilidade = 1 + (valorNominal - precoAquisicao) / precoAquisicao;
          const taxaFinalCalculadaC3 = Math.pow(fRentabilidade, 30 / prazoCorridoD3) - 1;

          // 📐 [Coluna A] PRAZO MASSA = D3 * Y3
          const colunaPrazoMassaA3 = prazoCorridoD3 * valorNominal;

          // 📉 [Coluna B] TAXA MASSA = C3 * Y3
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

        setStatusStatusTexto(`Subindo lote atômico de ${payloadParaInsercao.length} títulos...`);
        const { error: insertError } = await supabase.from("estoque_fidc").insert(payloadParaInsercao);
        if (insertError) throw insertError;

        alert(`🏁 Sucesso! Carteira importada sob metodologia de Massa Ponderada: ${payloadParaInsercao.length} registros ativos.`);
        await buscarEstoqueDoBanco();
      };
      reader.readAsText(file, "UTF-8");
    } catch (err: any) {
      alert(`❌ Falha operacional: ${err.message}`);
      setCarregando(false);
    }
  };

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
    }).sort((a, b) => b.valorNominalTotal - a.valorNominalTotal);
  }, [titulos]);

  const filtrados = useMemo(() => {
    return carteiraCedentes.filter(c => c.cedente.toLowerCase().includes(busca.toLowerCase()));
  }, [carteiraCedentes, busca]);

  const formatarMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700 p-4">
      
      <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">💼 Auditoria Gerencial de Estoque FIDC</h2>
          <p className="text-xs text-slate-400">Consolidação matemática por Massa Ponderada Absoluta com base no Valor Nominal.</p>
        </div>
        <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-xs uppercase tracking-wider text-[10px]">
          📥 CARREGAR BASE OFICIAL (.CSV)
          <input type="file" accept=".csv" onChange={handleImportarEstoqueDestrutivo} className="hidden" disabled={carregando} />
        </label>
      </div>

      {carregando && (
        <div className="p-6 font-bold text-center bg-amber-50 text-amber-800 rounded-xl border border-amber-200 animate-pulse">
          ⏳ {statusTexto || "Calculando Matriz Ponderada..."}
        </div>
      )}

      {titulos.length > 0 && (
        <div className="bg-white p-2 border border-slate-200 rounded-xl shadow-xs">
          <input type="text" placeholder="🔍 Buscar carteira de cedente homologado..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none font-medium text-slate-800" />
        </div>
      )}

      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="p-12 border border-dashed border-slate-300 rounded-xl text-center text-slate-400 font-medium bg-white">
            Nenhum dado ativo no painel. Insira a base crua diária para consolidar as ponderações.
          </div>
        ) : (
          filtrados.map((item) => {
            const isExpandido = cedenteExpandido === item.cedente;

            return (
              <div key={item.cedente} className={`bg-white border transition-all rounded-xl shadow-2xs overflow-hidden ${isExpandido ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200 hover:border-slate-300"}`}>
                
                <div onClick={() => setCedenteExpandido(isExpandido ? null : item.cedente)} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer bg-gradient-to-r from-white to-slate-50/20 select-none">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Cedente Parceiro</span>
                    <h3 className="font-black text-slate-900 text-[13px] tracking-tight">{item.cedente}</h3>
                  </div>

                  <div className="flex items-center gap-8 text-right self-stretch sm:self-auto justify-between sm:justify-end">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">VALOR NOMINAL TOTAL</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{formatarMoeda(item.valorNominalTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-bold uppercase">TAXA MÉDIA POND.</span>
                      <span className="font-mono font-black text-emerald-600">{item.taxaMediaPonderada.toFixed(6)}% a.m.</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-bold uppercase">PRAZO MÉDIO POND.</span>
                      <span className="font-mono font-black text-blue-900">{item.prazoMedioPonderado.toFixed(6)} dias</span>
                    </div>
                    <div className="text-slate-400 font-bold px-1">{isExpandido ? "▲" : "▼"}</div>
                  </div>
                </div>

                {isExpandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                            <th className="p-2">Sacado</th>
                            <th className="p-2 text-center">Nº Documento</th>
                            <th className="p-2 text-center">Vencimento</th>
                            <th className="p-2 text-center">Prazo Corrido (D3)</th>
                            <th className="p-2 text-right">Valor Nominal (Y3)</th>
                            <th className="p-2 text-right">Taxa Individual (C3)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                          {item.titulos.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2 font-bold text-slate-900 truncate max-w-[280px]">{t.sacado}</td>
                              <td className="p-2 text-center font-mono text-slate-400">{t.documento}</td>
                              <td className="p-2 text-center text-slate-500">{t.vencimento}</td>
                              <td className="p-2 text-center font-mono text-blue-900 font-bold">{t.prazoDias} dias</td>
                              <td className="p-2 text-right font-mono text-slate-900">{formatarMoeda(t.valorNominal)}</td>
                              <td className="p-2 text-right font-mono text-emerald-600 font-bold">{(t.taxaFinalCalculada * 100).toFixed(6)}%</td>
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