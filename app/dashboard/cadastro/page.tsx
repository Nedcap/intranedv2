/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";

export default function CadastroPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; perfil: string } | null>(null);
  
  // Estado para filtro dinâmico através do clique nos cards
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTE_ENVIO" | "AGUARDANDO_ASSINATURA" | "APTO">("TODOS");

  useEffect(() => {
    async function carregarCadastro() {
      try {
        setCarregando(true);
        
        const userStr = localStorage.getItem("intraned_user");
        let query = supabase.from("cadastro_cedentes").select("*");

        if (userStr) {
          const user = JSON.parse(userStr);
          const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
          
          setUsuarioAtual({ nome: user.nome, perfil: cargoUser });

          if (cargoUser === "comercial") {
            query = query.eq("comercial", user.nome);
          }
        }

        const { data } = await query.order("cedente", { ascending: true });
        if (data) {
          setCedentes(data.map(item => ({ ...item, _isEditado: false, _isNovo: false })));
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setCarregando(false); 
      }
    }
    carregarCadastro();
  }, []);

  const handleInputChange = (index: number, campo: string, valor: any) => {
    const novos = [...cedentes]; 
    novos[index][campo] = valor;
    novos[index]["_isEditado"] = true;
    setCedentes(novos);
  };

  const adicionarNovaLinha = () => {
    const novaLinha = {
      cedente: "", 
      limite: "",
      taxa: "",
      docs_ok: null,
      obs: "",
      data_5: null,
      data_6: null,
      data_7: null,
      data_8: null,
      data_9: null,
      apto: null,
      comercial: usuarioAtual?.perfil === "comercial" ? usuarioAtual.nome : "",
      _isNovo: true,
      _isEditado: true
    };
    
    setFiltroStatus("TODOS"); // Volta para a visão geral para o usuário ver a linha inserida
    setCedentes([novaLinha, ...cedentes]);
  };

  const salvarAlteracoes = async () => {
    try {
      setSalvando(true);
      
      const linhasInvalidas = cedentes.filter(c => c._isNovo && (!c.cedente || c.cedente.trim() === ""));
      if (linhasInvalidas.length > 0) {
        alert("⚠️ Preencha o nome do Cedente nas novas linhas antes de salvar!");
        setSalvando(false);
        return;
      }

      const alvosEnvio = cedentes.filter(c => c._isEditado || c._isNovo);

      if (alvosEnvio.length === 0) {
        alert("💡 Nenhuma alteração pendente para salvar.");
        setSalvando(false);
        return;
      }

      for (const item of alvosEnvio) {
        const payload: any = {
          cedente: limparNome(item.cedente), // Usa o seu higienizador global centralizado!
          limite: item.limite || "", 
          taxa: item.taxa || "", 
          docs_ok: item.docs_ok, 
          obs: item.obs || "",
          data_5: item.data_5 || null, 
          data_6: item.data_6 || null, 
          data_7: item.data_7 || null, 
          data_8: item.data_8 || null, 
          data_9: item.data_9 || null,
          apto: item.apto, 
          comercial: item.comercial, 
          atualizado_em: new Date().toISOString()
        };

        if (item.id) {
          payload.id = item.id;
        }

        const { error } = await supabase.from("cadastro_cedentes").upsert(payload);
        if (error) throw error;
      }
      
      alert("🎉 Alterações salvas com sucesso!");
      // Recarrega o estado local limpando marcadores
      setCedentes(cedentes.map(c => ({ ...c, _isNovo: false, _isEditado: false })));
    } catch (err: any) { 
      console.error(err);
      alert(`❌ Erro ao salvar os dados no Supabase: ${err.message}`); 
    } finally { 
      setSalvando(false); 
    }
  };

  // ==========================================================================
  // 🧮 CÁLCULO E MOTOR DOS CARDS DE COBRANÇA EXECUTIVA (KPIs)
  // ==========================================================================
  const kpisEsteira = useMemo(() => {
    let total = cedentes.length;
    let pendenteEnvio = 0;
    let aguardandoAssinatura = 0;
    let aptos = 0;

    cedentes.forEach(c => {
      if (c.apto === true) {
        aptos++;
      } else {
        // Se não tem data de envio Secutirizadora (data_5) ou FIDC (data_7), está pendente de envio
        if (!c.data_5 && !c.data_7) pendenteEnvio++;
        // Se já enviou mas não tem data de assinatura (data_6 ou data_8), está aguardando retorno do cliente
        else if ((c.data_5 && !c.data_6) || (c.data_7 && !c.data_8)) aguardandoAssinatura++;
      }
    });

    return { total, pendenteEnvio, aguardandoAssinatura, aptos };
  }, [cedentes]);

  // Filtragem em tempo de execução para renderizar a tabela conforme o Card clicado
  const cedentesFiltrados = useMemo(() => {
    return cedentes.filter(c => {
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "APTO") return c.apto === true;
      if (filtroStatus === "PENDENTE_ENVIO") return c.apto !== true && !c.data_5 && !c.data_7;
      if (filtroStatus === "AGUARDANDO_ASSINATURA") {
        return c.apto !== true && ((c.data_5 && !c.data_6) || (c.data_7 && !c.data_8));
      }
      return true;
    });
  }, [cedentes, filtroStatus]);

  if (carregando) return <div className="p-8 text-center animate-pulse text-slate-500 font-bold">Carregando carteira de clientes...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">📇 Esteira de Cadastro e Conversão</h2>
          <span className="text-xs text-slate-500 font-medium">Controle operacional de auditoria de documentos, fluxos de contratos e liberação de chaves.</span>
        </div>
        <div className="flex gap-3 shrink-0">
          <button 
            onClick={adicionarNovaLinha} 
            disabled={salvando} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition-all"
          >
            ➕ Novo Cedente
          </button>
          <button 
            onClick={salvarAlteracoes} 
            disabled={salvando} 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition-all"
          >
            {salvando ? "⏳ Gravando..." : "💾 Salvar Alterações"}
          </button>
        </div>
      </div>

      {/* 📊 PAINEL DE METRICAS INTERATIVAS (MASTIGADO PARA A DIRETORIA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={() => setFiltroStatus("TODOS")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-center ${filtroStatus === "TODOS" ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider ${filtroStatus === "TODOS" ? "text-slate-400" : "text-slate-400"}`}>Geral na Esteira</span>
          <span className="text-2xl font-black font-mono mt-1">{kpisEsteira.total}</span>
        </button>

        <button 
          onClick={() => setFiltroStatus("PENDENTE_ENVIO")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-rose-500 flex flex-col justify-center ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-500 text-white border-rose-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider ${filtroStatus === "PENDENTE_ENVIO" ? "text-rose-100" : "text-rose-600"}`}>🛑 Contrato Pendente Envio</span>
          <span className="text-2xl font-black font-mono mt-1">{kpisEsteira.pendenteEnvio}</span>
        </button>

        <button 
          onClick={() => setFiltroStatus("AGUARDANDO_ASSINATURA")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-amber-500 flex flex-col justify-center ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "bg-amber-500 text-white border-amber-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "text-amber-100" : "text-amber-600"}`}>⏳ Aguardando Assinatura</span>
          <span className="text-2xl font-black font-mono mt-1">{kpisEsteira.aguardandoAssinatura}</span>
        </button>

        <button 
          onClick={() => setFiltroStatus("APTO")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all border-l-4 border-l-emerald-500 flex flex-col justify-center ${filtroStatus === "APTO" ? "bg-emerald-500 text-white border-emerald-600 shadow-md" : "bg-white border-slate-200 hover:bg-slate-50"}`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider ${filtroStatus === "APTO" ? "text-emerald-100" : "text-emerald-600"}`}>🎉 Prontos (Apto a Operar)</span>
          <span className="text-2xl font-black font-mono mt-1">{kpisEsteira.aptos}</span>
        </button>
      </div>

      {/* TABELA DE OPERAÇÃO GRANULAR */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1450px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
              <th className="p-3 w-56 pl-5">Cedente</th>
              {usuarioAtual?.perfil !== "comercial" && (
                <th className="p-3 w-36 text-center text-blue-600">Comercial Resp.</th>
              )}
              <th className="p-3 text-center w-28">Limite (BRL)</th>
              <th className="p-3 text-center w-20">Taxa (%)</th>
              <th className="p-3 text-center w-24">Docs Auditados</th>
              <th className="p-3 text-center w-36">Contrato Sec</th>
              <th className="p-3 text-center w-36">Contrato Fidc</th>
              <th className="p-3 text-center w-32">Cadastro Adm</th>
              <th className="p-3 text-center w-24">Apto</th>
              <th className="p-3 min-w-[200px]">Observações de Trava</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {cedentesFiltrados.map((item) => {
              // Encontra o index real no array principal para disparar a alteração local
              const index = cedentes.findIndex(c => c === item);
              
              return (
                <tr key={item.id || `novo-${index}`} className={`hover:bg-slate-50/50 transition-colors ${item._isNovo ? "bg-blue-50/20" : ""} ${item._isEditado && !item._isNovo ? "bg-amber-50/10" : ""}`}>
                  
                  {/* Nome do Cedente */}
                  <td className="p-3 font-bold text-slate-900 pl-5">
                    {item._isNovo ? (
                      <input 
                        type="text" 
                        placeholder="NOME DA EMPRESA" 
                        value={item.cedente} 
                        onChange={(e) => handleInputChange(index, "cedente", e.target.value.toUpperCase())} 
                        className="w-full p-1.5 border border-blue-300 rounded outline-none focus:border-blue-600 font-black text-xs uppercase bg-white shadow-sm" 
                        autoFocus
                      />
                    ) : (
                      item.cedente
                    )}
                  </td>

                  {/* Comercial Responsável */}
                  {usuarioAtual?.perfil !== "comercial" && (
                    <td className="p-2 text-center">
                       <input 
                         type="text" 
                         value={item.comercial || ""} 
                         onChange={(e) => handleInputChange(index, "comercial", e.target.value)} 
                         className="w-full p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold text-blue-700 bg-transparent" 
                         placeholder="Comercial"
                       />
                    </td>
                  )}

                  {/* Limite */}
                  <td className="p-2 text-center">
                    <input type="text" value={item.limite || ""} onChange={(e) => handleInputChange(index, "limite", e.target.value)} className="w-full p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold font-mono" placeholder="R$ 0,00" />
                  </td>
                  
                  {/* Taxa */}
                  <td className="p-2 text-center">
                    <input type="text" value={item.taxa || ""} onChange={(e) => handleInputChange(index, "taxa", e.target.value)} className="w-full p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold font-mono" placeholder="0,00%" />
                  </td>

                  {/* Auditoria Docs */}
                  <td className="p-2 text-center">
                    <div className="flex gap-2 justify-center text-xs font-bold">
                      <label className="text-emerald-600 cursor-pointer flex items-center gap-1">
                        <input type="radio" checked={item.docs_ok === true} onChange={() => handleInputChange(index, "docs_ok", true)} /> ✔
                      </label>
                      <label className="text-red-500 cursor-pointer flex items-center gap-1">
                        <input type="radio" checked={item.docs_ok === false} onChange={() => handleInputChange(index, "docs_ok", false)} /> ✖
                      </label>
                    </div>
                  </td>

                  {/* Contrato Securitizadora */}
                  <td className="p-2 text-center bg-slate-50/50">
                    <div className="flex flex-col gap-1 items-center">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${item.data_5 ? (item.data_6 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200") : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"}`}>
                        {item.data_5 ? (item.data_6 ? "Assinado" : "Aguardando") : "Não Enviado"}
                      </span>
                      <div className="flex items-center gap-1">
                        <input type="date" value={item.data_5 || ""} title="Data de Envio" onChange={(e) => handleInputChange(index, "data_5", e.target.value)} className="p-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold text-slate-500" />
                        <input type="date" value={item.data_6 || ""} title="Data de Assinatura" onChange={(e) => handleInputChange(index, "data_6", e.target.value)} className="p-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold text-slate-500" />
                      </div>
                    </div>
                  </td>

                  {/* Contrato FIDC */}
                  <td className="p-2 text-center bg-slate-50/50">
                    <div className="flex flex-col gap-1 items-center">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${item.data_7 ? (item.data_8 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200") : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"}`}>
                        {item.data_7 ? (item.data_8 ? "Assinado" : "Aguardando") : "Não Enviado"}
                      </span>
                      <div className="flex items-center gap-1">
                        <input type="date" value={item.data_7 || ""} title="Data de Envio" onChange={(e) => handleInputChange(index, "data_7", e.target.value)} className="p-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold text-slate-500" />
                        <input type="date" value={item.data_8 || ""} title="Data de Assinatura" onChange={(e) => handleInputChange(index, "data_8", e.target.value)} className="p-0.5 border border-slate-200 rounded text-[10px] outline-none font-bold text-slate-500" />
                      </div>
                    </div>
                  </td>

                  {/* Cadastro Administrativo (Sistemas) */}
                  <td className="p-2 text-center">
                    <input type="date" value={item.data_9 || ""} title="Cadastro no Sistema" onChange={(e) => handleInputChange(index, "data_9", e.target.value)} className="w-full p-1 border border-slate-200 rounded text-[11px] text-center outline-none font-bold text-slate-500" />
                  </td>

                  {/* Status Final (Apto) */}
                  <td className="p-2 text-center bg-slate-50/20">
                    <div className="flex gap-2 justify-center text-xs font-bold">
                      <label className="text-emerald-600 cursor-pointer flex items-center gap-1" title="Apto">
                        <input type="radio" checked={item.apto === true} onChange={() => handleInputChange(index, "apto", true)} /> 🎉
                      </label>
                      <label className="text-red-500 cursor-pointer flex items-center gap-1" title="Travado">
                        <input type="radio" checked={item.apto === false} onChange={() => handleInputChange(index, "apto", false)} /> 🛑
                      </label>
                    </div>
                  </td>

                  {/* Observações de Impasse */}
                  <td className="p-2 pr-5">
                    <textarea value={item.obs || ""} onChange={(e) => handleInputChange(index, "obs", e.target.value)} className="w-full p-1.5 border border-slate-200 rounded text-xs h-9 resize-none outline-none focus:border-blue-500 bg-transparent font-medium" placeholder="Ex: Aguardando certidão de objeto..." />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}