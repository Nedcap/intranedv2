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
import { toPng } from 'html-to-image';
import '@xyflow/react/dist/style.css';
import { ReactFlowProvider } from '@xyflow/react';

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
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
        <span style={{ pointerEvents: 'none', userSelect: 'none', textAlign: 'center' }}>{data.label}</span>
        <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, border: 'none', pointerEvents: 'none' }} />
      </div>
    );
  }
};

export default function BuscaGrupoPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center text-sm font-mono text-slate-800 animate-pulse bg-white">⚡ Inicializando Renderizador Órbita B2B...</div>}>
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

      let backendNodes = data.nodes || [];
      let backendEdges = data.edges || [];

      // =========================================================================
      // 🧠 LÓGICA DE ANCORAGEM (CORRIGIDA): Evita duplicar o nó manual ao expandir
      // =========================================================================
      if (clickedNodeId) {
        const docLimpo = documento.replace(/\D/g, "");
        
        // Localiza qual nó retornado pelo backend é equivalente ao nó que clicamos
        const rootNode = backendNodes.find((n: any) => {
            if (docLimpo && n.id.replace(/\D/g, "").includes(docLimpo)) return true;
            if (nomeSocio && n.data?.label && String(n.data.label).toUpperCase().includes(nomeSocio.toUpperCase())) return true;
            if (n.data?.isMatriz) return true;
            return false;
        });

        if (rootNode && rootNode.id !== clickedNodeId) {
            const novoIdBackend = rootNode.id;
            
            // 1. Redireciona todas as arestas JÁ EXISTENTES na tela para o novo nó rico da API
            setEdges((prevEdges) => prevEdges.map((e: any) => ({
                ...e,
                source: e.source === clickedNodeId ? novoIdBackend : e.source,
                target: e.target === clickedNodeId ? novoIdBackend : e.target,
            })));

            // 2. Remove o nó manual antigo da tela (para não duplicar, pois o backendNodes trará o correto)
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
    
    // Passando o ID do nó clicado como 5º argumento para realizar a ancoragem correta
    handleBuscarDireto(docNode, tipoNode, node.position, nomeDoSocio as string, node.id);
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
    // Padroniza a criação de ID manual para evitar conflitos
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
          backgroundColor: manualTipo === 'CNPJ' ? '#1e40af' : '#8b5cf6', 
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
          border: `2px solid ${manualTipo === 'CNPJ' ? '#3b82f6' : '#a855f7'}` 
      }
    }]);

    setEdges((prev) => [...prev, { id: `edge-manual-${Date.now()}`, source: noVinculoAlvo, target: novoNoId, label: manualRelacao, animated: true, type: 'straight', style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' } }]);
    setModalAberto(false); 
    setManualNome(""); 
    setManualDoc("");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-4 font-sans text-slate-800 selection:bg-blue-200 overflow-hidden">
      
      {/* TOOLBAR CLARA */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl shadow-sm mb-4 border border-slate-200 shrink-0">
        <div className="flex flex-col pr-4 border-r border-slate-200">
          <h1 className="text-lg font-extrabold tracking-tight text-blue-700">Órbita FIDC</h1>
          <span className="text-[10px] text-slate-500 font-medium tracking-wide">Mapeamento Antihomônimo de Grupos</span>
        </div>
        
        <select className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold outline-none text-slate-800 transition-all focus:border-blue-500 cursor-pointer" value={tipoBusca} onChange={(e) => setTipoBusca(e.target.value as any)}>
          <option value="CNPJ">CNPJ Base</option>
          <option value="CPF">CPF Sócio</option>
        </select>

        <input type="text" placeholder="Digite sem pontuação..." className="p-2 bg-slate-50 border border-slate-300 rounded-lg w-48 text-xs font-mono outline-none text-slate-800 transition-all focus:border-blue-500 placeholder:text-slate-400" value={documentoBusca} onChange={(e) => setDocumentoBusca(e.target.value)} disabled={isLoading} />

        <button onClick={handleBuscar} disabled={isLoading} className="font-bold py-2 px-5 rounded-lg text-xs text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50">
          {isLoading ? 'Cruzando...' : 'Pesquisar Rede'}
        </button>

        <button onClick={() => setModalAberto(true)} className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-md shadow-purple-600/30 cursor-pointer">
          + Vínculo Manual
        </button>

        <div className="ml-auto flex gap-2">
          <button onClick={gerarImagemCaptura} disabled={isLoading} className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer border border-slate-300 shadow-sm disabled:opacity-50">
            📸 Capturar Imagem
          </button>
          <button onClick={exportarEstruturaEstrategica} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-md shadow-emerald-600/30 cursor-pointer">
            💾 Exportar JSON
          </button>
          <button onClick={() => { setNodes([]); setEdges([]); }} className="bg-white hover:bg-slate-100 text-red-600 font-bold py-2 px-3 rounded-lg text-xs transition-all border border-red-200 cursor-pointer">
            Limpar Canvas
          </button>
        </div>
      </div>

      {/* ÁREA INFERIOR: MAPA E TABELA */}
      <div className="flex gap-4 w-full h-full pb-2 overflow-hidden flex-1">
        
        {/* CANVAS FUNDO BRANCO */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-lg relative overflow-hidden">
          <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm p-3 rounded-lg text-[10px] text-slate-600 pointer-events-none shadow-sm border border-slate-200 space-y-1">
            <p className="font-bold text-blue-600">🛡️ Filtro Antihomônimo Ativado</p>
            <p>🖱️ <span className="text-slate-800 font-bold">1 Clique:</span> Detalha filiais da PJ</p>
            <p>🖱️🖱️ <span className="text-slate-800 font-bold">2 Cliques:</span> Expande conexões limpas</p>
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
            <Background color="#cbd5e1" gap={18} size={1} />
            <Controls className="bg-white border-slate-200 text-slate-800 rounded fill-slate-800 shadow-md" />
            <MiniMap nodeStrokeWidth={3} zoomable pannable maskColor="rgba(248,250,252,0.8)" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', right: 10, bottom: 10 }} />
          </ReactFlow>
        </div>

        {/* TABELA LATERAL INTELIGENTE */}
        <div className="w-1/4 min-w-[280px] bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
          <div className="bg-slate-800 text-white p-3.5 font-bold text-xs flex justify-between items-center shrink-0">
            <span className="tracking-wide">📋 Relação de Entidades</span>
            <span className="bg-slate-700 px-2.5 py-1 rounded-md text-[10px] border border-slate-600 shadow-inner">
              {nodes.length} Registros
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-white sticky top-0 z-10">
                  <th className="p-2 pb-3 font-semibold uppercase tracking-wider text-[9px]">Tipo</th>
                  <th className="p-2 pb-3 font-semibold uppercase tracking-wider text-[9px]">Documento / Razão Social</th>
                </tr>
              </thead>
              <tbody>
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center p-6 text-slate-400 font-mono">O mapa está vazio</td>
                  </tr>
                )}
                {nodes.map(n => {
                  const isCNPJ = n.id.startsWith('CNPJ') || n.id.startsWith('PJ');
                  const isCPF = n.id.startsWith('CPF') || n.id.startsWith('PF');
                  const docNumber = n.id.split('-').slice(1).join('-');
                  
                  return (
                    <tr key={n.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-2 align-top">
                        <span className={`px-2 py-1 rounded font-bold text-[9px] shadow-sm inline-block whitespace-nowrap ${
                          isCNPJ ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                          isCPF ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                          'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}>
                          {isCNPJ ? 'CNPJ' : isCPF ? 'CPF' : 'MANUAL'}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="font-bold text-slate-700 leading-tight">
                          {n.data?.label as string}
                        </div>
                        {docNumber && docNumber.length > 5 && !docNumber.includes('.') && (
                          <div className="font-mono text-[9px] text-slate-400 mt-1.5 tracking-wider bg-slate-100 inline-block px-1.5 rounded">
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

      {/* PAINEL DE INSPEÇÃO (EMPRESA) */}
      {empresaInspecionada && (
        <div className="absolute top-28 right-[27%] w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-30 overflow-hidden flex flex-col max-h-[65vh] animate-in fade-in slide-in-from-right duration-200">
          <div className="bg-slate-50 text-slate-800 p-3.5 font-bold text-xs flex justify-between items-center border-b border-slate-200">
            <span className="truncate pr-2 text-blue-700">🏢 Unidades: {empresaInspecionada.nome}</span>
            <button onClick={() => setEmpresaInspecionada(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded text-[10px] font-bold transition-all">Fechar X</button>
          </div>
          <div className="p-2 overflow-y-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px]">
                  <th className="p-2">CNPJ</th>
                  <th className="p-1">UF</th>
                  <th className="p-1">Bairro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                {empresaInspecionada.lista.map((filial: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-blue-600 font-bold tracking-tight">{filial.cnpj || 'Matriz'}</td>
                    <td className="p-1 uppercase text-slate-500">{filial.uf || 'NI'}</td>
                    <td className="p-1 font-sans truncate max-w-[130px] text-slate-500">{filial.bairro || 'Centro'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL VÍNCULO MANUAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-xs text-slate-800">
            <div className="bg-purple-600 text-white p-4 font-bold flex justify-between items-center border-b border-purple-700">
              <span className="tracking-wide">🧬 Injetar Relacionamento Oculto</span>
              <button onClick={() => setModalAberto(false)} className="text-purple-200 hover:text-white">Fechar X</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">Nome / Razão Social:</label>
                <input type="text" value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Ex: HOLDING FAMILIAR MOURA" className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg uppercase outline-none text-slate-800 focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Tipo:</label>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value as any)} className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-slate-800 focus:border-purple-500 cursor-pointer">
                    <option value="CPF">Pessoa Física (CPF)</option>
                    <option value="CNPJ">Pessoa Jurídica (CNPJ)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Doc (Opcional):</label>
                  <input type="text" value={manualDoc} onChange={(e) => setManualDoc(e.target.value)} placeholder="Números..." className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono outline-none text-slate-800 focus:border-purple-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Relação:</label>
                  <select value={manualRelacao} onChange={(e) => setManualRelacao(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-slate-800 focus:border-purple-500 cursor-pointer">
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
                      <option value="Diretor/Presidente">Diretor/Presidente</option>
                    </optgroup>
                    <optgroup label="Familiar">
                      <option value="Esposo(a)">Esposo(a)</option>
                      <option value="Filho(a)">Filho(a)</option>
                      <option value="Irmão(ã)">Irmão(ã)</option>
                      <option value="Parente">Parente (Outro)</option>
                    </optgroup>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">Linkar ao Nó:</label>
                  <select value={noVinculoAlvo} onChange={(e) => setNoVinculoAlvo(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-blue-700 font-bold focus:border-purple-500 cursor-pointer">
                    <option value="" className="text-slate-500 font-normal">Escolha...</option>
                    {nodes.map((no) => <option key={no.id} value={no.id} className="text-slate-800 font-semibold">{no.data?.label as string}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-3 flex gap-2 justify-end border-t border-slate-100">
                <button onClick={() => setModalAberto(false)} className="bg-slate-100 hover:bg-slate-200 border border-slate-300 py-2 px-4 rounded-lg font-bold text-slate-700 transition-all">Cancelar</button>
                <button onClick={handleSalvarVinculoManual} className="bg-purple-600 hover:bg-purple-700 py-2 px-5 rounded-lg text-white font-bold transition-all shadow-md shadow-purple-600/30">Injetar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}