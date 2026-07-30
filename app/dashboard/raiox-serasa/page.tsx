/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// 🧽 UTILS DE FORMATAÇÃO
// ============================================================================
const formatarMoeda = (valor: any) => {
  if (valor === undefined || valor === null || valor === "") return "R$ 0,00";
  let num = Number(valor);
  if (isNaN(num) && typeof valor === "string") {
    num = Number(valor.replace(/\./g, "").replace(",", "."));
  }
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

const formatarDataSerasa = (dataStr: string) => {
  if (!dataStr || dataStr.length !== 8) return dataStr || "-";
  return `${dataStr.substring(6, 8)}/${dataStr.substring(4, 6)}/${dataStr.substring(0, 4)}`;
};

const formatarDataBr = (str: string) => {
  if (!str) return "-";
  return str.split("-").reverse().join("/");
};

export default function RaioXSerasaPage() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<any | null>(null);

  // ============================================================================
  // 📥 CARREGAMENTO DE DADOS (Pega sempre a versão mais recente de cada CNPJ)
  // ============================================================================
  useEffect(() => {
    const carregarHistorico = async () => {
      try {
        setLoading(true);
        // Busca os registros ordenados do mais novo pro mais velho
        const { data, error } = await supabase
          .from("historico_consolidado")
          .select("*")
          .order("data_processamento", { ascending: false });

        if (error) throw error;
        
        if (data) {
          // Filtra para manter apenas o registro mais recente de cada CNPJ
          const mapUnicos = new Map();
          data.forEach(item => {
            if (!mapUnicos.has(item.cnpj_cliente)) {
              mapUnicos.set(item.cnpj_cliente, item);
            }
          });
          setRegistros(Array.from(mapUnicos.values()));
        }
      } catch (error) {
        console.error("Erro ao buscar dados do Raio-X:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarHistorico();
  }, []);

  // Filtro de busca na barra lateral
  const registrosFiltrados = useMemo(() => {
    if (!busca) return registros;
    const b = busca.toLowerCase();
    return registros.filter(r => 
      (r.cedente || "").toLowerCase().includes(b) || 
      (r.cnpj_cliente || "").includes(b)
    );
  }, [busca, registros]);

  // ============================================================================
  // 🧩 COMPONENTES INTERNOS DO RAIO-X
  // ============================================================================
  const renderizarPainel = () => {
    if (!selecionado) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
          <span className="text-6xl filter drop-shadow-sm opacity-50">📡</span>
          <h2 className="text-xl font-bold uppercase tracking-widest">Radar Deep View</h2>
          <p className="text-sm">Selecione um cedente na lista ao lado para carregar o dossiê de inteligência.</p>
        </div>
      );
    }

    const jsonb = selecionado.detalhes_completos || {};
    const cadastro = jsonb.cadastro || {};
    const comercial = jsonb.comercial || {};
    const consultas = jsonb.consultas || [];
    const dividas = jsonb.detalhes_dividas || [];

    const isProspecto = comercial.status_banco === "PROSPECTO_AVULSO";
    const statusLabel = isProspecto ? "PROSPECTO (AVULSO)" : "CLIENTE DA BASE";
    const statusColor = isProspecto ? "text-orange-700 bg-orange-100 border-orange-200" : "text-emerald-700 bg-emerald-100 border-emerald-200";

    const evoNum = parseFloat(selecionado.evolucao || 0);
    const evolucaoStr = evoNum > 0 ? `▲ Piora de ${formatarMoeda(evoNum)}` : 
                        evoNum < 0 ? `▼ Melhora de ${formatarMoeda(Math.abs(evoNum))}` : 
                        "Estável (Sem variação)";

    let totalDetalhado = 0;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
        
        {/* CABEÇALHO DO DOSSIÊ */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-stretch gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">{selecionado.cedente || "Empresa Não Informada"}</h1>
            <div className="font-mono text-blue-200 mt-1 mb-4 opacity-90">CNPJ: {selecionado.cnpj_cliente}</div>
            
            <div className="flex gap-4 text-xs md:text-sm pt-4 border-t border-white/10 opacity-90 font-medium">
              <span><strong className="text-white">Processamento:</strong> {formatarDataBr(selecionado.data_processamento)}</span>
              <span>|</span>
              <span><strong className="text-white">Praça:</strong> {cadastro.cidade || "Não informada"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[220px] shrink-0">
            <div className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border text-center ${statusColor}`}>
              {statusLabel}
            </div>
            <div className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider border border-white/20 bg-black/20 text-center backdrop-blur-sm text-white">
              <span className="opacity-70 mr-1">EVOLUÇÃO:</span>
              <span className={evoNum > 0 ? "text-rose-300" : evoNum < 0 ? "text-emerald-300" : "text-slate-300"}>{evolucaoStr}</span>
            </div>
          </div>
        </div>

        {/* INDICADORES FINANCEIROS GLOBAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Limite de Crédito Interno</div>
            <div className="text-2xl font-black font-mono text-blue-900">{formatarMoeda(comercial.limite_credito || 0)}</div>
            <div className="text-xs text-slate-500 mt-2">Cadastrado no CRM</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Risco Securitizadora + FIDC</div>
            <div className="text-2xl font-black font-mono text-amber-600">{formatarMoeda(selecionado.risco_aberto || 0)}</div>
            <div className="text-xs text-slate-500 mt-2">Exposição atual na casa</div>
          </div>
          <div className="bg-rose-50 border border-rose-100 border-l-4 border-l-rose-600 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] font-black uppercase tracking-wider text-rose-700 mb-1">Saldo Devedor (Serasa)</div>
            <div className="text-2xl font-black font-mono text-rose-700">{formatarMoeda(selecionado.saldo_atual || 0)}</div>
            <div className="text-xs text-rose-600 mt-2 font-bold">Total Restritivo Global</div>
          </div>
        </div>

        {/* MINI-CARDS DE RESTRITIVOS (Estética Titânio) */}
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2 mb-4">
            <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block"></span>
            1. Quadro de Ocorrências
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        </div>

        {/* DETALHAMENTO & RADAR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* TABELA DÍVIDAS DETALHADAS */}
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2 mb-4">
              Detalhamento de Protestos e Ações
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-center w-28">Data</th>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider">Praça / Origem</th>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-right w-32">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dividas.length === 0 ? (
                      <tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">Nenhuma restrição detalhada localizada.</td></tr>
                    ) : (
                      dividas.map((d: any, i: number) => {
                        totalDetalhado += Number(d.valor || 0);
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-500">{formatarDataSerasa(d.data)}</td>
                            <td className="p-3 font-bold text-slate-700 uppercase">{d.praca || "-"}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-600">{formatarMoeda(d.valor)}</td>
                          </tr>
                        );
                      })
                    )}
                    {dividas.length > 0 && (
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={2} className="p-3 font-bold text-slate-700">SOMA APROXIMADA DO DETALHAMENTO</td>
                        <td className="p-3 text-right font-mono font-black text-rose-700 text-sm">{formatarMoeda(totalDetalhado)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TABELA RADAR DE CONSULTAS */}
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-100 pb-2 mb-4">
              Radar de Buscas (Mercado)
            </h3>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg mb-4 text-xs text-blue-900 leading-relaxed text-justify">
              <strong>Atenção Estratégica:</strong> Um volume elevado de consultas recentes por bancos, factorings ou securitizadoras neste quadro pode indicar busca urgente por capital de giro ou refinanciamento no mercado.
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-[330px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider text-center w-28">Data</th>
                      <th className="p-3 font-bold uppercase text-slate-400 tracking-wider">Instituição Solicitante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultas.length === 0 ? (
                      <tr><td colSpan={2} className="p-6 text-center text-slate-400 italic">Nenhuma consulta recente mapeada.</td></tr>
                    ) : (
                      consultas.map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-blue-700">{formatarDataSerasa(c.data)}</td>
                          <td className="p-3 font-semibold text-slate-700">{c.instituicao}</td>
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
      
      {/* 📜 SIDEBAR: LISTA DE CEDENTES */}
      <div className="w-full md:w-80 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0">
        
        {/* Header da Sidebar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-800">Raio-X Serasa</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Selecione o cedente monitorado</p>
          <input
            type="text"
            placeholder="Buscar cedente ou CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-4 text-center text-sm font-bold text-slate-400 animate-pulse">Carregando base...</div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400 italic">Nenhum registro encontrado.</div>
          ) : (
            registrosFiltrados.map((item) => {
              const temDivida = parseFloat(item.saldo_atual || 0) > 0;
              const isSelected = selecionado?.id === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setSelecionado(item)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center justify-between group border
                    ${isSelected 
                      ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-500/20' 
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                    }`}
                >
                  <div className="overflow-hidden">
                    <div className={`text-sm font-black truncate uppercase ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                      {item.cedente}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{item.cnpj_cliente}</div>
                  </div>
                  
                  {/* Bolinha indicadora de risco */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ml-3 shadow-inner
                    ${temDivida ? 'bg-rose-500 shadow-rose-200' : 'bg-emerald-400 shadow-emerald-200'}
                  `}></div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 📊 ÁREA PRINCIPAL: DOSSIÊ (RENDERIZAÇÃO) */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-50/50">
        {renderizarPainel()}
      </div>
      
    </div>
  );
}