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

const formatarMoeda = (valor: string | number) => {
  const num = typeof valor === "string" ? parseFloat(valor.replace(/\D/g, "")) / 100 : valor;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num || 0);
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function ControleCadastroPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Controle do Modal de Edição Rápida
  const [cedenteSelecionado, setCedenteSelecionado] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const { data } = await supabase.from("cadastro_cedentes").select("*");
      if (data) {
        setCedentes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ==========================================
  // LÓGICA DE DISTRIBUIÇÃO DAS FASES (GARGALOS)
  // ==========================================
  const pipeline = useMemo(() => {
    const colunas = {
      DOCS: { titulo: "Pendente Documentos", cor: "bg-rose-500", corBg: "bg-rose-50", responsável: "Comercial / Cliente", itens: [] as any[] },
      CONTRATO: { titulo: "Gerar Contratos", cor: "bg-amber-500", corBg: "bg-amber-50", responsável: "Backoffice / Formalização", itens: [] as any[] },
      ASSINATURA: { titulo: "Em Assinatura", cor: "bg-indigo-500", corBg: "bg-indigo-50", responsável: "Comercial / Cliente", itens: [] as any[] },
      FUNDOS: { titulo: "Validação Fundos (FIDC)", cor: "bg-fuchsia-500", corBg: "bg-fuchsia-50", responsável: "Gestora / Admin", itens: [] as any[] },
    };

    cedentes.forEach(c => {
      // Ignora se não passou do comitê ainda (não entrou na esteira de fato)
      if (!c.dt_aprovacao_comite) return;

      const secPronto = c.nao_opera_sec || c.dt_apto_sec;
      const fidcPronto = c.nao_opera_fidc || c.dt_apto_fidc;

      // Se já está 100% apto a operar, não aparece no radar do Gestor como pendência
      if (secPronto && fidcPronto) return;

      // 1. Gargalo: Documentos (Falta receber ou aprovar docs)
      if ((!c.nao_opera_sec && !c.dt_documentos_sec) || (!c.nao_opera_fidc && !c.dt_documentos_fidc)) {
        colunas.DOCS.itens.push(c);
        return;
      }

      // 2. Gargalo: Geração de Contrato (Docs Ok, falta a formalização fazer o contrato)
      if ((!c.nao_opera_sec && !c.dt_geracao_contrato_sec) || (!c.nao_opera_fidc && !c.dt_geracao_contrato_fidc)) {
        colunas.CONTRATO.itens.push(c);
        return;
      }

      // 3. Gargalo: Assinatura (Contrato gerado, falta assinarem)
      if ((!c.nao_opera_sec && !c.dt_assinatura_contrato_sec) || (!c.nao_opera_fidc && !c.dt_assinatura_contrato_fidc)) {
        colunas.ASSINATURA.itens.push(c);
        return;
      }

      // 4. Gargalo: Fundos Externos (Assinou, mas o FIDC tá enrolando)
      if (!c.nao_opera_fidc && !c.dt_apto_fidc) {
        colunas.FUNDOS.itens.push(c);
        return;
      }
    });

    // Ordenar os itens dentro de cada coluna por quem está aguardando há mais tempo (SLA)
    Object.values(colunas).forEach(coluna => {
      coluna.itens.sort((a, b) => calcularDias(b.dt_aprovacao_comite) - calcularDias(a.dt_aprovacao_comite));
    });

    return colunas;
  }, [cedentes]);

  // ==========================================
  // FUNÇÕES DE AÇÃO RÁPIDA
  // ==========================================
  const atualizarDataHoje = async (campo: string) => {
    if (!cedenteSelecionado) return;
    try {
      setSalvando(true);
      const hoje = new Date().toISOString().split('T')[0];
      const payload = { id: cedenteSelecionado.id, [campo]: hoje };
      
      const { error } = await supabase.from("cadastro_cedentes").update(payload).eq("id", cedenteSelecionado.id);
      if (error) throw error;
      
      // Atualiza o estado local para fechar/refletir na hora
      setCedentes(prev => prev.map(c => c.id === cedenteSelecionado.id ? { ...c, [campo]: hoje } : c));
      setCedenteSelecionado({ ...cedenteSelecionado, [campo]: hoje });
    } catch (err) {
      alert("Erro ao atualizar data.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Carregando painel gerencial...</div>;

  return (
    <div className="min-h-screen bg-slate-100/50 p-4 md:p-8 font-sans">
      
      {/* HEADER GERENCIAL */}
      <div className="max-w-[1800px] mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="p-2 bg-indigo-600 text-white rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </span>
            Radar de Implantação (Gargalos)
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1 ml-12">
            Visão focada nos cadastros em andamento. Descubra onde está travado e quem cobrar.
          </p>
        </div>
        <div className="flex gap-4 mt-4 md:mt-0">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Total em Trâmite</span>
            <span className="text-2xl font-black text-slate-700">{Object.values(pipeline).reduce((acc, col) => acc + col.itens.length, 0)}</span>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div className="max-w-[1800px] mx-auto flex gap-6 overflow-x-auto pb-8 custom-scrollbar items-start">
        {Object.entries(pipeline).map(([chave, coluna]) => (
          <div key={chave} className={`min-w-[320px] w-[320px] flex-shrink-0 flex flex-col rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden bg-slate-50/50`}>
            
            {/* CABEÇALHO DA COLUNA */}
            <div className={`p-4 border-b border-slate-200 ${coluna.corBg}`}>
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-black text-slate-800 uppercase tracking-tight">{coluna.titulo}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${coluna.cor}`}>
                  {coluna.itens.length}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                Cobrar: <span className="text-slate-700">{coluna.responsável}</span>
              </p>
            </div>

            {/* CARTÕES */}
            <div className="p-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
              {coluna.itens.length === 0 ? (
                <div className="p-6 text-center text-xs font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  Nenhuma pendência nesta fase.
                </div>
              ) : (
                coluna.itens.map(item => {
                  const diasFase = calcularDias(item.dt_aprovacao_comite);
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setCedenteSelecionado(item)}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden"
                    >
                      {/* Borda lateral indicativa de SLA */}
                      <div className={`absolute left-0 top-0 w-1.5 h-full ${diasFase > 7 ? "bg-rose-500" : diasFase > 3 ? "bg-amber-400" : "bg-emerald-400"}`}></div>
                      
                      <div className="pl-2">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">{formatarCNPJ(item.cnpj)}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diasFase > 7 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                            {diasFase} dias na esteira
                          </span>
                        </div>
                        
                        <h4 className="font-extrabold text-slate-800 text-sm leading-tight mb-1 group-hover:text-indigo-700 transition-colors">
                          {item.cedente}
                        </h4>
                        
                        {item.grupo_economico && (
                          <span className="inline-block bg-indigo-50 text-indigo-600 text-[9px] font-bold px-1.5 py-0.5 rounded mb-2 uppercase tracking-wider">
                            Grupo: {item.grupo_economico}
                          </span>
                        )}

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {item.comercial ? item.comercial.charAt(0).toUpperCase() : "?"}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[10px] text-slate-500 uppercase font-semibold">Comercial</p>
                            <p className="text-xs font-bold text-slate-700 truncate">{item.comercial || "Não definido"}</p>
                          </div>
                        </div>

                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* =========================================================
          MODAL DE AÇÃO RÁPIDA (CONTROLE DO GESTOR)
      ========================================================= */}
      {cedenteSelecionado && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Ação Rápida</span>
                <h2 className="text-xl font-black text-slate-800 mt-1 leading-tight">{cedenteSelecionado.cedente}</h2>
                <p className="text-xs text-slate-500 font-mono mt-1">{formatarCNPJ(cedenteSelecionado.cnpj)}</p>
              </div>
              <button onClick={() => setCedenteSelecionado(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 shadow-sm border border-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Corpo Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Info Resumo */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase">Comercial Resp.</p>
                  <p className="text-sm font-black text-indigo-900">{cedenteSelecionado.comercial || "Sem Comercial"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase">Limite Aprovado</p>
                  <p className="text-sm font-black text-indigo-900">{cedenteSelecionado.limite || "Não def."}</p>
                </div>
              </div>

              {/* Botão de Cobrança Rápida */}
              <a 
                href={`mailto:?subject=Cobrança: Pendência no Cadastro de ${cedenteSelecionado.cedente}&body=Olá ${cedenteSelecionado.comercial},%0D%0A%0D%0AO cadastro da empresa ${cedenteSelecionado.cedente} está parado na esteira há ${calcularDias(cedenteSelecionado.dt_aprovacao_comite)} dias.%0D%0A%0D%0APor favor, verifique a pendência para darmos andamento.`}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl font-bold text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Cobrar Responsável (E-mail)
              </a>

              {/* Checklist de Progresso (SEC e FIDC Juntos) */}
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Destravar Etapas (Marcar com data de hoje)</h3>
                
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
                            onClick={() => atualizarDataHoje(etapa.campo)}
                            disabled={salvando}
                            className="text-[10px] font-black uppercase bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-500 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                          >
                            Dar Check ✔
                          </button>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-100 px-2 py-1 rounded">
                            Concluído
                          </span>
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

      {/* ANIMAÇÕES E SCROLL */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
}