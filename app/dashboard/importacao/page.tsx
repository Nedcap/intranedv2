"use client";

import Link from "next/link";

export default function ImportacaoHubPage() {
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10 p-6 font-sans text-slate-700">
      
      {/* HEADER DO HUB */}
      <div className="flex flex-col border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          📥 Central de Importações V2
        </h1>
        <span className="text-sm text-slate-500 font-medium mt-1">
          Selecione o módulo operacional. O sistema processa múltiplas camadas de dados por arquivo eliminando riscos de duplicidades.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ================================================================= */}
        {/* BLOCO 1: CARTEIRA ABERTA E RISCO (CONSOLIDADO) */}
        {/* ================================================================= */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shadow-md">1</span>
            <h3 className="font-black text-slate-800 uppercase tracking-wide text-sm">Carteiras e Limites de Risco</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/dashboard/importacao/carteira-risco-sec" className="group bg-white border border-slate-200 p-5 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-xs font-black text-blue-700 uppercase block mb-1">Securitizadora</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 font-mono">Qprof ➔ Cobrança Consolidada (.CSV)</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-600 mt-4 flex items-center gap-1">Carteira + Risco SEC ➔</span>
            </Link>

            {/* ROTA CORRIGIDA AQUI: de /carteirafidc para /carteira-risco-fidc */}
            <Link href="/dashboard/importacao/carteira-risco-fidc" className="group bg-white border border-slate-200 p-5 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-xs font-black text-blue-700 uppercase block mb-1">FIDC</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 font-mono">Black101 ➔ Lista de Recebíveis (.XLSX)</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-600 mt-4 flex items-center gap-1">Carteira + Risco FIDC ➔</span>
            </Link>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BLOCO 2: HISTÓRICO DE PRODUÇÃO (VOP REALIZADO) */}
        {/* ================================================================= */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shadow-md">2</span>
            <h3 className="font-black text-slate-800 uppercase tracking-wide text-sm">Volume Operado (VOP Realizado)</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/dashboard/importacao/operacoes-sec" className="group bg-white border border-slate-200 p-5 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-xs font-black text-indigo-700 uppercase block mb-1">Securitizadora</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 font-mono">Qprof ➔ Negócios por Data (.XLS)</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 mt-4 flex items-center gap-1">VOP + Rentabilidade SEC ➔</span>
            </Link>

            <Link href="/dashboard/importacao/operacoes-fidc" className="group bg-white border border-slate-200 p-5 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-xs font-black text-indigo-700 uppercase block mb-1">FIDC</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 font-mono">Black101 ➔ Lista de Operações (.XLSX)</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 mt-4 flex items-center gap-1">VOP + Rentabilidade FIDC ➔</span>
            </Link>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BLOCO 3: RECEITAS (MÓDULO FUTURO - UNDER CONSTRUCTION) */}
        {/* ================================================================= */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <span className="bg-emerald-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shadow-md">3</span>
            <h3 className="font-black text-slate-800 uppercase tracking-wide text-sm">Mapeamento Auxiliar de Receitas (Aditivos/Deságio Avulsos)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/importacao/receitas-sec" className="group bg-white border border-slate-200 border-dashed p-5 rounded-xl hover:border-amber-400 transition-all flex flex-col justify-between min-h-[120px]">
              <div>
                <span className="text-xs font-black text-slate-400 uppercase block mb-1">Auxiliar Receitas SEC</span>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-mono font-bold inline-block mt-1">⏳ EM CONSTRUÇÃO</span>
              </div>
              <span className="text-[11px] font-bold text-amber-600 mt-4 flex items-center gap-1">Trabalhar Módulo Posteriores ➔</span>
            </Link>

            <Link href="/dashboard/importacao/receitas-fidc" className="group bg-white border border-slate-200 border-dashed p-5 rounded-xl hover:border-amber-400 transition-all flex flex-col justify-between min-h-[120px]">
              <div>
                <span className="text-xs font-black text-slate-400 uppercase block mb-1">Auxiliar Receitas FIDC</span>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-mono font-bold inline-block mt-1">⏳ EM CONSTRUÇÃO</span>
              </div>
              <span className="text-[11px] font-bold text-amber-600 mt-4 flex items-center gap-1">Trabalhar Módulo Posteriores ➔</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}