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
        position: 'relative',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease-in-out',
      }}>
        <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
        <span style={{ pointerEvents: 'none', userSelect: 'none', textAlign: 'center', lineHeight: '1.2' }}>{data.label}</span>
        <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
      </div>
    );
  }
};

export default function BuscaGrupoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex flex-col gap-4 items-center justify-center text-sm font-bold tracking-widest uppercase text-indigo-500 animate-pulse bg-slate-50"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>Inicializando Renderizador Órbita B2B...</div>}>
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

      // =========================================================================
      // 🧠 LÓGICA DE ANCORAGEM: Redireciona arestas e mescla nós sem duplicação
      // =========================================================================
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
          position: { x: n.position.x + xOffset, y: n.position.y + yOffset } 
        }))];
      });

      setEdges((prevEdges) => {
        const novasEdges = backendEdges.filter((novaAresta: Edge) => !prevEdges.find((arestaAntiga) => arestaAntiga.id === novaAresta.id));
        return [...prevEdges, ...novasEdges.map((e: Edge) => ({ ...e, type: 'straight', style: { stroke: '#94a3b8', strokeWidth: 2 } }))];
      });

      if (posicaoOrigem && novosNosAdicionados === 0) {
        setTimeout(() => alert("Nenhum novo vínculo encontrado para este registro."), 100);
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
        lista: node.data.filiais as any[]
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
    downloadAnchor.setAttribute("download", `dossie_grupo_${documentoBusca || 'teia'}.json`);
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
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
    })
    .then((dataUrl) => {
      const downloadAnchor = document.createElement('a');
      downloadAnchor.download = `captura_teia_${documentoBusca || 'fidc'}.png`;
      downloadAnchor.href = dataUrl;
      downloadAnchor.click();
    })
    .catch((error) => {
      console.error("Erro no print do mapa:", error);
      alert("Erro ao processar imagem da teia.");
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
      position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 200 },
      data: { 
        label: manualNome.toUpperCase(),
        nomeOriginal: manualNome.toUpperCase() 
      },
      style: { 
          backgroundColor: manualTipo === 'CNPJ' ? '#1e3a8a' : '#7c3aed', 
          color: 'white', 
          borderRadius: '50%', 
          width: 95, 
          height: 95, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          fontWeight: 'bold', 
          fontSize: '9px', 
          textAlign: 'center', 
          padding: '6px', 
          border: `3px solid ${manualTipo === 'CNPJ' ? '#3b82f6' : '#a855f7'}` 
      }
    }]);

    setEdges((prev) => [...prev, { id: `edge-manual-${Date.now()}`, source: noVinculoAlvo, target: novoNoId, label: manualRelacao, animated: true, type: 'straight', style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' } }]);
    setModalAberto(false); 
    setManualNome(""); 
    setManualDoc("");
  };

  const inputStyle = "p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none text-slate-800 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
  const btnSecundario = "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 text-xs";

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-4 md:p-6 font-sans text-slate-800 selection:bg-indigo-200 overflow-hidden">
      
      {/* 🚀 TOOLBAR MODERNA */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl shadow-sm mb-5 border border-slate-200 shrink-0 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col pr-6 border-r border-slate-200">
            <h1 className="text-xl font-black tracking-tight text-indigo-900 uppercase">🕸️ Órbita FIDC</h1>
            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Mapa Societário B2B</span>
          </div>
          
          <div className="flex items-center gap-3">
            <select className={`${inputStyle} cursor-pointer min-w-[130px]`} value={tipoBusca} onChange={(e) => setTipoBusca(e.target.value as any)}>
              <option value="CNPJ">CNPJ Base</option>
              <option value="CPF">CPF Sócio</option>
            </select>

            <input 
              type="text" 
              placeholder="Digite sem pontuação..." 
              className={`${inputStyle} w-56 font-mono placeholder:font-sans placeholder:font-medium`} 
              value={documentoBusca} 
              onChange={(e) => setDocumentoBusca(e.target.value)} 
              disabled={isLoading} 
            />

            <button 
              onClick={handleBuscar} 
              disabled={isLoading || !documentoBusca} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? '⏳ Buscando...' : 'Pesquisar Rede'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => setModalAberto(true)} 
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            ➕ Injetar Vínculo Manual
          </button>

          <div className="h-8 w-px bg-slate-200 mx-1"></div>

          <button onClick={gerarImagemCaptura} disabled={isLoading} className={btnSecundario}>
            📸 Capturar
          </button>
          <button onClick={exportarEstruturaEstrategica} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer">
            💾 Exportar JSON
          </button>
          <button onClick={() => { setNodes([]); setEdges([]); }} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-all border border-rose-200 cursor-pointer">
            Limpar Painel
          </button>
        </div>
      </div>

      {/* 🗺️ ÁREA INFERIOR: MAPA E TABELA */}
      <div className="flex gap-5 w-full h-full pb-2 overflow-hidden flex-1">
        
        {/* CANVAS DE RENDENRIZAÇÃO */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          {/* Legend/Tooltip Integrado */}
          <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-md p-4 rounded-xl text-[11px] text-slate-600 pointer-events-none shadow-lg border border-slate-200/50 space-y-2 max-w-xs">
            <p className="font-black text-indigo-700 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5"><span className="text-sm">🛡️</span> Filtro Antihomônimo Ativo</p>
            <p className="flex items-start gap-2 leading-tight">
              <span className="bg-slate-100 text-slate-800 font-bold px-1.5 rounded text-[10px]">1 Clique</span> 
              Detalha as filiais e endereços da Matriz PJ
            </p>
            <p className="flex items-start gap-2 leading-tight">
              <span className="bg-slate-100 text-slate-800 font-bold px-1.5 rounded text-[10px]">2 Cliques</span> 
              Expande as conexões limpas do nó selecionado
            </p>
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
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls className="bg-white border-slate-200 text-slate-800 rounded-xl fill-slate-800 shadow-md overflow-hidden" />
            <MiniMap 
              nodeStrokeWidth={3} 
              zoomable 
              pannable 
              maskColor="rgba(248,250,252,0.8)" 
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', right: 16, bottom: 16, shadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} 
            />
          </ReactFlow>
        </div>

        {/* TABELA LATERAL INTELIGENTE */}
        <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
            <span className="font-black uppercase text-[11px] text-slate-700 tracking-widest flex items-center gap-2">📋 Relação de Entidades</span>
            <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-black shadow-sm">
              {nodes.length} Nós
            </span>
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="p-3 font-black uppercase tracking-wider text-[9px] w-20">Tipo</th>
                  <th className="p-3 font-black uppercase tracking-wider text-[9px]">Documento / Razão Social</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center p-10 text-slate-400 font-bold italic text-[11px]">O mapa ainda está vazio.</td>
                  </tr>
                )}
                {nodes.map(n => {
                  const isCNPJ = n.id.startsWith('CNPJ') || n.id.startsWith('PJ');
                  const isCPF = n.id.startsWith('CPF') || n.id.startsWith('PF');
                  const docNumber = n.id.split('-').slice(1).join('-');
                  
                  return (
                    <tr key={n.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-3 align-top">
                        <span className={`px-2 py-1 rounded flex items-center justify-center font-black text-[9px] shadow-sm tracking-wider uppercase ${
                          isCNPJ ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 
                          isCPF ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                          'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {isCNPJ ? 'CNPJ' : isCPF ? 'CPF' : 'MANUAL'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-700 leading-snug">
                          {n.data?.label as string}
                        </div>
                        {docNumber && docNumber.length > 5 && !docNumber.includes('.') && (
                          <div className="font-mono text-[10px] text-slate-500 mt-1.5 font-semibold bg-slate-50 border border-slate-200 inline-block px-2 py-0.5 rounded shadow-sm">
                            {docNumber}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🔍 PAINEL DE INSPEÇÃO (FILIAIS E ENDEREÇOS) */}
      {empresaInspecionada && (
        <div className="absolute top-32 right-[340px] w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-30 overflow-hidden flex flex-col max-h-[65vh] animate-in fade-in zoom-in duration-200">
          <div className="bg-indigo-900 text-white p-4 flex justify-between items-center border-b border-indigo-800 shrink-0 shadow-md">
            <div className="flex flex-col overflow-hidden pr-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Unidades Identificadas</span>
              <span className="truncate font-bold text-sm" title={empresaInspecionada.nome}>{empresaInspecionada.nome}</span>
            </div>
            <button onClick={() => setEmpresaInspecionada(null)} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-rose-500 rounded-lg text-white font-black transition-colors shrink-0">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr className="text-slate-500 font-black uppercase tracking-wider text-[9px]">
                  <th className="p-3 border-b border-slate-200">CNPJ</th>
                  <th className="p-3 border-b border-slate-200 text-center">UF</th>
                  <th className="p-3 border-b border-slate-200">Bairro/Sede</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresaInspecionada.lista.map((filial: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-indigo-600 font-bold font-mono tracking-tight">{filial.cnpj || 'Matriz'}</td>
                    <td className="p-3 uppercase text-slate-500 font-bold text-center">{filial.uf || 'NI'}</td>
                    <td className="p-3 font-medium text-slate-600 truncate max-w-[160px]" title={filial.bairro}>{filial.bairro || 'Centro'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ➕ MODAL VÍNCULO MANUAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95">
            
            <div className="bg-purple-600 text-white p-5 flex justify-between items-center shadow-md z-10 shrink-0">
              <div>
                <h2 className="font-black text-lg uppercase tracking-tight flex items-center gap-2">🧬 Vínculo Estratégico</h2>
                <p className="text-[10px] text-purple-200 font-bold tracking-widest uppercase mt-0.5">Injeção Manual de Risco / Sociedade Oculta</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-rose-500 rounded-xl text-white font-black transition-colors">✕</button>
            </div>
            
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome Completo / Razão Social</label>
                <input type="text" value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Ex: HOLDING FAMILIAR MOURA" className={inputStyle} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tipo de Entidade</label>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as any)} className={`${inputStyle} cursor-pointer`}>
                    <option value="CPF">Pessoa Física (CPF)</option>
                    <option value="CNPJ">Pessoa Jurídica (CNPJ)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Documento (Opcional)</label>
                  <input type="text" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} placeholder="Números..." className={`${inputStyle} font-mono`} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Natureza da Relação</label>
                  <select value={manualRelacao} onChange={(e) => setManualRelacao(e.target.value)} className={`${inputStyle} cursor-pointer`}>
                    <optgroup label="Societário" className="font-bold text-slate-800">
                      <option value="Sócio">Sócio</option>
                      <option value="Sócio-Administrador">Sócio-Administrador</option>
                      <option value="Sócio Oculto">Sócio Oculto / Laranja</option>
                      <option value="Holding Familiar">Holding Familiar</option>
                    </optgroup>
                    <optgroup label="Corporativo" className="font-bold text-slate-800">
                      <option value="Empresa Coligada">Empresa Coligada</option>
                      <option value="Filial">Filial</option>
                      <option value="Mesmo Endereço">Mesmo Endereço</option>
                      <option value="Procurador">Procurador</option>
                      <option value="Diretor/Presidente">Diretor/Presidente</option>
                    </optgroup>
                    <optgroup label="Familiar" className="font-bold text-slate-800">
                      <option value="Esposo(a)">Esposo(a)</option>
                      <option value="Filho(a)">Filho(a)</option>
                      <option value="Irmão(ã)">Irmão(ã)</option>
                      <option value="Parente">Parente (Outro)</option>
                    </optgroup>
                  </select>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Linkar (Ancorar) Ao Nó</label>
                  <select value={noVinculoAlvo} onChange={(e) => setNoVinculoAlvo(e.target.value)} className={`${inputStyle} text-indigo-700 cursor-pointer`}>
                    <option value="" className="text-slate-400 font-medium">Selecione o ponto de partida...</option>
                    {nodes.map((no) => <option key={no.id} value={no.id} className="text-slate-800 font-bold">{no.data?.label as string}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-5 flex justify-end gap-3 border-t border-slate-200 shrink-0">
              <button onClick={() => setModalAberto(false)} className="px-6 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-600 text-xs transition-colors">Cancelar</button>
              <button onClick={handleSalvarVinculoManual} disabled={!manualNome || !noVinculoAlvo} className="px-8 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md">Injetar no Mapa</button>
            </div>

          </div>
        </div>
      )}

      {/* GLOBAL SCROLLBAR STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .react-flow__attribution { display: none !important; }
      `}} />

    </div>
  );
}