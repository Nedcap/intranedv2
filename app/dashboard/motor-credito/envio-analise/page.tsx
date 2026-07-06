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
      setMensagem("Selecione um arquivo primeiro!");
      return;
    }

    setUploading(true);
    setMensagem("Gerando autorização no cofre R2...");

    try {
      // 1. Pede a URL assinada para a API do R2 usando o CNPJ como pasta
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          analiseId: empresa.cnpj.replace(/\D/g, ""), // Usa o CNPJ limpo como identificador da pasta
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error || !data.signedUrl) {
        throw new Error(data.error || "Falha ao gerar URL de upload.");
      }

      setMensagem("Transferindo documento diretamente para o Cloudflare R2...");

      // 2. Upload direto pro R2 via PUT presigned URL
      const uploadRes = await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Erro no Cloudflare R2: ${uploadRes.statusText}`);
      }

      setMensagem("Registrando solicitação na Esteira Supabase...");

      // 3. Cria a linha oficial na tabela que rodamos no banco
      const { error: supaError } = await supabase.from("analises_credito").insert({
        cnpj: empresa.cnpj.replace(/\D/g, ""),
        razao_social: empresa.razao_social,
        uf: empresa.uf,
        cidade: empresa.cidadeExtenso || "",
        capital_social: empresa.capital_social || 0,
        status: "robo_processando",
        dados_documentos: [{ nome: file.name, path: data.path }],
      });

      if (supaError) throw supaError;

      setMensagem("✅ Sucesso! Empresa enviada para o Motor V8.");
      setFile(null);
      
      // Notifica a tela pai para limpar os campos e recarregar a lista
      setTimeout(() => {
        onSucesso();
      }, 1500);

    } catch (err: unknown) {
      console.error("Erro capturado no fluxo:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      setMensagem("❌ Erro: " + errorMessage);
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
        disabled={!file || uploading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-40 shadow-md cursor-pointer"
      >
        {uploading ? "Processando Envio..." : "🚀 Disparar Esteira de Crédito"}
      </button>

      {mensagem && (
        <p className="text-center font-bold text-xs text-slate-600 animate-fade-in mt-2">
          {mensagem}
        </p>
      )}
    </div>
  );
}