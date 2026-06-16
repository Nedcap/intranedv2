/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

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

export default function FinalizadosPage() {
  const [historico, setHistorico] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);
  
  const [empresaSelecionada, setEmpresaSelecionada] = useState<any>(null);
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [avisoCopia, setAvisoCopia] = useState(false);
  const [conteudoHtmlPreview, setConteudoHtmlPreview] = useState<string | null>(null);

  const [linhaEditando, setLinhaEditando] = useState<string | null>(null);
  const [editDataRec, setEditDataRec] = useState("");
  const [editDataEnvio, setEditDataEnvio] = useState("");

  const [busca, setBusca] = useState(""); // 🎯 Controla o input de busca textual
  const [mesesSel, setMesesSel] = useState<string[]>([]);
  const [cedentesSel, setCedentesSel] = useState<string[]>([]);
  const [termoBuscaCedente, setTermoBuscaCedente] = useState("");
  const [listaMeses, setListaMeses] = useState<string[]>([]);
  const [listaCedentes, setListaCedentes] = useState<string[]>([]);

  const [openMes, setOpenMes] = useState(false);
  const [openCedente, setOpenCedente] = useState(false);

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

  const carregarHistorico = async () => {
    try {
      setCarregando(true);
      
      const userStr = localStorage.getItem("intraned_user");
      let allowedCedentes: string[] = [];
      let isComercial = false;
      let userNome = "";

      if (userStr) {
        const user = JSON.parse(userStr);
        userNome = user.nome;
        const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
        if (cargoUser === "comercial") {
          isComercial = true;
          const { data: vinculos } = await supabase.from("cadastro_cedentes").select("cedente").eq("comercial", user.nome);
          if (vinculos) allowedCedentes = vinculos.map((c: any) => simplificarNome(c.cedente));
        }
      }

      let query = supabase.from("analises").select("*");
      if (isComercial) {
        query = query.eq("comercial", userNome);
      }
      
      const { data } = await query.order("criado_em", { ascending: false });
      
      if (data) {
        let filtrado = data.filter(a => {
          const st = (a.status || "").toLowerCase().trim();
          
          const statusFinaisConfirmados = ["aprovado", "reprovado", "recusado", "rejeitado", "com restritivo", "finalizado"];
          if (statusFinaisConfirmados.some(s => st.includes(s))) {
            return true;
          }

          return st !== "aberta" && !st.includes("comit") && !st.includes("aberto") && st !== "em análise" && st !== "";
        });

        if (isComercial) {
          filtrado = filtrado.filter(a => allowedCedentes.includes(simplificarNome(a.empresa_nome)));
        }

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
            mesesUnicos.add("S/D"); // Garante o fallback mapeado
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
        
        // Inicializa contendo todos os meses (inclusive S/D se houver) para evitar quebras
        setMesesSel(mesesOrdenados);
        setHistorico(historicoMapeado);
        setCedentesSel(Array.from(cedentesUnicos));
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

  const abrirHistoricoChat = async (empresa: any) => {
    setEmpresaSelecionada(empresa);
    const { data } = await supabase.from("chat_comite").select("*").eq("empresa_nome", empresa.empresa_nome).order("id", { ascending: true });
    if (data) setChatMsgs(data);
  };

  const tratarAberturaAnalise = async (caminho: string) => {
    if (!caminho) return alert("Esta análise não possui relatório anexado.");
    const urlLimpa = caminho.trim();
    if (urlLimpa.startsWith("http")) { 
      try {
        const res = await fetch(urlLimpa);
        const htmlText = await res.text();
        setConteudoHtmlPreview(htmlText);
        return;
      } catch {
        window.open(urlLimpa, "_blank");
        return;
      }
    }
    const partes = urlLimpa.split(/[\\/]/);
    const nomeArquivo = partes[partes.length - 1].trim();
    try {
      const { data, error } = await supabase.storage.from("analises").download(nomeArquivo);
      if (error) {
        navigator.clipboard.writeText(urlLimpa); 
        setAvisoCopia(true);
        setTimeout(() => setAvisoCopia(false), 4000);
        return;
      }
      if (data) {
        const htmlText = await data.text();
        setConteudoHtmlPreview(htmlText);
      }
    } catch (err) { console.error(err); }
  };

  const baixarPdfAnalise = async (item: any) => {
    setGerandoPdfId(item.id);
    try {
      const { data: chat } = await supabase.from("chat_comite").select("*").eq("empresa_nome", item.empresa_nome).order("id", { ascending: true });
      
      let chatHtml = `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; width: 100%; max-height: 450px; overflow-y: hidden;">`;
      if (!chat || chat.length === 0) {
        chatHtml += `<p style="color: #94a3b8; font-style: italic; font-size: 14px;">Nenhum voto registrado no comitê.</p>`;
      } else {
        chat.forEach((m: any) => {
          chatHtml += `
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px; border-radius: 4px; color: #0f172a; text-align: left; line-height: 1.4;">
              <strong style="font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">${m.usuario}</strong><br/>
              <span style="font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap;">${m.mensagem}</span>
            </div>
          `;
        });
      }
      chatHtml += `</div>`;

      let analiseHtmlText = "";
      if (item.caminho_local) {
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
      const allElements = doc.body.querySelectorAll("*");
      
      for (const el of Array.from(allElements)) {
        if (el.textContent && el.textContent.trim().toLowerCase() === "histórico do comitê" && el.children.length === 0) {
          let blockParent = el;
          while (blockParent && !['DIV', 'SECTION', 'TD', 'LI'].includes(blockParent.tagName)) {
             if(blockParent.parentElement) blockParent = blockParent.parentElement;
             else break;
          }
          if (blockParent) {
            blockParent.insertAdjacentHTML('beforeend', chatHtml);
          } else {
            el.insertAdjacentHTML('afterend', chatHtml);
          }
          break;
        }
      }

      const printCss = `
        <style>
          @page { size: landscape; margin: 0; }
          @media print {
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
          }
          ::-webkit-scrollbar { display: none; }
        </style>
      `;
      doc.head.insertAdjacentHTML("beforeend", printCss);

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

  const fecharVisualizador = () => setConteudoHtmlPreview(null);
  
  const formatarDataLocal = (dataStr: string) => {
    if (!dataStr) return "-";
    const limpa = dataStr.trim();
    const dt = limpa.length === 10 ? new Date(`${limpa}T12:00:00`) : new Date(limpa);
    return dt.toLocaleDateString("pt-BR");
  };

  // 🎯 Fix: O filtro da tabela agora inclui a barra de busca por texto e ignora travas de dropdown se houver texto digitado
  const historicoFiltrado = historico.filter((item) => {
    const nomeEmpresa = item.empresa_nome || "";
    
    // Se o usuário digitou algo na barra de busca por texto, ele ignora os filtros de caixinha para trazer o dado bruto
    if (busca.trim() !== "") {
      return nomeEmpresa.toLowerCase().includes(busca.toLowerCase());
    }

    const bateMes = mesesSel.length === 0 || mesesSel.includes(item._mesRef);
    const bateCed = cedentesSel.length === 0 || cedentesSel.includes(simplificarNome(nomeEmpresa));
    return bateMes && bateCed;
  });

  const somaDias = historicoFiltrado.reduce((acc, curr) => acc + curr._sla, 0);
  const mediaSLA = historicoFiltrado.length > 0 ? (somaDias / historicoFiltrado.length).toFixed(1) : "0.0";
  const aprovados = historicoFiltrado.filter(i => (i.status || "").toLowerCase().includes("aprovado")).length;
  const recusados = historicoFiltrado.filter(i => ["reprovado", "recusado", "rejeitado"].some(s => (i.status || "").toLowerCase().includes(s))).length;

  const cedentesFiltradosPelaBusca = listaCedentes.filter(ced => ced.toLowerCase().includes(termoBuscaCedente.toLowerCase()));
  const todosFiltradosAtivos = cedentesFiltradosPelaBusca.length > 0 && cedentesFiltradosPelaBusca.every(c => cedentesSel.includes(c));
  const handleToggleTodosFiltrados = () => {
    if (todosFiltradosAtivos) setCedentesSel(cedentesSel.filter(c => !cedentesFiltradosPelaBusca.includes(c)));
    else setCedentesSel(Array.from(new Set([...cedentesSel, ...cedentesFiltradosPelaBusca])));
  };

  if (carregando && historico.length === 0) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Carregando histórico e processando métricas...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-6 text-[13px] font-sans">
      {avisoCopia && <div className="fixed top-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl z-50 font-bold">🗂️ Caminho local copiado!</div>}
      
      {/* SEÇÃO DE FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div ref={refMes} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[11px] tracking-wider mb-1.5">Filtrar por Mês de Recebimento:</label>
          <button onClick={() => setOpenMes(!openMes)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs flex justify-between items-center outline-none">
            <span className="truncate">{mesesSel.length === 0 ? "Todos os Meses (Histórico Geral)" : mesesSel.length === listaMeses.length ? "Todos os Meses Selecionados" : `${mesesSel.length} Meses Selecionados`}</span>
            <span>▼</span>
          </button>
          {openMes && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2 max-h-64 overflow-y-auto">
              <button onClick={() => setMesesSel(mesesSel.length === listaMeses.length ? [] : listaMeses)} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-1 border-b border-slate-100 mb-1">
                {mesesSel.length === listaMeses.length ? "🔲 Desmarcar Todos" : "☑️ Selecionar Todos"}
              </button>
              {listaMeses.map(mes => (
                <label key={mes} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={mesesSel.includes(mes)} onChange={() => setMesesSel(mesesSel.includes(mes) ? mesesSel.filter(m => m !== mes) : [...mesesSel, mes])} className="w-4 h-4 rounded text-blue-600 border-slate-300" />
                  {mes}
                </label>
              ))}
            </div>
          )}
        </div>

        <div ref={refCed} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[11px] tracking-wider mb-1.5">Filtrar por Cedentes:</label>
          <button onClick={() => setOpenCedente(!openCedente)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs flex justify-between items-center outline-none">
            <span className="truncate">{cedentesSel.length === 0 || cedentesSel.length === listaCedentes.length ? "Todos os Cedentes" : `${cedentesSel.length} Selecionados`}</span>
            <span>▼</span>
          </button>
          {openCedente && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 flex flex-col gap-2 max-h-72">
              <input 
                type="text"
                placeholder="🔎 Digite para pesquisar..."
                value={termoBuscaCedente}
                onChange={(e) => setTermoBuscaCedente(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md outline-none text-xs focus:border-blue-500 font-bold bg-slate-50"
              />
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
                <button type="button" onClick={handleToggleTodosFiltrados} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-1 border-b border-slate-100 mb-1 block">
                  {todosFiltradosAtivos ? "🔲 Limpar Resultados" : "☑️ Marcar Resultados"}
                </button>
                {cedentesFiltradosPelaBusca.map(ced => (
                  <label key={ced} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={cedentesSel.includes(ced)} onChange={() => setCedentesSel(cedentesSel.includes(ced) ? cedentesSel.filter(c => c !== ced) : [...cedentesSel, ced])} className="w-4 h-4 rounded text-blue-600 border-slate-300" />
                    {ced}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARDS INDICADORES DE SLA */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-800 text-white p-5 rounded-xl text-center shadow-md">
          <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider">Total de Análises</span>
          <div className="text-3xl font-black mt-1.5">{historicoFiltrado.length}</div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl text-center shadow-xs">
          <span className="text-[11px] font-black text-slate-500 block uppercase tracking-wider">Aprovados</span>
          <div className="text-3xl font-black text-emerald-600 mt-1.5">{aprovados}</div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl text-center shadow-xs">
          <span className="text-[11px] font-black text-slate-500 block uppercase tracking-wider">Recusados / Reprov.</span>
          <div className="text-3xl font-black text-red-500 mt-1.5">{recusados}</div>
        </div>
        <div className="bg-blue-50/60 border border-blue-200 p-5 rounded-xl text-center shadow-xs">
          <span className="text-[11px] font-black text-blue-700 block uppercase tracking-wider">SLA Médio de Retorno</span>
          <div className="text-3xl font-black text-blue-700 mt-1.5">{mediaSLA} {parseFloat(mediaSLA) === 1 ? "dia" : "dias"}</div>
        </div>
      </div>

      {/* INPUT DE BUSCA TEXTUAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 pb-2 pt-2">
        <h2 className="text-sm font-bold text-slate-500 tracking-tight uppercase">📋 Registros Filtrados da Carteira</h2>
        <input 
          type="text" 
          placeholder="🔎 Buscar empresa por digitação direta..." 
          value={busca} 
          onChange={(e) => setBusca(e.target.value)} 
          className="p-1.5 border border-slate-200 rounded text-xs outline-none bg-white focus:border-blue-500 w-72 font-bold shadow-xs" 
        />
      </div>

      {/* TABELA DE HISTORICO */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse text-[13px] min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="p-3">Empresa / Cedente</th>
              <th className="p-3 text-center">Recebimento</th>
              <th className="p-3 text-center">Envio Comitê</th>
              <th className="p-3 text-center bg-blue-50/40 text-blue-600">⏳ SLA Útil</th>
              <th className="p-3 text-center">Resultado</th>
              <th className="p-3 text-center w-64">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {historicoFiltrado.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-8 text-slate-400 font-bold">Nenhum registro encontrado para estes filtros.</td></tr>
            ) : (
              historicoFiltrado.map((item) => {
                const statusStr = (item.status || "").toLowerCase();
                const eAprovado = statusStr.includes("aprovado") || statusStr.includes("finalizado");
                const editando = linhaEditando === item.id;
                const isGerando = gerandoPdfId === item.id;

                return (
                  <tr key={item.id} className={`${editando ? "bg-amber-50/30" : "hover:bg-slate-50/50"} transition-colors`}>
                    <td className="p-3 font-bold text-slate-900 truncate max-w-[200px]" title={item.empresa_nome}>{item.empresa_nome}</td>
                    
                    <td className="p-3 text-center text-slate-500">
                      {editando ? (
                        <input type="date" value={editDataRec} onChange={(e) => setEditDataRec(e.target.value)} className="p-1 border border-slate-300 rounded text-xs outline-none focus:border-blue-500 font-bold" />
                      ) : (
                        formatarDataLocal(item.data_recebimento)
                      )}
                    </td>

                    <td className="p-3 text-center text-slate-500">
                      {editando ? (
                        <input type="date" value={editDataEnvio} onChange={(e) => setEditDataEnvio(e.target.value)} className="p-1 border border-slate-300 rounded text-xs outline-none focus:border-blue-500 font-bold" />
                      ) : (
                        formatarDataLocal(item.criado_em)
                      )}
                    </td>

                    <td className="p-3 text-center font-black text-blue-600 bg-blue-50/20">{item._sla} d</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 text-[10px] font-black rounded border uppercase tracking-wider ${
                        eAprovado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                      }`}>{item.status || "Finalizado"}</span>
                    </td>
                    <td className="p-3 flex gap-1 justify-center flex-wrap">
                      {editando ? (
                        <>
                          <button onClick={() => salvarEdicao(item.id)} disabled={salvandoEdicao} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm text-[10px] transition-colors cursor-pointer disabled:opacity-50">
                            {salvandoEdicao ? "⏳" : "💾 Salvar"}
                          </button>
                          <button onClick={() => setLinhaEditando(null)} disabled={salvandoEdicao} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded border text-[10px] transition-colors cursor-pointer">
                            ❌
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => iniciarEdicao(item)} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded border border-amber-200 text-[10px] transition-colors cursor-pointer" title="Editar Datas">✏️ Editar</button>
                          <button onClick={() => tratarAberturaAnalise(item.caminho_local)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border text-[10px] transition-colors cursor-pointer">📄 Análise</button>
                          <button onClick={() => abrirHistoricoChat(item)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[10px] transition-colors cursor-pointer shadow-xs">💬 Chat</button>
                          <button 
                            onClick={() => baixarPdfAnalise(item)} 
                            disabled={isGerando}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-[10px] transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                          >
                            {isGerando ? "⏳ Extraindo..." : "📥 Dossiê"}
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

      {/* VISUALIZADOR DE APRESENTAÇÃO HTML */}
      {conteudoHtmlPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="w-screen h-screen bg-white flex flex-col overflow-hidden fixed inset-0">
            <div className="flex justify-between items-center bg-slate-800 text-white p-3 shrink-0 shadow-md">
              <h3 className="font-bold text-sm">📄 Visualizador de Apresentações Ned Capital</h3>
              <button onClick={fecharVisualizador} className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-3 py-1 rounded transition-all cursor-pointer">✕ Fechar Tela Cheia</button>
            </div>
            <div className="flex-1 bg-white min-h-0">
              <iframe srcDoc={conteudoHtmlPreview} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" />
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORICO DA ATA / CHAT */}
      {empresaSelecionada && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[70vh]">
            <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 p-3 shrink-0">
              <h3 className="font-bold text-slate-800 text-sm truncate max-w-[320px]">📜 Ata: {empresaSelecionada.empresa_nome}</h3>
              <button onClick={() => setEmpresaSelecionada(null)} className="text-slate-400 hover:text-slate-600 font-bold text-base px-2 cursor-pointer">✕</button>
            </div>
            <div className="flex-1 bg-white p-3 overflow-y-auto text-xs space-y-2 min-h-[180px]">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Registro de Opiniões:</span>
              {chatMsgs.length === 0 ? (
                <p className="text-center text-slate-400 py-6">Nenhum registro encontrado.</p>
              ) : (
                chatMsgs.map(m => (
                  <div key={m.id} className="bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                    <span className="font-bold text-slate-900">{m.usuario}</span>: <span className="text-slate-600 font-medium whitespace-pre-wrap break-words">{m.mensagem}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}