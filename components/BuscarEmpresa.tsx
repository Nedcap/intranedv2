"use client";

import { useState } from "react";
import UploadDocs from "./UploadDocs";
import { supabase } from "@/lib/supabase";

interface Empresa {
  cnpj: string;
  razao_social: string;
  uf: string;
  cidadeExtenso?: string;
  capital_social?: number;
}

export default function BuscarEmpresa() {
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusTexto, setStatusTexto] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);

  const handleBuscar = async () => {
    if (!busca.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptUsuario: busca, limite: 5 }),
      });
      const data = await res.json();
      if (data.leads) {
        setEmpresas(data.leads);
      }
    } catch (err) {
      console.error("Erro ao buscar empresa:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 ORQUESTRADOR CENTRAL: Grava no banco e dispara o robô em background
  const handleProcessarEsteiraFinal = async (urlsDocumentos: string[]) => {
    if (!empresaSelecionada) return;
    setLoading(true);
    setStatusTexto("🤖 Inicializando registro e acionando Motor V8...");

    const cnpjLimpo = empresaSelecionada.cnpj.replace(/\D/g, "");
    let analiseId = "";

    try {
      // Pega o nome do usuário logado do comercial
      const userStr = localStorage.getItem("intraned_user");
      const user = userStr ? JSON.parse(userStr) : null;
      const nomeDoAgente = user?.nome || "Comercial Ned";

      // 1. Faz o insert usando o status nativo aceito pelo banco ("em_revisao_humana")
      const { data: novaAnalise, error: insertError } = await supabase
        .from("analises_credito")
        .insert({
          cnpj: cnpjLimpo,
          razao_social: empresaSelecionada.razao_social.toUpperCase(),
          status: "em_revisao_humana", // Mantém o status original padrão do banco
          comercial_nome: nomeDoAgente,
          dados_documentos: urlsDocumentos,
          dados_consolidados: {
            uf: empresaSelecionada.uf || "PR",
            cidade: empresaSelecionada.cidadeExtenso || "Curitiba",
            capital_social: empresaSelecionada.capital_social || 0,
            dados_gerais: { fundacao: "", ramo: "", site: "", relacionamento: "Prospect", gerente: "" },
            proposta: { modalidade: "Desconto", limite: 50000, prazo: 30, tranche: 10000, taxa: 0.04, garantia: "Aval", rating: "C" },
            dados_faturamento: { "2024": {}, "2025": {}, "2026": {} },
            dados_potencial: { ticket_medio: 0, prazo_medio_vendas: 0, vendas_prazo_perc: 100 },
            dados_endividamento_resumo: { curto_prazo: 0, longo_prazo: 0 },
            endividamento_detalhado: [],
            restritivos: [],
            socios: [],
            anexos: { organograma_url: "", fachada_url: "" },
            parecer_comite: ""
          }
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error("Este CNPJ já possui uma análise cadastrada ou ativa na esteira!");
        }
        throw insertError;
      }

      analiseId = novaAnalise.id;
      setStatusTexto("🔮 Robô V8 lendo e estruturando dados em background...");

      // 2. Dispara o processamento do robô Python (Via nossa rota gateway Next que acabamos de testar)
      const resIA = await fetch("/api/motor-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analise_id: analiseId,
          urls_documentos: urlsDocumentos
        }),
      });

      if (!resIA.ok) {
        const dataIA = await resIA.json();
        throw new Error(dataIA.error || "Ocorreu um desvio de leitura no robô Python.");
      }

      alert("🚀 Sucesso! Análise criada e enviada com sucesso para o Motor V8!");
      setEmpresaSelecionada(null);
      setEmpresas([]);

    } catch (err: any) {
      console.error("❌ [ERRO_ESTEIRA_V8]:", err);
      alert("⚠️ Falha na orquestração: " + err.message);
    } finally {
      setLoading(false);
      setStatusTexto("");
    }
  };

  return (
    <div className="space-y-6 text-left">
      {statusTexto && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex flex-col items-center justify-center font-bold text-white text-sm gap-2">
          <span className="animate-spin text-xl">⚡</span>
          {statusTexto}
        </div>
      )}

      {!empresaSelecionada ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Digite o nome ou critérios da empresa para buscar na base oficial da Receita Federal:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex: Fabricas de calçados em Franca SP..."
              className="flex-1 p-2 border border-gray-300 rounded-md text-sm outline-none"
            />
            <button
              onClick={handleBuscar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {/* LISTA DE RESULTADOS */}
          {empresas.length > 0 && (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 bg-gray-50 overflow-hidden">
              {empresas.map((emp) => (
                <div
                  key={emp.cnpj}
                  className="p-3 flex justify-between items-center hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => setEmpresaSelecionada(emp)}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{emp.razao_social}</p>
                    <p className="text-xs text-gray-500">CNPJ: {emp.cnpj} - {emp.cidadeExtenso || "Brasil"}/{emp.uf}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2.5 py-0.5 rounded uppercase tracking-wider text-[10px]">
                    Selecionar
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* EMPRESA SELECIONADA - EXPANDE LOTE DE UPLOAD */
        <div className="p-5 border border-green-200 bg-green-50/60 rounded-xl space-y-4 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-green-700 uppercase tracking-widest block mb-1">
                Empresa Selecionada Oficial
              </span>
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-tight">{empresaSelecionada.razao_social}</h3>
              <p className="text-xs text-gray-500 font-mono">CNPJ: {empresaSelecionada.cnpj}</p>
            </div>
            <button
              onClick={() => {
                setEmpresaSelecionada(null);
                setEmpresas([]);
              }}
              className="text-xs text-red-600 hover:text-red-700 font-bold uppercase tracking-wider text-[10px] cursor-pointer"
            >
              Trocar Empresa
            </button>
          </div>

          <hr className="border-green-200" />

          {/* 🔥 PASSAGEM COMPLETA DE PROPS: Resolvido o quebra-cabeça! */}
          <UploadDocs 
            empresa={empresaSelecionada as any} 
            onSucesso={handleSucesso => handleProcessarEsteiraFinal(handleSucesso)} 
          />
        </div>
      )}
    </div>
  );
}