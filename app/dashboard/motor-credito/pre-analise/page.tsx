/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PreAnalisePage() {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  
  const [dadosEmpresa, setDadosEmpresa] = useState<any>(null);
  const [processosEncontrados, setProcessosEncontrados] = useState<any[]>([]);
  const [dadosFinanceiros, setDadosFinanceiros] = useState<any>(null);
  
  const [historico, setHistorico] = useState<any[]>([]);
  const [mostrarJsonBruto, setMostrarJsonBruto] = useState(false);

  useEffect(() => {
    carregarHistorico();
  }, []);

  const carregarHistorico = async () => {
    const { data, error } = await supabase
      .from("pre_analises")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(10);
      
    if (error) console.error("❌ Erro ao puxar histórico:", error);
    if (data) setHistorico(data);
  };

  const avaliarRiscoProcesso = (classe: string) => {
    if (!classe) return { cor: "bg-slate-100 text-slate-600 border-slate-200", label: "N/D", peso: 0 };
    const c = classe.toLowerCase();
    // Ajuste de palavras-chave baseado no DataJud
    if (c.includes("falência") || c.includes("recuperação") || c.includes("execução fiscal") || c.includes("tributário")) return { cor: "bg-red-50 text-red-700 border-red-200", label: "🚨 ALTO RISCO", peso: 3 };
    if (c.includes("trabalhista") || c.includes("execução") || c.includes("indenização")) return { cor: "bg-amber-50 text-amber-700 border-amber-200", label: "⚠️ MÉDIO", peso: 2 };
    return { cor: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "🟢 BAIXO", peso: 1 };
  };

  const rodarVarredura = async (cnpjAlvo: string) => {
    if (!cnpjAlvo.trim()) return;

    try {
      setCarregando(true);
      setProcessosEncontrados([]);
      setDadosEmpresa(null);
      setDadosFinanceiros(null);
      setMostrarJsonBruto(false);

      const documentoLimpo = cnpjAlvo.replace(/\D/g, "");

      // 1. BIGQUERY (Receita Básica)
      const resBq = await fetch("/api/buscar-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: documentoLimpo })
      });
      const dataBq = await resBq.json();

      if (!dataBq.found || !dataBq.empresa) {
        alert("Empresa não localizada no BigQuery.");
        setCarregando(false);
        return;
      }

      // 2. CREDITHUB (SERASA + DATAJUD + QSA TUDO JUNTO)
      const resCreditHub = await fetch("/api/restritivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: documentoLimpo })
      });

      let financeiro = null;
      let processos = [];

      if (resCreditHub.ok) {
        financeiro = await resCreditHub.json();
        processos = financeiro.processos || []; // Puxa do backend otimizado
      } else {
        const errData = await resCreditHub.json().catch(() => ({}));
        financeiro = { erro: true, mensagem: errData.details || errData.error || "Falha de conexão com o CreditHub." };
      }

      let nivelRiscoGeral = "BAIXO";
      let pesoTotal = 0;
      processos.forEach((p: any) => pesoTotal += avaliarRiscoProcesso(p.classe).peso);
      
      if (pesoTotal >= 10 || processos.some((p: any) => avaliarRiscoProcesso(p.classe).peso === 3)) {
        nivelRiscoGeral = "ALTO";
      } else if (pesoTotal >= 4) {
        nivelRiscoGeral = "MEDIO";
      }
      if (financeiro?.resumo?.possui_apontamento) {
        nivelRiscoGeral = "ALTO";
      }

      const userStr = localStorage.getItem("intraned_user");
      const localUser = userStr ? JSON.parse(userStr) : null;

      const objEmpresaFoto = {
        razao_social: dataBq.empresa.razao_social,
        cnpj: dataBq.empresa.cnpj,
        capital_social: dataBq.empresa.capital_social,
        situacao: dataBq.empresa.situacao_cadastral,
      };

      const { error: insertError } = await supabase.from("pre_analises").insert({
        documento_alvo: documentoLimpo,
        nome_empresa_lead: dataBq.empresa.razao_social || "Razão Social Indisponível",
        comercial_responsavel: localUser?.nome || "Sistema",
        total_processos_encontrados: processos.length,
        nivel_risco: nivelRiscoGeral,
        dados_processos: processos,
        dados_empresa: objEmpresaFoto,
        dados_financeiros: financeiro
      });

      if (!insertError) await carregarHistorico();

      setDadosEmpresa(objEmpresaFoto);
      setProcessosEncontrados(processos);
      setDadosFinanceiros(financeiro);

    } catch (err) {
      console.error(err);
      alert("Erro crítico ao rodar motores de pré-análise.");
    } finally {
      setCarregando(false);
    }
  };

  const executarPreAnalise = async (e: React.FormEvent) => {
    e.preventDefault();
    await rodarVarredura(busca);
  };

  const carregarFotoDaConsulta = (itemHistorico: any) => {
    setBusca(itemHistorico.documento_alvo);
    if (itemHistorico.dados_empresa && itemHistorico.dados_financeiros) {
      setDadosEmpresa(itemHistorico.dados_empresa);
      setDadosFinanceiros(itemHistorico.dados_financeiros);
      setProcessosEncontrados(itemHistorico.dados_processos || []);
      setMostrarJsonBruto(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const confirma = window.confirm("⚠️ Esta consulta é antiga e a 'foto' não foi salva.\n\nDeseja realizar uma NOVA PESQUISA na API? (Isto gerará custos de Bureau).");
      if (confirma) {
        rodarVarredura(itemHistorico.documento_alvo);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const formatarMoeda = (valor: number | string) => {
    const v = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(v)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const formatarData = (dataIso: string) => {
    return new Date(dataIso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  const getCorRiscoGeral = (risco: string) => {
    if (risco === "ALTO") return "bg-red-50 text-red-700 border-red-200";
    if (risco === "MEDIO") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  const enviarParaMesa = () => {
    if (dadosEmpresa) {
      router.push(`/dashboard/motor-credito/envio-analise?cnpj=${dadosEmpresa.cnpj.replace(/\D/g, "")}`);
    }
  };

  const resumo = dadosFinanceiros?.resumo;
  const ficha = dadosFinanceiros?.ficha_cadastral || {};

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans antialiased text-[13px]">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        {/* BARRA DE BUSCA EXTERNA AO RELATÓRIO */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              🚦 Pré-Análise Executiva
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Insira o CNPJ para gerar o dossiê de viabilidade preliminar.</p>
          </div>
          <form onSubmit={executarPreAnalise} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" required placeholder="Digite o CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)}
              className="flex-1 p-3.5 border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none rounded-xl font-bold text-slate-800 text-sm shadow-inner max-w-md font-mono"
            />
            <button type="submit" disabled={carregando} className="px-8 py-3.5 bg-blue-900 hover:bg-blue-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md">
              {carregando ? "⏳ Gerando Dossiê..." : "📊 Extrair Relatório"}
            </button>
          </form>
        </div>

        {/* ============================================================== */}
        {/* 🔥 O RELATÓRIO / DOSSIÊ EXECUTIVO */}
        {/* ============================================================== */}
        {dadosEmpresa && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            
            {/* CABEÇALHO DO DOSSIÊ */}
            <div className="bg-gradient-to-br from-blue-900 to-blue-700 p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase opacity-80 mb-2 block">Dossiê de Viabilidade Preliminar</span>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none mb-2">{dadosEmpresa.razao_social}</h1>
                <div className="font-mono text-lg opacity-90">{dadosEmpresa.cnpj}</div>
              </div>
              <div className="flex flex-col gap-3 text-right">
                <div className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm shadow-inner ${dadosEmpresa.situacao === 'ATIVA' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/20 text-red-100'}`}>
                  Situação RFB: {dadosEmpresa.situacao}
                </div>
                <button onClick={enviarParaMesa} disabled={dadosEmpresa.situacao !== 'ATIVA'} className="px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-black rounded-lg text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg">
                  ✅ Aprovar p/ Mesa de Crédito
                </button>
              </div>
            </div>

            <div className="p-8 space-y-10">

              {/* 1. ESTRUTURA E LOCALIZAÇÃO */}
              <section>
                <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide flex items-center gap-3 border-b-2 border-slate-100 pb-2 mb-6">
                  <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                  1. Perfil Corporativo & Localização
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Abertura</span>
                    <span className="text-sm font-bold text-slate-800">{ficha.data_abertura || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Capital Social</span>
                    <span className="text-sm font-mono font-black text-slate-800">{formatarMoeda(ficha.capital_social || dadosEmpresa.capital_social)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Porte</span>
                    <span className="text-sm font-bold text-slate-800">{ficha.porteEmpresa || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Telefone Base</span>
                    <span className="text-sm font-mono font-bold text-slate-800">{ficha.telefones || '-'}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5 w-16 shrink-0">CNAE:</span>
                    <span className="text-xs font-bold text-slate-700 leading-relaxed uppercase">{ficha.atividade_economica || 'Não informado'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5 w-16 shrink-0">Sede:</span>
                    <span className="text-xs font-bold text-slate-700 leading-relaxed uppercase">
                      {ficha.enderecos && ficha.enderecos.length > 0 
                        ? `${ficha.enderecos[0].logradouro}, ${ficha.enderecos[0].numero} ${ficha.enderecos[0].complemento ? `- ${ficha.enderecos[0].complemento}` : ''} - ${ficha.enderecos[0].bairro}, ${ficha.enderecos[0].municipio} / ${ficha.enderecos[0].uf}`
                        : 'Não informado'}
                    </span>
                  </div>
                </div>
              </section>

              {/* 2. QUADRO SOCIETÁRIO */}
              <section>
                <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide flex items-center gap-3 border-b-2 border-slate-100 pb-2 mb-6">
                  <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                  2. Quadro de Administradores e Sócios (QSA)
                </h2>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Nome do Sócio / Administrador</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Qualificação</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Documento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ficha.socios && ficha.socios.length > 0 ? (
                        ficha.socios.map((socio: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-xs font-bold text-slate-800 uppercase">{socio.nome}</td>
                            <td className="p-3 text-[11px] font-bold text-slate-500 uppercase">{socio.qualificacao || 'Sócio'}</td>
                            <td className="p-3 text-xs font-mono font-black text-slate-400 text-right">{socio.documento || socio.cpf || '***'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} className="p-6 text-center text-slate-400 font-bold italic text-xs">Nenhum sócio mapeado na base.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 3. FINANCEIRO & BUREAU */}
              <section>
                <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide flex items-center gap-3 border-b-2 border-slate-100 pb-2 mb-6">
                  <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                  3. Restritivos Financeiros (Serasa / Boa Vista)
                </h2>

                {dadosFinanceiros?.erro ? (
                  <div className="p-4 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl border border-rose-200">❌ {dadosFinanceiros.mensagem}</div>
                ) : resumo ? (
                  <div className="space-y-6">
                    {/* Resumo Caixas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Status Bureau</span>
                        <span className={`inline-block self-start px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-sm ${resumo.possui_apontamento ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {resumo.possui_apontamento ? "🔴 Pendências Localizadas" : "🟢 Nada Consta"}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Dívidas Vencidas</span>
                        <span className="text-2xl font-mono font-black text-slate-800">{resumo.quantidade_dividas}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Montante Devedor</span>
                        <span className="text-xl font-mono font-black text-rose-600">{formatarMoeda(resumo.valor_total_dividas)}</span>
                      </div>
                    </div>

                    {/* Tabela de Credores */}
                    {resumo.pefin_serasa?.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Agente Credor Original</th>
                              <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Data Ref.</th>
                              <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Valor Atrasado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {resumo.pefin_serasa.map((div: any, i: number) => (
                              <tr key={i} className="bg-rose-50/20 hover:bg-rose-50/50 transition-colors">
                                <td className="p-3 text-xs font-bold text-slate-800 uppercase">{div.credor}</td>
                                <td className="p-3 text-[11px] font-mono text-slate-500 text-center">{div.vencimento || '-'}</td>
                                <td className="p-3 text-sm font-mono font-black text-rose-600 text-right">{formatarMoeda(div.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-slate-400 font-bold italic text-xs">Carregando dados financeiros...</div>
                )}
              </section>

              {/* 4. DATAJUD */}
              <section>
                <div className="flex justify-between items-end border-b-2 border-slate-100 pb-2 mb-6">
                  <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide flex items-center gap-3">
                    <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                    4. Base Jurídica Nacional (DataJud / CNJ)
                  </h2>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2.5 py-1 rounded-md border border-slate-200 uppercase tracking-wider mb-1">
                    {processosEncontrados.length} Registros
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider w-40">Nº Processo</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Classe Judicial</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Tribunal</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Classificação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {processosEncontrados.map((proc, idx) => {
                        const avaliacao = avaliarRiscoProcesso(proc.classe);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-[11px] font-mono font-bold text-slate-900 select-all">{proc.numero}</td>
                            <td className="p-3 text-[11px] font-bold text-slate-600 uppercase max-w-[250px] truncate" title={proc.classe}>{proc.classe}</td>
                            <td className="p-3 text-[10px] font-black text-slate-400 uppercase">{proc.tribunal}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-sm ${avaliacao.cor}`}>
                                {avaliacao.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {processosEncontrados.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic text-xs">Nenhum litígio pendente mapeado nos tribunais unificados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* JSON DEBUG AREA */}
              <div className="pt-6 border-t border-slate-100 text-center">
                <button onClick={() => setMostrarJsonBruto(!mostrarJsonBruto)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase transition-colors tracking-widest">
                  {mostrarJsonBruto ? "Ocultar Estrutura JSON" : "🔍 Modo Desenvolvedor: Exibir JSON da API"}
                </button>
                {mostrarJsonBruto && dadosFinanceiros && (
                  <div className="mt-4 bg-slate-900 rounded-xl p-6 overflow-auto max-h-96 text-left shadow-inner text-left">
                    <pre className="text-[11px] text-emerald-400 font-mono">
                      {JSON.stringify(dadosFinanceiros.raw_completo || dadosFinanceiros, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 📚 TABELA DE HISTÓRICO DE CONSULTAS */}
        {/* ========================================================= */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-8">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex justify-between items-center">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">📚 Histórico de Consultas (Últimas 10)</h3>
            <button onClick={carregarHistorico} className="text-blue-600 hover:text-blue-800 text-[11px] uppercase tracking-wider font-black flex items-center gap-1 transition-colors">
              🔄 Atualizar
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Data / Hora</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">CNPJ</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Empresa (Lead)</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Processos</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Risco</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.length > 0 ? (
                  historico.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-[11px] text-slate-500 font-mono">{formatarData(item.criado_em)}</td>
                      <td className="p-4 text-xs font-mono font-bold text-slate-900">{item.documento_alvo}</td>
                      <td className="p-4 text-[11px] font-bold text-slate-700 uppercase truncate max-w-[200px]" title={item.nome_empresa_lead}>{item.nome_empresa_lead}</td>
                      <td className="p-4 text-center font-bold text-slate-600 text-xs">{item.total_processos_encontrados}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${getCorRiscoGeral(item.nivel_risco)}`}>
                          {item.nivel_risco || "N/D"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => carregarFotoDaConsulta(item)}
                          className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-black rounded-lg text-[10px] uppercase tracking-wider transition-all shadow-sm mx-auto"
                        >
                          👁️ Exibir Dossiê
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold italic text-xs">Nenhuma consulta registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}