"use client";

import { useState, ChangeEvent } from "react";

interface UploadDocsProps {
  empresa: {
    cnpj: string;
    razao_social: string;
    uf: string;
    cidadeExtenso?: string;
    capital_social?: number;
  };
  // Modificamos a propriedade para aceitar e passar o array de links adiante
  onSucesso: (urlsDocumentos: string[]) => void;
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

    const urlsDocumentos: string[] = [];
    // Geramos um identificador temporário de lote para organizar os uploads no R2
    const loteId = `lote-${Date.now()}`;

    // URL base pública do seu Cloudflare R2
    const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://sua-url-r2-publica.com";

    try {
      // ====================================================================
      // 🚀 LOOP DE UPLOAD: FAZ O ENCONTRO DOS ARQUIVOS COM O BUCKET R2
      // ====================================================================
      for (let i = 0; i < arquivos.length; i++) {
        const item = arquivos[i];
        if (item.status === "sucesso") continue;

        setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "enviando", mensagem: "Enviando para o Cloudflare R2..." } : a));

        try {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("analiseId", loteId); // Identificador temporário para a pasta física

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok || data.error) {
            throw new Error(data.error || `Erro HTTP ${res.status}`);
          }

          // Monta o link público final do arquivo no Cloudflare R2
          const urlFinalDoArquivo = `${r2BaseUrl}/clientes/${loteId}/${item.file.name}`;
          urlsDocumentos.push(urlFinalDoArquivo);

          setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "sucesso", mensagem: "✅ Salvo na esteira R2!" } : a));

        } catch (err: any) {
          console.error(err);
          setArquivos(prev => prev.map(a => a.id === item.id ? { ...a, status: "erro", mensagem: err.message } : a));
          throw new Error(`Falha no upload do arquivo ${item.file.name}. Interrompendo esteira.`);
        }
      }

      // ====================================================================
      // 🏁 ENTREGA FINAL: Devolve as URLs prontas para a tela mãe processar
      // ====================================================================
      setArquivos(prev => prev.map(a => ({ ...a, mensagem: "📌 Sincronizando com a esteira principal..." })));
      
      setTimeout(() => {
        onSucesso(urlsDocumentos); // Aciona a gravação unificada e chama a IA lá na página principal
        setArquivos([]);
      }, 1000);

    } catch (err: any) {
      console.error("❌ [ERRO_ESTEIRA_UPLOAD]:", err);
      alert("⚠️ Erro no envio dos arquivos:\n" + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-700">
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

      {/* GRADE VISUAL DOS ARQUIVOS */}
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
        {uploading ? "Enviando Lote para Armazenamento..." : "🚀 Disparar Documentos para a Mesa V8"}
      </button>
    </div>
  );
}