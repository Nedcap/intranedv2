// components/DocumentViewerModal.tsx
"use client";

import { useState, useEffect } from "react";

interface DocItem {
  url: string;
  nome: string;
  cat: string;
  isPdf: boolean;
}

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaNome: string;
  documentosBrutos?: string[];
  documentosAuditados?: any[];
}

export default function DocumentViewerModal({
  isOpen,
  onClose,
  empresaNome,
  documentosBrutos = [],
  documentosAuditados = [],
}: DocumentViewerModalProps) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);

  // Normaliza os documentos para um formato padrão ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      let normalizedList: DocItem[] = [];

      if (documentosAuditados && documentosAuditados.length > 0) {
        normalizedList = documentosAuditados.map((d) => ({
          url: d.url,
          nome: d.nome_descritivo_ia || "Documento Analisado",
          cat: d.categoria_ia || "N/A",
          isPdf: d.url?.toLowerCase().includes(".pdf"),
        }));
      } else if (documentosBrutos && documentosBrutos.length > 0) {
        normalizedList = documentosBrutos.map((url, i) => {
          let nome = `Anexo_${i + 1}`;
          try {
            const partes = url.split(/[?#]/)[0].split("/");
            nome = decodeURIComponent(partes[partes.length - 1]);
          } catch (e) {}
          return {
            url,
            nome,
            cat: "Bruto",
            isPdf: url.toLowerCase().includes(".pdf"),
          };
        });
      }

      setDocs(normalizedList);
      // Auto-seleciona o primeiro documento
      if (normalizedList.length > 0) {
        setActiveDoc(normalizedList[0]);
      }
    } else {
      setDocs([]);
      setActiveDoc(null);
    }
  }, [isOpen, documentosAuditados, documentosBrutos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      <div className="bg-white w-full h-full max-w-[1600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
        
        {/* HEADER DO MODAL */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              📂 Visualizador Dinâmico
            </h2>
            <p className="text-sm text-slate-500 font-medium font-mono mt-1">
              Dossiê: {empresaNome}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm font-bold text-lg"
            title="Fechar Visualizador"
          >
            ✕
          </button>
        </div>

        {/* CORPO DO VISUALIZADOR */}
        <div className="flex-1 flex overflow-hidden bg-slate-100">
          
          {/* BARRA LATERAL (LISTA DE DOCS) */}
          <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
            <div className="p-3 bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider flex justify-between items-center">
              <span>📑 Arquivos ({docs.length})</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {docs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-xl text-xs">
                  Nenhum documento atrelado.
                </div>
              ) : (
                docs.map((doc, i) => {
                  const isActive = activeDoc?.url === doc.url;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveDoc(doc)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group ${
                        isActive
                          ? "bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400 shadow-sm"
                          : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-2xl shrink-0 opacity-80">
                        {doc.isPdf ? "📄" : "🖼️"}
                      </span>
                      <div className="flex flex-col gap-1 overflow-hidden w-full">
                        <span
                          className={`text-xs font-bold truncate ${
                            isActive ? "text-indigo-900" : "text-slate-700"
                          }`}
                          title={doc.nome}
                        >
                          {doc.nome}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold bg-slate-100 w-max px-1.5 py-0.5 rounded">
                          {doc.cat}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ÁREA DE RENDERIZAÇÃO DO DOCUMENTO */}
          <div className="flex-1 bg-slate-200/50 p-4 flex flex-col relative">
            <div className="flex-1 bg-white border border-slate-300 rounded-xl shadow-inner overflow-hidden relative flex flex-col items-center justify-center">
              
              {activeDoc ? (
                <>
                  {/* Botão flutuante de Download individual para ajudar o comercial */}
                  <a 
                    href={activeDoc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute top-4 right-4 z-10 bg-slate-900/80 hover:bg-indigo-600 text-white p-2.5 rounded-lg shadow-lg backdrop-blur text-xs font-bold uppercase flex items-center gap-2 transition-all"
                  >
                    📥 Baixar Arquivo
                  </a>

                  {activeDoc.isPdf ? (
                    <iframe
                      src={`${activeDoc.url}#toolbar=1`}
                      className="w-full h-full border-0"
                      title={activeDoc.nome}
                    />
                  ) : (
                    <div className="w-full h-full overflow-auto p-4 flex items-center justify-center bg-slate-100">
                      <img
                        src={activeDoc.url}
                        alt={activeDoc.nome}
                        className="max-w-full h-auto object-contain rounded shadow-md border border-slate-200 bg-white"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                  <span className="text-5xl opacity-30">📂</span>
                  <span className="font-bold text-xs uppercase tracking-widest">
                    Selecione um arquivo ao lado
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}