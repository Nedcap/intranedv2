"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardHomePage() {
  const [userName, setUserName] = useState("Membro Ned");
  const [saudacao, setSaudacao] = useState("Bem-vindo(a)");

  useEffect(() => {
    // Puxa o nome do usuário logado
    const userStr = localStorage.getItem("intraned_user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.nome) {
          setUserName(user.nome.split(" ")[0]); // Pega só o primeiro nome
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Define a saudação baseada na hora do dia
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) setSaudacao("Bom dia");
    else if (hora >= 12 && hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");
  }, []);

  const modulosPrincipais = [
    {
      titulo: "Painel de Indicadores (BI)",
      descricao: "Visão gerencial consolidada de Valores Operados, Receitas, Risco e SLA.",
      icone: "📊",
      corBadge: "bg-indigo-100 text-indigo-700 border-indigo-200",
      corHover: "hover:border-indigo-400 hover:shadow-indigo-100",
      link: "/dashboard/powerbi"
    },
    {
      titulo: "NedHub Comercial",
      descricao: "Máquina de originação, funil de vendas (Kanban) e gestão inteligente de contatos.",
      icone: "🚀",
      corBadge: "bg-blue-100 text-blue-700 border-blue-200",
      corHover: "hover:border-blue-400 hover:shadow-blue-100",
      link: "/dashboard/nedhub"
    },
    {
      titulo: "Carteira Dinâmica",
      descricao: "Análise granular título por título, envelhecimento e simulador de liquidez.",
      icone: "💼",
      corBadge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      corHover: "hover:border-emerald-400 hover:shadow-emerald-100",
      link: "/dashboard/carteira"
    },
    {
      titulo: "Análises e Comitê",
      descricao: "Esteira de crédito, aprovações, reprovações e chat de debates executivos.",
      icone: "📋",
      corBadge: "bg-amber-100 text-amber-700 border-amber-200",
      corHover: "hover:border-amber-400 hover:shadow-amber-100",
      link: "/dashboard/comite"
    },
    {
      titulo: "Controle Financeiro",
      descricao: "Calendário de pagamentos, contas a pagar e fluxo de caixa consolidado.",
      icone: "💰",
      corBadge: "bg-rose-100 text-rose-700 border-rose-200",
      corHover: "hover:border-rose-400 hover:shadow-rose-100",
      link: "/dashboard/financeiro"
    },
    {
      titulo: "Importação V2",
      descricao: "Motor síncrono de upload de planilhas e cruzamento Master Data Management.",
      icone: "📥",
      corBadge: "bg-purple-100 text-purple-700 border-purple-200",
      corHover: "hover:border-purple-400 hover:shadow-purple-100",
      link: "/dashboard/importacao"
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-800 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER BOAS VINDAS */}
      <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-10 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-center">
        <div className="absolute -right-10 -top-10 text-[180px] opacity-5 select-none pointer-events-none">
          🏢
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            {saudacao}, <span className="text-blue-400">{userName}</span>!
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl font-medium">
            Bem-vindo(a) ao seu hub central de operações da Ned Capital. Acesse seus módulos, acompanhe o fluxo de caixa e gerencie sua carteira de forma inteligente.
          </p>
        </div>
      </div>

      {/* GRID DE MÓDULOS */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase border-b border-slate-200 pb-2">
          Módulos do Sistema
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modulosPrincipais.map((mod, idx) => (
            <Link href={mod.link} key={idx}>
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
          ))}
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
          NedHub v2.0
        </div>
      </div>

    </div>
  );
}