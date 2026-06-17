/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Template {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
}

export default function GerenciarTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Estados do Form/Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  const [inputNome, setInputNome] = useState("");
  const [inputAssunto, setInputAssunto] = useState("");
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
    if (!inputNome || !inputAssunto || !inputCorpo) return alert("Todos os campos são obrigatórios.");

    try {
      setCarregando(true);
      const payload = { nome: inputNome, assunto: inputAssunto, corpo: inputCorpo };

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
    } catch (err: any) { alert(err.message); }
    finally { setCarregando(false); }
  };

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700 bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase">📝 Central de Templates de E-mail (SDR & Pós-Venda)</h1>
          <p className="text-xs text-slate-400">Desenhe os roteiros de e-mail padrões. Use as tags dinâmicas para automatizar a colagem de dados.</p>
        </div>
        <button onClick={() => { setModoEdicao(false); setInputNome(""); setInputAssunto(""); setInputCorpo(""); setModalAberto(true); }} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg uppercase text-[10px] tracking-wider shadow-md">
          ➕ Novo Template Comercial
        </button>
      </div>

      {carregando && <div className="p-2 text-center bg-purple-50 text-purple-600 rounded-lg animate-pulse font-bold text-[11px]">Sincronizando biblioteca de e-mails...</div>}

      {/* GRID DE TEMPLATES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/50 hover:shadow-sm transition-all">
            <div>
              <h3 className="font-black text-slate-900 uppercase text-[12px] truncate">{t.nome}</h3>
              <p className="text-[10px] text-purple-600 font-bold font-mono mt-0.5 truncate">Assunto: {t.assunto}</p>
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-4 bg-white p-2 rounded-lg border font-medium whitespace-pre-wrap">{t.corpo}</p>
            </div>
            <div className="flex justify-end gap-1.5 pt-2 border-t">
              <button onClick={() => { setModoEdicao(true); setIdSelecionado(t.id); setInputNome(t.nome); setInputAssunto(t.assunto); setInputCorpo(t.corpo); setModalAberto(true); }} className="px-2.5 py-1 bg-slate-900 text-white font-black uppercase text-[9px] rounded">✏️ Editar</button>
              <button onClick={() => handleDeletarTemplate(t.id)} className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 font-black uppercase text-[9px] rounded hover:bg-red-100">🗑️ Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CONFIGURADOR */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-5 rounded-2xl max-w-xl w-full space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-black uppercase text-slate-900 text-[11px] border-b pb-1">{modoEdicao ? "⚙️ Editar Roteiro Comercial" : "➕ Desenhar Novo Roteiro Comercial"}</h3>
            
            {/* COLA DE TAGS */}
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-[10px] space-y-1 text-purple-950">
              <span className="font-black uppercase block">💡 Tags Dinâmicas Disponíveis para colar no texto:</span>
              <p>Copie e cole exatamente as chaves abaixo. O robô da NedHub vai trocar os valores automaticamente na hora de enviar:</p>
              <div className="flex gap-2 font-mono font-bold mt-1.5 bg-white p-1.5 rounded border border-purple-200 w-fit">
                <span className="text-emerald-700">{"{contato}"}</span> ➔ Nome da Pessoa |
                <span className="text-blue-700">{"{empresa}"}</span> ➔ Razão Social do CNPJ
              </div>
            </div>

            <div className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Identificação Interna do Template:</label>
                <input type="text" value={inputNome} onChange={e => setInputNome(e.target.value)} placeholder="Ex: [SDR] Primeiro Contato - Apresentação Ned" className="w-full p-2 border rounded-lg bg-slate-50 outline-none font-bold text-slate-800" />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Linha de Assunto (O que o cliente lê):</label>
                <input type="text" value={inputAssunto} onChange={e => setInputAssunto(e.target.value)} placeholder="Ex: Oportunidade de Alavancagem - {empresa}" className="w-full p-2 border rounded-lg bg-slate-50 outline-none text-slate-800 font-medium" />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Corpo da Mensagem (E-mail):</label>
                <textarea rows={8} value={inputCorpo} onChange={e => setInputCorpo(e.target.value)} placeholder="Olá {contato}, avaliamos a estrutura corporativa da {empresa}..." className="w-full p-3 border rounded-lg bg-slate-50 outline-none text-slate-800 font-medium font-sans whitespace-pre-wrap" />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-[10px] pt-2 border-t">
              <button onClick={() => setModalAberto(false)} className="px-3 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg uppercase">Voltar</button>
              <button onClick={handleSalvarTemplate} className="px-5 py-2 bg-purple-600 text-white font-black rounded-lg uppercase shadow-md">💾 Salvar Roteiro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}