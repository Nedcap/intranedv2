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

export default function BuscaGrupoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center text-sm font-mono text-purple-600 animate-pulse">⚡ Carregando ambiente de grafos...</div>}>
      <BuscaGrupoConteudo />
    </Suspense>
  );
}

function BuscaGrupoConteudo() {
  const searchParams = useSearchParams();
  const cnpjDaUrl = searchParams.get('cnpj');
  const analiseIdDaUrl = searchParams.get('analise_id');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  const [documentoBusca, setDocumentoBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"CPF" | "CNPJ">("CNPJ");
  const [isLoading, setIsLoading] = useState(false);

  // Estado para a Gaveta/Modal de Inspeção de Filiais
  const [empresaInspecionada, setEmpresaInspecionada] = useState<{ nome: string; lista: any[] } | null>(null);

  // Estados do Modal Manual
  const [modalAberto, setModalAberto] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualDoc, setManualDoc] = useState("");
  const [manualTipo, setManualTipo] = useState<"CPF" | "CNPJ">("CPF");
  const [manualRelacao, setManualRelacao] = useState("Primo(a)");
  const [noVinculoAlvo, setNoVinculoAlvo] = useState("");

  useEffect(() => {
    if (cnpjDaUrl) {
      setDocumentoBusca(cnpjDaUrl);
      setTipoBusca("CNPJ");
      const timer = setTimeout(() => { handleBuscarDireto(cnpjDaUrl, "CNPJ"); }, 500);
      return () => clearTimeout(timer);
    }
  }, [cnpjDaUrl]);

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleBuscarDireto = async (documento: string, tipo: "CPF" | "CNPJ", posicaoOrigem?: { x: number, y: number }) => {
    if (!documento) return;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/gerar-organograma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoBusca: documento, tipoBusca: tipo }),
      });

      if (!response.ok) throw new Error('Falha no backend');
      const data = await response.json();

      if (data.error) { alert(data.error); return; }

      const xOffset = posicaoOrigem ? posicaoOrigem.x - 400 : 0;
      const yOffset = posicaoOrigem ? posicaoOrigem.y - 300 : 0;
      let novosNosAdicionados = 0;

      setNodes((prevNodes) => {
        const novosNodes = data.nodes.filter((novoNo: Node) => !prevNodes.find((noAntigo) => noAntigo.id === novoNo.id));
        novosNosAdicionados = novosNodes.length;
        return [...prevNodes, ...novosNodes.map((n: Node) => ({ ...n, position: { x: n.position.x + xOffset, y: n.position.y + yOffset } }))];
      });

      setEdges((prevEdges) => {
        const novasEdges = data.edges.filter((novaAresta: Edge) => !prevEdges.find((arestaAntiga) => arestaAntiga.id === novaAresta.id));
        return [...prevEdges, ...novasEdges.map((e: Edge) => ({ ...e, type: 'straight', style: { stroke: '#94a3b8', strokeWidth: 2 } }))];
      });

      if (posicaoOrigem && novosNosAdicionados === 0) {
        setTimeout(() => alert("Nenhum desdobramento pendente para este nó."), 100);
      }
    } catch (error) {
      alert("Erro ao expandir teia.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuscar = () => handleBuscarDireto(documentoBusca, tipoBusca);

  // Clique no nó: se for empresa com filiais, abre a tabela. Se for duplo clique ou clique em sócio, expande.
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const partes = node.id.split('-');
    if (partes.length < 2) return;

    const tipoNode = partes[0];
    const docNode = partes.slice(1).join('-'); 

    // Intercepta se a empresa tiver dados de filiais guardados
    if (tipoNode === "CNPJ" && node.data?.filiais) {
      setEmpresaInspecionada({
        nome: node.data.label as string,
        lista: node.data.filiais as any[]
      });
    }

    if (tipoNode === "NOME" || (tipoNode !== "CPF" && tipoNode !== "CNPJ")) return;
    
    handleBuscarDireto(docNode, tipoNode as "CPF" | "CNPJ", node.position);
  }, []);

  // ⚡ FUTURO: Função stub preparada para você plugar a exportação JSON/Imagem de alta definição
  const exportarEstruturaEstrategica = () => {
    const backupSnapshot = { nodes, edges, exportadoEm: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupSnapshot));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dossie_grupo_${documentoBusca || 'teia'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSalvarVinculoManual = () => {
    if (!manualNome || !noVinculoAlvo) return;
    const docLimpo = manualDoc.replace(/\D/g, "") || Math.random().toString(36).substring(7);
    const novoNoId = `${manualTipo}-${docLimpo}`;

    setNodes((prev) => [...prev, {
      id: novoNoId, position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 200 },
      data: { label: manualNome.toUpperCase() },
      style: { backgroundColor: '#9333ea', color: 'white', borderRadius: '50%', width: 90, height: 90, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '5px' }
    }]);

    setEdges((prev) => [...prev, { id: `edge-manual-${Date.now()}`, source: noVinculoAlvo, target: novoNoId, label: manualRelacao, animated: true, type: 'straight', style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' } }]);
    setModalAberto(false); setManualNome(""); setManualDoc("");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-4 relative font-sans">
      
      {/* HEADER DE CONTROLE */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm mb-4 border border-slate-200">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-800">Mapeamento de Grupo Econômico</h1>
          {analiseIdDaUrl && <span className="text-[10px] text-purple-600 font-mono font-bold">Dossiê ID: {analiseIdDaUrl}</span>}
        </div>
        
        <select className="p-2 border rounded-md text-sm outline-none" value={tipoBusca} onChange={(e) => setTipoBusca(e.target.value as any)}>
          <option value="CNPJ">CNPJ Base</option>
          <option value="CPF">CPF Sócio</option>
        </select>

        <input type="text" placeholder="Apenas números..." className="p-2 border rounded-md w-64 text-sm font-mono outline-none" value={documentoBusca} onChange={(e) => setDocumentoBusca(e.target.value)} disabled={isLoading} />

        <button onClick={handleBuscar} disabled={isLoading} className="font-semibold py-2 px-6 rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer">
          {isLoading ? 'Mapeando...' : 'Pesquisar e Expandir'}
        </button>

        <button onClick={() => setModalAberto(true)} className="ml-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-md text-sm transition-all cursor-pointer">
          + Vínculo Manual
        </button>

        <button onClick={exportarEstruturaEstrategica} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition-all cursor-pointer">
          💾 Exportar JSON
        </button>
        
        <button onClick={() => { setNodes([]); setEdges([]); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-md text-sm transition-all cursor-pointer">
          Limpar Teia
        </button>
      </div>

      {/* ÁREA INTERATIVA DO GRAFO */}
      <div className="flex-1 bg-slate-100 rounded-xl border border-slate-300 overflow-hidden shadow-inner relative">
        <div className="absolute top-2 left-2 z-10 bg-white/90 p-2 rounded text-[10px] text-slate-600 pointer-events-none shadow-sm">
          💡 <strong>Inteligência de Base:</strong> Filiais repetidas foram consolidadas. Clique na empresa para abrir a tabela de unidades.
        </div>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} fitView>
          <Background color="#cbd5e1" gap={16} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
        </ReactFlow>
      </div>

      {/* 📊 TABELA LATERAL DE FILIAIS OCULTAS (GAVETA HUD) */}
      {empresaInspecionada && (
        <div className="absolute top-24 right-8 w-96 bg-white rounded-xl shadow-2xl border border-slate-300 z-30 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="bg-slate-800 text-white p-3 font-bold text-xs flex justify-between items-center">
            <span className="truncate">🏢 Unidades: {empresaInspecionada.nome}</span>
            <button onClick={() => setEmpresaInspecionada(null)} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-[10px]">Fechar X</button>
          </div>
          <div className="p-2 overflow-y-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2">CNPJ Completo</th>
                  <th className="p-1">UF</th>
                  <th className="p-1">Bairro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                {empresaInspecionada.lista.map((filial: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 text-blue-600 font-bold">{filial.cnpj || 'Matriz'}</td>
                    <td className="p-1 uppercase">{filial.uf || 'NI'}</td>
                    <td className="p-1 font-sans truncate max-w-[120px]">{filial.bairro || 'Centro'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURADOR MANUAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-xs">
            <div className="bg-purple-700 text-white p-4 font-bold flex justify-between items-center">
              <span>🧬 Injetar Relacionamento Oculto Manual</span>
              <button onClick={() => setModalAberto(false)}>Fechar X</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">Nome / Razão Social:</label>
                <input type="text" value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Ex: HOLDING FAMILIAR MOURA" className="p-2 border rounded uppercase outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Tipo:</label>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as any)} className="p-2 border rounded outline-none"><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Doc (Opcional):</label>
                  <input type="text" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} placeholder="Números..." className="p-2 border rounded font-mono outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Relação:</label>
                  <select value={manualRelacao} onChange={(e) => setManualRelacao(e.target.value)} className="p-2 border rounded outline-none"><option value="Sócio oculto">Sócio Oculto / Laranja</option><option value="Holding Familiar">Holding Familiar</option><option value="Primo(a)">Primo(a)</option></select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Linkar ao Nó:</label>
                  <select value={noVinculoAlvo} onChange={(e) => setNoVinculoAlvo(e.target.value)} className="p-2 border rounded outline-none bg-yellow-50 text-slate-800 font-bold">
                    <option value="">Escolha...</option>
                    {nodes.map((no) => <option key={no.id} value={no.id}>{no.data?.label as string}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-2 flex gap-2 justify-end border-t border-slate-100">
                <button onClick={() => setModalAberto(false)} className="bg-slate-100 py-2 px-4 rounded font-bold text-slate-600">Cancelar</button>
                <button onClick={handleSalvarVinculoManual} className="bg-purple-600 py-2 px-5 rounded text-white font-bold">Injetar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}