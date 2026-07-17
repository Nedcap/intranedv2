/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; 
import { useEffect, useState } from "react";
import { MAPA_DE_ROTAS } from "@/lib/rotas"; 
import NotificadorGlobal from "@/components/NotificadorGlobal"; // 🔔 O novo notificador universal!

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter(); 
  const [usuario, setUsuario] = useState<any>(null);
  const [menuAberto, setMenuAberto] = useState(true);

  // 📂 Estado para controlar quais categorias do submenu estão abertas/expandidas
  const [submenusAbertos, setSubmenusAbertos] = useState<Record<string, boolean>>({
    "Geral": true,
    "Comercial": false,
    "Crédito": false,
    "Consultas": false,
    "Financeiro": false,
    "Cadastro": false,
    "Configurações": false,
  });

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

  // 🔄 Deixa a categoria do link atual aberta de forma automática ao carregar a página
  useEffect(() => {
    const rotaAtiva = MAPA_DE_ROTAS.find(r => r.path === pathname);
    if (rotaAtiva) {
      setSubmenusAbertos(prev => ({
        ...prev,
        [rotaAtiva.categoria]: true
      }));
    }
  }, [pathname]);

  const perfilAtual = String(usuario?.perfil || usuario?.cargo || "user").toLowerCase();
  
  // Filtro de permissões nativo mantido intacto
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

  // 📦 Agrupa os links permitidos por categoria para montar os submenus
  const rotasAgrupadas = {
    "Geral": linksPermitidos.filter(l => l.categoria === "Geral"),
    "Comercial": linksPermitidos.filter(l => l.categoria === "Comercial"),
    "Crédito": linksPermitidos.filter(l => l.categoria === "Crédito"),
    "Consultas": linksPermitidos.filter(l => l.categoria === "Consultas"),
    "Financeiro": linksPermitidos.filter(l => l.categoria === "Financeiro"),
    "Cadastro": linksPermitidos.filter(l => l.categoria === "Cadastro"),
    "Configurações": linksPermitidos.filter(l => l.categoria === "Configurações"),
  };

  // Alternador de sanfona (abre uma e mantém as outras como o usuário decidir)
  const toggleSubmenu = (categoria: string) => {
    setSubmenusAbertos(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };

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
        <div className="p-4 flex flex-col h-full min-h-0">
          <div className="mb-6 flex justify-between items-center px-2 pt-2">
            
            {/* 🎯 LOGO DA NED COM FILTRO DE SILHUETA */}
            <div className="flex items-center gap-3 select-none">
              <img 
                src="/favicon.ico" 
                alt="Ned Capital" 
                className="h-8 w-auto object-contain shrink-0 filter brightness-125 saturate-150 drop-shadow-[0_0_4px_rgba(255,255,255,0.75)]"
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

          {/* 🧭 CATEGORIAS EM SUBMENU DROP-DOWN RETRÁTIL */}
          <nav className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {Object.entries(rotasAgrupadas).map(([categoria, links]) => {
              // Se o usuário não tiver permissão para nenhuma rota dessa categoria, ela nem aparece
              if (links.length === 0) return null;

              const estaAberto = submenusAbertos[categoria];
              const contemLinkAtivo = links.some(l => l.path === pathname);

              // 🎯 Renderiza os ícones principais baseados na nova estrutura de categorias
              const getIconeCategoria = (cat: string) => {
                switch(cat) {
                  case "Geral": return "🏠";
                  case "Comercial": return "🎯";
                  case "Consultas": return "🔎"; 
                  case "Crédito": return "⚖️";
                  case "Financeiro": return "💰";
                  case "Cadastro": return "📝";
                  case "Configurações": return "⚙️";
                  default: return "📦";
                }
              };

              return (
                <div key={categoria} className="space-y-1">
                  {/* Botão de Disparo do Menu Pai */}
                  <button
                    onClick={() => toggleSubmenu(categoria)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all select-none ${
                      contemLinkAtivo 
                        ? "text-blue-400 bg-slate-800/40" 
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{getIconeCategoria(categoria)}</span>
                      <span>{categoria}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60">
                      {estaAberto ? "▼" : "▶"}
                    </span>
                  </button>

                  {/* Links Filhos (O Submenu de fato) */}
                  {estaAberto && (
                    <div className="pl-4 border-l border-slate-800 space-y-0.5 mt-1 transition-all">
                      {links.map((link) => {
                        const ativo = pathname === link.path;
                        return (
                          <Link
                            key={link.path}
                            href={link.path}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] font-bold transition-all cursor-pointer ${
                              ativo
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            }`}
                          >
                            <span className="text-sm shrink-0">{link.icone}</span>
                            <span className="truncate">{link.nome}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* FOOTER PERFIL LOGADO */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Logado como:</p>
            <p className="text-xs font-black text-white mt-0.5 truncate">{usuario?.nome || "Usuário"}</p>
            <p className="text-[10px] text-blue-400 font-medium capitalize mt-0.5 truncate">{usuario?.cargo || usuario?.perfil || "Colaborador"}</p>
          </div>

          <button 
            onClick={handleSair}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer border border-slate-700/50 hover:border-rose-900"
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
          
          {/* 🔥 Componente Global de Notificações Ativo na Raiz da Dashboard */}
          <NotificadorGlobal />
        </main>
      </div>

    </div>
  );
}