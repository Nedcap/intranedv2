/* eslint-disable @typescript-eslint/no-explicit-any */
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
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { useSearchParams } from 'next/navigation';
import { toPng } from 'html-to-image';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase'; 

// ============================================================================
// COMPONENTES DE NÓ DO REACT FLOW (BLINDADO CONTRA CRASHES)
// ============================================================================
const nodeTypes = {
  bolinha: ({ data, style }: any) => {
    // 🔥 CORREÇÃO DO CRASH: O React Flow pode passar o style como undefined.
    // Isso evita o erro "Cannot read properties of undefined (reading 'border')"
    const safeStyle = style || {}; 

    return (
      <div style={{
        ...safeStyle,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: data?.isMatriz ? '4px solid #fff' : (safeStyle.border || 'none'), // Blindado
      }}>
        <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
        <span style={{ pointerEvents: 'none', userSelect: 'none', textAlign: 'center', lineHeight: '1.2', letterSpacing: '-0.02em', padding: '8px' }}>{data?.label}</span>
        <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
      </div>
    );
  }
};

export default function BuscaGrupoPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex flex-col items-center justify-center text-sm font-black uppercase tracking-widest text-[#2563eb] animate-pulse bg-[#f8fafc] gap-4">
        <div className="w-12 h-12 border-[5px] border-[#60a5fa] border-t-transparent rounded-full animate-spin"></div>
        Acionando Motor de Grafos...
      </div>
    }>
      <ReactFlowProviderWrapper />
    </Suspense>
  );
}

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
  const { getNodes, getEdges } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  const [documentoBusca, setDocumentoBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState<"CPF" | "CNPJ">("CNPJ");
  const [isLoading, setIsLoading] = useState(false);

  const [empresaInspecionada, setEmpresaInspecionada] = useState<{ nome: string; lista: any[] } | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  
  // States Modal Injeção
  const [manualNome, setManualNome] = useState("");
  const [manualDoc, setManualDoc] = useState("");
  const [manualTipo, setManualTipo] = useState<"CPF" | "CNPJ">("CPF");
  const [manualRelacao, setManualRelacao] = useState("Sócio");
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

  const handleBuscarDireto = async (documento: string, tipo: string, posicaoOrigem?: { x: number, y: number }, nomeSocio?: string, clickedNodeId?: string) => {
    if (!documento && !nomeSocio) return;
    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/gerar-organograma', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          documentoBusca: documento, 
          tipoBusca: tipo,
          nomeSocio: nomeSocio 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || `Erro (${response.status}): Falha na autenticação ou consulta ao servidor.`);
        return;
      }

      if (data.error) {
        alert(data.error); 
        return; 
      }

      const backendNodes = data.nodes || [];
      const backendEdges = data.edges || [];

      if (backendNodes.length === 0) {
        alert("Nenhum desdobramento pendente cadastrado para este registro.");
        return;
      }

      if (clickedNodeId) {
        const docLimpo = documento.replace(/\D/g, "");
        
        const rootNode = backendNodes.find((n: any) => {
          if (docLimpo && n.id.replace(/\D/g, "").includes(docLimpo)) return true;
          if (nomeSocio && n.data?.label && String(n.data.label).toUpperCase().includes(nomeSocio.toUpperCase())) return true;
          if (n.data?.isMatriz) return true;
          return false;
        });

        if (rootNode && rootNode.id !== clickedNodeId) {
          const novoIdBackend = rootNode.id;
          
          setEdges((prevEdges) => prevEdges.map((e: any) => ({
            ...e,
            source: e.source === clickedNodeId ? novoIdBackend : e.source,
            target: e.target === clickedNodeId ? novoIdBackend : e.target,
          })));

          setNodes((prevNodes) => prevNodes.filter((n: any) => n.id !== clickedNodeId));
        }
      }

      const xOffset = posicaoOrigem ? posicaoOrigem.x - 400 : 0;
      const yOffset = posicaoOrigem ? posicaoOrigem.y - 300 : 0;
      let novosNosAdicionados = 0;

      setNodes((prevNodes) => {
        const novosNodes = backendNodes.filter((novoNo: Node) => !prevNodes.find((noAntigo) => noAntigo.id === novoNo.id));
        novosNosAdicionados = novosNodes.length;
        
        return [...prevNodes, ...novosNodes.map((n: Node) => ({ 
          ...n, 
          type: 'bolinha', 
          position: { x: n.position.x + xOffset, y: n.position.y + yOffset },
          style: {
            ...n.style,
            boxShadow: n.data?.isMatriz ? '0 0 0 6px rgba(59, 130, 246, 0.3)' : '0 10px 25px -5px rgba(0,0,0,0.2)'
          }
        }))];
      });

      setEdges((prevEdges) => {
        const novasEdges = backendEdges.filter((novaAresta: Edge) => !prevEdges.find((arestaAntiga) => arestaAntiga.id === novaAresta.id));
        return [...prevEdges, ...novasEdges.map((e: Edge) => ({ 
          ...e, 
          type: 'straight', 
          animated: e.label === "Sócio" ? false : true, 
          style: { stroke: '#475569', strokeWidth: e.label === "Sócio" ? 3 : 2 } 
        }))];
      });

      if (posicaoOrigem && novosNosAdicionados === 0) {
        setTimeout(() => alert("A malha societária deste nó já está totalmente expandida em tela."), 100);
      }
    } catch (error: any) {
      alert(`Erro ao expandir teia: ${error.message || error}`);
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
        lista: Array.isArray(node.data.filiais) ? node.data.filiais : [] // Blindagem contra arrays nulos
      });
    }
  }, []);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const partes = node.id.split('-');
    if (partes.length < 2) return;

    const tipoNode = partes[0].toUpperCase();
    const docNode = partes.slice(1).join('-'); 
    const nomeDoSocio = (node.data?.nomeOriginal || node.data?.label) as string;

    if (tipoNode === "NOME") {
      handleBuscarDireto("", "PF", node.position, nomeDoSocio, node.id);
      return;
    }

    if (["CPF", "CNPJ", "PJ", "PF"].includes(tipoNode)) {
      handleBuscarDireto(docNode, tipoNode, node.position, nomeDoSocio, node.id);
    }
  }, []);

  const exportarEstruturaEstrategica = () => {
    const customizedNodes = getNodes().map(n => ({ ...n, shape: 'circle' }));
    const backupSnapshot = { nodes: customizedNodes, edges: getEdges(), exportadoEm: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupSnapshot));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `malha_societaria_${documentoBusca || 'export'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const gerarImagemCaptura = () => {
    const element = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!element) { alert("Não consegui localizar a área do mapa."); return; }

    setIsLoading(true);

    toPng(element, {
      backgroundColor: '#ffffff',
      width: element.offsetWidth,
      height: element.offsetHeight,
      style: { transform: 'scale(1)', transformOrigin: 'top left' },
    })
    .then((dataUrl) => {
      const downloadAnchor = document.createElement('a');
      downloadAnchor.download = `blueprint_${documentoBusca || 'malha'}.png`;
      downloadAnchor.href = dataUrl;
      downloadAnchor.click();
    })
    .catch((error) => {
      console.error("Erro no print do mapa:", error);
      alert("Falha ao renderizar a imagem PNG.");
    })
    .finally(() => {
      setIsLoading(false);
    });
  };

  const handleSalvarVinculoManual = () => {
    if (!manualNome || !noVinculoAlvo) return;
    
    const docLimpo = manualDoc.replace(/\D/g, "");
    const novoNoId = docLimpo ? `${manualTipo}-${docLimpo}` : `NOME-${Math.random().toString(36).substring(7)}`;

    setNodes((prev) => [...prev, {
      id: novoNoId, 
      type: 'bolinha',
      position: { x: Math.random() * 150 + 200, y: Math.random() * 150 + 200 },
      data: { 
        label: manualNome.toUpperCase(),
        nomeOriginal: manualNome.toUpperCase() 
      },
      style: { 
          backgroundColor: manualTipo === 'CNPJ' ? '#1e3a8a' : '#9333ea', 
          color: '#ffffff', 
          borderRadius: '50%', 
          width: 105, 
          height: 105, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          fontWeight: '900', 
          fontSize: '9px', 
          textAlign: 'center', 
          padding: '8px', 
          border: `3px solid ${manualTipo === 'CNPJ' ? '#60a5fa' : '#c084fc'}`,
          boxShadow: '0 0 20px rgba(147, 51, 234, 0.4)'
      }
    }]);

    setEdges((prev) => [...prev, { 
      id: `edge-manual-${Date.now()}`, 
      source: noVinculoAlvo, 
      target: novoNoId, 
      label: manualRelacao, 
      animated: true, 
      type: 'straight', 
      style: { stroke: '#9333ea', strokeWidth: 3, strokeDasharray: '4,4' } 
    }]);
    
    setModalAberto(false); 
    setManualNome(""); 
    setManualDoc("");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f172a] font-sans selection:bg-[#3b82f6]/30 overflow-hidden">
      
      {/* 🚀 TOOLBAR "COMMAND CENTER" */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#1e293b] p-4 md:px-6 border-b border-[#334155] shrink-0 gap-4 shadow-xl z-20">
        
        {/* LOGO & TITLE */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] flex items-center justify-center shadow-lg border border-[#60a5fa]/30">
              <span className="text-xl">🕸️</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-[1.1rem] font-black tracking-tight text-white uppercase leading-none">Órbita Graph</h1>
              <span className="text-[10px] text-[#94a3b8] font-bold tracking-widest uppercase mt-1">Inteligência Antihomônimo</span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-[#334155] mx-2 hidden md:block"></div>
          
          {/* SEARCH BAR */}
          <div className="flex items-center bg-[#0f172a] rounded-xl border border-[#334155] p-1 shadow-inner">
            <select 
              className="bg-transparent text-white text-[11px] font-bold uppercase tracking-wider pl-3 pr-2 py-2 outline-none cursor-pointer border-r border-[#334155]" 
              value={tipoBusca} 
              onChange={(e) => setTipoBusca(e.target.value as any)}
            >
              <option value="CNPJ" className="bg-[#1e293b]">CNPJ</option>
              <option value="CPF" className="bg-[#1e293b]">CPF</option>
            </select>
            <input 
              type="text" 
              placeholder="Digite o documento..." 
              className="bg-transparent text-white text-[13px] font-mono pl-4 pr-3 py-2 w-44 md:w-56 outline-none placeholder:text-[#475569]" 
              value={documentoBusca} 
              onChange={(e) => setDocumentoBusca(e.target.value)} 
              disabled={isLoading} 
            />
            <button 
              onClick={handleBuscar} 
              disabled={isLoading || !documentoBusca} 
              className="bg-[#2563eb] hover:bg-[#3b82f6] text-white font-black py-2 px-6 rounded-lg text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50"
            >
              {isLoading ? '⏳' : 'Mapear'}
            </button>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setModalAberto(true)} 
            className="bg-gradient-to-r from-[#7e22ce] to-[#9333ea] hover:from-[#9333ea] hover:to-[#a855f7] text-white font-black py-2.5 px-5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] border border-[#c084fc]/30 flex items-center gap-2"
          >
            <span className="text-sm leading-none">+</span> Injetar Nó
          </button>
          
          <button onClick={gerarImagemCaptura} disabled={isLoading} className="bg-[#1e293b] hover:bg-[#334155] text-white border border-[#475569] font-bold py-2.5 px-4 rounded-xl text-[11px] transition-all shadow-sm">📸 PNG</button>
          <button onClick={exportarEstruturaEstrategica} className="bg-[#1e293b] hover:bg-[#334155] text-white border border-[#475569] font-bold py-2.5 px-4 rounded-xl text-[11px] transition-all shadow-sm">💾 JSON</button>
          <button onClick={() => { setNodes([]); setEdges([]); }} className="bg-[#450a0a]/50 hover:bg-[#7f1d1d] text-[#fca5a5] border border-[#991b1b] font-bold py-2.5 px-4 rounded-xl text-[11px] transition-all">Limpar</button>
        </div>
      </div>

      {/* 🗺️ ÁREA DE TRABALHO: GRAFO & TABELA LATERAL */}
      <div className="flex w-full h-full overflow-hidden flex-1 relative">
        
        {/* CANVAS DE RENDENRIZAÇÃO (DARK/GLASSMORPHISM) */}
        <div className="flex-1 bg-[#ffffff] relative overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.05)]">
          
          {/* Legenda Flutuante Clean */}
          <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 pointer-events-none max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Tracker Ativo</span>
            </div>
            <div className="space-y-2 text-[11px] text-slate-600 font-medium">
              <p className="flex items-center gap-2"><span className="bg-slate-100 border border-slate-200 font-black text-[9px] px-1.5 py-0.5 rounded text-slate-700 shadow-sm">1 CLIQUE</span> Ver Filiais/Sedes</p>
              <p className="flex items-center gap-2"><span className="bg-slate-100 border border-slate-200 font-black text-[9px] px-1.5 py-0.5 rounded text-slate-700 shadow-sm">2 CLIQUES</span> Expandir Rede Oculta</p>
            </div>
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
            minZoom={0.1}
            maxZoom={1.5}
          >
            <Background color="#cbd5e1" gap={24} size={1} />
            <Controls className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-xl overflow-hidden" />
            <MiniMap 
              nodeStrokeWidth={3} 
              zoomable 
              pannable 
              maskColor="rgba(255,255,255,0.7)" 
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', right: 20, bottom: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} 
            />
          </ReactFlow>
        </div>

        {/* ======================================================== */}
        {/* RIGHT PANEL: LISTA DE ENTIDADES & INSPEÇÃO OVERLAY       */}
        {/* ======================================================== */}
        <div className="w-[380px] bg-[#f8fafc] border-l border-[#e2e8f0] flex flex-col shrink-0 z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.05)] relative">
          
          {/* HEADER DA LISTA */}
          <div className="bg-white border-b border-[#e2e8f0] p-5 flex justify-between items-center shrink-0">
            <span className="font-black uppercase text-[11px] text-[#0f172a] tracking-widest flex items-center gap-2">
              <span className="text-lg leading-none">📋</span> Base Extraída
            </span>
            <span className="bg-[#eff6ff] text-[#1d4ed8] px-3 py-1 rounded-lg text-[10px] font-black border border-[#bfdbfe]">
              {nodes.length} NÓS
            </span>
          </div>
          
          {/* CORPO DA LISTA (SCROLL) */}
          <div className="overflow-y-auto flex-1 custom-scrollbar p-3 space-y-2">
            {nodes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-[#94a3b8] gap-3">
                <span className="text-4xl opacity-50">🧭</span>
                <span className="font-bold text-[11px] uppercase tracking-widest">Painel Vazio</span>
              </div>
            )}
            
            {nodes.map(n => {
              const isCNPJ = n.id.startsWith('CNPJ') || n.id.startsWith('PJ');
              const isCPF = n.id.startsWith('CPF') || n.id.startsWith('PF');
              const docNumber = n.id.split('-').slice(1).join('-');
              
              return (
                <div key={n.id} className="bg-white border border-[#e2e8f0] p-4 rounded-xl shadow-sm hover:shadow-md hover:border-[#93c5fd] transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded flex items-center justify-center font-black text-[9px] tracking-widest uppercase ${
                      isCNPJ ? 'bg-[#eff6ff] text-[#1d4ed8]' : 
                      isCPF ? 'bg-[#ecfdf5] text-[#15803d]' : 
                      'bg-[#faf5ff] text-[#7e22ce]'
                    }`}>
                      {isCNPJ ? 'PJ' : isCPF ? 'PF' : 'MANUAL'}
                    </span>
                    {docNumber && docNumber.length > 5 && !docNumber.includes('.') && (
                      <span className="font-mono font-bold text-[10px] text-[#64748b] bg-[#f1f5f9] px-1.5 rounded">
                        {docNumber}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-[11px] text-[#0f172a] uppercase leading-snug group-hover:text-[#2563eb] transition-colors">
                    {n.data?.label as string}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* PANEL DE INSPEÇÃO SLIDEOVER (DESLIZA POR CIMA DA LISTA) */}
          {/* ======================================================== */}
          <div className={`absolute top-0 right-0 w-full h-full bg-[#1e293b] text-white flex flex-col shadow-2xl transition-transform duration-300 z-30 ${empresaInspecionada ? 'translate-x-0' : 'translate-x-full'}`}>
            {empresaInspecionada && (
              <>
                <div className="bg-[#0f172a] p-6 flex flex-col shrink-0 border-b border-[#334155] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6] opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#3b82f6] bg-[#3b82f6]/10 px-2 py-1 rounded border border-[#3b82f6]/30">
                      Unidades & Filiais
                    </span>
                    <button onClick={() => setEmpresaInspecionada(null)} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-rose-500 rounded-lg text-white font-black transition-colors">✕</button>
                  </div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight leading-tight relative z-10">
                    {empresaInspecionada.nome}
                  </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar-dark p-4 space-y-3">
                  {(empresaInspecionada.lista || []).map((filial: any, idx: number) => (
                    <div key={idx} className="bg-[#334155]/40 border border-[#475569] p-4 rounded-xl">
                      <div className="flex justify-between items-center border-b border-[#475569]/50 pb-2 mb-2">
                        <span className="font-mono font-bold text-[#60a5fa] text-[11px]">{filial.cnpj || 'Matriz Cnpj Oculto'}</span>
                        <span className="bg-[#0f172a] text-[#94a3b8] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">{filial.uf || 'NI'}</span>
                      </div>
                      <div className="text-[11px] text-[#cbd5e1] font-medium leading-relaxed">
                        <span className="text-[#94a3b8] font-bold mr-1">Bairro:</span> {filial.bairro || 'Não Informado'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ➕ MODAL VÍNCULO MANUAL (GLASSMORPHISM ELEGANTE) */}
      {modalAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col animate-in zoom-in-95 border border-[#e2e8f0]">
            
            <div className="bg-gradient-to-r from-[#7e22ce] to-[#6b21a8] text-white p-6 flex justify-between items-center shadow-md z-10 shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="relative z-10">
                <h2 className="font-black text-xl uppercase tracking-tight flex items-center gap-2">🧬 Injetar Nó Manual</h2>
                <p className="text-[9px] text-[#e9d5ff] font-bold tracking-widest uppercase mt-1">Conexão de Risco Oculto</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="relative z-10 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl text-white font-black transition-colors">✕</button>
            </div>
            
            <div className="p-8 space-y-5 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Nome Completo / Razão Social *</label>
                <input type="text" value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Ex: MOURA HOLDING FAMILIAR" className="p-3.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-black text-[#0f172a] uppercase outline-none focus:border-[#7e22ce] focus:ring-4 focus:ring-[#7e22ce]/10 transition-all shadow-inner placeholder:font-medium placeholder:text-[#94a3b8]" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Tipo de Entidade</label>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as any)} className="p-3.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-bold text-[#0f172a] outline-none focus:border-[#7e22ce] focus:ring-4 focus:ring-[#7e22ce]/10 transition-all cursor-pointer">
                    <option value="CPF">Pessoa Física (CPF)</option>
                    <option value="CNPJ">Pessoa Jurídica (CNPJ)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Doc. Identificador</label>
                  <input type="text" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} placeholder="Números..." className="p-3.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-mono font-bold text-[#0f172a] outline-none focus:border-[#7e22ce] focus:ring-4 focus:ring-[#7e22ce]/10 transition-all shadow-inner" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Conexão Estrutural</label>
                  <select value={manualRelacao} onChange={(e) => setManualRelacao(e.target.value)} className="p-3.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-bold text-[#0f172a] outline-none focus:border-[#7e22ce] focus:ring-4 focus:ring-[#7e22ce]/10 transition-all cursor-pointer">
                    <optgroup label="Societário">
                      <option value="Sócio">Sócio</option>
                      <option value="Sócio-Administrador">Sócio-Administrador</option>
                      <option value="Sócio Oculto">Sócio Oculto / Laranja</option>
                      <option value="Holding Familiar">Holding Familiar</option>
                    </optgroup>
                    <optgroup label="Corporativo">
                      <option value="Empresa Coligada">Empresa Coligada</option>
                      <option value="Filial">Filial</option>
                      <option value="Mesmo Endereço">Mesmo Endereço</option>
                      <option value="Procurador">Procurador</option>
                    </optgroup>
                    <optgroup label="Familiar">
                      <option value="Esposo(a)">Esposo(a)</option>
                      <option value="Filho(a)">Filho(a)</option>
                      <option value="Irmão(ã)">Irmão(ã)</option>
                    </optgroup>
                  </select>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Ancorar ao Nó *</label>
                  <select value={noVinculoAlvo} onChange={(e) => setNoVinculoAlvo(e.target.value)} className="p-3.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-black text-[#7e22ce] outline-none focus:border-[#7e22ce] focus:ring-4 focus:ring-[#7e22ce]/10 transition-all cursor-pointer">
                    <option value="" className="text-[#94a3b8] font-medium">Selecione o alvo...</option>
                    {nodes.map((no) => <option key={no.id} value={no.id} className="text-[#0f172a] font-bold">{no.data?.label as string}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="bg-[#f8fafc] p-6 flex justify-end gap-3 border-t border-[#e2e8f0] shrink-0">
              <button onClick={() => setModalAberto(false)} className="px-6 py-3 bg-white hover:bg-[#e2e8f0] border border-[#cbd5e1] rounded-xl font-black text-[#64748b] text-[11px] uppercase tracking-widest transition-colors">Cancelar</button>
              <button onClick={handleSalvarVinculoManual} disabled={!manualNome || !noVinculoAlvo} className="px-8 py-3 bg-[#7e22ce] hover:bg-[#6b21a8] disabled:bg-[#d8b4fe] text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(126,34,206,0.3)]">Injetar no Mapa</button>
            </div>

          </div>
        </div>
      )}

      {/* STYLES GLOBAIS DE SCROLL E ESCONDER LOGO REACT FLOW */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        
        .react-flow__attribution { display: none !important; }
      `}} />

    </div>
  );
}