/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Template {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  cc?: string; // 🌟 NOVO CAMPO AQUI
}

export default function GerenciarTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  const [inputNome, setInputNome] = useState("");
  const [inputAssunto, setInputAssunto] = useState("");
  const [inputCc, setInputCc] = useState(""); // 🌟 ESTADO DO CC
  const [inputCorpo, setInputCorpo] = useState("");

  const carregarTemplates = async () => {
    try {
      setCarregando(true);
      const { data, error } = await supabase.from("crm_email_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setTemplates(data);
    } catch (err: any) { alert(`Erro ao carregar templates: ${err.message}`); } 
    finally { setCarregando(false); }
  };

  useEffect(() => { carregarTemplates(); }, []);

  const handleSalvarTemplate = async () => {
    if (!inputNome || !inputAssunto || !inputCorpo) return alert("Nome, assunto e corpo são obrigatórios.");

    try {
      setCarregando(true);
      // 🌟 PAYLOAD AGORA ENVIA O CC
      const payload = { nome: inputNome, assunto: inputAssunto, corpo: inputCorpo, cc: inputCc };

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
    } catch (err: any) { alert(err.message); } 
    finally { setCarregando(false); }
  };

  const handleDeletarTemplate = async (id: string) => {
    if (!confirm("Deseja mesmo excluir permanentemente este template de e-mail?")) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("crm_email_templates").delete().eq("id", id);
      if (error) throw error;
      await carregarTemplates();
    } catch (err: any) { alert(err.message); }
    finally { setCarregando(false); }
  };

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">📝 Central de Templates de E-mail</h1>
          <p className="text-xs text-slate-400">Desenhe os roteiros de e-mail padrões.</p>
        </div>
        <button onClick={() => { setModoEdicao(false); setInputNome(""); setInputAssunto(""); setInputCc(""); setInputCorpo(""); setModalAberto(true); }} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-md">
          ➕ Novo Template Comercial
        </button>
      </div>

      {carregando && <div className="p-2 text-center bg-purple-50 text-purple-600 rounded-lg animate-pulse font-bold text-[11px]">Sincronizando...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/50 hover:shadow-sm transition-all">
            <div>
              <h3 className="font-black text-slate-900 uppercase text-[12px] truncate">{t.nome}</h3>
              <p className="text-[10px] text-purple-600 font-bold font-mono mt-0.5 truncate">Assunto: {t.assunto}</p>
              {t.cc && <p className="text-[9px] text-slate-500 font-bold font-mono mt-0.5 truncate">CC: {t.cc}</p>}
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-4 bg-white p-2 rounded-lg border font-medium whitespace-pre-wrap">{t.corpo}</p>
            </div>
            <div className="flex justify-end gap-1.5 pt-2 border-t">
              <button onClick={() => { setModoEdicao(true); setIdSelecionado(t.id); setInputNome(t.nome); setInputAssunto(t.assunto); setInputCc(t.cc || ""); setInputCorpo(t.corpo); setModalAberto(true); }} className="px-2.5 py-1 bg-slate-900 text-white font-black uppercase text-[9px] rounded">✏️ Editar</button>
              <button onClick={() => handleDeletarTemplate(t.id)} className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 font-black uppercase text-[9px] rounded hover:bg-red-100">🗑️ Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-2xl max-w-xl w-full space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-black uppercase text-slate-900 text-[11px] border-b pb-1">{modoEdicao ? "⚙️ Editar Roteiro" : "➕ Novo Roteiro"}</h3>
            
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-[10px] space-y-2 text-purple-950">
              <span className="font-black uppercase block">💡 Tags Dinâmicas Disponíveis:</span>
              <div className="grid grid-cols-2 gap-2 font-mono font-bold mt-2">
                <div className="bg-white p-2 rounded border border-purple-200 flex flex-col gap-1 shadow-sm">
                  <span className="text-indigo-700">{"{empresa}"} <span className="text-slate-400 font-sans font-normal text-[9px] ml-1">Nome do Cedente</span></span>
                  <span className="text-indigo-700">{"{cnpj}"} <span className="text-slate-400 font-sans font-normal text-[9px] ml-1">CNPJ Formatado</span></span>
                  <span className="text-indigo-700">{"{contato}"} <span className="text-slate-400 font-sans font-normal text-[9px] ml-1">Nome do Cliente</span></span>
                </div>
                <div className="bg-white p-2 rounded border border-purple-200 flex flex-col gap-1 shadow-sm">
                  <span className="text-emerald-700">{"{limite}"} <span className="text-slate-400 font-sans font-normal text-[9px] ml-1">Limite Aprovado</span></span>
                  <span className="text-emerald-700">{"{taxa}"} <span className="text-slate-400 font-sans font-normal text-[9px] ml-1">Taxa Aprovada</span></span>
                  <span className="text-blue-700">{"{comercial}"} <span className="text-slate-400 font-sans font-normal text-[9px] ml-1">Nome do Comercial</span></span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Identificação Interna:</label>
                <input type="text" value={inputNome} onChange={e => setInputNome(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50 outline-none font-bold text-slate-800" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Assunto (O que o cliente lê):</label>
                  <input type="text" value={inputAssunto} onChange={e => setInputAssunto(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50 outline-none text-slate-800 font-medium" />
                </div>
                <div className="w-1/3">
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Cópia (CC):</label>
                  <input type="text" value={inputCc} onChange={e => setInputCc(e.target.value)} placeholder="email1@..., email2@..." className="w-full p-2 border rounded-lg bg-slate-50 outline-none text-slate-800 font-medium" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Corpo da Mensagem:</label>
                <textarea rows={8} value={inputCorpo} onChange={e => setInputCorpo(e.target.value)} className="w-full p-3 border rounded-lg bg-slate-50 outline-none text-slate-800 font-medium font-sans whitespace-pre-wrap" />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-[10px] pt-2 border-t">
              <button onClick={() => setModalAberto(false)} disabled={carregando} className="px-3 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg uppercase disabled:opacity-50">Voltar</button>
              <button onClick={handleSalvarTemplate} disabled={carregando} className="px-5 py-2 bg-purple-600 text-white font-black rounded-lg uppercase shadow-md flex items-center gap-2 disabled:opacity-50">
                {carregando ? "Salvando..." : "💾 Salvar Roteiro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}