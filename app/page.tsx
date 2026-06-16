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
  
  // Estados para gerenciar a janela de recuperação de senha real
  const [abrirAbasRecuperar, setAbrirAbasRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);

  useEffect(() => {
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
        .maybeSingle();

      if (error) throw error;

      const senhaBanco = data ? String(data.senha || data.senha_hash || "").trim() : "";
      const senhaDigitada = senha.trim();

      if (!data || senhaBanco !== senhaDigitada) {
        alert("❌ Acesso negado. Verifique os dados inseridos.");
        return;
      }

      localStorage.setItem("intraned_user", JSON.stringify({
        id: data.id,
        nome: data.nome,
        email: data.email,
        cargo: data.cargo || data.perfil || "Colaborador",
        perfil: data.perfil || data.cargo || "user",
        permissoes: data.permissoes || data.abas_permitidas || []
      }));

      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(`Erro no servidor: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const dispararRecuperacaoDeSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperar.trim()) return;

    try {
      setEnviandoRecuperacao(true);
      
      // Conecta diretamente na rota de API de recuperação interna que envia o Resend
      const res = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRecuperar.trim() }),
      });

      const resultado = await res.json();

      if (!res.ok) {
        throw new Error(resultado.error || "Falha ao processar solicitação");
      }

      alert("📧 Se o e-mail informado estiver cadastrado, as instruções de redefinição serão enviadas em instantes!");
      setAbrirAbasRecuperar(false);
      setEmailRecuperar("");
    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro no envio: ${err.message}. Garanta que as chaves de ambiente estão configuradas na Vercel.`);
    } finally {
      setEnviandoRecuperacao(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-[13px]">
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-xl space-y-6">
        
        {/* CABEÇALHO COM LOGO ALINHADA E TEXTO CENTRALIZADO */}
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

        {/* FORMULÁRIO DE LOGIN DE ACESSO */}
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
            onClick={() => setAbrirAbasRecuperar(true)}
            className="text-blue-600 hover:underline font-bold text-xs cursor-pointer bg-transparent border-0 outline-none"
          >
            Esqueceu sua senha? Recuperar acesso
          </button>
        </div>

      </div>

      {/* MODAL INTEGRADO DE RECUPERAÇÃO DE ACESSO REAL VIA RESEND API */}
      {abrirAbasRecuperar && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">🔒 Recuperar Acesso</h3>
              <button type="button" onClick={() => setAbrirAbasRecuperar(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
            </div>
            <form onSubmit={dispararRecuperacaoDeSenha} className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-600 text-xs">Informe seu e-mail corporativo:</label>
                <input 
                  type="email"
                  required
                  placeholder="nome@nedcapital.com.br"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg outline-none font-semibold text-xs focus:border-blue-500 bg-slate-50"
                />
              </div>
              <button 
                type="submit"
                disabled={enviandoRecuperacao}
                className="w-full p-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs tracking-tight transition-all disabled:opacity-50"
              >
                {enviandoRecuperacao ? "⏳ Solicitando Token..." : "Enviar E-mail de Recuperação"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}