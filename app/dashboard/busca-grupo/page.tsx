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
  Edge,
  Handle,
  Position,
  useReactFlow
} from '@xyflow/react';
import { useSearchParams } from 'next/navigation';
import '@xyflow/react/dist/style.css';

// Componente customizado orbital com área de clique total injetada
const nodeTypes = {
  bolinha: ({ data, style }: any) => {
    return (
      <div style={{
        ...style,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
        <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{data.label}</span>
        <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
      </div>
    );
  }
};

export default function BuscaGrupoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center text-sm font-mono text-slate-800 animate-pulse">⚡ Inicializando Renderizador Órbita B2B...</div>}>
      <ReactFlowProviderWrapper />
    </Suspense>
  );
}

// Necessário envelopar com o ReactFlowProvider para a exportação de imagem funcionar via Hook
import { ReactFlowProvider } from '@xyflow/react';
function ReactFlowProviderWrapper() {
  return (
    <ReactFlowProvider>
      <BuscaGrupoConteudo />
    </ReactFlowProvider>
  );
}

function BuscaGrupoConteudo() {
  const searchParams = useSearchParams();
  const cnpjDaUrl = searchParams.get('cnpj');
  const analiseIdDaUrl = searchParams.get('analise_id');
  const { getNodes, getEdges } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  const [documentoBusca, setDocumentoBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"CPF" | "CNPJ">("CNPJ");
  const [isLoading, setIsLoading] = useState(false);

  const [empresaInspecionada, setEmpresaInspecionada] = useState<{ nome: string; lista: any[] } | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualDoc, setManualDoc] = useState("");
  const [manualTipo, setManualTipo] = useState<"CPF" | "CNPJ">("CPF");
  const [manualRelacao, setManualRelacao] = useState("Sócio oculto");
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

  const handleBuscarDireto = async (documento: string, tipo: string, posicaoOrigem?: { x: number, y: number }, nomeSocio?: string) => {
    if (!documento) return;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/gerar-organograma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentoBusca: documento, 
          tipoBusca: tipo,
          nomeSocio: nomeSocio 
        }),
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
        return [...prevNodes, ...novosNodes.map((n: Node) => ({ 
          ...n, 
          type: 'bolinha', 
          position: { x: n.position.x + xOffset, y: n.position.y + yOffset } 
        }))];
      });

      setEdges((prevEdges) => {
        const novasEdges = data.edges.filter((novaAresta: Edge) => !prevEdges.find((arestaAntiga) => arestaAntiga.id === novaAresta.id));
        return [...prevEdges, ...novasEdges.map((e: Edge) => ({ ...e, type: 'straight', style: { stroke: '#94a3b8', strokeWidth: 2 } }))];
      });

      if (posicaoOrigem && novosNosAdicionados === 0) {
        setTimeout(() => alert("Nenhum desdobramento pendente cadastrado para este nome."), 100);
      }
    } catch (error) {
      alert("Erro ao expandir teia.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuscar = () => handleBuscarDireto(documentoBusca, tipoBusca);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const partes = node.id.split('-');
    if (partes.length < 2) return;
    const tipoNode = partes[0];
    
    if (tipoNode === "CNPJ" && node.data?.filiais) {
      setEmpresaInspecionada({
        nome: node.data.label as string,
        lista: node.data.filiais as any[]
      });
    }
  }, []);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const partes = node.id.split('-');
    if (partes.length < 2) return;

    const tipoNode = partes[0];
    const docNode = partes.slice(1).join('-'); 

    if (tipoNode === "NOME" || (tipoNode !== "CPF" && tipoNode !== "CNPJ" && tipoNode !== "PJ" && tipoNode !== "PF")) return;
    
    const nomeDoSocio = node.data?.nomeOriginal || node.data?.label;
    handleBuscarDireto(docNode, tipoNode, node.position, nomeDoSocio as string);
  }, []);

  const exportarEstruturaEstrategica = () => {
    const backupSnapshot = { nodes: getNodes(), edges: getEdges(), exportadoEm: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupSnapshot));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dossie_grupo_${documentoBusca || 'teia'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 📸 FUNÇÃO DE CAPTURA DE IMAGEM DA TELA (PRINT DO MAPA)
  const gerarImagemCaptura = () => {
    const svgElement = document.querySelector('.react-flow__renderer svg') as window.SVGElement;
    if (!svgElement) { alert("Não consegui capturar o mapa."); return; }

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgElement.clientWidth || 1200;
      canvas.height = svgElement.clientHeight || 800;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#f8fafc'; // Fundo Slate 50
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const png = canvas.toDataURL('image/png');
        const downloadAnchor = document.createElement('a');
        downloadAnchor.download = `captura_teia_${documentoBusca || 'fidc'}.png`;
        downloadAnchor.href = png;
        downloadAnchor.click();
      }
    };
    image.src = blobURL;
  };

  const handleSalvarVinculoManual = () => {
    if (!manualNome || !noVinculoAlvo) return;
    const docLimpo = manualDoc.replace(/\D/g, "") || Math.random().toString(36).substring(7);
    const novoNoId = `${manualTipo}-${docLimpo}`;

    setNodes((prev) => [...prev, {
      id: novoNoId, 
      type: 'bolinha',
      position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 200 },
      data: { label: manualNome.toUpperCase() },
      style: { backgroundColor: '#6b21a8', color: 'white', borderRadius: '50%', width: 95, height: 95, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '9px', textAlign: 'center', padding: '6px', border: '2px solid #a855f7', boxShadow: '0 4px 10px rgba(168,85,247,0.2)' }
    }]);

    setEdges((prev) => [...prev, { id: `edge-manual-${Date.now()}`, source: noVinculoAlvo, target: novoNoId, label: manualRelacao, animated: true, type: 'straight', style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' } }]);
    setModalAberto(false); setManualNome(""); setManualDoc("");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 p-4 font-sans text-slate-100 selection:bg-blue-500">
      
      {/* HEADER PREMIUM CONTROLE */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-800 p-4 rounded-xl shadow-lg mb-4 border border-slate-700/50">
        <div className="flex flex-col pr-4 border-r border-slate-700">
          <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Órbita FIDC</h1>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">Mapeamento Antihomônimo de Grupos</span>
        </div>
        
        <select className="p-2 bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold outline-none text-slate-100 transition-all focus:border-blue-500 cursor-pointer" value={tipoBusca} onChange={(e) => setTipoBusca(e.target.value as any)}>
          <option value="CNPJ">CNPJ Base</option>
          <option value="CPF">CPF Sócio</option>
        </select>

        <input type="text" placeholder="Digite sem pontuação..." className="p-2 bg-slate-700 border border-slate-600 rounded-lg w-48 text-xs font-mono outline-none text-slate-100 transition-all focus:border-blue-500 placeholder:text-slate-400" value={documentoBusca} onChange={(e) => setDocumentoBusca(e.target.value)} disabled={isLoading} />

        <button onClick={handleBuscar} disabled={isLoading} className="font-bold py-2 px-5 rounded-lg text-xs text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50">
          {isLoading ? 'Cruzando Dados...' : 'Pesquisar Rede'}
        </button>

        <button onClick={() => setModalAberto(true)} className="bg-purple-700 hover:bg-purple-600 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-md shadow-purple-900/30 cursor-pointer">
          + Vínculo Manual
        </button>

        <div className="ml-auto flex gap-2">
          <button onClick={gerarImagemCaptura} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer border border-slate-600">
            📸 Capturar Imagem
          </button>
          <button onClick={exportarEstruturaEstrategica} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-md shadow-emerald-900/20 cursor-pointer">
            💾 Exportar Dossiê
          </button>
          <button onClick={() => { setNodes([]); setEdges([]); }} className="bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-2 px-3 rounded-lg text-xs transition-all border border-slate-700 cursor-pointer">
            Limpar Canvas
          </button>
        </div>
      </div>

      {/* ÁREA INTERATIVA DO GRAFO EXPANDIDA (82vh) */}
      <div className="h-[82vh] w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
        <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg text-[10px] text-slate-300 pointer-events-none shadow-md border border-slate-800 space-y-1">
          <p className="font-semibold text-blue-400">🛡️ Filtro Antihomônimo Ativado</p>
          <p>🖱️ <span className="text-slate-400 font-bold">1 Clique:</span> Detalha filiais da PJ</p>
          <p>🖱️🖱️ <span className="text-slate-400 font-bold">2 Cliques:</span> Expande conexões limpas</p>
        </div>
        
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          onNodeClick={onNodeClick} 
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
        >
          <Background color="#334155" gap={18} size={1} />
          <Controls className="bg-slate-800 border-slate-700 text-slate-200 rounded fill-slate-200" />
          <MiniMap nodeStrokeWidth={3} zoomable pannable maskColor="rgba(15,23,42,0.7)" style={{ background: '#1e293b' }} />
        </ReactFlow>
      </div>

      {/* HUD GAVETA DE UNIDADES */}
      {empresaInspecionada && (
        <div className="absolute top-28 right-8 w-96 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-30 overflow-hidden flex flex-col max-h-[65vh] animate-in fade-in slide-in-from-right duration-200">
          <div className="bg-slate-900 text-slate-100 p-3.5 font-bold text-xs flex justify-between items-center border-b border-slate-700">
            <span className="truncate pr-2 text-blue-400">🏢 Unidades: {empresaInspecionada.nome}</span>
            <button onClick={() => setEmpresaInspecionada(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded text-[10px] font-bold transition-all">Fechar X</button>
          </div>
          <div className="p-2 overflow-y-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-300 font-bold border-b border-slate-700 text-[10px]">
                  <th className="p-2">CNPJ</th>
                  <th className="p-1">UF</th>
                  <th className="p-1">Bairro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 font-mono text-slate-400">
                {empresaInspecionada.lista.map((filial: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-700/40 transition-colors">
                    <td className="p-2 text-blue-400 font-bold tracking-tight">{filial.cnpj || 'Matriz'}</td>
                    <td className="p-1 uppercase text-slate-300">{filial.uf || 'NI'}</td>
                    <td className="p-1 font-sans truncate max-w-[130px] text-slate-400">{filial.bairro || 'Centro'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURADOR MANUAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-xs text-slate-200">
            <div className="bg-purple-900 text-purple-100 p-4 font-bold flex justify-between items-center border-b border-slate-700">
              <span className="tracking-wide">🧬 Injetar Relacionamento Oculto</span>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-200">Fechar X</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-300">Nome / Razão Social:</label>
                <input type="text" value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Ex: HOLDING FAMILIAR MOURA" className="p-2.5 bg-slate-700 border border-slate-600 rounded-lg uppercase outline-none text-slate-100 focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-300">Tipo:</label>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as any)} className="p-2.5 bg-slate-700 border border-slate-600 rounded-lg outline-none text-slate-100 focus:border-purple-500 cursor-pointer"><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-300">Doc (Opcional):</label>
                  <input type="text" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} placeholder="Números..." className="p-2.5 bg-slate-700 border border-slate-600 rounded-lg font-mono outline-none text-slate-100 focus:border-purple-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-300">Relação:</label>
                  <select value={manualRelacao} onChange={(e) => setManualRelacao(e.target.value)} className="p-2.5 bg-slate-700 border border-slate-600 rounded-lg outline-none text-slate-100 focus:border-purple-500 cursor-pointer"><option value="Sócio oculto">Sócio Oculto / Laranja</option><option value="Holding Familiar">Holding Familiar</option><option value="Primo(a)">Primo(a)</option></select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-300">Linkar ao Nó:</label>
                  <select value={noVinculoAlvo} onChange={(e) => setNoVinculoAlvo(e.target.value)} className="p-2.5 bg-slate-700 border border-slate-600 rounded-lg outline-none text-yellow-400 font-bold focus:border-purple-500 cursor-pointer">
                    <option value="" className="text-slate-300 font-normal">Escolha...</option>
                    {nodes.map((no) => <option key={no.id} value={no.id} className="text-slate-200 font-semibold">{no.data?.label as string}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-3 flex gap-2 justify-end border-t border-slate-700">
                <button onClick={() => setModalAberto(false)} className="bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg font-bold text-slate-300 transition-all">Cancelar</button>
                <button onClick={handleSalvarVinculoManual} className="bg-purple-700 hover:bg-purple-600 py-2 px-5 rounded-lg text-white font-bold transition-all shadow-lg shadow-purple-950/40">Injetar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}