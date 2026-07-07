"use client";

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  applyNodeChanges, 
  applyEdgeChanges,
  Node,
  Edge
} from '@xyflow/react';
import { useSearchParams } from 'next/navigation';
import '@xyflow/react/dist/style.css';

// =========================================================================
// COMPONENTE WRAPPER COM SUSPENSE (Obrigatório no Next.js para usar useSearchParams)
// =========================================================================
export default function BuscaGrupoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center text-sm font-mono text-purple-600 animate-pulse">⚡ Carregando ambiente de grafos...</div>}>
      <BuscaGrupoConteudo />
    </Suspense>
  );
}

// =========================================================================
// COMPONENTE PRINCIPAL COM A LÓGICA DA TEIA
// =========================================================================
function BuscaGrupoConteudo() {
  const searchParams = useSearchParams();
  const cnpjDaUrl = searchParams.get('cnpj');
  const analiseIdDaUrl = searchParams.get('analise_id');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  const [documentoBusca, setDocumentoBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"CPF" | "CNPJ">("CNPJ");
  const [isLoading, setIsLoading] = useState(false);

  // =========================================================================
  // 🧭 CAPTURA AUTOMÁTICA DA MESA DE ANÁLISE
  // =========================================================================
  useEffect(() => {
    if (cnpjDaUrl) {
      setDocumentoBusca(cnpjDaUrl);
      setTipoBusca("CNPJ");
      // Pequeno timeout seguro para garantir o carregamento do DOM antes do fetch
      const timer = setTimeout(() => {
        handleBuscarDireto(cnpjDaUrl, "CNPJ");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [cnpjDaUrl]);

  // CONTROLE DE ARRASTAR E SOLTAR
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Mapeia a função de busca dinâmica aceitando parâmetros diretos
  const handleBuscarDireto = async (documento: string, tipo: "CPF" | "CNPJ") => {
    if (!documento) return;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/gerar-organograma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoBusca: documento, tipoBusca: tipo }),
      });

      if (!response.ok) throw new Error('Falha ao buscar dados no backend');
      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setNodes((prevNodes) => {
        const novosNodes = data.nodes.filter(
          (novoNo: Node) => !prevNodes.find((noAntigo) => noAntigo.id === novoNo.id)
        );
        return [...prevNodes, ...novosNodes];
      });

      setEdges((prevEdges) => {
        const novasEdges = data.edges.filter(
          (novaAresta: Edge) => !prevEdges.find((arestaAntiga) => arestaAntiga.id === novaAresta.id)
        );
        return [...prevEdges, ...novasEdges];
      });

    } catch (error) {
      console.error("Erro na requisição:", error);
      alert("Ocorreu um erro ao buscar o grupo econômico.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuscar = () => handleBuscarDireto(documentoBusca, tipoBusca);

  const handleAdicionarManual = () => {
    alert("Aqui abriremos o Modal para criar uma bolinha nova (ex: Primo) e vincular ao Dossiê da Análise ID: " + analiseIdDaUrl);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-4">
      {/* HEADER DE CONTROLE */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm mb-4 border border-slate-200">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-800">Mapeamento de Grupo Econômico</h1>
          {analiseIdDaUrl && (
            <span className="text-[10px] text-purple-600 font-mono font-bold">VINCULADO À ANÁLISE ID: {analiseIdDaUrl}</span>
          )}
        </div>
        
        <select 
          className="p-2 border rounded-md text-sm"
          value={tipoBusca}
          onChange={(e) => setTipoBusca(e.target.value as "CPF" | "CNPJ")}
        >
          <option value="CNPJ">CNPJ Base</option>
          <option value="CPF">CPF Sócio</option>
        </select>

        <input 
          type="text" 
          placeholder="Digite apenas números..."
          className="p-2 border rounded-md w-64 text-sm font-mono"
          value={documentoBusca}
          onChange={(e) => setDocumentoBusca(e.target.value)}
          disabled={isLoading}
        />

        <button 
          onClick={handleBuscar}
          disabled={isLoading}
          className={`font-semibold py-2 px-6 rounded-md text-sm transition-all text-white cursor-pointer ${
            isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Buscando...' : 'Pesquisar e Expandir'}
        </button>

        <button 
          onClick={handleAdicionarManual}
          className="ml-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-md text-sm transition-all cursor-pointer"
        >
          + Vínculo Manual
        </button>
        
        <button 
          onClick={() => { setNodes([]); setEdges([]); }}
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-md text-sm transition-all cursor-pointer"
        >
          Limpar Teia
        </button>
      </div>

      {/* ÁREA DA TEIA */}
      <div className="flex-1 bg-slate-100 rounded-xl border border-slate-300 overflow-hidden shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
        </ReactFlow>
      </div>
    </div>
  );
}