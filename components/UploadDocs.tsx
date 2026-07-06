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

interface ArquivoFila {
  id: string;
  file: File;
  status: "pendente" | "enviando" | "sucesso" | "erro";
  mensagem: string;
}

export default function UploadDocs({ empresa, onSucesso }: UploadDocsProps) {
  const [arquivos, setArquivos] = useState<ArquivoFila[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const novos: ArquivoFila[] = Array.from(e.target.files).map((f, i) => ({
        id: `${Date.now()}-${i}`,
        file: f,
        status: "pendente",
        mensagem: "Pronto para processamento"
      }));
      setArquivos(prev => [...prev, ...novos]);
    }
  };

  const removerArquivoDaFila = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  const executarEsteiraUpload = async () => {
    if (arquivos.length === 0) return;
    setUploading(true);

    const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");
    let peloMenosUmSucesso = false;

    // 1. Processa os arquivos enviando em lote para o próprio servidor (Bypass total de CORS)
    for (let i = 0; i < arquivos.length; i++) {
      const item = arquivos[i];
      if (item.status === "sucesso") continue;

      setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "enviando", mensagem: "Enviando arquivo para o servidor..." } : a));

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("analiseId", cnpjLimpo);

        // Chamada local para o seu próprio teto (mesmo domínio)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || `Erro HTTP ${res.status}`);
        }

        peloMenosUmSucesso = true;
        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "sucesso", mensagem: "✅ Salvo com sucesso!" } : a));

      } catch (err: any) {
        console.error(err);
        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "erro", mensagem: err.message } : a));
      }
    }

    // 2. Se os uploads foram concluídos com sucesso, apenas avisa a tela mãe para avançar
    if (peloMenosUmSucesso) {
      setTimeout(() => {
        onSucesso();
        setArquivos([]);
      }, 1500);
    }

    setUploading(false);
  };

  return (
    <div className="space-y-4 font-sans">
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
          Anexar Documentação em Lote (Selecione um ou vários PDFs: Balanços, FAT, IRPF)
        </label>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-bold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer disabled:opacity-40"
        />
      </div>

      {/* GRADE VISUAL DO EXCEL INTERNO DE ARQUIVOS */}
      {arquivos.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
          <div className="bg-slate-100 p-2 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
            📋 Fila de Entrada de Arquivos para o Robô
          </div>
          <div className="divide-y divide-slate-200">
            {arquivos.map((item) => (
              <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                <div className="truncate max-w-[400px]">
                  <p className="font-bold text-slate-800 truncate">{item.file.name}</p>
                  <p className={`text-[10px] font-medium font-mono ${
                    item.status === "erro" ? "text-red-500" : item.status === "sucesso" ? "text-emerald-600" : "text-slate-400"
                  }`}>{item.mensagem}</p>
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
        {uploading ? "Processando Lote..." : "🚀 Disparar Documentos para a Mesa V8"}
      </button>
    </div>
  );
}