/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 UTILS DE FORMATAÇÃO E LIMPEZA
// ============================================================================

// NOVO: Limpador blindado para converter strings de banco (ex: "R$ 50.000,00" ou "50000,00") em número real
const limparValorNumerico = (valor: any) => {
  if (valor === undefined || valor === null || valor === "") return 0;
  if (typeof valor === "number") return valor;
  
  // Remove tudo que não for número, vírgula, ponto ou sinal de menos
  let limpo = String(valor).replace(/[^\d.,-]/g, "");
  
  // Se tiver vírgula, assume que é padrão BR (ex: 10.000,50 -> 10000.50)
  if (limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  }
  
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
};

const formatarMoeda = (valor: any) => {
  const num = limparValorNumerico(valor);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

const formatarDataSerasa = (dataStr: string) => {
  if (!dataStr || dataStr.length !== 8) return dataStr || "-";
  return `${dataStr.substring(6, 8)}/${dataStr.substring(4, 6)}/${dataStr.substring(0, 4)}`;
};

const formatarMesSerasa = (mesStr: string) => {
  if (!mesStr || mesStr.length < 7) return mesStr;
  const ano = "20" + mesStr.substring(0, 2);
  const mesExtenso = mesStr.substring(4, 7);
  return `${mesExtenso.charAt(0) + mesExtenso.slice(1).toLowerCase()}/${ano}`;
};

const formatarDataBr = (str: string) => {
  if (!str) return "-";
  return str.split("-").reverse().join("/");
};

const extrairRaizCnpj = (cnpj: string) => {
  if (!cnpj) return "";
  const apenasNumeros = cnpj.replace(/\D/g, "");
  return apenasNumeros.substring(0, 8).padStart(8, "0");
};

// Limpa o lixo de zeros que o Serasa manda no final do bloco
const limparTextoComp = (txt: string) => {
  if (!txt) return "-";
  const limpo = txt.replace(/0+$/, "").trim();
  return limpo || "-";
};

// 💎 TRADUTOR DE COMPORTAMENTO SERASA
const RenderizarFaixa = ({ texto, isPontual }: { texto: string, isPontual?: boolean }) => {
  if (!texto || texto === "-") return <span className="text-slate-300 font-bold text-sm">-</span>;
  
  const match = texto.match(/^([A-Z])(\d{1,2})\s*([1-9].*)/);
  
  if (match) {
    const classe = match[1];
    const fornecedores = match[2];
    const valor = match[3];

    let colorBadge = "bg-slate-100 text-slate-600 border-slate-200";
    if (classe === 'A') colorBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (classe === 'B') colorBadge = "bg-blue-100 text-blue-800 border-blue-200";
    if (classe === 'C') colorBadge = "bg-amber-100 text-amber-800 border-amber-200";
    if (classe === 'D') colorBadge = "bg-rose-100 text-rose-800 border-rose-200";

    return (
      <div className="flex flex-col gap-1.5 py-1">
        <span className={`font-black text-[13px] uppercase tracking-wide ${isPontual ? 'text-emerald-700' : 'text-slate-800'}`}>
          {valor}
        </span>
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border shadow-xs ${colorBadge}`}>
            Classe {classe}
          </span>
          <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">
            {fornecedores} Fornecedores
          </span>
        </div>
      </div>
    );
  }
  
  return <span className={`font-bold text-[13px] uppercase tracking-wide ${isPontual ? 'text-emerald-700' : 'text-slate-800'}`}>{texto}</span>;
};

export default function RaioXSerasaPage() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtros e Ordenação
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [ordenacao, setOrdenacao] = useState("ALFABETICA");
  
  const [selecionado, setSelecionado] = useState<any | null>(null);

  // ============================================================================
  // 📥 CARREGAMENTO DE DADOS (COM CRUZAMENTO DO CRM)
  // ============================================================================
  useEffect(() => {
    const carregarHistorico = async () => {
      try {
        setLoading(true);
        
        const [resHist, resCad] = await Promise.all([
          supabase.from("historico_consolidado").select("*").order("data_processamento", { ascending: false }).limit(15000),
          supabase.from("cadastro_cedentes").select("cnpj, limite, risco_sec, risco_fidc").limit(15000)
        ]);

        if (resHist.error) throw resHist.error;
        
        if (resHist.data) {
          const mapUnicos = new Map();
          
          resHist.data.forEach(item => {
            const temInteligencia = item.detalhes_completos && Object.keys(item.detalhes_completos).length > 0;
            if (temInteligencia && !mapUnicos.has(item.cnpj_cliente)) {
              mapUnicos.set(item.cnpj_cliente, item);
            }
          });

          // Cruzamento e blindagem com o limparValorNumerico
          const listaFinal = Array.from(mapUnicos.values()).map(item => {
            const raizItem = extrairRaizCnpj(item.cnpj_cliente);
            const cad = resCad.data?.find(c => extrairRaizCnpj(c.cnpj) === raizItem);
            
            return {
              ...item,
              limite_atualizado: cad ? limparValorNumerico(cad.limite) : limparValorNumerico(item.detalhes_completos?.comercial?.limite_credito),
              risco_atualizado: cad ? (limparValorNumerico(cad.risco_sec) + limparValorNumerico(cad.risco_fidc)) : limparValorNumerico(item.risco_aberto)
            };
          });

          setRegistros(listaFinal);
        }
      } catch (error) {
        console.error("Erro ao buscar dados do Raio-X:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarHistorico();
  }, []);

  // ============================================================================
  // 🔍 MOTOR DE FILTRO E ORDENAÇÃO
  // ============================================================================
  const registrosFiltrados = useMemo(() => {
    let filtrados = [...registros];

    if (busca) {
      const b = busca.toLowerCase();
      filtrados = filtrados.filter(r => 
        (r.cedente || "").toLowerCase().includes(b) || 
        (r.cnpj_cliente || "").includes(b)
      );
    }

    if (filtroStatus === "COM_RESTRICAO") {
      filtrados = filtrados.filter(r => parseFloat(r.saldo_atual || 0) > 0);
    } else if (filtroStatus === "NADA_CONSTA") {
      filtrados = filtrados.filter(r => parseFloat(r.saldo_atual || 0) === 0);
    }

    filtrados.sort((a, b) => {
      if (ordenacao === "ALFABETICA") {
        return (a.cedente || "").localeCompare(b.cedente || "");
      }
      if (ordenacao === "MAIOR_DIVIDA") {
        return parseFloat(b.saldo_atual || 0) - parseFloat(a.saldo_atual || 0);
      }
      if (ordenacao === "MAIOR_LIMITE") {
        return (b.limite_atualizado || 0) - (a.limite_atualizado || 0);
      }
      return 0;
    });

    return filtrados;
  }, [busca, registros, filtroStatus, ordenacao]);

  // ============================================================================
  // 🧩 RENDERIZAÇÃO DO PAINEL PRINCIPAL
  // ============================================================================
  const renderizarPainel = () => {
    if (!selecionado) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
          <span className="text-7xl filter drop-shadow-sm opacity-30">📡</span>
          <h2 className="text-xl font-bold uppercase tracking-widest text-slate-500">Radar Deep View</h2>
          <p className="text-sm max-w-sm text-center">Selecione um cedente na lista ao lado para carregar o dossiê completo de inteligência Serasa.</p>
        </div>
      );
    }

    const jsonb = selecionado.detalhes_completos || {};
    const cadastro = jsonb.cadastro || {};
    const comercial = jsonb.comercial || {};
    const consultas = Array.isArray(jsonb.consultas) ? jsonb.consultas : [];
    const dividas = Array.isArray(jsonb.detalhes_dividas) ? jsonb.detalhes_dividas : [];
    const comportamentoBruto = Array.isArray(jsonb.comportamento) ? jsonb.comportamento : [];

    const isProspecto = comercial.status_banco === "PROSPECTO_AVULSO";
    const statusLabel = isProspecto ? "PROSPECTO (AVULSO)" : "CLIENTE DA BASE";
    const statusColor = isProspecto ? "text-orange-700 bg-orange-100 border-orange-200" : "text-emerald-700 bg-emerald-100 border-emerald-200";

    const evoNum = parseFloat(selecionado.evolucao || 0);
    const evolucaoStr = evoNum > 0 ? `▲ Piora de ${formatarMoeda(evoNum)}` : 
                        evoNum < 0 ? `▼ Melhora de ${formatarMoeda(Math.abs(evoNum))}` : 
                        "Estável (Sem variação)";

    let totalDetalhado = 0;

    const compAgrupado = comportamentoBruto.reduce((acc: any, curr: any) => {
      if (!acc[curr.mes]) acc[curr.mes] = { mes: curr.mes, totalMes: "-", pontual: "-" };
      if (curr.tipo === "TOTAL MES") acc[curr.mes].totalMes = limparTextoComp(curr.avaliacao);
      if (curr.tipo === "PONTUAL") acc[curr.mes].pontual = limparTextoComp(curr.avaliacao);
      return acc;
    }, {});
    
    const comportamentoRows = Object.values(compAgrupado).sort((a: any, b: any) => b.mes.localeCompare(a.mes));

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 pb-10">
        
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 rounded-2xl shadow-lg flex flex-col xl:flex-row justify-between items-start xl:items-stretch gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">{selecionado.cedente || "Empresa Não Informada"}</h1>
            <div className="font-mono text-blue-200 mt-1 mb-4 opacity-90 text-sm">CNPJ: {selecionado.cnpj_cliente}</div>
            
            <div className="flex gap-4 text-xs md:text-sm pt-4 border-t border-white/10 opacity-90 font-medium">
              <span><strong className="text-white">Processamento:</strong> {formatarDataBr(selecionado.data_processamento)}</span>
              <span>|</span>
              <span><strong className="text-white">Praça Base:</strong> {cadastro.cidade || "Não informada"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px] shrink-0">
            <div className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border text-center shadow-sm ${statusColor}`}>
              {statusLabel}
            </div>
            <div className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-white/20 bg-black/20 text-center backdrop-blur-sm text-white shadow-inner">
              <span className="opacity-70 mr-2">EVOLUÇÃO:</span>
              <span className={evoNum > 0 ? "text-rose-300" : evoNum < 0 ? "text-emerald-300" : "text-slate-300"}>{evolucaoStr}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Limite de Crédito Interno</div>
            <div className="text-2xl font-black font-mono text-blue-900">{formatarMoeda(selecionado.limite_atualizado)}</div>
            <div className="text-xs text-slate-500 mt-2 font-medium">Baseado no CRM</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Risco Securitizadora + FIDC</div>
            <div className="text-2xl font-black font-mono text-amber-600">{formatarMoeda(selecionado.risco_atualizado)}</div>
            <div className="text-xs text-slate-500 mt-2 font-medium">Exposição atual na casa</div>
          </div>
          <div className="bg-rose-50 border border-rose-100 border-l-4 border-l-rose-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-black uppercase tracking-widest text-rose-700 mb-1">Saldo Devedor (Serasa)</div>
            <div className="text-2xl font-black font-mono text-rose-700">{formatarMoeda(selecionado.saldo_atual)}</div>
            <div className="text-xs text-rose-600 mt-2 font-bold">Total Restritivo Global</div>
          </div>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2 mb-4">
            <span className="w-2 h-6 bg-emerald-500 rounded-md inline-block shadow-sm"></span>
            1. Pontualidade e Poder de Compra
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold uppercase text-slate-400 tracking-wider text-center w-32 text-[10px]">Competência</th>
                    <th className="p-4 font-bold uppercase text-slate-400 tracking-wider text-[10px]">Volume Total Comprado (Fornecedores)</th>
                    <th className="p-4 font-bold uppercase text-emerald-600 tracking-wider text-[10px] bg-emerald-50/50">Volume Pago Pontualmente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comportamentoRows.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic font-medium">Nenhum histórico de comportamento mapeado neste arquivo.</td></tr>
                  ) : (
                    comportamentoRows.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="p-4 text-center font-mono font-bold text-slate-500 group-hover:text-blue-600 transition-colors">{formatarMesSerasa(c.mes)}</td>
                        <td className="p-4">
                          <RenderizarFaixa texto={c.totalMes} />
                        </td>
                        <td className="p-4 bg-emerald-50/30">
                          <RenderizarFaixa texto={c.pontual} isPontual={true} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2 mb-4 mt-6">
            <span className="w-2 h-6 bg-rose-600 rounded-md inline-block shadow-sm"></span>
            2. Quadro de Ocorrências e Dívidas
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "PEFIN", valor: selecionado.total_pefin, color: "border-b-rose-600" },
              { label: "REFIN", valor: selecionado.total_refin, color: "border-b-rose-600" },
              { label: "Protestos", valor: selecionado.total_protesto, color: "border-b-orange-500" },
              { label: "Ações Jud.", valor: selecionado.total_acao_jud, color: "border-b-amber-500" },
              { label: "Dív. Vencidas", valor: selecionado.total_div_vencida, color: "border-b-purple-600" },
            ].map((item, idx) => (
              <div key={idx} className={`bg-white border border-slate-200 border-b-4 ${item.color} rounded-xl p-4 text-center shadow-sm hover:-translate-y-1 transition-transform duration-300`}>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{item.label}</div>
                <div className="text-lg md:text-xl font-black text-slate-800 break-words">{formatarMoeda(item.valor)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 p-3.5 font-bold uppercase text-slate-600 tracking-wider text-[10px] text-center">
                Detalhamento de Protestos e Ações
              </div>
              <div className="max-h-[350px] overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-center w-28 text-[9px]">Data</th>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-[9px]">Praça / Origem</th>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-right w-32 text-[9px]">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dividas.length === 0 ? (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic font-medium">Nenhuma restrição detalhada localizada.</td></tr>
                    ) : (
                      dividas.map((d: any, i: number) => {
                        totalDetalhado += Number(d.valor || 0);
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-500">{formatarDataSerasa(d.data)}</td>
                            <td className="p-3 font-bold text-slate-700 uppercase">{d.praca || "-"}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-600 bg-rose-50/30">{formatarMoeda(d.valor)}</td>
                          </tr>
                        );
                      })
                    )}
                    {dividas.length > 0 && (
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={2} className="p-3.5 font-black text-slate-700 text-[10px] uppercase tracking-wider">Soma Aproximada do Detalhamento</td>
                        <td className="p-3.5 text-right font-mono font-black text-rose-700 text-sm">{formatarMoeda(totalDetalhado)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 p-3.5 font-bold uppercase text-slate-600 tracking-wider text-[10px] text-center">
                Radar de Buscas (Mercado)
              </div>
              <div className="bg-blue-50 border-b border-blue-100 p-3 text-[11px] text-blue-900 leading-relaxed text-center font-medium">
                Volume elevado pode indicar busca urgente por refinanciamento.
              </div>
              <div className="max-h-[305px] overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-center w-28 text-[9px]">Data</th>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-[9px]">Instituição Solicitante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultas.length === 0 ? (
                      <tr><td colSpan={2} className="p-8 text-center text-slate-400 italic font-medium">Nenhuma consulta recente mapeada.</td></tr>
                    ) : (
                      consultas.map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-blue-700 bg-blue-50/30">{formatarDataSerasa(c.data)}</td>
                          <td className="p-3 font-bold text-slate-700 uppercase">{c.instituicao}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] gap-6 p-4 max-w-[1800px] mx-auto font-sans text-slate-800">
      
      <div className="w-full md:w-[340px] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0">
        
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 space-y-4">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Raio-X Serasa</h2>
            <p className="text-xs text-slate-500 mt-0.5">Dossiê detalhado por cedente</p>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cedente ou CNPJ..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner bg-white placeholder:text-slate-400"
            />
            <span className="absolute left-3 top-3 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
          </div>

          <div className="flex gap-2">
            <select 
              value={filtroStatus} 
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="flex-1 bg-white border border-slate-300 text-slate-600 text-[11px] font-bold uppercase rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="TODOS">Todos Status</option>
              <option value="COM_RESTRICAO">Com Restrições</option>
              <option value="NADA_CONSTA">Nada Consta</option>
            </select>
            
            <select 
              value={ordenacao} 
              onChange={(e) => setOrdenacao(e.target.value)}
              className="flex-1 bg-white border border-slate-300 text-slate-600 text-[11px] font-bold uppercase rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="ALFABETICA">A-Z Alfabética</option>
              <option value="MAIOR_DIVIDA">Maior Dívida</option>
              <option value="MAIOR_LIMITE">Maior Limite CRM</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center text-slate-400 animate-pulse space-y-3">
              <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-xs font-bold uppercase tracking-wider">Carregando Dossiês...</span>
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400 font-medium">
              Nenhum cedente encontrado para os filtros selecionados.
            </div>
          ) : (
            registrosFiltrados.map((item) => {
              const temDivida = parseFloat(item.saldo_atual || 0) > 0;
              const isSelected = selecionado?.id === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setSelecionado(item)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all duration-200 flex items-center justify-between group border
                    ${isSelected 
                      ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-500/20' 
                      : 'border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm'
                    }`}
                >
                  <div className="overflow-hidden flex-1 pr-3">
                    <div className={`text-[13px] font-black truncate uppercase tracking-tight ${isSelected ? 'text-blue-900' : 'text-slate-700 group-hover:text-blue-700'}`}>
                      {item.cedente}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.cnpj_cliente}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-inner ${temDivida ? 'bg-rose-500 shadow-rose-200' : 'bg-emerald-400 shadow-emerald-200'}`}></div>
                    {isSelected && <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Visualizando</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-50/50 border border-slate-200/50">
        {renderizarPainel()}
      </div>
      
    </div>
  );
}