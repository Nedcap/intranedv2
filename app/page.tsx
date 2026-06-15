/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase"; 
import { obterRotasMaster } from "@/lib/rotas"; 
import "./globals.css"; // 🛡️ Garante o CSS ativo na raíz de cliente

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  
  const router = useRouter(); 

  const autenticar = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setLoading(true);
    setErro("");

    try {
      const { data, error } = await supabase.rpc("verificar_login", {
        p_email: email.trim(),
        p_senha: senha.trim()
      });

      if (error || !data || data.length === 0) {
        setErro("E-mail ou senha incorretos.");
      } else {
        const usuarioLogado = data[0];

        const { data: dadosColaborador } = await supabase
          .from("usuarios")
          .select("permissoes")
          .eq("email", email.trim())
          .maybeSingle();

        let abasFinais = [];
        if (usuarioLogado.cargo === "Master") {
          abasFinais = obterRotasMaster();
        } else if (dadosColaborador && dadosColaborador.permissoes) {
          abasFinais = dadosColaborador.permissoes;
        }

        const payloadSessao = {
          nome: usuarioLogado.nome,
          perfil: usuarioLogado.cargo || "Comercial",
          abas_permitidas: abasFinais 
        };

        localStorage.setItem("intraned_user", JSON.stringify(payloadSessao));
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setErro("Ocorreu um erro de conexão com o banco.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans text-[13px] text-slate-800">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Intra<span className="text-blue-600">Ned</span>
          </h1>
          <p className="text-slate-400 mt-1 font-bold text-[10px] uppercase tracking-widest">
            Controle e Gestão
          </p>
        </div>

        <form onSubmit={autenticar} className="space-y-5">
          {erro && (
            <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md text-center font-bold">
              {erro}
            </div>
          )}

          <div className="space-y-1">
            <label className="block font-bold text-slate-700">E-mail:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@nedcapital.com.br"
              required
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-700">Senha:</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? "Autenticando..." : "ENTRAR NO SISTEMA"}
          </button>
        </form>

        <div className="text-center pt-5 border-t border-slate-100 mt-5">
          <a href="/esqueci-senha" className="text-blue-600 hover:underline text-xs font-bold transition-all">
            Esqueceu sua senha? Recuperar acesso
          </a>
        </div>
      </div>
    </div>
  );
}