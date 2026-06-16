/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // Se o usuário já tiver sessão ativa, joga direto para o painel principal
    const logado = localStorage.getItem("intraned_user");
    if (logado) router.push("/dashboard");
  }, [router]);

  const tratarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) return;

    try {
      setCarregando(true);
      const emailTratado = email.trim().toLowerCase();

      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", emailTratado)
        .eq("senha", senha.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert("❌ Acesso negado. Verifique os dados inseridos.");
        return;
      }

      // Cria a sessão local com as permissões de rota ativas
      localStorage.setItem("intraned_user", JSON.stringify({
        id: data.id,
        nome: data.nome,
        email: data.email,
        cargo: data.cargo,
        permissoes: data.permissoes || []
      }));

      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(`Erro no servidor: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-[13px]">
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-xl space-y-6">
        
        {/* 🎯 CABEÇALHO DO CARD COM TEXTO CENTRALIZADO E LOGO FLUTUANDO À ESQUERDA */}
        <div className="flex flex-col items-center relative select-none">
          <div className="relative w-full flex justify-center items-center h-8">
            <img 
              src="/favicon.ico" 
              alt="Ned Capital" 
              className="absolute left-12 h-8 w-auto object-contain shrink-0" 
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              Intra<span className="text-blue-500">Ned</span>
            </h1>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2 text-center w-full">
            Controle & Gestão
          </p>
        </div>

        {/* FORMULÁRIO DE LOGIN */}
        <form onSubmit={tratarLogin} className="space-y-4 pt-2">
          <div className="flex flex-col space-y-1">
            <label className="font-bold text-slate-700">E-mail:</label>
            <input 
              type="email" 
              required
              placeholder="seu.nome@nedcapital.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-2.5 border border-slate-200 bg-blue-50/30 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="font-bold text-slate-700">Senha:</label>
            <input 
              type="password" 
              required
              placeholder="••••••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="p-2.5 border border-slate-200 bg-blue-50/30 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800"
            />
          </div>

          <button 
            type="submit"
            disabled={carregando}
            className="w-full p-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg transition-colors cursor-pointer uppercase tracking-wider text-xs shadow-md disabled:opacity-50"
          >
            {carregando ? "Autenticando..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="text-center pt-2">
          <button 
            type="button"
            onClick={() => alert("Entre em contato com o administrador do sistema para redefinir suas credenciais.")}
            className="text-blue-600 hover:underline font-bold text-xs cursor-pointer bg-transparent border-0"
          >
            Esqueceu sua senha? Recuperar acesso
          </button>
        </div>

      </div>
    </div>
  );
}