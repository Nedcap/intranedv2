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

  // 🔒 Estados para Primeiro Acesso / Troca de Senha Obrigatória
  const [exigirNovaSenha, setExigirNovaSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [usuarioTemporario, setUsuarioTemporario] = useState<any>(null);

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

      // 1. 🔑 Autentica de verdade usando o sistema nativo e criptografado do Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailTratado,
        password: senha.trim(),
      });

      if (authError) {
        alert("❌ Acesso negado. Verifique os dados inseridos.");
        return;
      }

      // 2. 📑 Puxa o perfil complementar da sua tabela pública
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (perfilError || !perfil) {
        throw new Error("Perfil de usuário não localizado no banco.");
      }

      // 🚨 3. CORREÇÃO: Verifica se é o primeiro acesso OU se o Admin setou uma senha temporária
      const senhaTemporariaAuth = authData.user?.app_metadata?.senha_temporaria === true;

      if (perfil.primeiro_acesso === true || senhaTemporariaAuth) {
        setUsuarioTemporario(perfil);
        setExigirNovaSenha(true); // Abre o modal de nova senha e barra o redirecionamento
        setCarregando(false);
        return;
      }

      // 4. 🚀 Login normal caso não precise redefinir nada
      localStorage.setItem("intraned_user", JSON.stringify({
        id: perfil.id,
        nome: perfil.nome,
        email: perfil.email,
        cargo: perfil.cargo || "Colaborador",
        permissoes: perfil.permissoes || {}
      }));

      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(`Erro no servidor: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // 🛠️ Função que atualiza a senha de forma definitiva e desliga as flags de bloqueio
  const salvarNovaSenhaPrimeiroAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSenha.trim() || !confirmarNovaSenha.trim()) return;

    if (novaSenha.trim().length < 6) {
      alert("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }

    if (novaSenha.trim() !== confirmarNovaSenha.trim()) {
      alert("As senhas inseridas não conferem.");
      return;
    }

    try {
      setTrocandoSenha(true);

      // 1. 🔐 Atualiza a senha no cofre nativo do Supabase E remove a flag 'senha_temporaria'
      const { error: authUpdateError } = await supabase.auth.updateUser({
        password: novaSenha.trim(),
        app_metadata: {
          senha_temporaria: false // 🎯 Desliga a flag no motor do Supabase
        }
      });

      if (authUpdateError) throw authUpdateError;

      // 2. 🏳️ Garante também que a flag 'primeiro_acesso' fique false na tabela pública
      const { error: tabelaError } = await supabase
        .from("usuarios")
        .update({ primeiro_acesso: false })
        .eq("id", usuarioTemporario.id);

      if (tabelaError) throw tabelaError;

      // 3. 💾 Cria a sessão definitiva e manda pro painel
      localStorage.setItem("intraned_user", JSON.stringify({
        id: usuarioTemporario.id,
        nome: usuarioTemporario.nome,
        email: usuarioTemporario.email,
        cargo: usuarioTemporario.cargo || "Colaborador",
        permissoes: usuarioTemporario.permissoes || {}
      }));

      alert("🎉 Senha corporativa definida com sucesso! Acesso liberado.");
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar nova senha: ${err.message}`);
    } finally {
      setTrocandoSenha(false);
    }
  };

  const dispararRecuperacaoDeSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperar.trim()) return;

    try {
      setEnviandoRecuperacao(true);
      const res = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRecuperar.trim() }),
      });

      const resultado = await res.json();
      if (!res.ok) throw new Error(resultado.error || "Falha ao solicitar");

      alert("📧 Se o e-mail informado estiver cadastrado, as instruções serão enviadas!");
      setAbrirAbasRecuperar(false);
      setEmailRecuperar("");
    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro no envio: ${err.message}`);
    } finally {
      setEnviandoRecuperacao(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-[13px]">
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-xl space-y-6">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col items-center select-none text-center">
          <div className="relative w-fit mx-auto flex items-center h-8 pl-1">
            <img src="/favicon.ico" alt="Ned Capital" className="absolute -left-7 h-7 w-auto object-contain shrink-0" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              Intra<span className="text-blue-500">Ned</span>
            </h1>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2.5 w-full">Controle & Gestão</p>
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
              className="p-2.5 border border-slate-200 bg-blue-50/30 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-880"
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
            className="w-full p-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg transition-colors uppercase tracking-wider text-xs shadow-md disabled:opacity-50"
          >
            {carregando ? "Autenticando..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="text-center pt-2">
          <button 
            type="button"
            onClick={() => setAbrirAbasRecuperar(true)}
            className="text-blue-600 hover:underline font-bold text-xs cursor-pointer bg-transparent border-0"
          >
            Esqueceu sua senha? Recuperar acesso
          </button>
        </div>
      </div>

      {/* 🚨 MODAL IMPEDING: ACESSO TEMPORÁRIO / PRIMEIRO ACESSO - CADASTRO DE NOVA SENHA */}
      {exigirNovaSenha && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center">
              <h3 className="font-black text-slate-950 text-base uppercase tracking-tight">🔒 Senha Provisória Detectada</h3>
              <p className="text-slate-500 text-[11px] mt-1">Por questões de conformidade e segurança da Ned Capital, defina uma nova senha definitiva para continuar.</p>
            </div>
            
            <form onSubmit={salvarNovaSenhaPrimeiroAcesso} className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">Nova Senha Corporativa:</label>
                <input 
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="p-2.5 border border-slate-200 rounded-lg outline-none font-semibold text-slate-800 focus:border-blue-500 bg-slate-50"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-700">Confirme a Nova Senha:</label>
                <input 
                  type="password"
                  required
                  placeholder="Repita a senha digitada acima"
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  className="p-2.5 border border-slate-200 rounded-lg outline-none font-semibold text-slate-800 focus:border-blue-500 bg-slate-50"
                />
              </div>

              <button 
                type="submit"
                disabled={trocandoSenha}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md"
              >
                {trocandoSenha ? "⏳ Criptografando & Atualizando..." : "Definir Senha Definitiva"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RECUPERAÇÃO */}
      {abrirAbasRecuperar && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">🔒 Recuperar Acesso</h3>
              <button type="button" onClick={() => setAbrirAbasRecuperar(false)} className="text-slate-400 font-bold text-xs">✕</button>
            </div>
            <form onSubmit={dispararRecuperacaoDeSenha} className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="font-bold text-slate-600 text-xs">Informe seu e-mail:</label>
                <input 
                  type="email"
                  required
                  placeholder="nome@nedcapital.com.br"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg outline-none font-semibold text-xs focus:border-blue-500 bg-slate-50"
                />
              </div>
              <button type="submit" disabled={enviandoRecuperacao} className="w-full p-2 bg-slate-900 text-white font-bold rounded-lg text-xs transition-all disabled:opacity-50">
                {enviandoRecuperacao ? "⏳ Solicitando..." : "Enviar E-mail de Recuperação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}