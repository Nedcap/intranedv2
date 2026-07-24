/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { 
  BookOpen, Plus, Settings, FileText, AlertTriangle, 
  ListOrdered, Type, ArrowLeft, Save, Trash2, CheckCircle2,
  Image as ImageIcon, ChevronUp, ChevronDown, X
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
// COMPONENTE PRINCIPAL (DASHBOARD & EDITOR)
// ============================================================================
export default function ManuaisOperacionaisPage() {
  const [view, setView] = useState<"list" | "editor">("list");
  
  // Estados do Banco de Dados
  const [manuais, setManuais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados do Manual Ativo (Editor)
  const [manualIdAtivo, setManualIdAtivo] = useState<string | null>(null);
  const [manualTitulo, setManualTitulo] = useState<string>("Novo Manual Operacional");
  const [manualTipo, setManualTipo] = useState<string>("Manual");
  const [manualStatus, setManualStatus] = useState<string>("Em Revisão");
  const [blocos, setBlocos] = useState<Bloco[]>([]);

  // ============================================================================
  // INTEGRAÇÃO SUPABASE (FETCH E SAVE)
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
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarManuais();
  }, []);

  const salvarDocumento = async () => {
    if (!manualTitulo.trim()) return alert("O manual precisa de um título.");
    setSalvando(true);

    try {
      // Pega o nome do usuário ativo (opcional, ajustado para o seu Auth)
      let autor = "Sistema";
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        autor = u.nome || "Sistema";
      }

      const payload = {
        titulo: manualTitulo,
        tipo: manualTipo,
        status: manualStatus,
        blocos: blocos, // Vai como JSONB pro banco
        autor_nome: autor,
        updated_at: new Date().toISOString()
      };

      if (manualIdAtivo) {
        // ATUALIZAR EXISTENTE
        const { error } = await supabase
          .from('manuais_operacionais')
          .update(payload)
          .eq('id', manualIdAtivo);
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
        setManualIdAtivo(data.id);
        alert("Novo manual criado com sucesso!");
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
  // AÇÕES DE ABRIR E CRIAR
  // ============================================================================
  const abrirManual = (manual: any) => {
    setManualIdAtivo(manual.id);
    setManualTitulo(manual.titulo);
    setManualTipo(manual.tipo || "Manual");
    setManualStatus(manual.status || "Em Revisão");
    
    // Garante que se o JSONB vier null, vira array vazio
    const blocosDoBanco = Array.isArray(manual.blocos) ? manual.blocos : [];
    setBlocos(blocosDoBanco); 
    
    setView("editor");
  };

  const criarNovoManual = () => {
    setManualIdAtivo(null);
    setManualTitulo("Novo Manual Operacional");
    setManualTipo("Manual");
    setManualStatus("Em Revisão");
    setBlocos([]);
    setView("editor");
  };

  // ============================================================================
  // MOTOR DE CUSTOMIZAÇÃO DOS BLOCOS (INCLUINDO ORDENAÇÃO)
  // ============================================================================
  const adicionarBloco = (tipo: TipoBloco) => {
    const novoBloco: Bloco = {
      id: Math.random().toString(36).substr(2, 9),
      tipo,
      conteudo: tipo === "passo-a-passo" ? [""] : "" // Passo a passo é array
    };
    setBlocos([...blocos, novoBloco]);
  };

  const removerBloco = (id: string) => {
    setBlocos(blocos.filter((b) => b.id !== id));
  };

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

  // Funções específicas para o Passo a Passo (Array interno)
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

  // Transforma arquivo em Base64 para salvar direto no JSONB
  const handleImageUpload = (blocoId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) return alert("A imagem não pode passar de 5MB.");
    const reader = new FileReader();
    reader.onloadend = () => {
      atualizarConteudoBloco(blocoId, reader.result); // Salva o Base64 na key conteudo
    };
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // RENDERIZAÇÃO DOS BLOCOS (ESTÉTICA DO SEU DOSSIÊ)
  // ============================================================================
  const renderizarBloco = (bloco: Bloco) => {
    switch (bloco.tipo) {
      case "titulo":
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-4 border-l-4 border-l-blue-600">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bloco: Título de Seção</div>
            <input 
              type="text" 
              value={bloco.conteudo || ""}
              onChange={(e) => atualizarConteudoBloco(bloco.id, e.target.value)}
              placeholder="Digite o título da seção..." 
              className="w-full text-2xl font-black text-blue-900 border-none outline-none bg-transparent placeholder:text-slate-300 uppercase tracking-tight"
            />
          </div>
        );
      
      case "texto":
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bloco: Parágrafo Padrão</div>
            <textarea 
              value={bloco.conteudo || ""}
              onChange={(e) => atualizarConteudoBloco(bloco.id, e.target.value)}
              placeholder="Descreva as instruções ou políticas aqui..." 
              className="w-full min-h-[100px] text-[15px] leading-relaxed text-slate-700 border-none outline-none resize-none bg-transparent placeholder:text-slate-300"
            />
          </div>
        );

      case "alerta":
        return (
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm mb-4 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Bloco: Alerta Crítico</div>
            </div>
            <textarea 
              value={bloco.conteudo || ""}
              onChange={(e) => atualizarConteudoBloco(bloco.id, e.target.value)}
              placeholder="Atenção: Descreva a restrição ou regra inegociável..." 
              className="w-full text-[15px] font-medium text-red-900 leading-relaxed border-none outline-none resize-none bg-transparent placeholder:text-red-300/70"
            />
          </div>
        );

      case "passo-a-passo":
        const passos = Array.isArray(bloco.conteudo) ? bloco.conteudo : [""];
        return (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4">
              <ListOrdered className="w-5 h-5 text-blue-600" />
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bloco: Fluxo Operacional (Etapas)</div>
            </div>
            <div className="flex flex-col gap-3">
              {passos.map((textoPasso: string, index: number) => (
                <div key={index} className="flex gap-4 items-start bg-white p-4 rounded-lg border border-slate-200 relative group/passo">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center font-mono text-sm">
                    {index + 1}
                  </div>
                  <input 
                    type="text" 
                    value={textoPasso}
                    onChange={(e) => atualizarPasso(bloco.id, index, e.target.value)}
                    placeholder={`Descreva a etapa ${index + 1}...`} 
                    className="w-full mt-1 text-[15px] text-slate-700 border-none outline-none bg-transparent placeholder:text-slate-300"
                  />
                  {passos.length > 1 && (
                    <button 
                      onClick={() => removerPasso(bloco.id, index)}
                      className="absolute right-3 top-4 text-slate-300 hover:text-red-500 opacity-0 group-hover/passo:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={() => addPasso(bloco.id)}
                className="text-[12px] font-bold text-blue-600 uppercase tracking-wider mt-2 hover:underline text-left"
              >
                + Adicionar Nova Etapa
              </button>
            </div>
          </div>
        );

      case "imagem":
        return (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bloco: Anexo / Print da Tela</div>
            </div>
            
            {bloco.conteudo ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 group/img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={bloco.conteudo} 
                  alt="Print Anexado" 
                  className="w-full h-auto object-contain max-h-[500px] bg-slate-200" 
                />
                <button 
                  onClick={() => atualizarConteudoBloco(bloco.id, "")}
                  className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all opacity-0 group-hover/img:opacity-100 shadow-lg"
                >
                  Trocar Imagem
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center bg-white hover:bg-slate-50 transition-colors cursor-pointer hover:border-blue-400 group/upload">
                <ImageIcon className="w-8 h-8 text-slate-400 mb-2 group-hover/upload:text-blue-500 transition-colors" />
                <span className="text-sm font-bold text-slate-600 group-hover/upload:text-blue-600">Clique para fazer upload do print</span>
                <span className="text-xs text-slate-400 mt-1">PNG, JPG ou WEBP (Max 5MB)</span>
                <input 
                  type="file" 
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(bloco.id, file);
                  }}
                />
              </label>
            )}
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
        {/* Header Premium */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-600 p-8 flex flex-col md:flex-row justify-between items-start md:items-center rounded-2xl shadow-[0_10px_30px_-5px_rgba(37,99,235,0.3)] mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3">
              <BookOpen className="w-8 h-8 opacity-80" />
              Base de Conhecimento Operacional
            </h1>
            <p className="text-blue-100 font-medium opacity-90 text-sm">
              Gerencie políticas, fluxos de crédito e manuais internos da plataforma.
            </p>
          </div>
          <button 
            onClick={criarNovoManual}
            className="bg-white text-blue-900 hover:bg-slate-100 px-6 py-3 rounded-lg font-black uppercase text-xs tracking-wider shadow-lg transition-transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Novo Dossiê / Manual
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2 border-b-2 border-slate-200 pb-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-xl font-black text-blue-900 uppercase tracking-wide">Documentos Homologados</h2>
        </div>

        {carregando ? (
          <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Carregando manuais do banco de dados...</div>
        ) : manuais.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 text-slate-500 shadow-sm">
            Nenhum documento encontrado. Crie o primeiro!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manuais.map((manual) => (
              <div 
                key={manual.id} 
                onClick={() => abrirManual(manual)}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                      manual.tipo === 'Política' ? 'bg-yellow-100 text-yellow-800' : 
                      manual.tipo === 'Processo' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {manual.tipo}
                    </span>
                    <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 leading-snug mb-2">{manual.titulo}</h3>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>Autor: <span className="font-bold">{manual.autor_nome || 'Sistema'}</span></span>
                  <span className={`flex items-center gap-1 ${manual.status === 'Ativo' ? 'text-green-600' : 'text-blue-600'}`}>
                    <CheckCircle2 className="w-3 h-3" /> {manual.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // TELA 2: EDITOR / CONSTRUTOR DE BLOCOS
  // ============================================================================
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50 font-['Inter'] flex gap-8">
      
      {/* Coluna Esquerda: A Tela de Construção */}
      <div className="flex-1">
        {/* Barra de Ferramentas Superior */}
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => setView("list")}
            className="text-slate-500 hover:text-blue-600 flex items-center gap-2 font-bold text-sm uppercase transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
          </button>
          <div className="flex gap-3">
            <button 
              onClick={salvarDocumento}
              disabled={salvando}
              className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 rounded-lg font-black uppercase text-[11px] tracking-widest transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {salvando ? "Salvando..." : "Salvar no Banco"}
            </button>
          </div>
        </div>

        {/* Capa do Relatório */}
        <div className="bg-white rounded-t-2xl border border-slate-200 border-b-0 p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-900 to-blue-500"></div>
          
          <input 
            type="text" 
            value={manualTitulo}
            onChange={(e) => setManualTitulo(e.target.value)}
            className="w-full text-4xl font-black text-blue-900 uppercase tracking-tighter border-none outline-none bg-transparent placeholder:text-slate-300 mb-6"
            placeholder="NOME DO DOCUMENTO AQUI..."
          />
          
          <div className="flex gap-6 border-t border-slate-100 pt-6 text-sm font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classificação:</span>
              <select 
                value={manualTipo} 
                onChange={(e) => setManualTipo(e.target.value)}
                className="bg-slate-100 text-slate-800 border-none outline-none rounded px-2 py-1 text-xs font-bold uppercase cursor-pointer"
              >
                <option value="Manual">Manual</option>
                <option value="Política">Política</option>
                <option value="Processo">Processo</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Legal:</span>
              <select 
                value={manualStatus} 
                onChange={(e) => setManualStatus(e.target.value)}
                className="bg-slate-100 text-slate-800 border-none outline-none rounded px-2 py-1 text-xs font-bold uppercase cursor-pointer"
              >
                <option value="Em Revisão">Em Revisão</option>
                <option value="Ativo">Vigente (Ativo)</option>
                <option value="Inativo">Inativo / Obsoleto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Área de Renderização dos Blocos */}
        <div className="bg-slate-100/50 min-h-[500px] border border-slate-200 p-8 rounded-b-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          {blocos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed border-slate-300 rounded-xl">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-bold uppercase tracking-wider text-sm">O documento está vazio</p>
              <p className="text-xs mt-2">Use o painel lateral para adicionar blocos de conteúdo.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {blocos.map((bloco, index) => (
                <div key={bloco.id} className="relative group/bloco">
                  
                  {/* Menu de Ações do Bloco (Sobe, Desce, Exclui) */}
                  <div className="absolute -right-3 -top-3 z-10 flex gap-1 opacity-0 group-hover/bloco:opacity-100 transition-opacity">
                    <button 
                      onClick={() => moverBloco(index, 'up')}
                      disabled={index === 0}
                      className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded-full shadow-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para Cima"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => moverBloco(index, 'down')}
                      disabled={index === blocos.length - 1}
                      className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded-full shadow-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para Baixo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => removerBloco(bloco.id)}
                      className="bg-red-100 border border-red-200 text-red-600 p-1.5 rounded-full shadow-md hover:bg-red-200"
                      title="Remover Bloco"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {renderizarBloco(bloco)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coluna Direita: Painel de Controle / Adição de Blocos */}
      <div className="w-80 shrink-0">
        <div className="sticky top-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4" /> Componentes
            </h3>
          </div>
          
          <div className="p-4 flex flex-col gap-2">
            <button 
              onClick={() => adicionarBloco("titulo")}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group"
            >
              <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Título Principal</div>
                <div className="text-[11px] text-slate-500">Cabeçalho de seção (H2)</div>
              </div>
            </button>

            <button 
              onClick={() => adicionarBloco("texto")}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group"
            >
              <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Parágrafo Padrão</div>
                <div className="text-[11px] text-slate-500">Texto formatado livre</div>
              </div>
            </button>

            <button 
              onClick={() => adicionarBloco("imagem")}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group"
            >
              <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Print / Imagem</div>
                <div className="text-[11px] text-slate-500">Anexo visual na documentação</div>
              </div>
            </button>

            <button 
              onClick={() => adicionarBloco("passo-a-passo")}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group"
            >
              <div className="bg-slate-100 p-2 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ListOrdered className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Passo a Passo</div>
                <div className="text-[11px] text-slate-500">Lista ordenada com numeração</div>
              </div>
            </button>

            <button 
              onClick={() => adicionarBloco("alerta")}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50 text-left transition-colors group"
            >
              <div className="bg-slate-100 p-2 rounded text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Card de Alerta</div>
                <div className="text-[11px] text-slate-500">Destaque para riscos/regras</div>
              </div>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}