"use client";

import Link from "next/link";

export default function ReceitasUnderConstructionPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md shadow-md space-y-4">
        <span className="text-4xl block animate-bounce">🚧</span>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
          Módulo em Desenvolvimento
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          As rotas analíticas de VOP e Rentabilidade macro já foram centralizadas e automatizadas nos fluxos principais de Operações. Este módulo complementar de conciliação avulsa está sendo reestruturado para auditoria.
        </p>
        <div className="pt-2">
          <Link 
            href="/dashboard/importacao" 
            className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
          >
            Voltar para a Central ➔
          </Link>
        </div>
      </div>
    </div>
  );
}