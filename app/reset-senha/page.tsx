/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ResetSenhaForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [usuarioValido, setUsuarioValido] = useState<any>(null);
  const [verificandoToken, setVerificandoToken] = useState(true);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    async function validarTokenRecuperacao() {
      if (!token) {
        setVerificandoToken(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("usuarios")
          .select("id, token_expira")
          .eq("token_recuperacao", token)
          .maybeSingle();

        if (error || !data) {
          setVerificandoToken(false);
          return;
        }

        const expira = new Date(data.token_expira).getTime();
        const agora = Date.now();

        if (agora < expira) {
          setUsuarioValido(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setVerificandoToken(false);
      }
    }
    validarTokenRecuperacao();
  }, [token]);

  const executarTrocaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioValido) return;

    if (novaSenha.length < 6) {
      setMensagem({ tipo: "erro", texto: "❌ A senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setMensagem({ tipo: "erro", texto: "❌ As senhas digitadas não coincidem." });
      return;
    }

    try {
      setCarregando(true);

      // 🎯 FIX DEFINITIVO: Faz um UPDATE em texto puro na tabela, limpando também os tokens usados
      const { error } = await supabase
        .from("usuarios")
        .update({
          senha: novaSenha.trim(),
          token_recuperacao: null,
          token_expira: null
        })
        .eq("id", usuarioValido.id);

      if (error) throw error;

      alert("🎉 Senha atualizada e sincronizada com sucesso!");
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setMensagem({ tipo: "erro", texto: `❌ Erro ao salvar nova senha: ${err.message || "Erro no servidor."}` });
    } finally {
      setCarregando(false);
    }
  };

  if (verificandoToken) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500 animate-pulse">Validando token de segurança...</div>;
  }

  if (!usuarioValido) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-[13px]">
        <div className="w-full max-w-sm bg-white p-6 rounded-xl border border-red-200 shadow-md text-center space-y-3">
          <h2 className="text-red-600 font-black text-base">⚠️ Link Inválido ou Expirado</h2>
          <p className="text-slate-500 font-medium">Este link de recuperação já foi utilizado ou passou do prazo de validade de 1 hora.</p>
          <a href="/" className="px-4 py-2 bg-slate-950 text-white font-bold rounded-lg inline-block text-xs mt-2">Solicitar Novo Link</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-[13px] font-medium text-slate-700">
      <div className="w-full max-w-sm bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-900">Nova Credencial</h2>
          <p className="text-slate-400 text-xs mt-1">Crie sua nova senha forte de acesso</p>
        </div>

        {mensagem.texto && (
          <div className={`p-3 rounded-lg border text-xs font-bold ${mensagem.tipo === "sucesso" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={executarTrocaSenha} className="space-y-3">
          <div className="flex flex-col space-y-1">
            <label className="font-bold text-xs text-slate-500">Nova Senha</label>
            <input type="password" required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="font-bold text-xs text-slate-500">Confirmar Nova Senha</label>
            <input type="password" required value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} placeholder="Repita a senha" className="p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
          </div>
          <button type="submit" disabled={carregando} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg cursor-pointer transition-all">
            {carregando ? "SALVANDO CREDENCIAL..." : "💾 Atualizar Credencial"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetSenhaPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-bold text-slate-500 animate-pulse">Carregando formulário...</div>}>
      <ResetSenhaForm />
    </Suspense>
  );
}