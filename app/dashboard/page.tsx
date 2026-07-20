/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function DashboardHomePage() {
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState("Membro Ned");
  const [saudacao, setSaudacao] = useState("Bem-vindo(a)");
  
  // ⚡ Estados de Customização de Atalhos
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);

  // 🔐 Estados de Troca de Senha Rápida
  const [abrirConfig, setAbrirConfig] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // Definição estática de todos os caminhos dos módulos para bater com as permissões do banco
  const modulosPrincipais = [
    {
      id: "powerbi",
      path: "/dashboard/powerbi",
      titulo: "Painel de Indicadores (BI)",
      descricao: "Visão gerencial consolidada de Valores Operados, Receitas, Risco e SLA.",
      icone: "📊",
      corBadge: "bg-indigo-100 text-indigo-700 border-indigo-200",
      corHover: "hover:border-indigo-400 hover:shadow-indigo-100",
    },
    {
      id: "nedhub",
      path: "/dashboard/nedhub",
      titulo: "NedHub Comercial",
      descricao: "Máquina de originação, funil de vendas (Kanban) e gestão inteligente de contatos.",
      icone: "🚀",
      corBadge: "bg-blue-100 text-blue-700 border-blue-200",
      corHover: "hover:border-blue-400 hover:shadow-blue-100",
    },
    {
      id: "carteira",
      path: "/dashboard/carteira",
      titulo: "Carteira Dinâmica",
      descricao: "Análise granular título por título, envelhecimento e simulador de liquidez.",
      icone: "💼",
      corBadge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      corHover: "hover:border-emerald-400 hover:shadow-emerald-100",
    },
    {
      id: "comite",
      path: "/dashboard/comite",
      titulo: "Análises e Comitê",
      descricao: "Esteira de crédito, aprovações, reprovações e chat de debates executivos.",
      icone: "📋",
      corBadge: "bg-amber-100 text-amber-700 border-amber-200",
      corHover: "hover:border-amber-400 hover:shadow-amber-100",
    },
    {
      id: "financeiro",
      path: "/dashboard/financeiro",
      titulo: "Controle Financeiro",
      descricao: "Calendário de pagamentos, contas a pagar e fluxo de caixa consolidado.",
      icone: "💰",
      corBadge: "bg-rose-100 text-rose-700 border-rose-200",
      corHover: "hover:border-rose-400 hover:shadow-rose-100",
    },
    {
      id: "importacao",
      path: "/dashboard/importacao",
      titulo: "Importação V2",
      descricao: "Motor síncrono de upload de planilhas e cruzamento Master Data Management.",
      icone: "📥",
      corBadge: "bg-purple-100 text-purple-700 border-purple-200",
      corHover: "hover:border-purple-400 hover:shadow-purple-100",
    }
  ];

  useEffect(() => {
    const userStr = localStorage.getItem("intraned_user");
    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        setUser(parsedUser);
        if (parsedUser.nome) {
          setUserName(parsedUser.nome.split(" ")[0]);
        }
        
        // Carrega a ordenação/atalhos personalizados salvos localmente para o dispositivo
        const favsSalvos = localStorage.getItem(`favs_${parsedUser.id}`);
        if (favsSalvos) setFavoritos(JSON.parse(favsSalvos));
      } catch (e) {
        console.error("Erro ao processar sessão local:", e);
      }
    }

    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) setSaudacao("Bom dia");
    else if (hora >= 12 && hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");
  }, []);

  // 🛡️ Filtra os módulos com base nas permissões reais guardadas na conta do usuário
  const modulosPermitidos = modulosPrincipais.filter(mod => {
    if (!user) return false;
    if (user.cargo === "Master") return true; // Master acessa tudo direto
    return !!user.permissoes?.[mod.path];
  });

  // ⚡ Alterna exibição personalizada (Esconder/Mostrar telas)
  const alternarFavorito = (id: string) => {
    let novosFavs = [...favoritos];
    if (novosFavs.includes(id)) {
      novosFavs = novosFavs.filter(f => f !== id);
    } else {
      novosFavs.push(id);
    }
    setFavoritos(novosFavs);
    if (user?.id) {
      localStorage.setItem(`favs_${user.id}`, JSON.stringify(novosFavs));
    }
  };

  // 🔐 Executa a alteração segura da própria senha logada
  const alterarMinhaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmarNovaSenha) {
      alert("❌ As senhas digitadas não conferem.");
      return;
    }
    if (novaSenha.length < 6) {
      alert("❌ A senha deve conter no mínimo 6 dígitos.");
      return;
    }

    try {
      setSalvandoSenha(true);
      const { error } = await supabase.auth.updateUser({ password: novaSenha.trim() });
      if (error) throw error;
      
      alert("🎉 Sua senha de acesso foi atualizada com sucesso!");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      setAbrirConfig(false);
    } catch (err: any) {
      alert(`Erro ao alterar senha: ${err.message}`);
    } finally {
      setSalvandoSenha(false);
    }
  };

  // Define a lista de módulos finais que serão renderizados
  const modulosExibidos = modoEdicao 
    ? modulosPermitidos 
    : favoritos.length > 0 
      ? modulosPermitidos.filter(m => favoritos.includes(m.id)) 
      : modulosPermitidos;

  return (
    <div className="max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-800 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-10 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute -right-10 -top-10 text-[180px] opacity-5 select-none pointer-events-none">🏢</div>
        
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            {saudacao}, <span className="text-blue-400">{userName}</span>!
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl font-medium">
            Painel Central Ned Capital • Nível de Alçada: <span className="text-white font-bold uppercase underline decoration-blue-500">{user?.cargo || "Carregando..."}</span>
          </p>
        </div>

        {/* BOTÕES DE GERENCIAMENTO DA CONTA */}
        <div className="flex gap-2 relative z-10 shrink-0">
          <button
            onClick={() => setModoEdicao(!modoEdicao)}
            className={`px-4 py-2.5 rounded-lg border font-bold uppercase text-[11px] tracking-wider transition-all shadow-sm ${
              modoEdicao 
                ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600" 
                : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {modoEdicao ? "💾 Salvar Telas" : "⚙️ Customizar Visão"}
          </button>
          
          <button
            onClick={() => setAbrirConfig(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 font-bold uppercase text-[11px] tracking-wider rounded-lg transition-all shadow-md"
          >
            👤 Minha Conta
          </button>
        </div>
      </div>

      {/* GRID DE MÓDULOS DE SISTEMA */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">
            {modoEdicao ? "🛠️ Selecionar Telas Visíveis" : favoritos.length > 0 ? "🌟 Seus Atalhos Fixados" : "💻 Módulos Disponíveis"}
          </h2>
          {favoritos.length > 0 && !modoEdicao && (
            <button 
              onClick={() => { setFavoritos([]); localStorage.removeItem(`favs_${user?.id}`); }} 
              className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase"
            >
              Limpar Filtros ✕
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modulosExibidos.map((mod, idx) => {
            const isFav = favoritos.includes(mod.id);
            
            return (
              <div key={idx} className="relative group h-full">
                {modoEdicao ? (
                  // Visão de Customização (Checkbox lateral)
                  <div 
                    onClick={() => alternarFavorito(mod.id)}
                    className={`border rounded-2xl p-6 h-full flex flex-col gap-4 select-none cursor-pointer transition-all ${
                      isFav 
                        ? "bg-blue-50/50 border-blue-400 ring-2 ring-blue-100 shadow-sm" 
                        : "bg-white border-slate-200 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-4xl">{mod.icone}</span>
                      <span className={`px-2 py-1 rounded font-black text-[10px] uppercase border ${
                        isFav ? "bg-blue-600 text-white border-blue-700" : "bg-slate-100 text-slate-400 border-slate-200"
                      }`}>
                        {isFav ? "★ Ativado" : "☆ Oculto"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 mb-1">{mod.titulo}</h3>
                      <p className="text-slate-500 font-medium leading-relaxed">{mod.descricao}</p>
                    </div>
                  </div>
                ) : (
                  // Visão Normal - Link clicável direto para as telas
                  <Link href={mod.path}>
                    <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm transition-all duration-300 cursor-pointer h-full flex flex-col gap-4 group ${mod.corHover}`}>
                      <div className="flex justify-between items-start">
                        <span className="text-4xl group-hover:scale-110 transition-transform duration-300">
                          {mod.icone}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${mod.corBadge}`}>
                          Acessar
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                          {mod.titulo}
                        </h3>
                        <p className="text-slate-500 font-medium leading-relaxed">
                          {mod.descricao}
                        </p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            );
          })}

          {modulosExibidos.length === 0 && (
            <div className="col-span-full border border-dashed border-slate-300 bg-slate-50 rounded-2xl p-10 text-center text-slate-400 font-bold italic">
              Nenhuma tela foi selecionada para visualização rápida. Clique em &quot;Customizar Visão&quot; acima para redefinir.
            </div>
          )}
        </div>
      </div>

      {/* FOOTER INFORMATIVO */}
      <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <h4 className="font-black text-slate-700 text-sm uppercase">Segurança e Sincronização</h4>
            <p className="text-slate-500 font-medium text-xs">Todos os dados trafegam criptografados e integrados com a infraestrutura Supabase V2.</p>
          </div>
        </div>
        <div className="text-[10px] font-black uppercase text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs">
          NedHub v2.5
        </div>
      </div>

      {/* 🚨 SIDEBAR DESLIZANTE DE CONFIGURAÇÃO DE SEGURANÇA (MINHA CONTA) */}
      {abrirConfig && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-slate-900 text-base uppercase">👤 Gerenciar Conta</h3>
                  <p className="text-slate-400 text-[11px]">Atualize suas credenciais de segurança.</p>
                </div>
                <button 
                  onClick={() => setAbrirConfig(false)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* DADOS CADASTRAIS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Perfil Vinculado</span>
                <div className="font-bold text-slate-800 text-sm uppercase">{user?.nome}</div>
                <div className="font-mono text-slate-500 text-xs">{user?.email}</div>
              </div>

              {/* FORMULÁRIO DE TROCA DE SENHA */}
              <form onSubmit={alterarMinhaSenha} className="space-y-4 pt-2">
                <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">🔒 Alterar Senha de Acesso</h4>
                
                <div className="flex flex-col space-y-1.5">
                  <label className="font-bold text-slate-600 text-xs">Nova Senha Corporativa:</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo de 6 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-semibold"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="font-bold text-slate-600 text-xs">Confirme a Nova Senha:</label>
                  <input
                    type="password"
                    required
                    placeholder="Repita a senha digitada"
                    value={confirmarNovaSenha}
                    onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                    className="p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={salvandoSenha}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
                >
                  {salvandoSenha ? "⏳ Atualizando..." : "Confirmar Nova Senha"}
                </button>
              </form>
            </div>

            <div className="border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400 font-medium">
              Sessão criptografada nativamente via JWT.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}