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
    if (data) setHistorico(data);
  };

  const avaliarRiscoProcesso = (classe: string) => {
    const c = classe.toLowerCase();
    if (c.includes("falência") || c.includes("recuperação") || c.includes("execução fiscal")) return { cor: "bg-red-500 text-white", label: "🚨 Alto Risco", peso: 3 };
    if (c.includes("trabalhista") || c.includes("execução")) return { cor: "bg-amber-500 text-white", label: "⚠️ Médio", peso: 2 };
    return { cor: "bg-emerald-500 text-white", label: "🟢 Baixo", peso: 1 };
  };

  const executarPreAnalise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busca.trim()) return;

    try {
      setCarregando(true);
      setProcessosEncontrados([]);
      setDadosEmpresa(null);
      setDadosFinanceiros(null);
      setMostrarJsonBruto(false);

      const documentoLimpo = busca.replace(/\D/g, "");

      // 1. 🔍 BATE NO BIGQUERY (Receita Federal)
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

      // 2. 💳 BATE NO CREDITHUB (UNIFICADO: Traz Serasa, QSA e Processos de uma vez só!)
      const resCreditHub = await fetch("/api/restritivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: documentoLimpo })
      });

      let financeiro = null;
      let processos = [];

      if (resCreditHub.ok) {
        financeiro = await resCreditHub.json();
        processos = financeiro.processos || []; // 🔥 Puxa os processos direto da mesma resposta!
      } else {
        const errData = await resCreditHub.json().catch(() => ({}));
        financeiro = { erro: true, mensagem: errData.details || errData.error || "Falha de conexão com o CreditHub." };
      }

      // Cálculo do Risco
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

      const { error: insertError } = await supabase.from("pre_analises").insert({
        documento_alvo: dataBq.empresa.cnpj,
        nome_empresa_lead: dataBq.empresa.razao_social,
        comercial_responsavel: localUser?.nome || "Comercial Padrão",
        total_processos_encontrados: processos.length,
        nivel_risco: nivelRiscoGeral,
        dados_processos: processos
      });

      if (!insertError) carregarHistorico();

      setDadosEmpresa({
        razao_social: dataBq.empresa.razao_social,
        cnpj: dataBq.empresa.cnpj,
        capital_social: dataBq.empresa.capital_social,
        situacao: dataBq.empresa.situacao_cadastral,
      });
      setProcessosEncontrados(processos);
      setDadosFinanceiros(financeiro);

    } catch (err) {
      console.error(err);
      alert("Erro crítico ao rodar motores de pré-análise.");
    } finally {
      setCarregando(false);
    }
  };

  const formatarMoeda = (valor: number | string) => {
    const v = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(v)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const enviarParaMesa = () => {
    if (dadosEmpresa) {
      router.push(`/dashboard/motor-credito/envio-analise?cnpj=${dadosEmpresa.cnpj.replace(/\D/g, "")}`);
    }
  };

  // Variáveis de atalho para os dados ricos da API
  const resumo = dadosFinanceiros?.resumo;
  const ficha = dadosFinanceiros?.ficha_cadastral || {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans antialiased text-[13px]">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              🚦 Pré-Análise de Viabilidade Profunda
            </h2>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <form onSubmit={executarPreAnalise} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" required placeholder="Digite o CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)}
              className="flex-1 p-3.5 border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none rounded-xl font-bold text-slate-800 text-sm shadow-inner max-w-md font-mono"
            />
            <button type="submit" disabled={carregando} className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase transition-all disabled:opacity-50">
              {carregando ? "⏳ Extraindo Raio-X..." : "🚦 Extrair Raio-X"}
            </button>
          </form>
        </div>

        {/* CONTEÚDO DA PRÉ-ANÁLISE ATUAL */}
        {dadosEmpresa && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-in fade-in">
            
            {/* COLUNA ESQUERDA (DADOS CADASTRAIS RICOS) */}
            <div className="space-y-6 xl:col-span-1">
              
              {/* FICHA GERAL */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Identidade Corporativa</span>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-1 leading-tight">{dadosEmpresa.razao_social}</h3>
                  <p className="text-slate-500 font-mono text-xs mt-1 font-bold">{dadosEmpresa.cnpj}</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Situação RFB</span>
                    <span className={`font-black text-[10px] px-2 py-0.5 rounded uppercase ${dadosEmpresa.situacao === 'ATIVA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {dadosEmpresa.situacao}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Idade / Abertura</span>
                    <span className="font-bold text-xs text-slate-700">{ficha.idadeEmpresa ? `${ficha.idadeEmpresa} anos` : '-'} ({ficha.dataAbertura || '-'})</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Capital Social</span>
                    <span className="font-bold text-xs text-slate-700">{formatarMoeda(ficha.capitalSocial || dadosEmpresa.capital_social)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Porte</span>
                    <span className="font-bold text-xs text-slate-700">{ficha.porteEmpresa || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">CNAE Principal</span>
                    <span className="font-bold text-[11px] text-slate-700 leading-tight block bg-slate-50 p-2 rounded">{ficha.cnae} - {ficha.cnaeDescricao || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* CONTATOS E LOCALIZAÇÃO */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 pb-2 block">Localização & Contato</span>
                
                {ficha.enderecos && ficha.enderecos.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg text-xs font-medium text-slate-600 border border-slate-100">
                    📍 {ficha.enderecos[0].logradouro}, {ficha.enderecos[0].numero} - {ficha.enderecos[0].bairro}, {ficha.enderecos[0].cidade} / {ficha.enderecos[0].uf}
                  </div>
                )}
                
                {ficha.telefones && ficha.telefones.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ficha.telefones.slice(0, 3).map((tel: any, i: number) => (
                      <span key={i} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono">📞 {tel.numero || tel}</span>
                    ))}
                  </div>
                )}
                
                {ficha.emails && ficha.emails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ficha.emails.slice(0, 2).map((email: any, i: number) => (
                      <span key={i} className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-bold">✉️ {email.endereco || email}</span>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={enviarParaMesa} disabled={dadosEmpresa.situacao !== 'ATIVA'} className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase transition-all disabled:opacity-50 shadow-lg">
                ✅ Avançar p/ Mesa de Crédito
              </button>
            </div>

            {/* COLUNA CENTRAL E DIREITA (FINANCEIRO + QSA + PROCESSOS) */}
            <div className="xl:col-span-2 space-y-6 flex flex-col">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PAINEL FINANCEIRO */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col">
                  <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Risco Serasa / Bureau</span>
                    {resumo && (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${resumo.possui_apontamento ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {resumo.possui_apontamento ? "🔴 Pendências" : "🟢 Nada Consta"}
                      </span>
                    )}
                  </div>

                  {dadosFinanceiros?.erro ? (
                    <div className="p-4 bg-rose-50 text-rose-600 font-bold text-xs rounded border border-rose-300">❌ {dadosFinanceiros.mensagem}</div>
                  ) : resumo ? (
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-slate-50 rounded border border-slate-200">
                        <span className="text-xs font-bold text-slate-600">Dívidas Vencidas</span>
                        <span className="font-mono font-black text-slate-900">{resumo.quantidade_dividas}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded border border-slate-200">
                        <span className="text-xs font-bold text-slate-600">Valor Total (R$)</span>
                        <span className="font-mono font-black text-rose-600">{formatarMoeda(resumo.valor_total_dividas)}</span>
                      </div>
                      
                      {resumo.pefin_serasa?.length > 0 && (
                        <div className="mt-4">
                          <span className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Credores:</span>
                          <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                            {resumo.pefin_serasa.map((div: any, i: number) => (
                              <div key={i} className="flex justify-between bg-rose-50/50 p-2 border border-rose-100 rounded text-[10px]">
                                <span className="font-bold text-slate-700 truncate" title={div.credor}>{div.credor}</span>
                                <span className="font-mono font-black text-rose-600 whitespace-nowrap">R$ {div.valor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-3 text-right">
                        <button onClick={() => setMostrarJsonBruto(!mostrarJsonBruto)} className="text-[9px] font-bold text-indigo-500 uppercase">
                          {mostrarJsonBruto ? "Ocultar JSON Bruto" : "🔍 Ver JSON Completo da API"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-400 font-bold text-xs">Carregando bureau...</div>
                  )}
                </div>

                {/* PAINEL QUADRO SOCIETÁRIO (QSA) */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col">
                  <div className="border-b border-slate-100 pb-3 mb-4">
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Quadro Societário (QSA)</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto max-h-56 custom-scrollbar pr-1">
                    {ficha.quadroSocietario && ficha.quadroSocietario.length > 0 ? (
                      <div className="space-y-2">
                        {ficha.quadroSocietario.map((socio: any, i: number) => (
                          <div key={i} className="p-3 bg-amber-50/30 border border-amber-100 rounded-lg">
                            <span className="block text-xs font-black text-slate-800 uppercase">{socio.nome}</span>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{socio.qualificacao || 'Sócio'}</span>
                              <span className="text-[10px] font-mono text-slate-400">{socio.documento || socio.cpf || ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 font-bold italic text-xs">
                        Nenhum sócio mapeado na consulta.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* JSON DEBUG (Aparece embaixo dos dois cards se ativo) */}
              {mostrarJsonBruto && dadosFinanceiros && (
                 <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-96 custom-scrollbar shadow-inner">
                   <pre className="text-[11px] text-emerald-400 font-mono">
                     {JSON.stringify(dadosFinanceiros.raw_completo || dadosFinanceiros, null, 2)}
                   </pre>
                 </div>
              )}

              {/* PAINEL DATAJUD */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden min-h-[300px]">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center shrink-0">
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">⚖️ Histórico Clínico de Litígios (DataJud)</h3>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2.5 py-1 rounded-md border border-indigo-200">
                    {processosEncontrados.length} Processos
                  </span>
                </div>
                
                <div className="overflow-auto custom-scrollbar flex-1">
                  <table className="w-full text-left border-collapse text-[12px] min-w-[600px]">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 shadow-sm z-10">
                      <tr className="text-slate-500 font-black uppercase text-[10px] tracking-wider h-11">
                        <th className="p-4">Nº Processo</th>
                        <th className="p-4">Classe</th>
                        <th className="p-4">Tribunal</th>
                        <th className="p-4 text-center">Risco</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {processosEncontrados.map((proc, idx) => {
                        const avaliacao = avaliarRiscoProcesso(proc.classe);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-4 font-mono font-bold text-slate-900 text-[11px]">{proc.numero}</td>
                            <td className="p-4 uppercase font-bold text-slate-600 text-[11px] truncate max-w-[200px]" title={proc.classe}>{proc.classe}</td>
                            <td className="p-4 font-black text-slate-400 uppercase text-[10px]">{proc.tribunal}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded text-[9px] font-black uppercase ${avaliacao.cor}`}>{avaliacao.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {processosEncontrados.length === 0 && (
                        <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-bold italic">Nenhum processo localizado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}