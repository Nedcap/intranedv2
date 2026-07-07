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
// COMPONENTE WRAPPER COM SUSPENSE
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

  // Estados Unificados do Modal Manual
  const [modalAberto, setModalAberto] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualDoc, setManualDoc] = useState("");
  const [manualTipo, setManualTipo] = useState<"CPF" | "CNPJ">("CPF");
  const [manualRelacao, setManualRelacao] = useState("Primo(a)");
  const [noVinculoAlvo, setNoVinculoAlvo] = useState("");

  // =========================================================================
  // 🧭 CAPTURA AUTOMÁTICA DA MESA DE ANÁLISE
  // =========================================================================
  useEffect(() => {
    if (cnpjDaUrl) {
      setDocumentoBusca(cnpjDaUrl);
      setTipoBusca("CNPJ");
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

  // =========================================================================
  // 🚀 MOTORES DE BUSCA E EXPANSÃO INFINITA
  // =========================================================================
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

  // Clicar no Nó expande a busca automaticamente
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const partes = node.id.split('-');
    if (partes.length < 2) return;

    const tipoNode = partes[0] as "CPF" | "CNPJ";
    const docNode = partes[1];

    console.log(`[Expansão Teia] Clicou no nó: ${tipoNode} - ${docNode}`);
    handleBuscarDireto(docNode, tipoNode);
  }, []);

  // =========================================================================
  // ➕ SALVAR VÍNCULO MANUAL
  // =========================================================================
  const handleSalvarVinculoManual = () => {
    if (!manualNome || !noVinculoAlvo) {
      alert("Por favor, preencha o Nome e selecione a qual empresa/pessoa deseja linkar.");
      return;
    }

    const docLimpo = manualDoc.replace(/\D/g, "") || Math.random().toString(36).substring(7);
    const novoNoId = `${manualTipo}-${docLimpo}`;

    const novoNo: Node = {
      id: novoNoId,
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label: manualNome.toUpperCase() },
      style: {
        backgroundColor: '#9333ea', // Roxo analista
        color: 'white', borderRadius: '50%', width: 90, height: 90,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px'
      }
    };

    const novaAresta: Edge = {
      id: `edge-manual-${Date.now()}`,
      source: noVinculoAlvo, // Conecta ao nó selecionado como alvo
      target: novoNoId,     // Aponta para a nova bolinha criada
      label: manualRelacao,
      animated: true,
      style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' }
    };

    setNodes((prev) => [...prev, novoNo]);
    setEdges((prev) => [...prev, novaAresta]);
    
    setModalAberto(false);
    setManualNome("");
    setManualDoc("");
  };

  const abrirModalManual = () => {
    if (nodes.length === 0) {
      alert("A teia precisa ter pelo menos um nó na tela para você conseguir vincular alguém!");
      return;
    }
    setModalAberto(true);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-4 relative">
      
      {/* HEADER DE CONTROLE */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm mb-4 border border-slate-200">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-800">Mapeamento de Grupo Econômico</h1>
          {analiseIdDaUrl && (
            <span className="text-[10px] text-purple-600 font-mono font-bold">Dossiê de Vínculos ID: {analiseIdDaUrl}</span>
          )}
        </div>
        
        <select 
          className="p-2 border rounded-md text-sm outline-none"
          value={tipoBusca}
          onChange={(e) => setTipoBusca(e.target.value as "CPF" | "CNPJ")}
        >
          <option value="CNPJ">CNPJ Base</option>
          <option value="CPF">CPF Sócio</option>
        </select>

        <input 
          type="text" 
          placeholder="Digite apenas números..."
          className="p-2 border rounded-md w-64 text-sm font-mono outline-none"
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
          onClick={abrirModalManual}
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

      {/* ÁREA DA TEIA - GRAFO INTERATIVO */}
      <div className="flex-1 bg-slate-100 rounded-xl border border-slate-300 overflow-hidden shadow-inner relative">
        <div className="absolute top-2 left-2 z-10 bg-white/80 p-2 rounded text-[10px] text-slate-500 pointer-events-none font-sans">
          💡 <strong>Dica do Motor:</strong> Dê um clique em cima de qualquer bolinha na teia para expandir os vínculos dela na hora.
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
        </ReactFlow>
      </div>

      {/* ========================================================= */}
      {/* MODAL CONFIGURADOR DE VÍNCULO MANUAL */}
      {/* ========================================================= */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-purple-700 text-white p-4 font-bold text-sm flex justify-between items-center">
              <span>🧬 Injetar Relacionamento Oculto Manual</span>
              <button onClick={() => setModalAberto(false)} className="hover:text-purple-200 font-sans text-xs">Fechar X</button>
            </div>
            
            <div className="p-4 space-y-4 font-sans text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">Nome / Razão Social:</label>
                <input type="text" value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Ex: NAMORADA DO LARANJA LTDA" className="p-2 border rounded uppercase outline-none focus:ring-1 focus:ring-purple-500" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Tipo de Documento:</label>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as any)} className="p-2 border rounded outline-none">
                    <option value="CPF">Pessoa Física (CPF)</option>
                    <option value="CNPJ">Pessoa Jurídica (CNPJ)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">CPF / CNPJ (Opcional):</label>
                  <input type="text" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} placeholder="Apenas números..." className="p-2 border rounded font-mono outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Vínculo / Relação:</label>
                  <select value={manualRelacao} onChange={(e) => setManualRelacao(e.target.value)} className="p-2 border rounded outline-none">
                    <option value="Namorado(a)">Namorado(a)</option>
                    <option value="Primo(a)">Primo(a)</option>
                    <option value="Tio/Tia">Tio/Tia</option>
                    <option value="Amigo(a)">Amigo(a)</option>
                    <option value="Esposo(a)">Esposo(a)</option>
                    <option value="Sócio oculto">Sócio Oculto / Laranja</option>
                    <option value="Holding Familiar">Holding Familiar</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Linkar ao Nó Existente:</label>
                  <select value={noVinculoAlvo} onChange={(e) => setNoVinculoAlvo(e.target.value)} className="p-2 border rounded outline-none bg-yellow-50 font-semibold text-slate-800">
                    <option value="">Escolha qual bolinha...</option>
                    {nodes.map((no) => (
                      <option key={no.id} value={no.id}>{no.data?.label as string}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2 justify-end border-t border-slate-100">
                <button onClick={() => setModalAberto(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-4 rounded transition-all">Cancelar</button>
                <button onClick={handleSalvarVinculoManual} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-5 rounded transition-all shadow-sm">Injetar na Teia</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}