/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { gerarHtmlDossie } from "@/components/gerar-analise";
import JSZip from "jszip";

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================
function calcularDiasUteis(dInicio: Date, dFim: Date) {
  let count = 0;
  const atual = new Date(dInicio.getTime());
  atual.setHours(12, 0, 0, 0);
  const fim = new Date(dFim.getTime());
  fim.setHours(12, 0, 0, 0);
  if (fim < atual) return 0;
  while (atual < fim) {
    atual.setDate(atual.getDate() + 1);
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      count++;
    }
  }
  return count;
}

function parseDataSegura(dataStr: string) {
  if (!dataStr) return null;
  const apenasData = dataStr.trim().split("T")[0];
  return new Date(`${apenasData}T12:00:00`);
}

function simplificarNome(nome: string): string {
  if (!nome) return "";
  let n = nome.trim().toUpperCase();
  n = n.replace(/\b(LTDA|SA|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, "");
  return n.replace(/\s+/g, " ").trim();
}

const obterIdsSubordinados = (usuarios: any[], liderId: string, visitados = new Set<string>()): string[] => {
  if (visitados.has(liderId)) return [];
  visitados.add(liderId);

  let resultado: string[] = [liderId];

  const subDiretos = usuarios.filter(u => {
    const lideres = u.permissoes?.lider_ids || (u.permissoes?.lider_id ? [u.permissoes.lider_id] : []);
    return Array.isArray(lideres) && lideres.includes(liderId);
  });

  subDiretos.forEach(sub => {
    resultado = [...resultado, ...obterIdsSubordinados(usuarios, sub.id, visitados)];
  });

  return Array.from(new Set(resultado));
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function FinalizadosPage() {
  const [historico, setHistorico] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);
  
  const [modoFocoConsulta, setModoFocoComite] = useState(false);
  const [empresaFocoAtivo, setEmpresaFocoAtivo] = useState<any>(null);
  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [htmlPreviewsInline, setHtmlPreviewsInline] = useState<Record<string, string>>({});
  
  const [avisoCopia, setAvisoCopia] = useState(false);

  const [linhaEditando, setLinhaEditando] = useState<string | null>(null);
  const [editDataRec, setEditDataRec] = useState("");
  const [editDataEnvio, setEditDataEnvio] = useState("");

  const [busca, setBusca] = useState(""); 
  const [mesesSel, setMesesSel] = useState<string[]>([]);
  const [termoBuscaCedente, setTermoBuscaCedente] = useState("");
  const [listaMeses, setListaMeses] = useState<string[]>([]);
  const [listaCedentes, setListaCedentes] = useState<string[]>([]);
  const [cedentesSel, setCedentesSel] = useState<string[]>([]);

  const [openMes, setOpenMes] = useState(false);
  const [openCedente, setOpenCedente] = useState(false);

  // 🔥 Estados do Painel de Documentos
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [empresaParaDocs, setEmpresaParaDocs] = useState<any>(null);
  const [isZipping, setIsZipping] = useState(false);

  const refMes = useRef<HTMLDivElement>(null);
  const refCed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function clickFora(e: MouseEvent) {
      if (refMes.current && !refMes.current.contains(e.target as Node)) setOpenMes(false);
      if (refCed.current && !refCed.current.contains(e.target as Node)) setOpenCedente(false);
    }
    document.addEventListener("mousedown", clickFora);
    return () => document.removeEventListener("mousedown", clickFora);
  }, []);

  const carregarVotosIniciais = useCallback(async (empresaNome: string) => {
    if (!empresaNome) return;
    const { data } = await supabase.from("votos").select("*").eq("empresa_nome", empresaNome);
    if (data) {
      setVotosAoVivo(prev => ({ ...prev, [empresaNome]: data }));
    }
  }, []);

  const vincularPreVisualizacao = async (item: any) => {
    if (item.dados_consolidados && Object.keys(item.dados_consolidados).length > 0) {
      const htmlCompilado = await gerarHtmlDossie(item);
      setHtmlPreviewsInline(prev => ({ ...prev, [item.id]: htmlCompilado }));
      return;
    }

    if (!item.caminho_local) return;
    const urlLimpa = item.caminho_local.trim();
    if (urlLimpa.startsWith("http")) { 
      try {
        const res = await fetch(urlLimpa);
        const text = await res.text();
        setHtmlPreviewsInline(prev => ({ ...prev, [item.id]: text }));
      } catch { /* fallback */ }
      return;
    }
    const partes = urlLimpa.split(/[\\/]/);
    const nomeArquivo = partes[partes.length - 1].trim();
    try {
      const { data } = await supabase.storage.from("analises").download(nomeArquivo);
      if (data) {
        const text = await data.text();
        setHtmlPreviewsInline(prev => ({ ...prev, [item.id]: text }));
      }
    } catch (err) { console.error(err); }
  };

  const carregarHistorico = async () => {
    try {
      setCarregando(true);
      const userStr = localStorage.getItem("intraned_user");
      let query = supabase.from("analises").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

        if (cargoUser === "master" || cargoUser === "diretor" || cargoUser.includes("opera") || cargoUser.includes("analist")) {
          // Mantém query.select("*")
        } else {
          const { data: todosUsuarios } = await supabase.from("usuarios").select("id, nome, permissoes");
          
          let nomesPermitidos: string[] = [user.nome];
          
          if (todosUsuarios) {
            const idsPermitidos = obterIdsSubordinados(todosUsuarios, user.id);
            const subordinados = todosUsuarios
              .filter(u => idsPermitidos.includes(u.id))
              .map(u => u.nome);
              
            if (subordinados.length > 0) nomesPermitidos = subordinados;
          }

          const arrayNomesFormatados = nomesPermitidos.map(n => `"${n}"`).join(",");
          query = query.or(`comercial.in.(${arrayNomesFormatados}),responsavel_id.eq.${user.id}`);
        }
      }
      
      const { data } = await query.order("criado_em", { ascending: false });
      
      if (data) {
        const filtrado = data.filter(a => {
          const stAnalise = (a.status || "").toLowerCase().trim();
          const stComite = (a.status_comite || "").toLowerCase().trim();
          const statusFinaisConfirmados = ["aprovado", "reprovado", "recusado", "rejeitado", "com restritivo", "finalizado"];
          return statusFinaisConfirmados.some(s => stAnalise.includes(s) || stComite.includes(s));
        });

        const mesesUnicos = new Set<string>();
        const cedentesUnicos = new Set<string>();

        const historicoMapeado = filtrado.map((item) => {
          let mesRef = "S/D";
          let slaCalculado = 0;
          const dRec = parseDataSegura(item.data_recebimento);
          const dFim = parseDataSegura(item.criado_em);

          if (dRec) {
            mesRef = `${String(dRec.getMonth() + 1).padStart(2, "0")}/${dRec.getFullYear()}`;
            mesesUnicos.add(mesRef);
          } else {
            mesesUnicos.add("S/D");
          }
          if (dRec && dFim) {
            slaCalculado = calcularDiasUteis(dRec, dFim);
          }
          cedentesUnicos.add(simplificarNome(item.empresa_nome));
          return { ...item, _mesRef: mesRef, _sla: slaCalculado };
        });

        const mesesOrdenados = Array.from(mesesUnicos).sort((a, b) => {
          if (a === "S/D") return 1; if (b === "S/D") return -1;
          const [mA, yA] = a.split("/"); const [mB, yB] = b.split("/");
          return (parseInt(yB) * 100 + parseInt(mB)) - (parseInt(yA) * 100 + parseInt(mA));
        });
        
        setListaMeses(mesesOrdenados);
        setListaCedentes(Array.from(cedentesUnicos).sort());
        setMesesSel(mesesOrdenados);
        setHistorico(historicoMapeado);
        setCedentesSel(Array.from(cedentesUnicos));

        historicoMapeado.forEach(item => {
          carregarVotosIniciais(item.empresa_nome);
          vincularPreVisualizacao(item);
        });
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setCarregando(false); 
    }
  };

  useEffect(() => { carregarHistorico(); }, []);

  const iniciarEdicao = (item: any) => {
    setLinhaEditando(item.id);
    const dtRec = item.data_recebimento ? item.data_recebimento.split('T')[0] : "";
    const dtEnv = (item.criado_em || "").split('T')[0];
    setEditDataRec(dtRec);
    setEditDataEnvio(dtEnv);
  };

  const salvarEdicao = async (id: string) => {
    try {
      setSalvandoEdicao(true);
      const payload: any = { 
        data_recebimento: editDataRec ? `${editDataRec}T12:00:00` : null,
        criado_em: editDataEnvio ? `${editDataEnvio}T12:00:00` : null
      };

      const { error } = await supabase.from("analises").update(payload).eq("id", id);
      if (error) throw error;
      setLinhaEditando(null);
      await carregarHistorico();
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao atualizar as datas.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const ativarModoConsultaFoco = async (empresa: any) => {
    setEmpresaFocoAtivo(empresa);
    setModoFocoComite(true);
    const { data } = await supabase.from("chat_comite").select("*").eq("empresa_nome", empresa.empresa_nome).order("id", { ascending: true });
    if (data) setChatMsgs(data);
  };

  const desativarModoConsultaFoco = () => {
    setModoFocoComite(false);
    setEmpresaFocoAtivo(null);
    setChatMsgs([]);
  };

  // 🔥 NOVA FUNÇÃO DE IMPRESSÃO (PÁGINA DE ROSTO + QUEBRA DE PÁGINA)
  const baixarPdfAnalise = async (item: any) => {
    setGerandoPdfId(item.id);
    try {
      // 1. Busca os dados reais de Votos e Chat (garantindo que estão atualizados)
      const { data: chat } = await supabase.from("chat_comite").select("*").eq("empresa_nome", item.empresa_nome).order("id", { ascending: true });
      const { data: votos } = await supabase.from("votos").select("*").eq("empresa_nome", item.empresa_nome);
      
      let analiseHtmlText = "";
      
      // 2. Extrai o HTML da análise
      if (item.dados_consolidados && Object.keys(item.dados_consolidados).length > 0) {
        analiseHtmlText = await gerarHtmlDossie(item);
      } else if (item.caminho_local) {
        const urlLimpa = item.caminho_local.trim();
        if (urlLimpa.startsWith("http")) {
          try {
            const res = await fetch(urlLimpa);
            analiseHtmlText = await res.text();
          } catch { /* Fallback */ }
        } else {
          const partes = urlLimpa.split(/[\\/]/);
          const nomeArquivo = partes[partes.length - 1].trim();
          const { data } = await supabase.storage.from("analises").download(nomeArquivo);
          if (data) analiseHtmlText = await data.text();
        }
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(analiseHtmlText, "text/html");

      // 3. Constrói o visual dos Votos no padrão estético da ferramenta
      let votosHtml = '';
      if (!votos || votos.length === 0) {
         votosHtml = `<div class="card" style="grid-column: span 2; text-align: center; color: var(--muted); font-style: italic; font-weight: 500;">Nenhum voto registrado no comitê para esta análise.</div>`;
      } else {
         votosHtml = votos.map((v: any) => {
           const isAprovado = (v.voto || "").toLowerCase().includes("aprov");
           const color = isAprovado ? "var(--green)" : "var(--red)";
           const bg = isAprovado ? "#f0fdf4" : "#fef2f2";
           const border = isAprovado ? "#86efac" : "#fca5a5";
           
           return `
             <div class="card" style="border-left: 6px solid ${color}; background: #fff;">
               <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                 <strong style="font-size: 1.1rem; color: var(--text);">${v.membro_nome}</strong>
                 <span style="background: ${bg}; color: ${color}; border: 1px solid ${border}; padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 900; text-transform: uppercase;">${v.voto}</span>
               </div>
               <div style="font-size: 0.95rem; color: var(--muted); line-height: 1.6; font-style: italic;">"${v.justificativa}"</div>
             </div>
           `;
         }).join("");
      }

      // 4. Constrói o visual das Atas e Chat
      let chatHtml = '';
      if (!chat || chat.length === 0) {
        chatHtml = `<p style="color: var(--muted); font-style: italic; font-size: 0.95rem; text-align: center; padding: 1rem;">Nenhuma discussão ou ata registrada.</p>`;
      } else {
        chatHtml = chat.map((m: any) => `
          <div style="background: #f8fafc; border-left: 4px solid var(--blue); padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);">
            <strong style="font-size: 0.85rem; color: var(--blue-dark); text-transform: uppercase; letter-spacing: 0.5px;">${m.usuario}</strong>
            <div style="font-size: 0.95rem; color: var(--text); margin-top: 6px; white-space: pre-wrap; line-height: 1.6;">${m.mensagem}</div>
          </div>
        `).join("");
      }

      const dataEmissao = new Date().toLocaleDateString('pt-BR');
      const statusAnalise = item.status || item.status_comite || 'FINALIZADO';
      
      // 5. Monta a Estrutura da Página de Rosto (Capa)
      const coverPageHtml = `
        <div class="cover-page" style="page-break-after: always; margin-bottom: 4rem; display: flex; flex-direction: column;">
          
          <div class="header" style="background: linear-gradient(135deg, var(--text), var(--blue-dark)); border: none !important; margin-bottom: 3rem;">
            <div style="flex-grow: 1;">
              <h1 style="font-size: 2.2rem; margin-bottom: 0.5rem; color: #fff;">DELIBERAÇÃO OFICIAL DO COMITÊ</h1>
              <div class="meta" style="font-size: 1.2rem; color: rgba(255,255,255,0.9); text-transform: uppercase; font-weight: 700;">${item.empresa_nome}</div>
            </div>
            <div style="text-align: right; min-width: 250px;">
              <div class="badge-top" style="background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); color: #fff; margin-bottom: 12px;">
                 Status: ${statusAnalise}
              </div>
              <div class="meta" style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">Impresso em: ${dataEmissao}</div>
            </div>
          </div>

          <h2 style="margin-top: 0;">📋 Votos Registrados (Súmula)</h2>
          <div class="grid-2" style="margin-bottom: 3rem;">
            ${votosHtml}
          </div>

          <h2>💬 Fórum de Discussões & Alinhamentos Finais</h2>
          <div class="card" style="padding: 1.5rem; border: 1px solid var(--border); background: #fff;">
            ${chatHtml}
          </div>

        </div>
      `;

      // 6. Injeta a capa logo no começo do container principal do Dossie
      const container = doc.querySelector(".container");
      if (container) {
        container.insertAdjacentHTML('afterbegin', coverPageHtml);
      }

      // 7. Garante a quebra de página (A capa vai terminar e forçar o dossiê pra folha 2)
      const printCss = `
        <style>
          @media print {
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            .cover-page { 
              page-break-after: always !important; 
            }
            /* Esconder links nas impressões (opcional para estética limpa) */
            a[href]:after { content: none !important; }
          }
        </style>
      `;
      doc.head.insertAdjacentHTML("beforeend", printCss);

      // 8. Gera e abre a impressão
      const blob = new Blob([doc.documentElement.outerHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");

      if (!printWindow) {
        alert("⚠️ O navegador bloqueou a aba de impressão. Permita pop-ups.");
        setGerandoPdfId(null);
        return;
      }

      printWindow.onload = () => {
        setTimeout(() => { printWindow.print(); }, 1000);
      };

    } catch (err) {
      console.error(err);
      alert("❌ Erro ao organizar o Dossiê Executivo.");
    } finally {
      setGerandoPdfId(null);
    }
  };

  const formatarDataLocal = (dataStr: string) => {
    if (!dataStr) return "-";
    const limpa = dataStr.trim();
    const dt = limpa.length === 10 ? new Date(`${limpa}T12:00:00`) : new Date(limpa);
    return dt.toLocaleDateString("pt-BR");
  };

  const historicoFiltrado = historico.filter((item) => {
    const nomeEmpresa = item.empresa_nome || "";
    if (busca.trim() !== "") {
      return nomeEmpresa.toLowerCase().includes(busca.toLowerCase());
    }
    const bateMes = mesesSel.length === 0 || mesesSel.includes(item._mesRef);
    const bateCed = cedentesSel.length === 0 || cedentesSel.includes(simplificarNome(nomeEmpresa));
    return bateMes && bateCed;
  });

  const somaDias = historicoFiltrado.reduce((acc, curr) => acc + curr._sla, 0);
  const mediaSLA = historicoFiltrado.length > 0 ? (somaDias / historicoFiltrado.length).toFixed(1) : "0.0";
  const aprovados = historicoFiltrado.filter(i => (i.status || "").toLowerCase().includes("aprovado") || (i.status_comite || "").toLowerCase().includes("aprovado")).length;
  const recusados = historicoFiltrado.filter(i => ["reprovado", "recusado", "rejeitado"].some(s => (i.status || "").toLowerCase().includes(s) || (i.status_comite || "").toLowerCase().includes(s))).length;

  const cedentesFiltradosPelaBusca = listaCedentes.filter(ced => ced.toLowerCase().includes(termoBuscaCedente.toLowerCase()));
  const todosFiltradosAtivos = cedentesFiltradosPelaBusca.length > 0 && cedentesFiltradosPelaBusca.every(c => cedentesSel.includes(c));
  const handleToggleTodosFiltrados = () => {
    if (todosFiltradosAtivos) setCedentesSel(cedentesSel.filter(c => !cedentesFiltradosPelaBusca.includes(c)));
    else setCedentesSel(Array.from(new Set([...cedentesSel, ...cedentesFiltradosPelaBusca])));
  };

  function modoConsultaFocoAtivarModo(item: any) {
    ativarModoConsultaFoco(item);
  }

  const abrirPainelDocumentos = (item: any) => {
    setEmpresaParaDocs(item);
    setIsDocsModalOpen(true);
  };

  const baixarTudoZip = async () => {
    if (!empresaParaDocs?.dados_documentos || empresaParaDocs.dados_documentos.length === 0) return;
    
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const nomePasta = empresaParaDocs.empresa_nome.replace(/[^a-zA-Z0-9]/g, "_"); 
      const folder = zip.folder(nomePasta);

      if (!folder) throw new Error("Erro ao criar diretório ZIP.");

      const fetchPromises = empresaParaDocs.dados_documentos.map(async (url: string, i: number) => {
        const res = await fetch(url);
        const blob = await res.blob();
        
        let fileName = `Anexo_${i+1}`;
        try {
          const urlPartes = url.split(/[?#]/)[0].split('/');
          fileName = decodeURIComponent(urlPartes[urlPartes.length - 1]);
        } catch (e) {
          const isPdf = url.toLowerCase().includes('.pdf');
          fileName = `Anexo_${i+1}${isPdf ? ".pdf" : ".jpg"}`;
        }
        
        folder.file(fileName, blob);
      });

      await Promise.all(fetchPromises);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Docs_${nomePasta}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      console.error("Erro ao gerar ZIP:", err);
      alert("⚠️ Erro ao empacotar arquivos. Se persistir, o navegador pode estar bloqueando múltiplos downloads (CORS).");
    } finally {
      setIsZipping(false);
    }
  };

  // 🔮 INTERFACE 1: MODO CONSULTA EXECUTIVO TELA CHEIA ATIVO (LIGHT MODE)
  if (modoFocoConsulta && empresaFocoAtivo) {
    const listaDeVotos = votosAoVivo[empresaFocoAtivo.empresa_nome] || [];
    const htmlPreview = htmlPreviewsInline[empresaFocoAtivo.id];
    const isGerando = gerandoPdfId === empresaFocoAtivo.id;
    const isStatusPositivo = (empresaFocoAtivo.status || "").toLowerCase().includes("aprovado") || (empresaFocoAtivo.status_comite || "").toLowerCase().includes("aprovado");

    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px] animate-in fade-in duration-200">
        {/* CABEÇALHO */}
        <div className="bg-white text-slate-800 p-4 px-6 flex justify-between items-center shadow-sm border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Consulta de Dossiê Arquivado</span>
              <div className="flex items-center gap-2">
                 <h2 className="text-base font-black uppercase text-slate-800 tracking-wide">{empresaFocoAtivo.empresa_nome}</h2>
                 <span className={`ml-2 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isStatusPositivo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                 }`}>
                    {empresaFocoAtivo.status || "Finalizado"}
                 </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => baixarPdfAnalise(empresaFocoAtivo)} 
              disabled={isGerando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs tracking-wide rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 uppercase"
            >
              {isGerando ? "⏳ Extraindo HTML..." : "🖨️ Imprimir Dossiê"}
            </button>
            <button 
              onClick={desativarModoConsultaFoco} 
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer uppercase tracking-wide"
            >
              ✕ Fechar Tela
            </button>
          </div>
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden w-full bg-slate-50/50">
          <div className="w-[70%] h-full p-5 flex flex-col">
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex flex-col">
              {htmlPreview ? (
                <iframe srcDoc={htmlPreview} className="w-full h-full border-0 bg-white" sandbox="allow-scripts allow-same-origin" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 italic text-xs gap-3 font-mono">
                  <span className="animate-spin text-2xl">⏳</span>
                  Renderizando HTML estruturado...
                </div>
              )}
            </div>
          </div>

          <div className="w-[30%] h-full py-5 pr-5 flex flex-col space-y-5">
            
            {/* PAINEL DE VOTOS REGISTRADOS */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden text-left relative">
              <span className="text-[12px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-3 flex items-center gap-2">
                📋 Votos Registrados
              </span>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {listaDeVotos.length === 0 ? (
                  <p className="text-slate-400 italic text-xs py-10 text-center font-medium">Nenhum voto lançado em comitê para esta análise.</p>
                ) : (
                  listaDeVotos.map((v: any, idx: number) => {
                    const isVotoPositivo = (v.voto || "").toLowerCase().includes("aprov");
                    return (
                      <div key={idx} className="p-3.5 border border-slate-100 rounded-xl bg-slate-50 flex flex-col gap-2 shadow-sm transition-colors hover:border-slate-200">
                        <div className="flex justify-between items-start font-bold">
                          <span className="text-slate-800 text-xs tracking-wide">{v.membro_nome}</span>
                          <span className={`px-2.5 py-1 rounded-md text-[9px] uppercase font-black tracking-wider border ${
                            isVotoPositivo ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"
                          }`}>
                            {v.voto}
                          </span>
                        </div>
                        <span className="text-slate-600 font-medium text-xs leading-relaxed italic">"{v.justificativa}"</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PAINEL DE ATAS E CHAT */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden text-left relative">
              <span className="text-[12px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-3 flex items-center gap-2">
                💬 Atas e Alinhamentos Finais
              </span>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {chatMsgs.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-xs italic font-medium">Nenhuma discussão registada.</p>
                ) : (
                  chatMsgs.map((m: any) => (
                    <div key={m.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 hover:border-slate-300 transition-colors">
                      <span className="font-black text-[10px] text-slate-400 uppercase tracking-wider">{m.usuario}</span>
                      <span className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap break-words">{m.mensagem}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}} />
      </div>
    );
  }

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse text-xs uppercase tracking-widest">A varrer arquivo histórico do comitê...</div>;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-800">
      <div className="hidden">{avisoCopia && "Copiado!"}</div>
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Arquivo do Comitê</h2>
          </div>
          <span className="text-sm text-slate-500 font-medium ml-12">Consulte relatórios antigos, votos e prazos de SLA das análises já encerradas.</span>
        </div>
      </div>
      
      {/* FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div ref={refMes} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Mês de Recebimento:</label>
          <button onClick={() => setOpenMes(!openMes)} className="w-full text-left p-3 border border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors shadow-sm">
            <span className="truncate">{mesesSel.length === 0 ? "Todos os Meses (Histórico Geral)" : mesesSel.length === listaMeses.length ? "Todos os Meses Selecionados" : `${mesesSel.length} Meses Selecionados`}</span>
            <span className="text-slate-400">▼</span>
          </button>
          {openMes && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-2 max-h-64 overflow-y-auto">
              <button onClick={() => setMesesSel(mesesSel.length === listaMeses.length ? [] : listaMeses)} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-2.5 border-b border-slate-100 mb-1.5 hover:text-blue-800 transition-colors">
                {mesesSel.length === listaMeses.length ? "🔲 Desmarcar Todos" : "☑️ Selecionar Todos"}
              </button>
              {listaMeses.map(mes => (
                <label key={mes} className="flex items-center gap-3 font-bold text-slate-700 text-xs cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                  <input type="checkbox" checked={mesesSel.includes(mes)} onChange={() => setMesesSel(mesesSel.includes(mes) ? mesesSel.filter(m => m !== mes) : [...mesesSel, mes])} className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                  {mes}
                </label>
              ))}
            </div>
          )}
        </div>

        <div ref={refCed} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Filtrar por Cedentes:</label>
          <button onClick={() => setOpenCedente(!openCedente)} className="w-full text-left p-3 border border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors shadow-sm">
            <span className="truncate">{cedentesSel.length === 0 || cedentesSel.length === listaCedentes.length ? "Todos os Cedentes" : `${cedentesSel.length} Selecionados`}</span>
            <span className="text-slate-400">▼</span>
          </button>
          {openCedente && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-4 flex flex-col gap-3 max-h-72">
              <input 
                type="text"
                placeholder="🔎 Digite para pesquisar..."
                value={termoBuscaCedente}
                onChange={(e) => setTermoBuscaCedente(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-none text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold bg-slate-50 shadow-inner"
              />
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar">
                <button type="button" onClick={handleToggleTodosFiltrados} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-2.5 border-b border-slate-100 mb-1.5 block hover:text-blue-800 transition-colors">
                  {todosFiltradosAtivos ? "🔲 Limpar Resultados" : "☑️ Marcar Resultados"}
                </button>
                {cedentesFiltradosPelaBusca.map(ced => (
                  <label key={ced} className="flex items-center gap-3 font-bold text-slate-700 text-xs cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                    <input type="checkbox" checked={cedentesSel.includes(ced)} onChange={() => setCedentesSel(cedentesSel.includes(ced) ? cedentesSel.filter(c => c !== ced) : [...cedentesSel, ced])} className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                    {ced}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 text-white p-6 rounded-2xl text-left shadow-md transition-transform hover:-translate-y-1 relative overflow-hidden">
          <svg className="absolute -bottom-4 -right-4 w-24 h-24 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider relative z-10">Total de Análises</span>
          <div className="text-4xl font-black mt-2 relative z-10">{historicoFiltrado.length}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-left shadow-sm transition-transform hover:-translate-y-1">
          <span className="text-[11px] font-black text-emerald-600 block uppercase tracking-wider flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Aprovados</span>
          <div className="text-4xl font-black text-slate-800 mt-2">{aprovados}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-left shadow-sm transition-transform hover:-translate-y-1">
          <span className="text-[11px] font-black text-rose-600 block uppercase tracking-wider flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Recusados / Reprov.</span>
          <div className="text-4xl font-black text-slate-800 mt-2">{recusados}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl text-left shadow-sm transition-transform hover:-translate-y-1">
          <span className="text-[11px] font-black text-blue-600 block uppercase tracking-wider flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> SLA Médio</span>
          <div className="flex items-baseline gap-1.5 mt-2 text-slate-800">
            <span className="text-4xl font-black">{mediaSLA}</span>
            <span className="text-sm font-bold text-slate-500">{parseFloat(mediaSLA) === 1 ? "dia" : "dias"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-3 pt-4">
        <h2 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">📋</div>
          Registros Filtrados da Carteira
        </h2>
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔎</span>
          <input 
            type="text" 
            placeholder="Buscar empresa diretamente..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-xs text-slate-700 shadow-sm"
          />
        </div>
      </div>

      {/* TABELA DE RESULTADOS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mt-2">
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse text-[13px] min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-widest h-14 text-slate-500">
                <th className="p-4 pl-6 w-72">Empresa / Cedente</th>
                <th className="p-4 text-center w-36">Recebimento</th>
                <th className="p-4 text-center w-36">Envio Comitê</th>
                <th className="p-4 text-center w-32 bg-blue-50/50 text-blue-700 border-l border-r border-blue-100/50">⏳ SLA Útil</th>
                <th className="p-4 text-center w-36">Resultado</th>
                <th className="p-4 text-center w-56">Ações Executivas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-10 text-slate-400 font-bold italic">
                    Nenhum registro histórico atende aos filtros atuais para você.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((item) => {
                  const statusStr = (item.status || "").toLowerCase();
                  const eAprovado = statusStr.includes("aprovado") || statusStr.includes("finalizado");
                  const editando = linhaEditando === item.id;
                  const isGerando = gerandoPdfId === item.id;

                  return (
                    <tr key={item.id} className={`${editando ? "bg-amber-50/30" : "hover:bg-slate-50/70"} transition-colors`}>
                      <td className="p-4 pl-6 font-extrabold text-slate-900 truncate max-w-[280px] uppercase tracking-tight" title={item.empresa_nome}>
                        {item.empresa_nome}
                      </td>
                      
                      <td className="p-4 text-center text-slate-500">
                        {editando ? (
                          <input type="date" value={editDataRec} onChange={(e) => setEditDataRec(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-bold bg-white uppercase shadow-sm" />
                        ) : (
                          formatarDataLocal(item.data_recebimento)
                        )}
                      </td>

                      <td className="p-4 text-center text-slate-500">
                        {editando ? (
                          <input type="date" value={editDataEnvio} onChange={(e) => setEditDataEnvio(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 font-bold bg-white uppercase shadow-sm" />
                        ) : (
                          formatarDataLocal(item.criated_em || item.criado_em)
                        )}
                      </td>

                      <td className="p-4 text-center font-black font-mono text-blue-700 bg-blue-50/20 border-l border-r border-blue-100/50">
                        {item._sla} d
                      </td>
                      
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black rounded-md uppercase tracking-wider shadow-xs ${
                          eAprovado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {item.status || "Finalizado"}
                        </span>
                      </td>
                      
                      <td className="p-4 flex gap-2 justify-center">
                        {editando ? (
                          <>
                            <button onClick={() => salvarEdicao(item.id)} disabled={salvandoEdicao} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50">
                              {salvandoEdicao ? "⏳" : "💾 Salvar"}
                            </button>
                            <button onClick={() => setLinhaEditando(null)} disabled={salvandoEdicao} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            {/* 🔥 BOTÃO DOCS */}
                            <button 
                              onClick={() => {
                                setEmpresaParaDocs(item);
                                setIsDocsModalOpen(true);
                              }} 
                              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-sm" 
                              title="Visualizar documentos"
                            >
                              📂 Docs
                            </button>
                            <button 
                              onClick={() => iniciarEdicao(item)} 
                              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-sm" 
                              title="Corrigir datas de entrada e saída manualmente"
                            >
                              ✏️ Datas
                            </button>
                            <button 
                              onClick={() => modoConsultaFocoAtivarModo(item)} 
                              className="px-3 py-2 bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-1.5"
                            >
                              <span className="text-sm leading-none">🏛️</span> Analisar
                            </button>
                            <button 
                              onClick={() => baixarPdfAnalise(item)} 
                              disabled={isGerando}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isGerando ? "⏳..." : "📥 Dossiê"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 🔥 MODAL DE DOCUMENTOS E CHECKLIST */}
      {isDocsModalOpen && empresaParaDocs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">📂 Base de Documentos Injetados</h2>
                <p className="text-xs text-slate-500 font-medium font-mono mt-1">
                  {empresaParaDocs.empresa_nome} {empresaParaDocs.cnpj && `— ${empresaParaDocs.cnpj}`}
                </p>
              </div>
              <button 
                onClick={() => setIsDocsModalOpen(false)} 
                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6 bg-slate-50/50">
              
              <div className="space-y-3">
                <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Leitura do Robô / Checklist Mapeado
                </h3>
                
                {empresaParaDocs.checklist_ia && Object.keys(empresaParaDocs.checklist_ia).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                     {Object.entries(empresaParaDocs.checklist_ia).map(([chave, valor]) => (
                       <div key={chave} className={`p-3 rounded-xl border flex items-center justify-between shadow-sm ${valor ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                         <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{chave.replace(/_/g, ' ')}</span>
                         <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${valor ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                           {valor ? "✔️ LIDO" : "❌ PENDENTE"}
                         </span>
                       </div>
                     ))}
                  </div>
                ) : (
                  <div className="p-5 bg-white border border-indigo-100 rounded-xl shadow-sm">
                    <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                      💡 <strong>Estrutura de Validação Pronta:</strong> Os documentos lidos pelo robô aparecerão listados automaticamente aqui. Nenhuma tag `checklist_ia` encontrada para esta análise.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 border-dashed pt-4"></div>

              <div className="space-y-3">
                
                <div className="flex justify-between items-center">
                  <h3 className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Arquivos Brutos (Cloudflare R2) - {empresaParaDocs.dados_documentos?.length || 0} anexo(s)
                  </h3>
                  
                  {empresaParaDocs.dados_documentos && empresaParaDocs.dados_documentos.length > 0 && (
                    <button 
                      onClick={baixarTudoZip}
                      disabled={isZipping}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isZipping ? "⏳ Empacotando..." : "📦 Baixar Todos (.ZIP)"}
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {empresaParaDocs.dados_documentos && empresaParaDocs.dados_documentos.length > 0 ? (
                    empresaParaDocs.dados_documentos.map((url: string, i: number) => {
                      const isPdf = url.toLowerCase().includes('.pdf');
                      
                      let nomeRealArquivo = `Anexo_${i+1}`;
                      try {
                        const urlPartes = url.split(/[?#]/)[0].split('/'); 
                        let ultimoTrecho = urlPartes[urlPartes.length - 1];
                        nomeRealArquivo = decodeURIComponent(ultimoTrecho); 
                      } catch (e) {
                        nomeRealArquivo = `Anexo_Injetado_${i+1}${isPdf ? ".pdf" : ".jpg"}`;
                      }

                      return (
                        <a 
                          key={i} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-3.5 border border-slate-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group"
                          title={nomeRealArquivo}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="text-xl shrink-0">{isPdf ? "📄" : "🖼️"}</span>
                            <span className="text-xs font-bold text-slate-600 truncate group-hover:text-blue-700 transition-colors">
                              {nomeRealArquivo}
                            </span>
                          </div>
                          <span className="text-[9px] bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-md text-slate-500 font-black uppercase tracking-wider group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors shrink-0">
                            Abrir ↗
                          </span>
                        </a>
                      )
                    })
                  ) : (
                    <div className="col-span-2 p-6 bg-slate-100 rounded-xl border border-slate-200 border-dashed text-center">
                      <p className="text-xs text-slate-400 italic font-bold">Nenhum arquivo físico de leitura atrelado a este envio.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}