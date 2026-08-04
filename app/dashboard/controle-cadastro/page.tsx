"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ==========================================
// FUNÇÕES DE TEMPO E UTILIDADES
// ==========================================
const calcularDias = (dataInicio: string | null) => {
  if (!dataInicio) return 0;
  const hoje = new Date();
  const inicio = new Date(dataInicio);
  const diffTime = Math.abs(hoje.getTime() - inicio.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatarCNPJ = (cnpj: string) => {
  if (!cnpj) return "";
  let v = cnpj.replace(/\D/g, "");
  if (v.length <= 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, "$1.$2.$3/$4-$5");
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function AgendaPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Controles de UI
  const [cedenteSelecionado, setCedenteSelecionado] = useState<any | null>(null);
  const [modalNovaNota, setModalNovaNota] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Form de anotação manual
  const [formNota, setFormNota] = useState({ titulo: "", descricao: "" });

  const carregarDados = async () => {
    try {
      setCarregando(true);
      // Busca os cadastros da esteira
      const { data: dataCedentes } = await supabase.from("cadastro_cedentes").select("*");
      // Busca a agenda/configurações do usuário (anotações e itens ocultos)
      const { data: dataNotas } = await supabase.from("agenda_usuario").select("*");
      
      if (dataCedentes) setCedentes(dataCedentes);
      if (dataNotas) setNotas(dataNotas);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ==========================================
  // LÓGICA UNIFICADA DA AGENDA
  // ==========================================
  const agenda = useMemo(() => {
    const itensAgenda: any[] = [];

    // 1. PROCESSA AS PENDÊNCIAS DO SISTEMA
    cedentes.forEach(c => {
      if (!c.dt_aprovacao_comite) return;

      const secPronto = c.nao_opera_sec || c.dt_apto_sec;
      const fidcPronto = c.nao_opera_fidc || c.dt_apto_fidc;
      if (secPronto && fidcPronto) return;

      // Verifica se o usuário ocultou este card da view dele
      const notaRelacionada = notas.find(n => n.cedente_id === c.id);
      if (notaRelacionada?.oculto) return; // Se tá oculto, ignora!

      // Descobre qual é a pendência atual
      let gargalo = "";
      let corGargalo = "";

      if ((!c.nao_opera_sec && !c.dt_documentos_sec) || (!c.nao_opera_fidc && !c.dt_documentos_fidc)) {
        gargalo = "Falta Documentação"; corGargalo = "bg-rose-100 text-rose-700 border-rose-200";
      } else if ((!c.nao_opera_sec && !c.dt_geracao_contrato_sec) || (!c.nao_opera_fidc && !c.dt_geracao_contrato_fidc)) {
        gargalo = "Gerar Contratos"; corGargalo = "bg-amber-100 text-amber-700 border-amber-200";
      } else if ((!c.nao_opera_sec && !c.dt_assinatura_contrato_sec) || (!c.nao_opera_fidc && !c.dt_assinatura_contrato_fidc)) {
        gargalo = "Em Assinatura"; corGargalo = "bg-indigo-100 text-indigo-700 border-indigo-200";
      } else if (!c.nao_opera_fidc && !c.dt_apto_fidc) {
        gargalo = "Validação FIDC"; corGargalo = "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200";
      }

      if (gargalo) {
        itensAgenda.push({
          id: c.id,
          tipo: "SISTEMA",
          titulo: c.cedente,
          subtitulo: formatarCNPJ(c.cnpj),
          etiqueta: gargalo,
          cor: corGargalo,
          dias: calcularDias(c.dt_aprovacao_comite),
          dadosOriginais: c
        });
      }
    });

    // 2. PROCESSA AS ANOTAÇÕES MANUAIS
    notas.forEach(n => {
      // Pega apenas notas manuais (sem cedente atrelado) e que não estão ocultadas/excluídas
      if (!n.cedente_id && !n.oculto) {
        itensAgenda.push({
          id: n.id,
          tipo: "MANUAL",
          titulo: n.titulo,
          subtitulo: n.descricao,
          etiqueta: "Anotação Pessoal",
          cor: "bg-slate-100 text-slate-700 border-slate-200",
          dias: calcularDias(n.criado_em),
          dadosOriginais: n
        });
      }
    });

    // Ordena: Anotações novas primeiro, depois os com mais dias atrasados do sistema
    return itensAgenda.sort((a, b) => b.dias - a.dias);
  }, [cedentes, notas]);

  // ==========================================
  // AÇÕES RÁPIDAS
  // ==========================================
  
  // Oculta um card do sistema ou deleta um manual da view
  const ocultarCard = async (item: any) => {
    try {
      if (item.tipo === "SISTEMA") {
        // Cria um registro para ocultar o card do cedente
        const { data, error } = await supabase.from("agenda_usuario").insert([{
          cedente_id: item.id,
          titulo: `Oculto: ${item.titulo}`,
          oculto: true
        }]).select();
        
        if (!error && data) {
          setNotas(prev => [...prev, data[0]]);
        }
      } else {
        // Atualiza a nota manual para oculta
        await supabase.from("agenda_usuario").update({ oculto: true }).eq("id", item.id);
        setNotas(prev => prev.filter(n => n.id !== item.id)); // Remove da view local na hora
      }
    } catch (err) {
      alert("Erro ao ocultar card.");
    }
  };

  const salvarNotaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNota.titulo) return;
    setSalvando(true);
    
    try {
      const { data, error } = await supabase.from("agenda_usuario").insert([{
        titulo: formNota.titulo,
        descricao: formNota.descricao,
        oculto: false
      }]).select();

      if (error) throw error;
      if (data) setNotas(prev => [...prev, data[0]]);
      
      setFormNota({ titulo: "", descricao: "" });
      setModalNovaNota(false);
    } catch (err) {
      alert("Erro ao salvar anotação.");
    } finally {
      setSalvando(false);
    }
  };

  const destravarEtapaSistema = async (campo: string) => {
    if (!cedenteSelecionado) return;
    try {
      setSalvando(true);
      const hoje = new Date().toISOString().split('T')[0];
      
      await supabase.from("cadastro_cedentes").update({ [campo]: hoje }).eq("id", cedenteSelecionado.id);
      
      // Atualiza estado local
      setCedentes(prev => prev.map(c => c.id === cedenteSelecionado.id ? { ...c, [campo]: hoje } : c));
      setCedenteSelecionado({ ...cedenteSelecionado, [campo]: hoje });
    } catch (err) {
      alert("Erro ao atualizar data.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Carregando sua agenda...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      
      {/* HEADER AGENDA */}
      <div className="max-w-[1200px] mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="p-2 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Minha Agenda & Prioridades
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1 ml-12">
            Tarefas automáticas do sistema e suas anotações pessoais em um só lugar.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={() => setModalNovaNota(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Nova Anotação
          </button>
        </div>
      </div>

      {/* MURAL DE CARDS */}
      <div className="max-w-[1200px] mx-auto">
        {agenda.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-400 font-medium">Sua agenda está limpa! Nenhuma pendência ou anotação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agenda.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
                
                {/* Etiqueta de status / tipo */}
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border ${item.cor}`}>
                    {item.etiqueta}
                  </span>
                  
                  {/* Botão de Ocultar (Aparece no Hover ou mobile) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); ocultarCard(item); }}
                    title="Ocultar da Agenda"
                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  </button>
                </div>

                <div className="flex-1 cursor-pointer" onClick={() => item.tipo === "SISTEMA" && setCedenteSelecionado(item.dadosOriginais)}>
                  <h3 className="text-base font-extrabold text-slate-800 leading-tight mb-1">{item.titulo}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-3 mb-4">{item.subtitulo}</p>
                </div>

                {/* Rodapé do card */}
                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400">
                    {item.tipo === "SISTEMA" ? `Na esteira há ${item.dias} dias` : `Criado há ${item.dias} dias`}
                  </span>
                  
                  {item.tipo === "SISTEMA" && (
                    <button 
                      onClick={() => setCedenteSelecionado(item.dadosOriginais)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      Resolver <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================
          MODAL: NOVA ANOTAÇÃO MANUAL
      ========================================================= */}
      {modalNovaNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-black text-slate-800">Nova Anotação Pessoal</h2>
              <button onClick={() => setModalNovaNota(false)} className="text-slate-400 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={salvarNotaManual} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Título</label>
                <input 
                  type="text" required autoFocus
                  className="w-full border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Ligar para o cliente X..."
                  value={formNota.titulo} onChange={e => setFormNota({...formNota, titulo: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Detalhes (Opcional)</label>
                <textarea 
                  rows={4}
                  className="w-full border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  placeholder="Escreva os detalhes da anotação..."
                  value={formNota.descricao} onChange={e => setFormNota({...formNota, descricao: e.target.value})}
                />
              </div>
              <button 
                type="submit" disabled={salvando}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold text-sm transition-colors mt-2"
              >
                {salvando ? "Salvando..." : "Salvar na Agenda"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: RESOLVER PENDÊNCIA DO SISTEMA (Ação Rápida Antiga)
      ========================================================= */}
      {cedenteSelecionado && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Resolver Pendência</span>
                <h2 className="text-xl font-black text-slate-800 mt-1 leading-tight">{cedenteSelecionado.cedente}</h2>
                <p className="text-xs text-slate-500 font-mono mt-1">{formatarCNPJ(cedenteSelecionado.cnpj)}</p>
              </div>
              <button onClick={() => setCedenteSelecionado(null)} className="p-2 bg-white rounded-full text-slate-400 border border-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Destravar Etapas</h3>
                <div className="space-y-3">
                  {[
                    { label: "Documentação Recebida (SEC)", campo: "dt_documentos_sec", exibe: !cedenteSelecionado.nao_opera_sec },
                    { label: "Documentação Recebida (FIDC)", campo: "dt_documentos_fidc", exibe: !cedenteSelecionado.nao_opera_fidc },
                    { label: "Contrato Gerado (SEC)", campo: "dt_geracao_contrato_sec", exibe: !cedenteSelecionado.nao_opera_sec },
                    { label: "Contrato Gerado (FIDC)", campo: "dt_geracao_contrato_fidc", exibe: !cedenteSelecionado.nao_opera_fidc },
                    { label: "Contrato Assinado (SEC)", campo: "dt_assinatura_contrato_sec", exibe: !cedenteSelecionado.nao_opera_sec },
                    { label: "Contrato Assinado (FIDC)", campo: "dt_assinatura_contrato_fidc", exibe: !cedenteSelecionado.nao_opera_fidc },
                    { label: "Apto para Operar (SEC)", campo: "dt_apto_sec", exibe: !cedenteSelecionado.nao_opera_sec },
                    { label: "Apto para Operar (FIDC)", campo: "dt_apto_fidc", exibe: !cedenteSelecionado.nao_opera_fidc }
                  ].map(etapa => {
                    if (!etapa.exibe) return null;
                    const feito = !!cedenteSelecionado[etapa.campo];
                    
                    return (
                      <div key={etapa.campo} className={`flex items-center justify-between p-3 rounded-lg border ${feito ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
                        <span className={`text-sm font-semibold ${feito ? "text-emerald-700 line-through opacity-70" : "text-slate-700"}`}>
                          {etapa.label}
                        </span>
                        {!feito ? (
                          <button 
                            onClick={() => destravarEtapaSistema(etapa.campo)}
                            disabled={salvando}
                            className="text-[10px] font-black uppercase bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-500 px-3 py-1.5 rounded transition-colors"
                          >
                            Dar Check ✔
                          </button>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-100 px-2 py-1 rounded">Concluído</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANIMAÇÕES */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
}