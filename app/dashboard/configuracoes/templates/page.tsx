/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Template {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  cc?: string; 
}

export default function GerenciarTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  const [inputNome, setInputNome] = useState("");
  const [inputAssunto, setInputAssunto] = useState("");
  const [inputCc, setInputCc] = useState("");
  const [inputCorpo, setInputCorpo] = useState("");

  const carregarTemplates = async () => {
    try {
      setCarregando(true);
      const { data, error } = await supabase.from("crm_email_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setTemplates(data);
    } catch (err: any) { 
      alert(`Erro ao carregar templates: ${err.message}`); 
    } finally { 
      setCarregando(false); 
    }
  };

  useEffect(() => { carregarTemplates(); }, []);

  const handleSalvarTemplate = async () => {
    if (!inputNome || !inputAssunto || !inputCorpo) return alert("Nome, assunto e corpo são obrigatórios.");

    try {
      setCarregando(true);
      
      const payload = { 
        nome: inputNome, 
        assunto: inputAssunto, 
        corpo: inputCorpo, 
        cc: inputCc 
      };

      if (modoEdicao && idSelecionado) {
        const { error } = await supabase.from("crm_email_templates").update(payload).eq("id", idSelecionado);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_email_templates").insert([payload]);
        if (error) throw error;
      }

      alert("Template salvo com sucesso!");
      setModalAberto(false);
      await carregarTemplates();
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setCarregando(false); 
    }
  };

  const handleDeletarTemplate = async (id: string) => {
    if (!confirm("Deseja mesmo excluir permanentemente este template de e-mail?")) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("crm_email_templates").delete().eq("id", id);
      if (error) throw error;
      await carregarTemplates();
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setCarregando(false); 
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">📝 Central de Templates de E-mail</h1>
          <p className="text-xs text-slate-400">Desenhe os roteiros de e-mail padrões da operação.</p>
        </div>
        <button 
          onClick={() => { 
            setModoEdicao(false); 
            setInputNome(""); 
            setInputAssunto(""); 
            setInputCc(""); 
            setInputCorpo(""); 
            setModalAberto(true); 
          }} 
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-md transition-colors"
        >
          ➕ Novo Template Comercial
        </button>
      </div>

      {carregando && <div className="p-2 text-center bg-purple-50 text-purple-600 rounded-lg animate-pulse font-bold text-[11px]">Sincronizando banco de dados...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map(t => (
          <div key={t.id} className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 bg-slate-50/50 hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div>
              <h3 className="font-black text-slate-900 uppercase text-[13px] truncate pr-2">{t.nome}</h3>
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-purple-700 font-bold font-mono truncate bg-purple-50 px-2 py-1 rounded border border-purple-100" title={t.assunto}>
                  🏷️ {t.assunto}
                </p>
                {t.cc && (
                  <p className="text-[10px] text-slate-500 font-bold font-mono truncate bg-slate-100 px-2 py-1 rounded border border-slate-200" title={t.cc}>
                    👥 CC: {t.cc}
                  </p>
                )}
              </div>
              <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200 shadow-inner h-28 overflow-hidden relative">
                <p className="text-[11px] text-slate-500 font-medium whitespace-pre-wrap">{t.corpo}</p>
                <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-white to-transparent"></div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button 
                onClick={() => { 
                  setModoEdicao(true); 
                  setIdSelecionado(t.id); 
                  setInputNome(t.nome); 
                  setInputAssunto(t.assunto); 
                  setInputCc(t.cc || ""); 
                  setInputCorpo(t.corpo); 
                  setModalAberto(true); 
                }} 
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] rounded-md transition-colors shadow-sm flex items-center gap-1"
              >
                ✏️ Editar
              </button>
              <button 
                onClick={() => handleDeletarTemplate(t.id)} 
                className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-black uppercase text-[10px] rounded-md hover:bg-rose-100 transition-colors flex items-center gap-1"
              >
                🗑️ Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-black uppercase text-slate-900 text-sm flex items-center gap-2">
                {modoEdicao ? "⚙️ Editar Roteiro Existente" : "➕ Criar Novo Roteiro"}
              </h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
            </div>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-4">
              
              {/* PAINEL DE INSTRUÇÕES DE TAGS */}
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-sm">
                <span className="font-black uppercase block text-[11px] text-purple-900 mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Tags Dinâmicas Disponíveis:
                </span>
                <p className="text-[10px] text-purple-700 mb-3 font-medium">Copie e cole as tags abaixo no Assunto ou Corpo do e-mail. Elas serão substituídas automaticamente pelos dados do cliente no momento do envio.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono font-bold text-[10px]">
                  <div className="bg-white p-2.5 rounded-lg border border-purple-100 flex flex-col gap-1.5 shadow-sm">
                    <span className="text-indigo-700 flex justify-between items-center border-b border-slate-50 pb-1">{"{empresa}"} <span className="text-slate-400 font-sans font-medium text-[9px]">Nome do Cedente</span></span>
                    <span className="text-indigo-700 flex justify-between items-center border-b border-slate-50 pb-1">{"{cnpj}"} <span className="text-slate-400 font-sans font-medium text-[9px]">CNPJ Formatado</span></span>
                    <span className="text-indigo-700 flex justify-between items-center border-b border-slate-50 pb-1">{"{contato}"} <span className="text-slate-400 font-sans font-medium text-[9px]">1º Nome do Comercial</span></span>
                    <span className="text-blue-700 flex justify-between items-center pt-0.5">{"{comercial}"} <span className="text-slate-400 font-sans font-medium text-[9px]">Nome Completo Com.</span></span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-purple-100 flex flex-col gap-1.5 shadow-sm">
                    <span className="text-emerald-700 flex justify-between items-center border-b border-slate-50 pb-1">{"{limite}"} <span className="text-slate-400 font-sans font-medium text-[9px]">Limite Aprovado</span></span>
                    <span className="text-emerald-700 flex justify-between items-center border-b border-slate-50 pb-1">{"{taxa}"} <span className="text-slate-400 font-sans font-medium text-[9px]">Taxa Aprovada</span></span>
                    {/* 🔥 NOVAS TAGS INJETADAS NA INSTRUÇÃO */}
                    <span className="text-rose-600 flex justify-between items-center border-b border-slate-50 pb-1">{"{documentos}"} <span className="text-slate-400 font-sans font-medium text-[9px]">Lista de Docs Pendentes</span></span>
                    <span className="text-amber-600 flex justify-between items-center pt-0.5">{"{fundo}"} <span className="text-slate-400 font-sans font-medium text-[9px]">Nome do Fundo (SEC/FIDC)</span></span>
                  </div>
                </div>
              </div>

              {/* CAMPOS DO FORMULÁRIO */}
              <div className="space-y-4 text-xs font-medium text-slate-700">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 ml-1">Identificação Interna do Roteiro:</label>
                  <input 
                    type="text" 
                    value={inputNome} 
                    onChange={e => setInputNome(e.target.value)} 
                    placeholder="Ex: Roteiro Aprovação Comitê - SEC"
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-bold text-slate-900 shadow-sm" 
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 ml-1">Assunto do E-mail:</label>
                    <input 
                      type="text" 
                      value={inputAssunto} 
                      onChange={e => setInputAssunto(e.target.value)} 
                      placeholder="Ex: Aprovação de Crédito - {empresa}"
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-slate-800 shadow-sm" 
                    />
                  </div>
                  <div className="w-full sm:w-1/3">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 ml-1 flex items-center gap-1">
                      Cópia (CC): <span className="text-slate-400 font-normal normal-case">(Opcional)</span>
                    </label>
                    <input 
                      type="text" 
                      value={inputCc} 
                      onChange={e => setInputCc(e.target.value)} 
                      placeholder="email1@..., email2@..." 
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-slate-800 shadow-sm" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 ml-1">Corpo da Mensagem:</label>
                  <textarea 
                    rows={12} 
                    value={inputCorpo} 
                    onChange={e => setInputCorpo(e.target.value)} 
                    placeholder={`Olá {contato},\n\nTemos o prazer de informar que o cadastro da {empresa} foi aprovado na {fundo}...\n\nPara prosseguir, envie os seguintes documentos:\n{documentos}`}
                    className="w-full p-3.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-slate-800 font-sans whitespace-pre-wrap shadow-sm custom-scrollbar resize-y" 
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-slate-100">
              <button 
                onClick={() => setModalAberto(false)} 
                disabled={carregando} 
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl uppercase tracking-wider hover:bg-slate-50 transition-colors disabled:opacity-50 text-[10px]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSalvarTemplate} 
                disabled={carregando} 
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl uppercase tracking-wider shadow-md shadow-purple-500/30 flex items-center gap-2 transition-all disabled:opacity-50 text-[10px]"
              >
                {carregando ? "Salvando..." : "💾 Salvar Roteiro"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ESTILOS DE SCROLL */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}