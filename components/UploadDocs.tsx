/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, ChangeEvent, useRef } from "react";

interface UploadDocsProps {
  empresa: {
    cnpj: string;
    razao_social: string;
    uf: string;
    cidadeExtenso?: string;
    capital_social?: number;
  };
  onSucesso: (urlsDocumentos: string[], urlsImagens: string[]) => void;
}

interface ArquivoFila {
  id: string;
  file: File;
  tipo: "documento" | "imagem";
  status: "pendente" | "enviando" | "sucesso" | "erro";
  mensagem: string;
}

export default function UploadDocs({ empresa, onSucesso }: UploadDocsProps) {
  const [arquivos, setArquivos] = useState<ArquivoFila[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, tipo: "documento" | "imagem") => {
    if (e.target.files) {
      const novos: ArquivoFila[] = Array.from(e.target.files).map((f, i) => ({
        id: `${Date.now()}-${tipo}-${i}`,
        file: f,
        tipo: tipo,
        status: "pendente",
        mensagem: "Pronto para processamento"
      }));
      setArquivos(prev => [...prev, ...novos]);
    }
    e.target.value = "";
  };

  const removerArquivoDaFila = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  const executarEsteiraUpload = async () => {
    if (arquivos.length === 0) return;
    setUploading(true);

    const urlsDocumentos: string[] = [];
    const urlsImagens: string[] = []; 
    
    // ✅ CORREÇÃO 1: loteId inteligente e controlado usando o CNPJ limpo para evitar pastas duplicadas no R2
    const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");
    const loteId = `lote-${cnpjLimpo || "geral"}-${Date.now()}`;
    const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://sua-url-r2-publica.com";

    try {
      for (let i = 0; i < arquivos.length; i++) {
        const item = arquivos[i];
        if (item.status === "sucesso") continue;

        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "enviando", mensagem: "Enviando para o Cloudflare R2..." } : a));

        try {
          const formData = new FormData();
          formData.append("file", item.file);
          
          const subpasta = item.tipo === "imagem" ? "imagens" : "docs";
          const pathDinamicoR2 = `${loteId}/${subpasta}`;
          formData.append("analiseId", pathDinamicoR2);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          // ✅ CORREÇÃO 2: Intercepta o erro HTTP 413 (Payload Too Large) antes de tentar rodar o parser de JSON
          if (res.status === 413) {
            throw new Error("Arquivo muito grande! O servidor rejeitou por passar do limite de tamanho.");
          }

          // Lê primeiro como texto puro para evitar a quebra do 'Unexpected token R'
          const textoResposta = await res.text();
          let data: any = {};
          
          try {
            data = JSON.parse(textoResposta);
          } catch {
            throw new Error(`Resposta inesperada do servidor (Código ${res.status}). Verifique as configurações de limite.`);
          }

          if (!res.ok || data.error) {
            throw new Error(data.error || `Erro HTTP ${res.status}`);
          }

          const pathCodificado = data.path.split('/').map((segment: string) => encodeURIComponent(segment)).join('/');
          const urlFinalDoArquivo = `${r2BaseUrl}/${pathCodificado}`;
          
          if (item.tipo === "documento") {
             urlsDocumentos.push(urlFinalDoArquivo);
          } else if (item.tipo === "imagem") {
             urlsImagens.push(urlFinalDoArquivo);
          }

          setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "sucesso", mensagem: `✅ Salvo na subpasta /${subpasta}!` } : a));

        } catch (err: any) {
          console.error(err);
          setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "erro", mensagem: err.message } : a));
          
          // ✅ CORREÇÃO 3: Usamos 'continue' em vez de travar o laço inteiro. 
          // Se um arquivo der erro (ex: maior de 5MB), os outros arquivos da fila continuam subindo normalmente!
          continue; 
        }
      }

      // Sincroniza e avança se pelo menos um arquivo do lote subiu com sucesso
      if (urlsDocumentos.length > 0 || urlsImagens.length > 0) {
        setArquivos(prev => prev.map(a => a.status === "sucesso" ? a : { ...a, mensagem: "Arquivo retido devido a erros no lote." }));
        
        setTimeout(() => {
          onSucesso(urlsDocumentos, urlsImagens); 
          // Limpa a fila mantendo na tela apenas os arquivos que falharam para o usuário ver
          setArquivos(prev => prev.filter(a => a.status === "erro"));
        }, 1200);
      }

    } catch (err: any) {
      console.error("❌ [ERRO_ESTEIRA_UPLOAD]:", err);
      alert("⚠️ Erro crítico no envio dos arquivos:\n" + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-700">
      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="file"
          accept="application/pdf, .xlsx, .xls, .csv" 
          multiple
          ref={docInputRef}
          onChange={(e) => handleFileChange(e, "documento")}
          className="hidden"
          disabled={uploading}
        />
        <input
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          multiple
          ref={imgInputRef}
          onChange={(e) => handleFileChange(e, "imagem")}
          className="hidden"
          disabled={uploading}
        />

        <button 
          type="button"
          onClick={() => docInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-lg text-xs tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          📄 Anexar Documentos (PDF, Excel, CSV)
        </button>
        
        <button 
          type="button"
          onClick={() => imgInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold py-3 px-4 rounded-lg text-xs tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          📸 Anexar Fotos da Empresa
        </button>
      </div>

      {arquivos.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
          <div className="bg-slate-100 p-2 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider flex justify-between">
            <span>📋 Fila de Entrada de Arquivos para o R2</span>
            <span>{arquivos.length} arquivo(s)</span>
          </div>
          <div className="divide-y divide-slate-200">
            {arquivos.map((item) => (
              <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 truncate max-w-[400px]">
                  <span className="text-[16px]">{item.tipo === "documento" ? "📄" : "🖼️"}</span>
                  <div className="truncate">
                    <p className="font-bold text-slate-800 truncate">{item.file.name}</p>
                    <p className={`text-[10px] font-medium font-mono ${
                      item.status === "erro" ? "text-red-500 font-bold" : item.status === "sucesso" ? "text-emerald-600" : "text-slate-400"
                    }`}>{item.mensagem}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    item.status === "sucesso" ? "bg-emerald-100 text-emerald-800" :
                    item.status === "erro" ? "bg-red-100 text-red-800" :
                    item.status === "enviando" ? "bg-amber-100 text-amber-800 animate-pulse" : "bg-slate-200 text-slate-600"
                  }`}>
                    {item.status}
                  </span>
                  {!uploading && item.status !== "sucesso" && (
                    <button 
                      onClick={() => removerArquivoDaFila(item.id)}
                      className="text-slate-400 hover:text-red-500 font-bold px-1 transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={executarEsteiraUpload}
        disabled={uploading || arquivos.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-lg text-xs uppercase tracking-widest transition-all shadow-md cursor-pointer disabled:opacity-40"
      >
        {uploading ? "Enviando Lote para Armazenamento..." : "🚀 Disparar Lote para a Nuvem e Mesa V8"}
      </button>
    </div>
  );
}