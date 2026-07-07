"use client";

import React, { useState, useCallback } from 'react';
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
import '@xyflow/react/dist/style.css';

// =========================================================================
// 🎨 CUSTOMIZAÇÃO VISUAL DAS BOLINHAS (NÓS)
// =========================================================================
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function BuscaGrupoPage() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  
  // Estados dos inputs de busca e UI
  const [documentoBusca, setDocumentoBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"CPF" | "CNPJ">("CNPJ");
  const [isLoading, setIsLoading] = useState(false);

  // =========================================================================
  // 🕹️ CONTROLE DE ARRASTAR E SOLTAR DA TEIA
  // =========================================================================
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // =========================================================================
  // 🚀 FUNÇÃO DE BUSCA NA API (Conectado ao route.ts)
  // =========================================================================
  const handleBuscar = async () => {
    if (!documentoBusca) return;
    
    setIsLoading(true);
    console.log(`Buscando ${tipoBusca}: ${documentoBusca}`);
    
    try {
      const response = await fetch('/api/gerar-organograma', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentoBusca,
          tipoBusca
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao buscar dados no backend');
      }

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        setIsLoading(false);
        return;
      }

      // Adiciona os novos nós e arestas aos que já existem na tela (para permitir expansão infinita)
      setNodes((prevNodes) => {
        // Evita duplicatas caso a pessoa busque algo que já está na tela
        const novosNodes = data.nodes.filter(
          (novoNo: Node) => !prevNodes.find((noAntigo) => noAntigo.id === novoNo.id)
        );
        return [...prevNodes, ...novosNodes];
      });

      setEdges((prevEdges) => {
        // Evita duplicatas nas linhas
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

  // =========================================================================
  // ➕ ADICIONAR LIGAÇÃO MANUAL ("Primo", "Laranja", etc)
  // =========================================================================
  const handleAdicionarManual = () => {
    // Isso vai abrir um Modal para você preencher os dados do "Primo" e ligar aos nós existentes
    alert("Aqui abriremos o Modal para criar uma bolinha nova (ex: Primo) e ligar num CNPJ/CPF existente da tela!");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-4">
      {/* HEADER DE CONTROLE */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm mb-4 border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 mr-4">Mapeamento de Grupo Econômico</h1>
        
        <select 
          className="p-2 border rounded-md"
          value={tipoBusca}
          onChange={(e) => setTipoBusca(e.target.value as "CPF" | "CNPJ")}
        >
          <option value="CNPJ">CNPJ Base</option>
          <option value="CPF">CPF Sócio</option>
        </select>

        <input 
          type="text" 
          placeholder="Digite apenas números..."
          className="p-2 border rounded-md w-64"
          value={documentoBusca}
          onChange={(e) => setDocumentoBusca(e.target.value)}
          disabled={isLoading}
        />

        <button 
          onClick={handleBuscar}
          disabled={isLoading}
          className={`font-semibold py-2 px-6 rounded-md transition-all text-white ${
            isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Buscando...' : 'Pesquisar e Expandir'}
        </button>

        <button 
          onClick={handleAdicionarManual}
          className="ml-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-md transition-all"
        >
          + Vínculo Manual
        </button>
        
        {/* Botão de Limpar Tela */}
        <button 
          onClick={() => { setNodes([]); setEdges([]); }}
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-md transition-all"
        >
          Limpar Teia
        </button>
      </div>

      {/* ÁREA DA TEIA (GRAFO INTERATIVO) */}
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