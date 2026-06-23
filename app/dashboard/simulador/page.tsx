"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

export default function SimuladorTaxasPage() {
  // Estados para armazenar os inputs do usuário (iniciados com os dados da sua planilha de exemplo)
  const [redesconto, setRedesconto] = useState({
    pm: 16.87,
    bruto: 154493.11,
    juros: 2835.03,
    tarifas: 505.60,
    outros: 0
  });

  const [ned, setNed] = useState({
    pm: 45,
    bruto: 154493.11,
    juros: 2187.49,
    tarifas: 264.50,
    outros: 0
  });

  // Função para lidar com a digitação nos inputs
  const handleChange = (lado: "redesconto" | "ned", campo: string, valor: string) => {
    const num = parseFloat(valor) || 0;
    if (lado === "redesconto") {
      setRedesconto(prev => ({ ...prev, [campo]: num }));
    } else {
      setNed(prev => ({ ...prev, [campo]: num }));
    }
  };

  // Motor de Cálculos (Fórmulas exatas extraídas do seu Excel)
  const calcularResultados = (dados: typeof redesconto) => {
    const subtotal = dados.bruto - dados.juros;
    const liquido = subtotal - dados.tarifas - dados.outros;

    // Fórmulas de juros compostos mensalizados
    const taxa = dados.pm > 0 && subtotal > 0 ? Math.pow(dados.bruto / subtotal, 30 / dados.pm) - 1 : 0;
    const taxaFinal = dados.pm > 0 && liquido > 0 ? Math.pow(dados.bruto / liquido, 30 / dados.pm) - 1 : 0;

    return { subtotal, liquido, taxa, taxaFinal };
  };

  const resRed = calcularResultados(redesconto);
  const resNed = calcularResultados(ned);

  // Utilitários de Formatação para a Tela
  const fM = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const fP = (val: number) => (val * 100).toFixed(4) + "%";
  const fNum = (val: number) => val.toFixed(2);

  // ==========================================================================
  // 📥 EXPORTAÇÃO IDÊNTICA AO SEU EXCEL
  // ==========================================================================
  const exportarParaExcel = () => {
    const dadosExcel = [
      ["", "Redesconto", "NED", "D (Diferença)"],
      ["PM", redesconto.pm, ned.pm, ned.pm - redesconto.pm],
      ["Valor Bruto", redesconto.bruto, ned.bruto, ned.bruto - redesconto.bruto],
      ["Juros", redesconto.juros, ned.juros, ned.juros - redesconto.juros],
      ["(Subtotal)", resRed.subtotal, resNed.subtotal, resNed.subtotal - resRed.subtotal],
      ["Tarifas", redesconto.tarifas, ned.tarifas, ned.tarifas - redesconto.tarifas],
      ["Outros custos", redesconto.outros, ned.outros, ned.outros - redesconto.outros],
      ["Liquido", resRed.liquido, resNed.liquido, resNed.liquido - resRed.liquido],
      ["Taxa", resRed.taxa, resNed.taxa, resNed.taxa - resRed.taxa],
      ["Taxa Final", resRed.taxaFinal, resNed.taxaFinal, resNed.taxaFinal - resRed.taxaFinal]
    ];

    const ws = XLSX.utils.aoa_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Simulação");
    XLSX.writeFile(wb, "Calculo_de_Taxa_Simulador.xlsx");
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 text-[13px] font-sans text-slate-800 pb-10">
      
      {/* HEADER DA TELA */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase">🧮 Simulador de Rentabilidade (Taxas)</h2>
          <span className="text-xs text-slate-500 font-medium">Compare os custos de Redesconto vs NED e apure o lucro líquido da operação.</span>
        </div>
        <button 
          onClick={exportarParaExcel} 
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg uppercase shadow-sm flex items-center gap-2 transition-colors"
        >
          📥 Exportar Excel
        </button>
      </div>

      {/* PAINEL DO SIMULADOR */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white font-black uppercase text-[11px] tracking-wider text-center">
              <th className="p-4 w-1/4 text-left rounded-tl-xl">Indicador</th>
              <th className="p-4 w-1/4">Redesconto (Custo)</th>
              <th className="p-4 w-1/4">NED (Receita)</th>
              <th className="p-4 w-1/4 rounded-tr-xl">Diferença (NED - Redesconto)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            
            {/* LINHA 1: PM */}
            <tr className="hover:bg-slate-50">
              <td className="p-3 font-bold text-slate-600 pl-5">Prazo Médio (PM)</td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={redesconto.pm} onChange={(e) => handleChange("redesconto", "pm", e.target.value)} className="w-full text-center border border-slate-300 p-1.5 rounded outline-none focus:border-blue-500 font-mono" /></td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={ned.pm} onChange={(e) => handleChange("ned", "pm", e.target.value)} className="w-full text-center border border-slate-300 p-1.5 rounded outline-none focus:border-blue-500 font-mono" /></td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fNum(ned.pm - redesconto.pm)} dias</td>
            </tr>

            {/* LINHA 2: VALOR BRUTO */}
            <tr className="hover:bg-slate-50">
              <td className="p-3 font-bold text-slate-600 pl-5">Valor Bruto</td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={redesconto.bruto} onChange={(e) => handleChange("redesconto", "bruto", e.target.value)} className="w-full text-center border border-slate-300 p-1.5 rounded outline-none focus:border-blue-500 font-mono text-blue-700 font-bold" /></td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={ned.bruto} onChange={(e) => handleChange("ned", "bruto", e.target.value)} className="w-full text-center border border-slate-300 p-1.5 rounded outline-none focus:border-blue-500 font-mono text-blue-700 font-bold" /></td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fM(ned.bruto - redesconto.bruto)}</td>
            </tr>

            {/* LINHA 3: JUROS */}
            <tr className="hover:bg-slate-50">
              <td className="p-3 font-bold text-rose-600 pl-5">Juros (-)</td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={redesconto.juros} onChange={(e) => handleChange("redesconto", "juros", e.target.value)} className="w-full text-center border border-rose-300 bg-rose-50 p-1.5 rounded outline-none focus:border-rose-500 font-mono text-rose-700" /></td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={ned.juros} onChange={(e) => handleChange("ned", "juros", e.target.value)} className="w-full text-center border border-rose-300 bg-rose-50 p-1.5 rounded outline-none focus:border-rose-500 font-mono text-rose-700" /></td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fM(ned.juros - redesconto.juros)}</td>
            </tr>

            {/* LINHA 4: SUBTOTAL */}
            <tr className="bg-slate-100">
              <td className="p-3 font-black text-slate-500 uppercase text-[10px] pl-5">Subtotal</td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fM(resRed.subtotal)}</td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fM(resNed.subtotal)}</td>
              <td className="p-3 text-center font-mono font-bold text-emerald-600">{fM(resNed.subtotal - resRed.subtotal)}</td>
            </tr>

            {/* LINHA 5: TARIFAS */}
            <tr className="hover:bg-slate-50">
              <td className="p-3 font-bold text-rose-600 pl-5">Tarifas (-)</td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={redesconto.tarifas} onChange={(e) => handleChange("redesconto", "tarifas", e.target.value)} className="w-full text-center border border-rose-300 bg-rose-50 p-1.5 rounded outline-none focus:border-rose-500 font-mono text-rose-700" /></td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={ned.tarifas} onChange={(e) => handleChange("ned", "tarifas", e.target.value)} className="w-full text-center border border-rose-300 bg-rose-50 p-1.5 rounded outline-none focus:border-rose-500 font-mono text-rose-700" /></td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fM(ned.tarifas - redesconto.tarifas)}</td>
            </tr>

            {/* LINHA 6: OUTROS CUSTOS */}
            <tr className="hover:bg-slate-50">
              <td className="p-3 font-bold text-rose-600 pl-5">Outros Custos (-)</td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={redesconto.outros} onChange={(e) => handleChange("redesconto", "outros", e.target.value)} className="w-full text-center border border-rose-300 bg-rose-50 p-1.5 rounded outline-none focus:border-rose-500 font-mono text-rose-700" /></td>
              <td className="p-3 text-center"><input type="number" step="0.01" value={ned.outros} onChange={(e) => handleChange("ned", "outros", e.target.value)} className="w-full text-center border border-rose-300 bg-rose-50 p-1.5 rounded outline-none focus:border-rose-500 font-mono text-rose-700" /></td>
              <td className="p-3 text-center font-mono font-bold text-slate-700">{fM(ned.outros - redesconto.outros)}</td>
            </tr>

            {/* LINHA 7: LÍQUIDO FINAL */}
            <tr className="bg-emerald-50 border-y-2 border-emerald-200">
              <td className="p-4 font-black text-emerald-800 uppercase tracking-wider pl-5">💰 Líquido Final</td>
              <td className="p-4 text-center font-mono font-black text-emerald-800 text-lg">{fM(resRed.liquido)}</td>
              <td className="p-4 text-center font-mono font-black text-emerald-800 text-lg">{fM(resNed.liquido)}</td>
              <td className="p-4 text-center font-mono font-black text-white bg-emerald-600 text-lg rounded-r">{fM(resNed.liquido - resRed.liquido)}</td>
            </tr>

            {/* LINHA 8: TAXA AO MÊS */}
            <tr className="hover:bg-slate-50">
              <td className="p-3 font-bold text-slate-600 pl-5">Taxa ao Mês (Só Juros)</td>
              <td className="p-3 text-center font-mono font-bold text-slate-600">{fP(resRed.taxa)}</td>
              <td className="p-3 text-center font-mono font-bold text-slate-600">{fP(resNed.taxa)}</td>
              <td className="p-3 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{fP(resNed.taxa - resRed.taxa)}</td>
            </tr>

            {/* LINHA 9: TAXA FINAL AO MÊS */}
            <tr className="hover:bg-slate-50">
              <td className="p-4 font-black text-slate-800 pl-5">Taxa Final a.m (Custo Total)</td>
              <td className="p-4 text-center font-mono font-black text-slate-800 text-base">{fP(resRed.taxaFinal)}</td>
              <td className="p-4 text-center font-mono font-black text-slate-800 text-base">{fP(resNed.taxaFinal)}</td>
              <td className="p-4 text-center font-mono font-black text-indigo-700 bg-indigo-50 text-base rounded-br-xl">{fP(resNed.taxaFinal - resRed.taxaFinal)}</td>
            </tr>

          </tbody>
        </table>
      </div>

    </div>
  );
}