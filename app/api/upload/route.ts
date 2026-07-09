"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface UploadDocsProps {
  empresa: any;
  onSucesso: () => void;
}

export default function UploadDocs({ empresa, onSucesso }: UploadDocsProps) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusAcao, setStatusAcao] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArquivos(Array.from(e.target.files));
    }
  };

  const processarEsteiraV8 = async () => {
    if (arquivos.length === 0) {
      alert("⚠️ Anexe pelo menos um documento (PGDAS, Contrato, Endividamento)!");
      return;
    }

    setLoading(true);
    try {
      const cnpjLimpo = empresa.cnpj.replace(/\D/g, "");

      // ====================================================================
      // 1. CRIA A ANÁLISE NO BANCO PARA GERAR O ID (STATUS: ROBO PROCESSANDO)
      // ====================================================================
      setStatusAcao("Criando dossiê no banco de dados...");
      
      const { data: novaAnalise, error: insertError } = await supabase
        .from("analises_credito")
        .insert({
          cnpj: cnpjLimpo,
          razao_social: empresa.razao_social.toUpperCase(),
          status: "robo_processando", 
          dados_consolidados: {
            uf: empresa.uf || "PR",
            cidade: empresa.cidadeExtenso || "Curitiba",
            capital_social: empresa.capital_social || 0,
            dados_gerais: { fundacao: "", ramo: "", site: "", relacionamento: "Prospect", gerente: "" },
            proposta: { modalidade: "Desconto", limite: 50000, prazo: 30, tranche: 10000, taxa: 0.04, garantia: "Aval", rating: "C" },
            dados_faturamento: { "2024": {}, "2025": {}, "2026": {} },
            dados_potencial: { ticket_medio: 0, prazo_medio_vendas: 0, vendas_prazo_perc: 100 },
            dados_endividamento: [],
            dados_restritivos: [],
            dados_estrutura_societaria: [],
            dados_juridico: { processos_tramitacao: "", processos_arquivados: "" },
            parecer_comite: ""
          },
          dados_documentos: [] 
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") throw new Error("Este CNPJ já possui análise ativa!");
        throw insertError;
      }

      const analiseId = novaAnalise.id;

      // ====================================================================
      // 2. UPLOAD DOS ARQUIVOS VIA SUA API DO CLOUDFLARE R2
      // ====================================================================
      setStatusAcao("Subindo arquivos para o Cloudflare R2...");
      const urlsDocumentos: string[] = [];
      
      // URL base do seu R2 (Ajuste no seu .env)
      const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://sua-url-r2.com"; 

      for (const file of arquivos) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("analiseId", analiseId); // Passamos o ID recém-criado

        // Chama a sua rota padrão de upload
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData, // Sem headers de Content-Type, o browser define o boundary automaticamente
        });

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || "Falha ao subir arquivo pro R2");
        }

        // Junta a URL base pública com o path retornado pela sua API
        urlsDocumentos.push(`${r2BaseUrl}/${uploadData.path}`);
      }

      // Atualiza os links no Supabase para manter o histórico
      await supabase
        .from("analises_credito")
        .update({ dados_documentos: urlsDocumentos })
        .eq("id", analiseId);

      // ====================================================================
      // 3. CHAMA O MOTOR DE IA
      // ====================================================================
      setStatusAcao("Robô analisando documentos (Pode levar até 1 minuto)...");
      
      const resIA = await fetch("/api/motor-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          analise_id: analiseId, 
          urls_documentos: urlsDocumentos 
        }),
      });

      const dataIA = await resIA.json();

      if (!resIA.ok) {
        throw new Error(dataIA.error || "Falha ao processar IA");
      }

      // ====================================================================
      // 4. FINALIZADO COM SUCESSO!
      // ====================================================================
      setStatusAcao("Concluído!");
      onSucesso(); 

    } catch (err: any) {
      console.error("Erro na esteira:", err);
      alert("❌ Erro no processo: " + err.message);
    } finally {
      setLoading(false);
      setStatusAcao("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
        <input 
          type="file" 
          multiple 
          accept=".pdf" 
          onChange={handleFileChange} 
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
        />
        <p className="text-[10px] text-slate-400 mt-2">
          Anexe PGDAS, Contratos Sociais e Extratos de Endividamento (Apenas PDFs).
        </p>
      </div>

      {arquivos.length > 0 && (
        <ul className="text-[11px] text-slate-600 space-y-1 bg-white p-3 rounded border border-slate-200">
          {arquivos.map((arq, i) => (
            <li key={i}>📄 {arq.name}</li>
          ))}
        </ul>
      )}

      <button
        onClick={processarEsteiraV8}
        disabled={loading || arquivos.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs py-3 uppercase tracking-widest transition-all disabled:opacity-40 cursor-pointer flex justify-center items-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin">⌛</span> {statusAcao}
          </>
        ) : (
          "🚀 Enviar para a Esteira V8"
        )}
      </button>
    </div>
  );
}