"use client";

import { useState, ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";

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
    const documentosRegistrados: { nome: string; path: string }[] = [];

    // 1. Loop de Uploads em Lote para o Cloudflare R2
    for (let i = 0; i < arquivos.length; i++) {
      const item = arquivos[i];
      if (item.status === "sucesso") continue;

      setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "enviando", mensagem: "Assinando cofre R2..." } : a));

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            fileName: item.file.name,
            fileType: item.file.type,
            analiseId: cnpjLimpo,
          }),
        }).catch(err => {
          throw new Error(`A rota local /api/upload está inacessível ou fora do ar: ${err.message}`);
        });

        const data = await res.json();

        if (!res.ok || data.error || !data.signedUrl) {
          throw new Error(data.error || `HTTP ${res.status}: Servidor rejeitou os parâmetros R2.`);
        }

        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, mensagem: "Transferindo binário para o R2..." } : a));

        const uploadRes = await fetch(data.signedUrl, {
          method: "PUT",
          headers: { 
            "Content-Type": item.file.type 
          },
          body: item.file,
        }).catch(err => {
          throw new Error(`Falha física de upload no R2 (Verifique o CORS): ${err.message}`);
        });

        if (!uploadRes.ok) {
          throw new Error(`Cloudflare R2 rejeitou o arquivo: ${uploadRes.statusText}`);
        }

        // Armazena o path retornado pelo seu R2 para registrar na tabela
        documentosRegistrados.push({ nome: item.file.name, path: data.path || "" });

        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "sucesso", mensagem: "✅ Gravado com sucesso!" } : a));

      } catch (err: any) {
        console.error(`Erro no arquivo ${item.file.name}:`, err);
        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "erro", mensagem: err.message } : a));
      }
    }

    // 2. Inserção do Registro no Supabase caso pelo menos um arquivo tenha subido
    if (documentosRegistrados.length > 0) {
      try {
        setArquivos(prev => prev.map(a => a.status === "sucesso" ? { ...a, messaging: "Criando cartão na esteira..." } : a));
        
        const { error: supaError } = await supabase.from("analises_credito").insert({
          cnpj: cnpjLimpo,
          razao_social: empresa.razao_social,
          uf: empresa.uf,
          status: "robo_processando",
          // Se sua coluna aceitar JSONB, injeta o array de arquivos salvos
          dados_documentos: documentosRegistrados
        });

        if (supaError) throw supaError;

        setTimeout(() => {
          onSucesso();
          setArquivos([]);
        }, 1500);

      } catch (dbErr: any) {
        console.error("Erro ao registrar na tabela do Supabase:", dbErr);
        alert(`⚠️ Arquivos salvos no R2, mas falhou ao criar cartão no banco: ${dbErr.message}`);
      }
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
        {uploading ? "Processando Lote no R2..." : "🚀 Disparar Documentos para a Mesa V8"}
      </button>
    </div>
  );
}