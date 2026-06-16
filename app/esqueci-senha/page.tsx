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

      // 🎯 Fix: Envia o e-mail padronizado em caixa baixa para evitar desencontro de strings no banco
      const emailTratado = email.trim().toLowerCase();

      const res = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTratado }),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Erro na requisição da API");
      }

      setMensagem({ 
        tipo: "sucesso", 
        texto: "🎉 Se o e-mail estiver ativo no ecossistema, as instruções de renovação foram disparadas!" 
      });
      setEmail("");
    } catch (err: any) {
      console.error(err);
      setMensagem({ 
        tipo: "erro", 
        texto: err.message === "Erro na requisição da API" 
          ? "❌ Falha ao processar a recuperação de senha no servidor." 
          : `❌ Erro: ${err.message}` 
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-[13px] font-medium text-slate-700">
      <div className="w-full max-w-sm bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-900">Ned Capital</h2>
          <p className="text-slate-400 text-xs mt-1">Recuperação Cadastral de Acesso</p>
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
              className="p-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 font-medium" 
            />
          </div>
          <button 
            type="submit" 
            disabled={carregando} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg cursor-pointer transition-all disabled:opacity-50"
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