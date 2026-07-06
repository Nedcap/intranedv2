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
    setMensagem("🔄 Gerando autorização no cofre Cloudflare R2...");

    const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");
    let pathDocumento = `clientes/${cnpjLimpo}/${Date.now()}_${file.name}`;

    try {
      // 1. Pede a URL assinada para a API oficial do R2 que você enviou
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          analiseId: cnpjLimpo, // Pasta organizada por CNPJ
        }),
      });

      if (!res.ok) throw new Error("Falha ao gerar URL de upload no R2.");
      
      const data = await res.json();
      if (data.signedUrl) {
        setMensagem("📁 Transferindo arquivo diretamente para o Cloudflare R2...");
        // 2. PUT direto no R2
        const uploadRes = await fetch(data.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Erro na gravação do bucket R2.");
        if (data.path) pathDocumento = data.path;
      }
    } catch (networkError: any) {
      console.warn("Aviso R2:", networkError.message);
    }

    setMensagem("🚀 Injetando solicitação na esteira de crédito...");

    try {
      // 3. Inserção limpa: Envia APENAS o que o comercial tem de fato.
      // O restante inicia como estrutura vazia prontas para o Excel V8 processar
      const { error: supaError } = await supabase.from("analises_credito").insert({
        cnpj: cnpjLimpo,
        razao_social: empresa.razao_social,
        uf: empresa.uf,
        cidade: empresa.cidadeExtenso || "Curitiba",
        status: "robo_processando",
        dados_documentos: [{ nome: file.name, path: pathDocumento }],
        
        // Inicializa as colunas JSONB vazias (Evita que o analise/page quebre ao ler nulo)
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

      setMensagem("✅ Sucesso! Empresa enviada para a Mesa de Análise.");
      setFile(null);
      
      setTimeout(() => {
        onSucesso();
      }, 1200);

    } catch (err: any) {
      console.error("Erro Supabase:", err);
      setMensagem("❌ Erro de Schema: " + err.message);
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