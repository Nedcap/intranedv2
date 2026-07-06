"use client";

import { useState, ChangeEvent } from "react";

export default function UploadDocs() {
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
    setMensagem("Gerando autorização...");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error || !data.signedUrl) {
        throw new Error(data.error || "Falha ao gerar URL de upload.");
      }

      setMensagem("Enviando para o cofre (Cloudflare R2)...");

      const uploadRes = await fetch(data.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (uploadRes.ok) {
        setMensagem(`✅ Sucesso! Arquivo salvo no R2.`);
        setFile(null);
      } else {
        throw new Error(`Erro no R2: ${uploadRes.statusText}`);
      }
    } catch (err: unknown) {
      console.error("Erro capturado:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      setMensagem("❌ Erro: " + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Nova Análise de Crédito</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Anexar Documento (PDF)
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? "Enviando..." : "Enviar Documento"}
      </button>

      {mensagem && (
        <p className="mt-4 text-sm font-medium text-gray-600 text-center">
          {mensagem}
        </p>
      )}
    </div>
  );
}