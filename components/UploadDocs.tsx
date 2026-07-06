"use client";

import { useState, ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";

interface UploadDocsProps {
  empresa: {
    cnpj: string;
    razao_social: string;
    uf: string;
    cidadeExtenso?: string;
    capital_social?: number;
  };
  onSucesso: () => void;
}

export default function UploadDocs({ empresa, onSucesso }: UploadDocsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMensagem("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMensagem("⚠️ Selecione um arquivo PDF primeiro!");
      return;
    }

    setUploading(true);
    setMensagem("🔄 Conectando com a rota de upload...");

    let pathDocumento = `analises/manual/${Date.now()}_${file.name}`;

    try {
      // 1. Tenta buscar a assinatura no servidor Next.js
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          cnpj: empresa.cnpj.replace(/\D/g, ""),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.path) pathDocumento = data.path;
      }
    } catch (networkError) {
      console.warn("⚠️ API local /api/upload offline. Usando contingência para dados.");
    }

    setMensagem("🚀 Salvando registro estruturado no Supabase...");

    try {
      // 2. Injeta a linha oficial mapeando a estrutura completa exigida pelo Excel V8
      const { error: supaError } = await supabase.from("analises_credito").insert({
        cnpj: empresa.cnpj.replace(/\D/g, ""),
        razao_social: empresa.razao_social,
        uf: empresa.uf,
        cidade: empresa.cidadeExtenso || "Curitiba",
        capital_social: empresa.capital_social || 100000,
        status: "robo_processando",
        dados_documentos: [{ nome: file.name, path: pathDocumento }],
        
        // Inicializa os objetos JSONB vazios exigidos pela tipagem do seu Excel V8
        dados_gerais: { fundacao: "", ramo: "", gerente: "Luiz", relacionamento: "Prospect" },
        proposta: { modalidade: "Desconto", limite: 0, prazo: 30, tranche: 0, taxa: 0.04, garantia: "Aval", rating: "C" },
        dados_faturamento: { "2024": {}, "2025": {}, "2026": {} },
        dados_potencial: { ticket_medio: 0, prazo_medio_vendas: 0, vendas_prazo_perc: 100 },
        dados_endividamento: [],
        dados_restritivos: [],
        dados_estrutura_societaria: [],
        dados_juridico: { processos_tramitacao: "", processos_arquivados: "" },
        parecer_comite: ""
      });

      if (supaError) throw supaError;

      setMensagem("✅ Sucesso! Empresa enviada para a Mesa de Crédito.");
      setFile(null);
      
      setTimeout(() => {
        onSucesso();
      }, 1000);

    } catch (err: any) {
      console.error("Erro Supabase:", err);
      setMensagem("❌ Erro no Supabase: " + (err.message || "Verifique as colunas do banco"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
          Anexar Documento para Análise (Contrato Social / Balanço PDF)
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-bold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-lg text-xs uppercase tracking-widest transition-all shadow-md cursor-pointer"
      >
        {uploading ? "Sincronizando..." : "🚀 Disparar Esteira de Crédito"}
      </button>

      {mensagem && (
        <p className="text-center font-bold text-xs text-slate-600 animate-pulse mt-2">
          {mensagem}
        </p>
      )}
    </div>
  );
}