"use client";

import { useState, ChangeEvent } from "react";

interface UploadDocsProps {
  empresa: {
    cnpj: string;
    razao_social: string;
    uf: string;
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
    setMensagem("🔄 Solicitando URL assinada à rota /api/upload...");

    const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");

    try {
      // 1. Faz o pedido da Assinatura para a tua API R2
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          analiseId: cnpjLimpo,
        }),
      });

      if (!res.ok) {
        const txtErro = await res.text();
        throw new Error(`A rota /api/upload respondeu com status ${res.status}: ${txtErro}`);
      }
      
      const data = await res.json();
      
      if (!data.signedUrl) {
        throw new Error(data.error || "A API não devolveu o campo 'signedUrl'. Verifica os logs do servidor.");
      }

      setMensagem("📁 Transferindo arquivo diretamente para o Cloudflare R2...");
      
      // 2. PUT direto no Storage da Cloudflare
      const uploadRes = await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`O Cloudflare R2 rejeitou o arquivo. Status: ${uploadRes.statusText}`);
      }
      
      setMensagem("✅ Sucesso! Arquivo guardado no R2.");
      setFile(null);
      
      setTimeout(() => {
        onSucesso();
      }, 1500);

    } catch (err: any) {
      console.error("DEBUG CRÍTICO UPLOAD R2:", err);
      setMensagem(`❌ Falha no Envio: ${err.message}`);
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
        disabled={uploading || !file}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-lg text-xs uppercase tracking-widest transition-all shadow-md cursor-pointer disabled:opacity-40"
      >
        {uploading ? "A transferir para o R2..." : "🚀 Enviar Documentação para Análise"}
      </button>

      {mensagem && (
        <p className="text-center font-bold text-xs text-slate-600 animate-pulse mt-2">
          {mensagem}
        </p>
      )}
    </div>
  );
}