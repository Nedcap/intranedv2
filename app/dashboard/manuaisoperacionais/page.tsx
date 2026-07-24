/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { 
  BookOpen, Plus, Settings, FileText, AlertTriangle, 
  ListOrdered, Type, ArrowLeft, Save, Trash2, CheckCircle2,
  Image as ImageIcon // 📸 Import do ícone de Imagem
} from "lucide-react";

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
  const [manualAtivo, setManualAtivo] = useState<string>("Novo Manual Operacional");
  const [blocos, setBlocos] = useState<Bloco[]>([]);

  // Mock provisório enquanto não plugamos no Supabase
  const manuaisSalvos = [
    { 
      id: "1", 
      titulo: "Política de Concessão de Crédito V8", 
      tipo: "Política", 
      data: "24/07/2026", 
      status: "Ativo",
      blocosFake: [
        { id: "b1", tipo: "titulo" as TipoBloco, conteudo: "1. Regras Inegociáveis" },
        { id: "b2", tipo: "alerta" as TipoBloco, conteudo: "Atenção: Proibido aprovar sem consulta no Serasa confirmada e anexada ao dossiê." },
        { id: "b3", tipo: "texto" as TipoBloco, conteudo: "O comitê de crédito se reunirá todas as terças-feiras para deliberação de propostas acima de R$ 500.000,00." }
      ]
    },
    { 
      id: "2", 
      titulo: "Manual de Integração (Onboarding)", 
      tipo: "Manual", 
      data: "15/06/2026", 
      status: "Em Revisão",
      blocosFake: [] 
    },
  ];

  // ============================================================================
  // AÇÕES DE ABRIR E CRIAR
  // ============================================================================
  const abrirManual = (manual: any) => {
    setManualAtivo(manual.titulo);
    // Aqui no futuro vai ser setBlocos(manual.blocos) vindo do banco
    setBlocos(manual.blocosFake || []); 
    setView("editor");
  };

  const criarNovoManual = () => {
    setManualAtivo("Novo Manual Operacional");
    setBlocos([]);
    setView("editor");
  };

  // ============================================================================
  // FUNÇÕES DO CONSTRUTOR (MOTOR DE CUSTOMIZAÇÃO)
  // ============================================================================
  const adicionarBloco = (tipo: TipoBloco) => {
    const novoBloco: Bloco = {
      id: Math.random().toString(36).substr(2, 9),
      tipo,
      conteudo: tipo === "passo-a-passo" ? [""] : "" // Passo a passo é array, outros string
    };
    setBlocos([...blocos, novoBloco]);
  };

  const removerBloco = (id: string) => {
    setBlocos(blocos.filter((b) => b.id !== id));
  };

  // Atualiza o conteúdo do bloco em tempo real (necessário para a imagem)
  const atualizarConteudoBloco = (id: string, novoConteudo: any) => {
    setBlocos(blocos.map(b => b.id === id ? { ...b, conteudo: novoConteudo } : b));
  };

  // ============================================================================
  // RENDERIZAÇÃO DOS BLOCOS (ESTÉTICA DO SEU DOSSIÊ)
  // ============================================================================
  const renderizarBloco = (bloco: Bloco) => {
    switch (bloco.tipo) {
      case "titulo":
        return (
          <div className="group relative bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-4 border-l-4 border-l-blue-600">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bloco: Título de Seção</div>
            <input 
              type="text" 
              defaultValue={typeof bloco.conteudo === 'string' ? bloco.conteudo : ''}
              placeholder="Digite o título da seção..." 
              className="w-full text-2xl font-black text-blue-900 border-none outline-none bg-transparent placeholder:text-slate-300 uppercase tracking-tight"
            />
          </div>
        );
      
      case "texto":
        return (
          <div className="group relative bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bloco: Parágrafo Padrão</div>
            <textarea 
              defaultValue={typeof bloco.conteudo === 'string' ? bloco.conteudo : ''}
              placeholder="Descreva as instruções ou políticas aqui..." 
              className="w-full min-h-[100px] text-[15px] leading-relaxed text-slate-700 border-none outline-none resize-none bg-transparent placeholder:text-slate-300"
            />
          </div>
        );

      case "alerta":
        return (
          <div className="group relative bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm mb-4 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Bloco: Alerta Crítico</div>
            </div>
            <textarea 
              defaultValue={typeof bloco.conteudo === 'string' ? bloco.conteudo : ''}
              placeholder="Atenção: Descreva a restrição ou regra inegociável..." 
              className="w-full text-[15px] font-medium text-red-900 leading-relaxed border-none outline-none resize-none bg-transparent placeholder:text-red-300/70"
            />
          </div>
        );

      case "passo-a-passo":
        return (
          <div className="group relative bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4">
              <ListOrdered className="w-5 h-5 text-blue-600" />
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bloco: Fluxo Operacional (Etapas)</div>
            </div>
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((passo) => (
                <div key={passo} className="flex gap-4 items-start bg-white p-4 rounded-lg border border-slate-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center font-mono text-sm">
                    {passo}
                  </div>
                  <input 
                    type="text" 
                    placeholder={`Descreva a etapa ${passo}...`} 
                    className="w-full mt-1 text-[15px] text-slate-700 border-none outline-none bg-transparent placeholder:text-slate-300"
                  />
                </div>
              ))}
              <button className="text-[12px] font-bold text-blue-600 uppercase tracking-wider mt-2 hover:underline text-left">
                + Adicionar Nova Etapa
              </button>
            </div>
          </div>
        );

      // 🔥 NOVO BLOCO: IMAGEM / PRINT
      case "imagem":
        return (
          <div className="group relative bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm mb-4">
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
                    if (file) {
                      const urlPreview = URL.createObjectURL(file);
                      atualizarConteudoBloco(bloco.id, urlPreview);
                    }
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
  // TELA 1: LISTAGEM DE MANUAIS
  // ============================================================================
  if (view === "list") {
    return (
      <div className="p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50 font-['Inter']">
        {/* Header Premium - Inspirado no seu CSS Original */}
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

        {/* Grid de Manuais Existentes */}
        <div className="mb-6 flex items-center gap-2 border-b-2 border-slate-200 pb-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-xl font-black text-blue-900 uppercase tracking-wide">Documentos Homologados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manuaisSalvos.map((manual) => (
            <div 
              key={manual.id} 
              onClick={() => abrirManual(manual)}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                    manual.tipo === 'Política' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {manual.tipo}
                  </span>
                  <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 leading-snug mb-2">{manual.titulo}</h3>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>Atualizado: {manual.data}</span>
                <span className={`flex items-center gap-1 ${manual.status === 'Ativo' ? 'text-green-600' : 'text-blue-600'}`}>
                  <CheckCircle2 className="w-3 h-3" /> {manual.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TELA 2: EDITOR / CONSTRUTOR DE BLOCOS
  // ============================================================================
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50 font-['Inter'] flex gap-8">
      
      {/* Coluna Esquerda: A Tela de Construção (O Relatório em si) */}
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
            <button className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold uppercase text-[11px] tracking-wider transition-all flex items-center gap-2 shadow-sm">
              Visualizar
            </button>
            <button className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-bold uppercase text-[11px] tracking-wider transition-all flex items-center gap-2 shadow-md">
              <Save className="w-4 h-4" /> Salvar Documento
            </button>
          </div>
        </div>

        {/* Capa do Relatório (Estética Head do Dossiê) */}
        <div className="bg-white rounded-t-2xl border border-slate-200 border-b-0 p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-900 to-blue-500"></div>
          <input 
            type="text" 
            value={manualAtivo}
            onChange={(e) => setManualAtivo(e.target.value)}
            className="w-full text-4xl font-black text-blue-900 uppercase tracking-tighter border-none outline-none bg-transparent placeholder:text-slate-300 mb-4"
          />
          <div className="flex gap-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-500">
            <span>Data Base: <strong className="text-slate-800">24/07/2026</strong></span>
            <span>|</span>
            <span>Autor: <strong className="text-slate-800">Seu Nome</strong></span>
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
              {blocos.map((bloco) => (
                <div key={bloco.id} className="relative group/bloco">
                  {/* Botão de Excluir Bloco (Aparece no Hover) */}
                  <button 
                    onClick={() => removerBloco(bloco.id)}
                    className="absolute -right-3 -top-3 z-10 bg-red-100 text-red-600 p-2 rounded-full shadow-md opacity-0 group-hover/bloco:opacity-100 transition-opacity hover:bg-red-200"
                    title="Remover Bloco"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

            {/* 🔥 NOVO BOTÃO DE COMPONENTE NA SIDEBAR: IMAGEM */}
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