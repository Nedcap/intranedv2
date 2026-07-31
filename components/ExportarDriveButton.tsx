"use client";
import { useState } from "react";

interface ExportarDriveProps {
  empresaNome: string;
  documentosAuditados: any[]; // Aquele array que a IA gerou os nomes bonitos
}

export default function ExportarDriveButton({ empresaNome, documentosAuditados }: ExportarDriveProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    if (!documentosAuditados || documentosAuditados.length === 0) {
      alert("Nenhum documento auditado para exportar!");
      return;
    }

    setIsExporting(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/exportar-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_nome: empresaNome,
          documentos: documentosAuditados,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro desconhecido na API.");

      setSuccess(true);
      alert(`✅ Dossiê salvo no Google Drive com sucesso!\nForam enviados ${data.arquivos_exportados.length} arquivos renomeados.`);
      
    } catch (error: any) {
      console.error(error);
      alert("❌ Falha na exportação: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || success}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 border
        ${
          success
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:text-indigo-600 hover:border-indigo-300"
        }
      `}
      title="Criar pasta no Google Drive e salvar arquivos renomeados"
    >
      {isExporting ? (
        <>
          <span className="animate-spin">🔄</span> Exportando...
        </>
      ) : success ? (
        <>
          <span>✅</span> Salvo no Drive
        </>
      ) : (
        <>
          <span className="text-sm">📁</span> Enviar pro Drive
        </>
      )}
    </button>
  );
}