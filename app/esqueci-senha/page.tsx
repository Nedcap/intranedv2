/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });

  const processarRecuperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setCarregando(true);
      setMensagem({ tipo: "", texto: "" });

      const emailTratado = email.trim().toLowerCase();

      const res = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTratado }),
      });

      const data = await res.json();

      // 🎯 Fix: Alinhado com a resposta real da API route ({ enviado: true }) evitando o falso erro do .success
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erro na requisição da API");
      }

      setMensagem({ 
        tipo: "sucesso", 
        texto: "🎉 Se o e-mail informado estiver ativo no ecossistema, as instruções de redefinição foram disparadas!" 
      });
      setEmail("");
    } catch (err: any) {
      console.error(err);
      setMensagem({ 
        tipo: "erro", 
        texto: `❌ Erro ao processar: ${err.message || "Falha de comunicação com o servidor."}` 
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 flex-col p-4 font-sans text-[13px] font-medium text-slate-700">
      <div className="w-full max-w-sm bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-4">
        
        {/* 🎯 LOGO DA NED INTEGRADINHA E CENTRALIZADA IGUAL AO CARD DE LOGIN PRINCIPAL */}
        <div className="flex flex-col items-center select-none text-center">
          <div className="relative w-fit mx-auto flex items-center h-8 pl-1">
            <img 
              src="/favicon.ico" 
              alt="Ned Capital" 
              className="absolute -left-7 h-7 w-auto object-contain shrink-0" 
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              Intra<span className="text-blue-500">Ned</span>
            </h1>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2.5 w-full">
            Controle & Gestão
          </p>
        </div>

        {mensagem.texto && (
          <div className={`p-3 rounded-lg border text-xs font-bold ${mensagem.tipo === "sucesso" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={processarRecuperacao} className="space-y-3">
          <div className="flex flex-col space-y-1">
            <label className="font-bold text-xs text-slate-500">E-mail Corporativo</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="exemplo@nedcapital.com.br" 
              className="p-2.5 border border-slate-200 bg-blue-50/30 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800" 
            />
          </div>
          <button 
            type="submit" 
            disabled={carregando} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold p-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50 text-xs uppercase tracking-wider"
          >
            {carregando ? "ENVIANDO INSTRUÇÕES..." : "🔐 Solicitar Nova Senha"}
          </button>
        </form>
        
        <div className="text-center pt-2">
          <a href="/" className="text-blue-600 hover:underline text-xs font-bold transition-all">Voltar para o Login</a>
        </div>
      </div>
    </div>
  );
}