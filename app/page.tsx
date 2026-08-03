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
  
  const [abrirAbasRecuperar, setAbrirAbasRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);

  // 🔒 Estados para Primeiro Acesso / Troca de Senha Obrigatória
  const [exigirNovaSenha, setExigirNovaSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [usuarioTemporario, setUsuarioTemporario] = useState<any>(null);

  // Verifica se a sessão nativa do Supabase já existe
  useEffect(() => {
    const verificarSessaoAtiva = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const userEmail = session.user.email?.toLowerCase().trim();
        
        // Busca flexível: Tenta casar pelo ID ou pelo E-mail
        const { data: perfil } = await supabase
          .from("usuarios")
          .select("*")
          .or(`id.eq.${session.user.id},email.eq.${userEmail}`)
          .maybeSingle();

        if (perfil?.primeiro_acesso) {
          setUsuarioTemporario(perfil);
          setExigirNovaSenha(true);
        } else {
          router.push("/dashboard");
        }
      }
    };
    verificarSessaoAtiva();
  }, [router]);

  const tratarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) return;

    try {
      setCarregando(true);
      const emailTratado = email.trim().toLowerCase();

      // 1. 🔑 Autentica no cofre do Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailTratado,
        password: senha.trim(),
      });

      if (authError || !authData.user) {
        alert("❌ Acesso negado. Verifique os dados inseridos.");
        await supabase.auth.signOut(); 
        setCarregando(false);
        return;
      }

      // 2. 📑 Puxa o perfil com busca híbrida (ID ou E-mail) para evitar travamentos
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .or(`id.eq.${authData.user.id},email.eq.${emailTratado}`)
        .maybeSingle();

      if (perfilError || !perfil) {
        console.error("Erro ao localizar perfil:", perfilError);
        alert("⚠️ Credenciais válidas, mas perfil não encontrado na tabela de usuários.");
        await supabase.auth.signOut();
        setCarregando(false);
        return;
      }

      // 3. 🚨 Verifica se exige troca de senha no primeiro acesso
      if (perfil.primeiro_acesso === true) {
        setUsuarioTemporario(perfil);
        setExigirNovaSenha(true);
        setCarregando(false);
        return;
      }

      // 4. 🚀 Tudo OK! Redireciona para a Home do Dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(`Erro inesperado no servidor: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

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

      // 1. 🔐 Atualiza a senha no Auth Nativo
      const { error: authUpdateError } = await supabase.auth.updateUser({
        password: novaSenha.trim()
      });

      if (authUpdateError) throw authUpdateError;

      // 2. 🏳️ Desmarca a trava na tabela pública
      await supabase
        .from("usuarios")
        .update({ primeiro_acesso: false })
        .eq("id", usuarioTemporario.id);

      // 3. 💾 Redireciona para o painel
      alert("🎉 Senha corporativa definida com sucesso! Acesso liberado.");
      setExigirNovaSenha(false);
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
            className="w-full p-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg transition-colors uppercase tracking-wider text-xs shadow-md disabled:opacity-50 cursor-pointer"
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

      {/* 🚨 MODAL DE PRIMEIRA TROCA DE SENHA */}
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
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md cursor-pointer"
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
              <button type="button" onClick={() => setAbrirAbasRecuperar(false)} className="text-slate-400 font-bold text-xs cursor-pointer">✕</button>
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
              <button type="submit" disabled={enviandoRecuperacao} className="w-full p-2 bg-slate-900 text-white font-bold rounded-lg text-xs transition-all disabled:opacity-50 cursor-pointer">
                {enviandoRecuperacao ? "⏳ Solicitando..." : "Enviar E-mail de Recuperação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}