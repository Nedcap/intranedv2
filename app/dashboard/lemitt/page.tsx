"use client";

import Link from "next/link";

export default function LemittPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 px-4">
      <div className="text-7xl animate-pulse">🚧</div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
          Módulo em Construção
        </h1>
        <p className="text-slate-500 font-medium max-w-lg mx-auto text-sm">
          A aba <b>Lemitt</b> ainda está na prancheta de desenvolvimento. Estamos trabalhando para trazer essa funcionalidade em breve!
        </p>
      </div>

      <Link 
        href="/dashboard" 
        className="px-6 py-2.5 mt-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase cursor-pointer shadow-md transition-all inline-flex items-center gap-2"
      >
        ⬅️ Voltar para o Início
      </Link>
    </div>
  );
}