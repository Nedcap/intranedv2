/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; 
import { useEffect, useState } from "react";
import { MAPA_DE_ROTAS } from "@/lib/rotas"; 
import NotificadorComite from "@/app/notificador-comite"; // 🔔 Importa o componente de tempo real

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter(); 
  const [usuario, setUsuario] = useState<any>(null);
  const [menuAberto, setMenuAberto] = useState(true);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        setUsuario(JSON.parse(userStr));
      }
    } catch (err) {
      console.error("Erro ao ler sessão do localStorage:", err);
    }

    if (typeof window !== "undefined") {
      if (window.innerWidth < 1024) {
        setMenuAberto(false);
      }
    }
  }, []);

  const perfilAtual = String(usuario?.perfil || usuario?.cargo || "user").toLowerCase();
  
  const linksPermitidos = MAPA_DE_ROTAS.filter((link) => {
    if (perfilAtual === "master") return true; 
    
    const rotasDoUsuario = usuario?.permissoes || usuario?.abas_permitidas;

    if (Array.isArray(rotasDoUsuario)) {
      return rotasDoUsuario.includes(link.path);
    } else if (rotasDoUsuario && typeof rotasDoUsuario === "object") {
      return rotasDoUsuario[link.path] === true;
    }
    
    return false;
  });

  const handleSair = () => {
    localStorage.removeItem("intraned_user"); 
    router.push("/"); 
  };

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-800 relative overflow-hidden">
      
      {/* Cortina mobile */}
      {menuAberto && (
        <div 
          onClick={() => setMenuAberto(false)} 
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Menu Lateral */}
      <aside 
        className={`fixed inset-y-0 left-0 lg:static w-64 bg-slate-900 text-slate-400 flex flex-col justify-between border-r border-slate-800 shrink-0 z-50 transition-transform duration-300 ease-in-out ${
          menuAberto ? "translate-x-0" : "-translate-x-full lg:-ml-64"
        }`}
      >
        <div className="p-6">
          <div className="mb-8 flex justify-between items-center">
            
            {/* 🎯 LOGO DA NED DESTACADA COM CONTORNO E BRILHO SUAVE */}
            <div className="flex items-center gap-3 select-none">
              <img 
                src="/favicon.ico" 
                alt="Ned Capital" 
                className="h-8 w-auto object-contain shrink-0 rounded-md p-[1px] border border-white/20 bg-slate-800/40 shadow-[0_0_8px_rgba(255,255,255,0.15)] filter brightness-110"
              />
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-white tracking-tight leading-none">
                  Intra<span className="text-blue-500">Ned</span>
                </h1>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1 leading-none">
                  Controle & Gestão
                </p>
              </div>
            </div>

            <button 
              onClick={() => setMenuAberto(false)} 
              className="lg:hidden text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
            >
              X
            </button>
          </div>

          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
            {linksPermitidos.map((link) => {
              const ativo = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    ativo
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span className="text-base">{link.icone}</span>
                  {link.nome}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/40 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Logado como:</p>
            <p className="text-sm font-black text-white mt-0.5">{usuario?.nome || "Usuário"}</p>
            <p className="text-xs text-blue-400 font-medium capitalize mt-0.5">{usuario?.cargo || usuario?.perfil || "Colaborador"}</p>
          </div>

          <button 
            onClick={handleSair}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-700/50 hover:border-rose-900"
          >
            🚪 Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-14 flex items-center px-6 shrink-0 justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMenuAberto(!menuAberto)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 uppercase tracking-tight"
            >
              Menu
            </button>
            <span className="font-bold text-slate-500 hidden sm:inline text-xs uppercase tracking-wider">
              Painel Operacional IntraNed
            </span>
          </div>
          <div className="text-right text-[11px] font-bold text-slate-400 font-mono">
            Ned Capital v2.1.0
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto relative">
          {children}
          <NotificadorComite />
        </main>
      </div>

    </div>
  );
}