"use client";

import { useState } from "react";
import UploadDocs from "./UploadDocs";

interface Empresa {
  cnpj: string;
  razao_social: string;
  uf: string;
  cidadeExtenso?: string;
}

export default function BuscarEmpresa() {
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);

  const handleBuscar = async () => {
    if (!busca.trim()) return;
    setLoading(true);
    try {
      // Bate direto na sua API existente do BigQuery!
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

  return (
    <div className="space-y-6">
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
              className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={handleBuscar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {/* LISTA DE RESULTADOS RECONHECIDOS */}
          {empresas.length > 0 && (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 bg-gray-50">
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
                  <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2.5 py-0.5 rounded">
                    Selecionar
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* EMPRESA SELECIONADA - ABRE PORTA DE UPLOAD */
        <div className="p-4 border border-green-200 bg-green-50 rounded-xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-green-700 uppercase tracking-wider block mb-1">
                Empresa Selecionada Oficial
              </span>
              <h3 className="text-lg font-bold text-gray-900">{empresaSelecionada.razao_social}</h3>
              <p className="text-sm text-gray-600">CNPJ: {empresaSelecionada.cnpj}</p>
            </div>
            <button
              onClick={() => {
                setEmpresaSelecionada(null);
                setEmpresas([]);
              }}
              className="text-xs text-red-600 hover:underline font-medium"
            >
              Trocar Empresa
            </button>
          </div>

          <hr className="border-green-200" />

          {/* Injeta o componente de upload original que já criamos */}
          <UploadDocs />
        </div>
      )}
    </div>
  );
}