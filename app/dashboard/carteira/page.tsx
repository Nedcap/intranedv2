/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧱 INTERFACES DE DADOS
// ============================================================================
interface Titulo {
  cedente: string;
  sacado: string;
  numeroTitulo?: string;
  vencimento: string;
  valorFace: number;
  valorAberto: number;
  status: "Vencido" | "A Vencer";
  origem: "SEC" | "FIDC";
  diasParaVencer: number; 
}

interface AgregacaoEmpresa {
  valorFace: number;
  valorAberto: number;
  vencido: number;
  aVencer: number;
  titulos: Titulo[];
}

interface AgregacaoCedente {
  nome: string;
  sec: AgregacaoEmpresa;
  fidc: AgregacaoEmpresa;
  totalFace: number;
  totalAberto: number;
  totalVencido: number;
  totalAVencer: number;
}

export default function CarteiraDinamicaPage() {
  const [titulosOriginais, setTitulosOriginais] = useState<Titulo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // 🎛️ ESTADO DO SIMULADOR DE DIAS (CARD DINÂMICO)
  const [diasProjecao, setDiasProjecao] = useState<number>(30);

  // 📊 ESTADOS DE ORDENAÇÃO DA TABELA MASTER
  const [ordenacaoMaster, setOrdenacaoMaster] = useState<string>("totalAberto"); 
  const [direcaoMaster, setDirecaoMaster] = useState<"asc" | "desc">("desc");

  // Estados de Expansão de Linhas
  const [cedentesExpandidos, setCedentesExpandidos] = useState<Record<string, boolean>>({});
  const [subExpandidos, setSubExpandidos] = useState<Record<string, boolean>>({}); 

  // Estados dos Filtros das Sub-tabelas
  const [filtroSacado, setFiltroSacado] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [ordenacaoColunaSub, setOrdenacaoColunaSub] = useState("vencimento"); 
  const [ordenacaoDirecaoSub, setOrdenacaoDirecaoSub] = useState<"asc" | "desc">("asc");

  // 📥 BUSCA DADOS UTILIZANDO O SUPABASE V2 COM SEGURANÇA RLS
  const carregarDadosCarteira = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [resSec, resFidc] = await Promise.all([
        supabase.from("carteira_sec").select("*"),
        supabase.from("carteira_fidc").select("*")
      ]);

      if (resSec.error) throw new Error(resSec.error.message);
      if (resFidc.error) throw new Error(resFidc.error.message);

      const listaTitulos: Titulo[] = [];
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      resSec.data?.forEach(row => {
        if (!row.vencimento) return;
        const dtVenc = new Date(`${row.vencimento}T12:00:00`);
        const diffDias = Math.floor((dtVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const dtFormatada = `${String(dtVenc.getDate()).padStart(2, '0')}/${String(dtVenc.getMonth() + 1).padStart(2, '0')}/${dtVenc.getFullYear()}`;

        listaTitulos.push({
          cedente: row.cedente.toUpperCase(),
          sacado: row.sacado.toUpperCase(),
          numeroTitulo: row.numero_titulo || "-",
          vencimento: dtFormatada,
          valorFace: Number(row.valor_face || 0),
          valorAberto: Number(row.valor_aberto || 0),
          status: row.status as "Vencido" | "A Vencer",
          origem: "SEC",
          diasParaVencer: diffDias
        });
      });

      resFidc.data?.forEach(row => {
        if (!row.vencimento) return;
        const dtVenc = new Date(`${row.vencimento}T12:00:00`);
        const diffDias = Math.floor((dtVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const dtFormatada = `${String(dtVenc.getDate()).padStart(2, '0')}/${String(dtVenc.getMonth() + 1).padStart(2, '0')}/${dtVenc.getFullYear()}`;

        listaTitulos.push({
          cedente: row.cedente.toUpperCase(),
          sacado: row.sacado.toUpperCase(),
          numeroTitulo: row.numero_titulo || "-",
          vencimento: dtFormatada,
          valorFace: Number(row.valor_face || 0),
          valorAberto: Number(row.valor_aberto || 0),
          status: row.status as "Vencido" | "A Vencer",
          origem: "FIDC",
          diasParaVencer: diffDias
        });
      });

      setTitulosOriginais(listaTitulos);
    } catch (err: any) {
      setErro(err.message || "Erro desconhecido.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDadosCarteira(); }, []);

  const kpisGlobais = useMemo(() => {
    let totalVencido = 0;
    let totalProjetadoAVencer = 0;

    titulosOriginais.forEach((t) => {
      if (t.status === "Vencido") {
        totalVencido += t.valorAberto;
      } else if (t.status === "A Vencer" && t.diasParaVencer <= diasProjecao && t.diasParaVencer >= 0) {
        totalProjetadoAVencer += t.valorAberto;
      }
    });

    return { totalVencido, totalProjetadoAVencer };
  }, [titulosOriginais, diasProjecao]);

  const carteiraAgregada = useMemo(() => {
    const agrupamento: Record<string, AgregacaoCedente> = {};

    titulosOriginais.forEach((titulo) => {
      const c = titulo.cedente;
      if (!agrupamento[c]) {
        agrupamento[c] = {
          nome: c,
          sec: { valorFace: 0, valorAberto: 0, vencido: 0, aVencer: 0, titulos: [] },
          fidc: { valorFace: 0, valorAberto: 0, vencido: 0, aVencer: 0, titulos: [] },
          totalFace: 0, totalAberto: 0, totalVencido: 0, totalAVencer: 0
        };
      }

      const emp = titulo.origem === "SEC" ? agrupamento[c].sec : agrupamento[c].fidc;
      
      emp.valorFace += titulo.valorFace;
      emp.valorAberto += titulo.valorAberto;
      
      if (titulo.status === "Vencido") emp.vencido += titulo.valorAberto;
      else emp.aVencer += titulo.valorAberto;
      emp.titulos.push(titulo);

      agrupamento[c].totalFace += titulo.valorFace;
      agrupamento[c].totalAberto += titulo.valorAberto;
      
      if (titulo.status === "Vencido") {
        agrupamento[c].totalVencido += titulo.valorAberto;
      } else {
        agrupamento[c].totalAVencer += titulo.valorAberto;
      }
    });

    return Object.values(agrupamento).sort((a: any, b: any) => {
      const valA = a[ordenacaoMaster] || 0;
      const valB = b[ordenacaoMaster] || 0;

      if (ordenacaoMaster === "nome") {
        return direcaoMaster === "asc" ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      }

      return direcaoMaster === "asc" ? valA - valB : valB - valA;
    });
  }, [titulosOriginais, ordenacaoMaster, direcaoMaster]);

  const lidarOrdenacaoMaster = (coluna: string) => {
    const tableKeys: Record<string, string> = {
      cedente: "nome",
      face: "totalFace",
      aberto: "totalAberto",
      vencido: "totalVencido",
      avencer: "totalAVencer"
    };
    const chave = tableKeys[coluna] || "nome";
    if (ordenacaoMaster === chave) {
      setDirecaoMaster(p => p === "asc" ? "desc" : "asc");
    } else {
      setOrdenacaoMaster(chave);
      setDirecaoMaster("desc");
    }
  };

  const renderSetaOrdenacao = (colName: string) => {
    const tableKeys: Record<string, string> = {
      cedente: "nome",
      face: "totalFace",
      aberto: "totalAberto",
      vencido: "totalVencido",
      avencer: "totalAVencer"
    };
    if (ordenacaoMaster !== tableKeys[colName]) return " ↕️";
    return direcaoMaster === "asc" ? " 🔼" : " 🔽";
  };

  const filtrarEOrdenarTitulos = (titulos: Titulo[]) => {
    return titulos
      .filter(t => {
        const matchSacado = t.sacado.includes(filtroSacado.toUpperCase().trim());
        const matchStatus = filtroStatus === "" ? true : t.status === filtroStatus;
        return matchSacado && matchStatus;
      })
      .sort((a, b) => {
        let valA = a[ordenacaoColunaSub as keyof Titulo] || 0;
        let valB = b[ordenacaoColunaSub as keyof Titulo] || 0;

        if (ordenacaoColunaSub === "vencimento") {
          const parseData = (dStr: string) => {
            const p = String(dStr).split("/");
            if (p.length !== 3) return 0;
            return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime();
          };
          valA = parseData(a.vencimento);
          valB = parseData(b.vencimento);
        }

        if (valA < valB) return ordenacaoDirecaoSub === "asc" ? -1 : 1;
        if (valA > valB) return ordenacaoDirecaoSub === "asc" ? 1 : -1;
        return 0;
      });
  };

  const toggleCedente = (nome: string) => {
    setCedentesExpandidos(p => ({ ...p, [nome]: !p[nome] }));
  };

  const toggleSub = (chave: string) => {
    setSubExpandidos(p => ({ ...p, [chave]: !p[chave] }));
  };

  const formatarMoeda = (v: number) => {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (carregando) return <div className="p-10 font-bold text-center animate-pulse text-slate-500 text-xs">⏳ Mapeando concentração granular e cruzando indexadores... Aguarde!</div>;
  if (erro) return <div className="p-10 text-red-600 font-bold text-center">❌ Erro de processamento: {erro}</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[12px] font-sans text-slate-700">
      <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">📊 Painel Analítico de Concentração e Carteira Aberta</h2>
          <span className="text-xs text-slate-400 font-medium">Análise volumétrica em tempo real dos sacados e envelhecimento analítico por sacados.</span>
        </div>
        <button onClick={carregarDadosCarteira} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm transition-all uppercase tracking-wider">
          🔄 Recarregar Carteira
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-l-4 border-rose-600 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-black uppercase tracking-wider text-[11px]">Total Carteira Vencida (Inadimplência Atual)</span>
            <span className="text-lg">🚨</span>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2 font-mono">{formatarMoeda(kpisGlobais.totalVencido)}</div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Soma do saldo em aberto real de todos os títulos em atraso da carteira filtrada.</span>
        </div>

        <div className="bg-white border-l-4 border-blue-600 border border-slate-200 p-5 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              Previsão de Recebimento (Próximos 
              <input 
                type="number" 
                value={diasProjecao} 
                onChange={(e) => setDiasProjecao(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-14 text-center p-0.5 border border-slate-300 rounded font-black text-blue-700 bg-slate-50 outline-none" 
              /> 
              dias)
            </span>
            <span className="text-lg">⏳</span>
          </div>
          <div className="text-2xl font-black text-blue-800 mt-2 font-mono">{formatarMoeda(kpisGlobais.totalProjetadoAVencer)}</div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Simulador dinâmico de fluxo de caixa futuro para liquidação regular da esteira.</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-900 text-white font-black uppercase text-[10px] tracking-wider h-11 select-none">
                <th className="p-3 w-14 text-center">Abrir</th>
                <th onClick={() => lidarOrdenacaoMaster("cedente")} className="p-3 w-[380px] cursor-pointer hover:bg-slate-700 transition-colors">Cedente / Origem {renderSetaOrdenacao("cedente")}</th>
                <th onClick={() => lidarOrdenacaoMaster("face")} className="p-3 text-right cursor-pointer hover:bg-slate-700 transition-colors">Valor Face Global {renderSetaOrdenacao("face")}</th>
                <th onClick={() => lidarOrdenacaoMaster("aberto")} className="p-3 text-right cursor-pointer hover:bg-slate-700 transition-colors text-blue-300">Saldo Aberto Atual {renderSetaOrdenacao("aberto")}</th>
                <th onClick={() => lidarOrdenacaoMaster("vencido")} className="p-3 text-right cursor-pointer hover:bg-slate-700 transition-colors text-rose-300">Total Vencido {renderSetaOrdenacao("vencido")}</th>
                <th onClick={() => lidarOrdenacaoMaster("avencer")} className="p-3 text-right cursor-pointer hover:bg-slate-700 transition-colors text-emerald-300">A Vencer {renderSetaOrdenacao("avencer")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {carteiraAgregada.map((cedente) => {
                const cedExpandido = !!cedentesExpandidos[cedente.nome];
                return (
                  <tr key={cedente.nome} className="hover:bg-slate-50/20">
                    <td colSpan={6} className="p-0">
                      <table className="w-full text-left border-collapse table-fixed">
                        <tbody>
                          {/* NÍVEL 1: LINHA DO CEDENTE */}
                          <tr className="bg-slate-50 font-bold text-slate-900 hover:bg-slate-100/80 border-l-4 border-l-slate-700 transition-colors h-11">
                            <td className="p-2.5 text-center w-14">
                              <button onClick={() => toggleCedente(cedente.nome)} className="w-5 h-5 bg-slate-200 text-slate-800 rounded font-black flex items-center justify-center border border-slate-300 shadow-xs cursor-pointer text-xs">
                                {cedExpandido ? "−" : "+"}
                              </button>
                            </td>
                            <td className="p-2.5 text-[12px] tracking-tight font-black text-slate-900 uppercase truncate w-[380px]" title={cedente.nome}>{cedente.nome}</td>
                            <td className="p-2.5 text-right font-mono text-slate-400 font-normal">{formatarMoeda(cedente.totalFace)}</td>
                            <td className="p-2.5 text-right font-mono text-slate-900 font-black bg-slate-100/30">{formatarMoeda(cedente.totalAberto)}</td>
                            <td className="p-2.5 text-right font-mono bg-rose-50/40 text-rose-700">{formatarMoeda(cedente.totalVencido)}</td>
                            <td className="p-2.5 text-right font-mono bg-emerald-50/40 text-emerald-700">{formatarMoeda(cedente.totalAVencer)}</td>
                          </tr>

                          {/* NÍVEL 2 */}
                          {cedExpandido && (
                            <>
                              {/* SECURITIZADORA */}
                              {cedente.sec.titulos.length > 0 && (
                                <>
                                  <tr className="bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors h-10">
                                    <td className="p-2 text-center w-14">
                                      <button onClick={() => toggleSub(`${cedente.nome}|||SEC`)} className="w-4 h-4 bg-blue-50 text-blue-800 rounded font-black flex items-center justify-center border border-blue-200 cursor-pointer text-[10px]">
                                        {subExpandidos[`${cedente.nome}|||SEC`] ? "−" : "+"}
                                      </button>
                                    </td>
                                    <td className="p-2 pl-6 text-blue-800 font-black uppercase tracking-tight text-[11px]">重建 Ned Securitizadora</td>
                                    <td className="p-2 text-right font-mono text-slate-400 font-normal">{formatarMoeda(cedente.sec.valorFace)}</td>
                                    <td className="p-2 text-right font-mono text-slate-900 font-bold">{formatarMoeda(cedente.sec.valorAberto)}</td>
                                    <td className="p-2 text-right font-mono text-rose-600 bg-rose-50/10">{formatarMoeda(cedente.sec.vencido)}</td>
                                    <td className="p-2 text-right font-mono text-emerald-600 bg-emerald-50/10">{formatarMoeda(cedente.sec.aVencer)}</td>
                                  </tr>

                                  {/* TÍTULOS DETALHADOS SEC */}
                                  {subExpandidos[`${cedente.nome}|||SEC`] && (
                                    <tr>
                                      <td colSpan={6} className="bg-slate-100/50 p-4">
                                        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-xs">
                                          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="font-bold text-slate-500 text-[10px] uppercase">Filtros Avançados:</span>
                                            <input type="text" placeholder="Buscar Sacado..." value={filtroSacado} onChange={(e) => setFiltroSacado(e.target.value)} className="p-1.5 border border-slate-300 rounded text-[11px] font-medium w-48 bg-white outline-none" />
                                            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="p-1.5 border border-slate-300 rounded text-[11px] font-bold bg-white outline-none cursor-pointer text-slate-700">
                                              <option value="">Status (Todos)</option><option value="Vencido">Vencido</option><option value="A Vencer">A Vencer</option>
                                            </select>
                                            <span className="font-bold text-slate-500 text-[10px] uppercase ml-auto">Ordenar:</span>
                                            <select value={ordenacaoColunaSub} onChange={(e) => setOrdenacaoColunaSub(e.target.value)} className="p-1.5 border border-slate-300 rounded text-[11px] bg-white font-medium outline-none text-slate-700">
                                              <option value="vencimento">Vencimento</option><option value="valorAberto">Saldo em Aberto</option><option value="valorFace">Valor Face</option>
                                            </select>
                                            <button onClick={() => setOrdenacaoDirecaoSub(p => p === "asc" ? "desc" : "asc")} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-bold cursor-pointer text-slate-700">
                                              {ordenacaoDirecaoSub === "asc" ? "🔼 Crescente" : "🔽 Decrescente"}
                                            </button>
                                          </div>

                                          <table className="w-full text-[12px] text-left border-collapse">
                                            <thead>
                                              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200 h-8">
                                                <th className="p-2 pl-4">Sacado / Devedor</th>
                                                <th className="p-2 text-center">Nº Título</th>
                                                <th className="p-2 text-center">Vencimento</th>
                                                <th className="p-2 text-right">Valor Face</th>
                                                <th className="p-2 text-right">Saldo Aberto</th>
                                                <th className="p-2 text-center">Envelhecimento</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium">
                                              {filtrarEOrdenarTitulos(cedente.sec.titulos).map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 h-9 text-slate-600">
                                                  <td className="p-2 pl-4 font-bold text-slate-800 max-w-[280px] truncate">{t.sacado}</td>
                                                  <td className="p-2 text-center text-slate-400 font-mono text-[11px]">{t.numeroTitulo}</td>
                                                  <td className="p-2 text-center font-bold text-slate-500">{t.vencimento}</td>
                                                  <td className="p-2 text-right font-mono text-slate-400 font-normal">{formatarMoeda(t.valorFace)}</td>
                                                  <td className="p-2 text-right font-mono text-slate-900 font-bold">{formatarMoeda(t.valorAberto)}</td>
                                                  <td className="p-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black ${t.status === "Vencido" ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>{t.status.toUpperCase()}</span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}

                              {/* FIDC */}
                              {cedente.fidc.titulos.length > 0 && (
                                <>
                                  <tr className="bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors h-10">
                                    <td className="p-2 text-center w-14">
                                      <button onClick={() => toggleSub(`${cedente.nome}|||FIDC`)} className="w-4 h-4 bg-purple-50 text-purple-800 rounded font-black flex items-center justify-center border border-purple-200 cursor-pointer text-[10px]">
                                        {subExpandidos[`${cedente.nome}|||FIDC`] ? "−" : "+"}
                                      </button>
                                    </td>
                                    <td className="p-2 pl-6 text-purple-800 font-black uppercase tracking-tight text-[11px]">🔮 Ned FIDC</td>
                                    <td className="p-2 text-right font-mono text-slate-400 font-normal">{formatarMoeda(cedente.fidc.valorFace)}</td>
                                    <td className="p-2 text-right font-mono text-slate-900 font-bold">{formatarMoeda(cedente.fidc.valorAberto)}</td>
                                    <td className="p-2 text-right font-mono text-rose-600 bg-rose-50/10">{formatarMoeda(cedente.fidc.vencido)}</td>
                                    <td className="p-2 text-right font-mono text-emerald-600 bg-emerald-50/10">{formatarMoeda(cedente.fidc.aVencer)}</td>
                                  </tr>

                                  {/* TÍTULOS DETALHADOS FIDC */}
                                  {subExpandidos[`${cedente.nome}|||FIDC`] && (
                                    <tr>
                                      <td colSpan={6} className="bg-slate-100/50 p-4">
                                        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-xs">
                                          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="font-bold text-slate-500 text-[10px] uppercase">Filtros Avançados:</span>
                                            <input type="text" placeholder="Buscar Sacado..." value={filtroSacado} onChange={(e) => setFiltroSacado(e.target.value)} className="p-1.5 border border-slate-300 rounded text-[11px] font-medium w-48 bg-white outline-none" />
                                            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="p-1.5 border border-slate-300 rounded text-[11px] font-bold bg-white outline-none cursor-pointer text-slate-700">
                                              <option value="">Status (Todos)</option><option value="Vencido">Vencido</option><option value="A Vencer">A Vencer</option>
                                            </select>
                                            <span className="font-bold text-slate-500 text-[10px] uppercase ml-auto">Ordenar:</span>
                                            <select value={ordenacaoColunaSub} onChange={(e) => setOrdenacaoColunaSub(e.target.value)} className="p-1.5 border border-slate-300 rounded text-[11px] bg-white font-medium outline-none text-slate-700">
                                              <option value="vencimento">Vencimento</option><option value="valorAberto">Saldo em Aberto</option><option value="valorFace">Valor Face</option>
                                            </select>
                                            <button onClick={() => setOrdenacaoDirecaoSub(p => p === "asc" ? "desc" : "asc")} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-bold cursor-pointer text-slate-700">
                                              {ordenacaoDirecaoSub === "asc" ? "🔼 Crescente" : "🔽 Decrescente"}
                                            </button>
                                          </div>

                                          <table className="w-full text-[12px] text-left border-collapse">
                                            <thead>
                                              <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200 h-8">
                                                <th className="p-2 pl-4">Sacado / Devedor</th>
                                                <th className="p-2 text-center">Vencimento</th>
                                                <th className="p-2 text-right">Valor Face</th>
                                                <th className="p-2 text-right">Saldo Aberto</th>
                                                <th className="p-2 text-center">Envelhecimento</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium">
                                              {filtrarEOrdenarTitulos(cedente.fidc.titulos).map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 h-9 text-slate-600">
                                                  <td className="p-2 pl-4 font-bold text-slate-800 max-w-[280px] truncate">{t.sacado}</td>
                                                  <td className="p-2 text-center font-bold text-slate-500">{t.vencimento}</td>
                                                  <td className="p-2 text-right font-mono text-slate-400 font-normal">{formatarMoeda(t.valorFace)}</td>
                                                  <td className="p-2 text-right font-mono text-slate-900 font-bold">{formatarMoeda(t.valorAberto)}</td>
                                                  <td className="p-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black ${t.status === "Vencido" ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>{t.status.toUpperCase()}</span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}