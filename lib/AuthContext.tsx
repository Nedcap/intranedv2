"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

// Estrutura atualizada do perfil que vem do banco
export type UserProfile = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  permissoes: Record<string, boolean>;
  notificacoes_config: Record<string, boolean>;
  bate_ponto: boolean;
  ver_apenas_carteira?: boolean;
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  isMaster: boolean;
  isDiretor: boolean;
  verApenasCarteira: boolean;
  hasPermission: (path: string, actionKey?: string) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Busca a sessão ativa quando a aplicação carrega
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Fica escutando mudanças na autenticação (login, logout, token expirado)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
          // Redireciona para o login se a sessão cair e o usuário não estiver na tela inicial
          if (pathname !== "/" && pathname !== "/esqueci-senha" && pathname !== "/reset-senha") {
             router.push("/");
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  // 🛡️ Helpers de segurança facilitados para uso direto nas telas
  const cargoLimpo = user?.cargo?.toLowerCase().trim() || "";
  const isMaster = cargoLimpo === "master";
  const isDiretor = cargoLimpo === "diretor" || isMaster;
  
  // Flag que indica se as queries de listagem devem filtrar apenas a própria carteira
  const verApenasCarteira = !!user?.ver_apenas_carteira && !isMaster;

  // 🎯 Validação granular de permissões (Acesso à Tela + Ação de Botão Específica)
  const hasPermission = (path: string, actionKey?: string) => {
    if (isMaster) return true; // Master tem acesso VIP irrestrito

    // 1. Checa se o usuário tem permissão de acesso à tela
    const temAcessoTela = !!user?.permissoes?.[path];
    if (!temAcessoTela) return false;

    // 2. Se não foi exigida uma ação/botão específico, libera o acesso da tela
    if (!actionKey) return true;

    // 3. Checa a permissão do botão (Formato guardado no banco: "/dashboard/comite:btn_forcar_veredito")
    const chaveAcao = `${path}:${actionKey}`;

    if (user?.permissoes && chaveAcao in user.permissoes) {
      return !!user.permissoes[chaveAcao];
    }

    // Se a ação não estiver explicitamente configurada como 'false', herda o acesso livre da tela
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isMaster, isDiretor, verApenasCarteira, hasPermission, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook customizado para usar o contexto facilmente
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}