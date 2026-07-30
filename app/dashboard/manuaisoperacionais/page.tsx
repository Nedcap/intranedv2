/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { 
  BookOpen, Plus, Settings, FileText, AlertTriangle, 
  ListOrdered, Type, ArrowLeft, Save, Trash2, CheckCircle2,
  Image as ImageIcon, ChevronUp, ChevronDown, X, Eye, Lock, History, GitCompare,
  Printer
} from "lucide-react";
import { supabase } from "@/lib/supabase"; // ⚠️ AJUSTE AQUI SE SEU CAMINHO DO SUPABASE FOR DIFERENTE

// ============================================================================
// TIPAGENS DO CONSTRUTOR DE MANUAIS
// ============================================================================
type TipoBloco = "titulo" | "texto" | "passo-a-passo" | "alerta" | "politica" | "imagem";

interface Bloco {
  id: string;
  tipo: TipoBloco;
  conteudo: any;
}

// ============================================================================
// COMPONENTE PRINCIPAL (DASHBOARD & EDITOR/VIEWER & COMPARE)
// ============================================================================
export default function ManuaisOperacionaisPage() {
  const [view, setView] = useState<"list" | "editor" | "compare">("list");
  
  // Usuário Atual
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);

  // Estados do Banco de Dados
  const [manuais, setManuais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados do Manual Ativo (Editor/Viewer)
  const [manualIdAtivo, setManualIdAtivo] = useState<string | null>(null);
  const [manualTitulo, setManualTitulo] = useState<string>("Novo Manual Operacional");
  const [manualTipo, setManualTipo] = useState<string>("Manual");
  const [manualStatus, setManualStatus] = useState<string>("Em Revisão");
  const [manualAutor, setManualAutor] = useState<string>("");
  const [blocos, setBlocos] = useState<Bloco[]>([]);

  // Estados do Comparador
  const [historicoVersoes, setHistoricoVersoes] = useState<any[]>([]);
  const [versaoA, setVersaoA] = useState<any>(null);
  const [versaoB, setVersaoB] = useState<any>(null);

  // ============================================================================
  // FUNÇÃO DE IMPRESSÃO (DISPONÍVEL PARA QUALQUER PAPEL/ROLE)
  // ============================================================================
  const handleImprimir = (e?: React.MouseEvent, manual?: any) => {
    if (e) e.stopPropagation(); // Evita abrir o editor se clicado direto no card

    if (manual) {
      // Se clicado no card da listagem, carrega os dados e depois dispara a impressão
      setManualIdAtivo(manual.id);
      setManualTitulo(manual.titulo);
      setManualTipo(manual.tipo || "Manual");
      setManualStatus(manual.status || "Em Revisão");
      setManualAutor(manual.autor_nome || "");
      setBlocos(Array.isArray(manual.blocos) ? manual.blocos : []);
      setView("editor");
      
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      // Se clicado diretamente na tela de visualização/edição
      window.print();
    }
  };

  // ============================================================================
  // INTEGRAÇÃO SUPABASE E SESSÃO
  // ============================================================================
  const carregarManuais = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('manuais_operacionais')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setManuais(data || []);
    } catch (error) {
      console.error("Erro ao buscar manuais:", error);
    } fontally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem("intraned_user");
    if (userStr) {
      setUsuarioAtual(JSON.parse(userStr));
    }
    carregarManuais();
  }, []);

  const salvarDocumento = async () => {
    if (!manualTitulo.trim()) return alert("O manual precisa de um título.");
    setSalvando(true);

    try {
      const autor = usuarioAtual?.nome || "Sistema";
      let currentManualId = manualIdAtivo;

      const payload = {
        titulo: manualTitulo,
        tipo: manualTipo,
        status: manualStatus,
        blocos: blocos, 
        autor_nome: manualIdAtivo ? manualAutor : autor, 
        updated_at: new Date().toISOString()
      };

      if (currentManualId) {
        // ATUALIZAR EXISTENTE
        const { error } = await supabase
          .from('manuais_operacionais')
          .update(payload)
          .eq('id', currentManualId);
        if (error) throw error;
        alert("Manual atualizado com sucesso!");
      } else {
        // CRIAR NOVO
        const { data, error } = await supabase
          .from('manuais_operacionais')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        currentManualId = data.id;
        setManualIdAtivo(data.id);
        setManualAutor(autor); 
        alert("Novo manual criado com sucesso!");
      }

      // 🔥 GATILHO DE VERSIONAMENTO (Se está ATIVO, salva uma cópia na tabela de versões)
      if (manualStatus === "Ativo" && currentManualId) {
        const versaoPayload = {
          manual_id: currentManualId,
          titulo: manualTitulo,
          tipo: manualTipo,
          status: manualStatus,
          blocos: blocos,
          autor_nome: payload.autor_nome
        };
        await supabase.from('manuais_operacionais_versoes').insert([versaoPayload]);
      }

      carregarManuais();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert("Falha ao salvar no banco: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  // ============================================================================
  // LÓGICA DE PERMISSÃO E FILTROS
  // ============================================================================
  const isMaster = String(usuarioAtual?.cargo || "").toLowerCase() === "master";
  const canEdit = !manualIdAtivo || manualAutor === usuarioAtual?.nome || isMaster;

  const manuaisPermitidos = manuais.filter(m => {
    if (m.status === 'Ativo') return true;
    if (m.autor_nome === usuarioAtual?.nome) return true;
    if (isMaster) return true;
    return false;
  });

  // ============================================================================
  // AÇÕES DE ABRIR, CRIAR E COMPARAR
  // ============================================================================
  const abrirManual = (manual: any) => {
    setManualIdAtivo(manual.id);
    setManualTitulo(manual.titulo);
    setManualTipo(manual.tipo || "Manual");
    setManualStatus(manual.status || "Em Revisão");
    setManualAutor(manual.autor_nome || "");
    const blocosDoBanco = Array.isArray(manual.blocos) ? manual.blocos : [];
    setBlocos(blocosDoBanco); 
    setView("editor");
  };

  const criarNovoManual = () => {
    setManualIdAtivo(null);
    setManualTitulo("Novo Manual Operacional");
    setManualTipo("Manual");
    setManualStatus("Em Revisão");
    setManualAutor(usuarioAtual?.nome || "Sistema");
    setBlocos([]);
    setView("editor");
  };

  const abrirComparador = async () => {
    if (!manualIdAtivo) return;
    setCarregando(true);
    try {
      // Busca as versões salvas
      const { data, error } = await supabase
        .from('manuais_operacionais_versoes')
        .select('*')
        .eq('manual_id', manualIdAtivo)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const versoesEncontradas = data || [];
      
      if (versoesEncontradas.length < 1) {
        alert("Ainda não existem versões 'Ativas' salvas no histórico para comparar.");
        setCarregando(false);
        return;
      }

      setHistoricoVersoes(versoesEncontradas);
      setVersaoA(versoesEncontradas[0]); 
      setVersaoB(versoesEncontradas.length > 1 ? versoesEncontradas[1] : versoesEncontradas[0]);
      
      setView("compare");
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar histórico.");
    } finally {
      setCarregando(false);
    }
  };

  // ============================================================================
  // MOTOR DE CUSTOMIZAÇÃO DOS BLOCOS (INCLUINDO ORDENAÇÃO)
  // ============================================================================
  const adicionarBloco = (tipo: TipoBloco) => {
    const novoBloco: Bloco = { id: Math.random().toString(36).substr(2, 9), tipo, conteudo: tipo === "passo-a-passo" ? [""] : "" };
    setBlocos([...blocos, novoBloco]);
  };

  const removerBloco = (id: string) => setBlocos(blocos.filter((b) => b.id !== id));

  const moverBloco = (index: number, direcao: 'up' | 'down') => {
    if (direcao === 'up' && index === 0) return;
    if (direcao === 'down' && index === blocos.length - 1) return;
    const novosBlocos = [...blocos];
    const targetIndex = direcao === 'up' ? index - 1 : index + 1;
    const temp = novosBlocos[index];
    novosBlocos[index] = novosBlocos[targetIndex];
    novosBlocos[targetIndex] = temp;
    setBlocos(novosBlocos);
  };

  const atualizarConteudoBloco = (id: string, novoConteudo: any) => {
    setBlocos(blocos.map(b => b.id === id ? { ...b, conteudo: novoConteudo } : b));
  };

  const atualizarPasso = (blocoId: string, indexPasso: number, valor: string) => {
    setBlocos(blocos.map(b => {
      if (b.id === blocoId) {
        const novoConteudo = [...(b.conteudo || [])];
        novoConteudo[indexPasso] = valor;
        return { ...b, conteudo: novoConteudo };
      }
      return b;
    }));
  };

  const addPasso = (blocoId: string) => {
    setBlocos(blocos.map(b => {
      if (b.id === blocoId) {
        const atual = Array.isArray(b.conteudo) ? b.conteudo : [];
        return { ...b, conteudo: [...atual, ""] };
      }
      return b;
    }));
  };

  const removerPasso = (blocoId: string, indexPasso: number) => {
    setBlocos(blocos.map(b => {
      if (b.id === blocoId) {
        const atual = Array.isArray(b.conteudo) ? b.conteudo : [];
        return { ...b, conteudo: atual.filter((_, i) => i !== indexPasso) };
      }
      return b;
    }));
  };

  const handleImageUpload = (blocoId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) return alert("A imagem não pode passar de 5MB.");
    const reader = new FileReader();
    reader.onloadend = () => atualizarConteudoBloco(blocoId, reader.result); 
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // RENDERIZAÇÃO: MODO EDIÇÃO
  // ============================================================================
  const renderizarBlocoEdit = (bloco: Bloco) => {
    switch (bloco.tipo) {
      case "titulo":
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-4 border-l-4 border-l-blue-600">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 print:hidden">Bloco: Título de Seção</div>
            <input type="text" value={bloco.conteudo || ""} onChange={(e) => atualizarConteudoBloco(bloco.id, e.target.value)} placeholder="Digite o título da seção..." className="w-full text-2xl font-black text-blue-900 border-none outline-none bg-transparent placeholder:text-slate-300 uppercase tracking-tight" />
          </div>
        );
      case "texto":
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 print:hidden">Bloco: Parágrafo Padrão</div>
            <textarea value={bloco.conteudo || ""} onChange={(e) => atualizarConteudoBloco(bloco.id, e.target.value)} placeholder="Descreva as instruções ou políticas aqui..." className="w-full min-h-[100px] text-[15px] leading-relaxed text-slate-700 border-none outline-none resize-none bg-transparent placeholder:text-slate-300" />
          </div>
        );
      case "alerta":
        return (
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm mb-4 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div className="text-[10px] font-black text-red-500 uppercase tracking-widest print:hidden">Bloco: Alerta Crítico</div>
            </div>
            <textarea value={bloco.conteudo || ""} onChange={(e) => atualizarConteudoBloco(bloco.id, e.target.value)} placeholder="Atenção: Descreva a restrição ou regra inegociável..." className="w-full text-[15px] font-medium text-red-900 leading-relaxed border-none outline-none resize-none bg-transparent placeholder:text-red-300/70" />
          </div>
        );
      case "passo-a-passo":
        const passos = Array.isArray(bloco.conteudo) ? bloco.conteudo : [""];
        return (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4"><ListOrdered className="w-5 h-5 text-blue-600" /><div className="text-[10px] font-black text-slate-500 uppercase tracking-widest print:hidden">Bloco: Fluxo Operacional (Etapas)</div></div>
            <div className="flex flex-col gap-3">
              {passos.map((textoPasso: string, index: number) => (
                <div key={index} className="flex gap-4 items-start bg-white p-4 rounded-lg border border-slate-200 relative group/passo">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center font-mono text-sm">{index + 1}</div>
                  <input type="text" value={textoPasso} onChange={(e) => atualizarPasso(bloco.id, index, e.target.value)} placeholder={`Descreva a etapa ${index + 1}...`} className="w-full mt-1 text-[15px] text-slate-700 border-none outline-none bg-transparent placeholder:text-slate-300" />
                  {passos.length > 1 && (<button onClick={() => removerPasso(bloco.id, index)} className="absolute right-3 top-4 text-slate-300 hover:text-red-500 opacity-0 group-hover/passo:opacity-100 transition-opacity print:hidden"><X className="w-4 h-4" /></button>)}
                </div>
              ))}
              <button onClick={() => addPasso(bloco.id)} className="text-[12px] font-bold text-blue-600 uppercase tracking-wider mt-2 hover:underline text-left print:hidden">+ Adicionar Nova Etapa</button>
            </div>
          </div>
        );
      case "imagem":
        return (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4"><ImageIcon className="w-5 h-5 text-blue-600" /><div className="text-[10px] font-black text-slate-500 uppercase tracking-widest print:hidden">Bloco: Anexo / Print da Tela</div></div>
            {bloco.conteudo ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 group/img">
                <img src={bloco.conteudo} alt="Print Anexado" className="w-full h-auto object-contain max-h-[500px] bg-slate-200" />
                <button onClick={() => atualizarConteudoBloco(bloco.id, "")} className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all opacity-0 group-hover/img:opacity-100 shadow-lg print:hidden">Trocar Imagem</button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center bg-white hover:bg-slate-50 transition-colors cursor-pointer hover:border-blue-400 group/upload print:hidden">
                <ImageIcon className="w-8 h-8 text-slate-400 mb-2 group-hover/upload:text-blue-500 transition-colors" />
                <span className="text-sm font-bold text-slate-600 group-hover/upload:text-blue-600">Clique para fazer upload do print</span>
                <span className="text-xs text-slate-400 mt-1">PNG, JPG ou WEBP (Max 5MB)</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(bloco.id, file); }} />
              </label>
            )}
          </div>
        );
      default: return null;
    }
  };

  // ============================================================================
  // RENDERIZAÇÃO: MODO VISUALIZAÇÃO PREMIUM (SOMENTE LEITURA & COMPARAÇÃO)
  // ============================================================================
  const renderizarBlocoView = (bloco: Bloco) => {
    switch (bloco.tipo) {
      case "titulo": return <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight border-l-4 border-blue-600 pl-4 py-1 mb-6 mt-10">{bloco.conteudo}</h2>;
      case "texto": return <div className="text-[15px] leading-relaxed text-slate-700 mb-6 whitespace-pre-wrap">{bloco.conteudo}</div>;
      case "alerta":
        return (
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm mb-8 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-red-600" /><div className="text-[11px] font-black text-red-600 uppercase tracking-widest">Atenção Crítica</div></div>
            <div className="text-[15px] font-medium text-red-900 leading-relaxed whitespace-pre-wrap">{bloco.conteudo}</div>
          </div>
        );
      case "passo-a-passo":
        const passosView = Array.isArray(bloco.conteudo) ? bloco.conteudo : [];
        if (passosView.length === 0 || !passosView[0]) return null;
        return (
          <div className="mb-8 mt-4">
            <div className="flex flex-col gap-4">
              {passosView.map((textoPasso: string, index: number) => (
                <div key={index} className="flex gap-5 items-start bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center font-mono text-sm shadow-md">{index + 1}</div>
                  <div className="mt-1 text-[15px] text-slate-700 font-medium leading-relaxed">{textoPasso}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "imagem":
        if (!bloco.conteudo) return null;
        return (
          <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-center">
            <img src={bloco.conteudo} alt="Evidência" className="w-auto h-auto max-h-[600px] object-contain rounded-lg shadow-sm border border-slate-300" />
          </div>
        );
      default: return null;
    }
  };

  // ============================================================================
  // TELA 1: LISTAGEM DE MANUAIS (DASHBOARD)
  // ============================================================================
  if (view === "list") {
    return (
      <div className="p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50 font-['Inter']">
        <div className="bg-gradient-to-br from-blue-900 to-blue-600 p-8 flex flex-col md:flex-row justify-between items-start md:items-center rounded-2xl shadow-[0_10px_30px_-5px_rgba(37,99,235,0.3)] mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3">
              <BookOpen className="w-8 h-8 opacity-80" />
              Base de Conhecimento Operacional
            </h1>
            <p className="text-blue-100 font-medium opacity-90 text-sm">
              Consulte políticas, manuais corporativos e processos operacionais da plataforma.
            </p>
          </div>
          <button onClick={criarNovoManual} className="bg-white text-blue-900 hover:bg-slate-100 px-6 py-3 rounded-lg font-black uppercase text-xs tracking-wider shadow-lg transition-transform hover:-translate-y-0.5 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Criar Novo Documento
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2 border-b-2 border-slate-200 pb-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-xl font-black text-blue-900 uppercase tracking-wide">Biblioteca Oficial</h2>
        </div>

        {carregando ? (
          <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Carregando documentação...</div>
        ) : manuaisPermitidos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 text-slate-500 shadow-sm flex flex-col items-center justify-center">
            <Lock className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-bold">Nenhum manual liberado para o seu perfil no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manuaisPermitidos.map((manual) => {
              const isAdminDesteManual = manual.autor_nome === usuarioAtual?.nome || isMaster;
              return (
                <div key={manual.id} onClick={() => abrirManual(manual)} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                        manual.tipo === 'Política' ? 'bg-yellow-100 text-yellow-800' : 
                        manual.tipo === 'Processo' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {manual.tipo}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* 🖨️ BOTÃO DE IMPRESSÃO - DISPONÍVEL PARA QUALQUER PESSOA */}
                        <button
                          onClick={(e) => handleImprimir(e, manual)}
                          title="Imprimir Relatório"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {isAdminDesteManual ? (
                          <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" title="Você tem permissão de edição" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" title="Modo Leitura" />
                        )}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 leading-snug mb-2">{manual.titulo}</h3>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span className="truncate max-w-[120px]">Autor: <span className="font-bold">{manual.autor_nome || 'Sistema'}</span></span>
                    <span className={`flex items-center gap-1 shrink-0 ${
                      manual.status === 'Ativo' ? 'text-green-600' : 
                      manual.status === 'Inativo' ? 'text-red-500' : 'text-amber-500'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" /> {manual.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // TELA 3: COMPARADOR DE VERSÕES (LADO A LADO)
  // ============================================================================
  if (view === "compare") {
    return (
      <div className="p-4 md:p-8 max-w-[1800px] mx-auto min-h-screen bg-slate-50 font-['Inter'] flex flex-col">
        {/* Header do Comparador */}
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setView("editor")} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 font-bold text-sm uppercase transition-colors border-r border-slate-200 pr-4">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Editor
            </button>
            <div className="flex items-center gap-2 text-blue-900 font-black uppercase tracking-tight">
              <GitCompare className="w-5 h-5 text-blue-600" />
              Comparador de Versões Históricas
            </div>
          </div>
          <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded">
            {manualTitulo}
          </div>
        </div>

        {/* Grid Lado a Lado */}
        <div className="flex-1 grid grid-cols-2 gap-6 h-full">
          
          {/* LADO A */}
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className="bg-slate-100 p-4 border-b border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Selecione a Versão (A):</span>
              <select 
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                value={versaoA?.id || ""}
                onChange={(e) => setVersaoA(historicoVersoes.find(v => v.id === e.target.value))}
              >
                {historicoVersoes.map(v => (
                  <option key={v.id} value={v.id}>Versão de {new Date(v.created_at).toLocaleString('pt-BR')} (Por {v.autor_nome})</option>
                ))}
              </select>
            </div>
            <div className="p-8 overflow-y-auto max-h-[75vh]">
              {versaoA && versaoA.blocos && Array.isArray(versaoA.blocos) ? (
                versaoA.blocos.map((b: Bloco) => <div key={`A-${b.id}`}>{renderizarBlocoView(b)}</div>)
              ) : (
                <div className="text-center text-slate-400 py-10 text-sm font-bold">Documento vazio nesta versão.</div>
              )}
            </div>
          </div>

          {/* LADO B */}
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className="bg-blue-50 p-4 border-b border-blue-100">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-2">Selecione a Versão (B):</span>
              <select 
                className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-900 outline-none focus:border-blue-500"
                value={versaoB?.id || ""}
                onChange={(e) => setVersaoB(historicoVersoes.find(v => v.id === e.target.value))}
              >
                {historicoVersoes.map(v => (
                  <option key={v.id} value={v.id}>Versão de {new Date(v.created_at).toLocaleString('pt-BR')} (Por {v.autor_nome})</option>
                ))}
              </select>
            </div>
            <div className="p-8 overflow-y-auto max-h-[75vh]">
              {versaoB && versaoB.blocos && Array.isArray(versaoB.blocos) ? (
                versaoB.blocos.map((b: Bloco) => <div key={`B-${b.id}`}>{renderizarBlocoView(b)}</div>)
              ) : (
                <div className="text-center text-slate-400 py-10 text-sm font-bold">Documento vazio nesta versão.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============================================================================
  // TELA 2: EDITOR / LEITURA DO MANUAL (VIEW DEFAULT DO RELATÓRIO)
  // ============================================================================
  return (
    <>
      {/* 🖨️ ESTILO CSS PARA AJUSTAR A IMPRESSÃO E ESCONDER BOTÕES DE INTERFACE */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>

      <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50 font-['Inter'] flex gap-8 justify-center print:p-0 print:bg-white">
        
        {/* Coluna Esquerda: O Documento */}
        <div className={`flex-1 ${!canEdit ? 'max-w-[900px]' : ''} print:max-w-full print:w-full`}>
          
          <div className="flex justify-between items-center mb-6 print:hidden">
            <button onClick={() => setView("list")} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 font-bold text-sm uppercase transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
            </button>
            
            <div className="flex gap-3 items-center">
              {/* 🖨️ BOTÃO DE IMPRESSÃO GLOBAL - VISÍVEL PARA TODOS OS USUÁRIOS */}
              <button 
                onClick={() => handleImprimir()}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg font-black uppercase text-[11px] tracking-widest transition-all flex items-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" /> Imprimir Relatório
              </button>

              {canEdit && (
                <>
                  {manualIdAtivo && (
                    <button 
                      onClick={abrirComparador}
                      className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-black uppercase text-[11px] tracking-widest transition-all flex items-center gap-2 shadow-sm"
                    >
                      <History className="w-4 h-4" /> Histórico / Comparar
                    </button>
                  )}
                  <button 
                    onClick={salvarDocumento}
                    disabled={salvando}
                    className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 rounded-lg font-black uppercase text-[11px] tracking-widest transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {salvando ? "Salvando..." : "Salvar no Banco"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`bg-white rounded-t-2xl border border-slate-200 border-b-0 relative overflow-hidden print:border-none print:shadow-none ${canEdit ? 'p-10' : 'p-12 pb-8'}`}>
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-900 to-blue-500 print:hidden"></div>
            
            {canEdit ? (
              <input 
                type="text" 
                value={manualTitulo}
                onChange={(e) => setManualTitulo(e.target.value)}
                className="w-full text-4xl font-black text-blue-900 uppercase tracking-tighter border-none outline-none bg-transparent placeholder:text-slate-300 mb-6"
                placeholder="NOME DO DOCUMENTO AQUI..."
              />
            ) : (
              <h1 className="w-full text-4xl font-black text-blue-900 uppercase tracking-tighter mb-8 leading-tight">{manualTitulo}</h1>
            )}
            
            <div className={`flex gap-6 border-t border-slate-100 ${canEdit ? 'pt-6' : 'pt-4'} text-sm font-semibold text-slate-500`}>
              
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classificação:</span>
                  <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value)} className="bg-slate-100 text-slate-800 border-none outline-none rounded px-2 py-1 text-xs font-bold uppercase cursor-pointer print:bg-transparent">
                    <option value="Manual">Manual</option>
                    <option value="Política">Política</option>
                    <option value="Processo">Processo</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classificação:</span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs font-bold uppercase">{manualTipo}</span>
                </div>
              )}
              
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Legal:</span>
                  <select value={manualStatus} onChange={(e) => setManualStatus(e.target.value)} className="bg-slate-100 text-slate-800 border-none outline-none rounded px-2 py-1 text-xs font-bold uppercase cursor-pointer print:bg-transparent">
                    <option value="Em Revisão">Em Revisão</option>
                    <option value="Ativo">Vigente (Ativo)</option>
                    <option value="Inativo">Inativo / Obsoleto</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Legal:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${manualStatus === 'Ativo' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{manualStatus}</span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Criado por:</span>
                <span className="text-slate-800 font-bold text-xs uppercase">{manualAutor || "Sistema"}</span>
              </div>

            </div>
          </div>

          <div className={`${canEdit ? 'bg-slate-100/50' : 'bg-white'} min-h-[500px] border border-slate-200 border-t-0 p-8 ${!canEdit && 'px-12'} rounded-b-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] print:border-none print:shadow-none print:p-0 print:bg-white`}>
            {blocos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed border-slate-300 rounded-xl print:hidden">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-bold uppercase tracking-wider text-sm">O documento está vazio</p>
                {canEdit && <p className="text-xs mt-2">Use o painel lateral para adicionar blocos de conteúdo.</p>}
              </div>
            ) : (
              <div className="flex flex-col">
                {blocos.map((bloco, index) => (
                  <div key={bloco.id} className="relative group/bloco">
                    {canEdit && (
                      <div className="absolute -right-3 -top-3 z-10 flex gap-1 opacity-0 group-hover/bloco:opacity-100 transition-opacity print:hidden">
                        <button onClick={() => moverBloco(index, 'up')} disabled={index === 0} className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded-full shadow-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para Cima"><ChevronUp className="w-4 h-4" /></button>
                        <button onClick={() => moverBloco(index, 'down')} disabled={index === blocos.length - 1} className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded-full shadow-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para Baixo"><ChevronDown className="w-4 h-4" /></button>
                        <button onClick={() => removerBloco(bloco.id)} className="bg-red-100 border border-red-200 text-red-600 p-1.5 rounded-full shadow-md hover:bg-red-200" title="Remover Bloco"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                    {canEdit ? renderizarBlocoEdit(bloco) : renderizarBlocoView(bloco)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="w-80 shrink-0 print:hidden">
            <div className="sticky top-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Componentes
                </h3>
              </div>
              
              <div className="p-4 flex flex-col gap-2">
                <button onClick={() => adicionarBloco("titulo")} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group">
                  <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Type className="w-4 h-4" /></div>
                  <div><div className="font-bold text-slate-800 text-sm">Título Principal</div><div className="text-[11px] text-slate-500">Cabeçalho de seção (H2)</div></div>
                </button>

                <button onClick={() => adicionarBloco("texto")} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group">
                  <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FileText className="w-4 h-4" /></div>
                  <div><div className="font-bold text-slate-800 text-sm">Parágrafo Padrão</div><div className="text-[11px] text-slate-500">Texto formatado livre</div></div>
                </button>

                <button onClick={() => adicionarBloco("imagem")} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group">
                  <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><ImageIcon className="w-4 h-4" /></div>
                  <div><div className="font-bold text-slate-800 text-sm">Print / Imagem</div><div className="text-[11px] text-slate-500">Anexo visual na documentação</div></div>
                </button>

                <button onClick={() => adicionarBloco("passo-a-passo")} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group">
                  <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><ListOrdered className="w-4 h-4" /></div>
                  <div><div className="font-bold text-slate-800 text-sm">Passo a Passo</div><div className="text-[11px] text-slate-500">Lista ordenada com numeração</div></div>
                </button>

                <button onClick={() => adicionarBloco("alerta")} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50 text-left transition-colors group">
                  <div className="bg-slate-100 p-2 rounded text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors"><AlertTriangle className="w-4 h-4" /></div>
                  <div><div className="font-bold text-slate-800 text-sm">Card de Alerta</div><div className="text-[11px] text-slate-500">Destaque para riscos/regras</div></div>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}