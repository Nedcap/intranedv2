/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PreAnalisePage() {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  
  // 🗂️ Estados de Dados (A Tríade)
  const [dadosEmpresa, setDadosEmpresa] = useState<any>(null);
  const [processosEncontrados, setProcessosEncontrados] = useState<any[]>([]);
  const [dadosFinanceiros, setDadosFinanceiros] = useState<any>(null);

  // Função auxiliar movida para fora do try/catch para ser usada no cálculo pré-salvamento
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

      // 2. ⚖️ BATE NO DATAJUD (CNJ) EM PARALELO
      const reqProcessos = fetch("/api/credito/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: documentoLimpo })
      });

      // 3. 💳 BATE NO CREDITHUB (iCheques) EM PARALELO
      const reqFinanceiro = fetch("/api/credito/restritivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: documentoLimpo })
      });

      // Aguarda as duas requisições terminarem juntas
      const [resProcessos, resFinanceiro] = await Promise.all([reqProcessos, reqFinanceiro]);

      let processos = [];
      if (resProcessos.ok) {
        const dataProc = await resProcessos.json();
        processos = dataProc.processos || [];
      }

      let financeiro = null;
      if (resFinanceiro.ok) {
        financeiro = await resFinanceiro.json();
      } else {
        // 🔥 AQUI ESTÁ O PULO DO GATO: Tenta ler o erro formatado pelo nosso backend
        const errData = await resFinanceiro.json().catch(() => ({}));
        financeiro = { 
          erro: true, 
          mensagem: errData.error || "Falha de conexão com o CreditHub." 
        };
      }

      // =========================================================================
      // 🔥 SALVAMENTO AUTOMÁTICO (GRAVA O LOG DE AUDITORIA E RISCO NO SUPABASE)
      // =========================================================================
      
      // Calcula o risco instantaneamente
      let nivelRiscoGeral = "BAIXO";
      let pesoTotal = 0;
      processos.forEach(p => pesoTotal += avaliarRiscoProcesso(p.classe).peso);
      
      if (pesoTotal >= 10 || processos.some(p => avaliarRiscoProcesso(p.classe).peso === 3)) {
        nivelRiscoGeral = "ALTO";
      } else if (pesoTotal >= 4) {
        nivelRiscoGeral = "MEDIO";
      }

      if (financeiro?.possui_apontamento) {
        nivelRiscoGeral = "ALTO";
      }

      const userStr = localStorage.getItem("intraned_user");
      const localUser = userStr ? JSON.parse(userStr) : null;

      // Dispara o insert silenciosamente
      const { error: insertError } = await supabase.from("pre_analises").insert({
        documento_alvo: dataBq.empresa.cnpj,
        nome_empresa_lead: dataBq.empresa.razao_social,
        comercial_responsavel: localUser?.nome || "Comercial Padrão",
        total_processos_encontrados: processos.length,
        nivel_risco: nivelRiscoGeral,
        dados_processos: processos
      });

      if (insertError) {
        console.error("⚠️ Erro ao registrar log de consulta no banco:", insertError);
      }

      // =========================================================================
      // ATUALIZA A TELA COM OS DADOS QUE FORAM SALVOS
      // =========================================================================
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

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // Botão apenas faz o redirecionamento (o filtro pesado entrará aqui depois)
  const enviarParaMesa = () => {
    if (dadosEmpresa) {
      router.push(`/dashboard/motor-credito/envio-analise?cnpj=${dadosEmpresa.cnpj.replace(/\D/g, "")}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans antialiased text-[13px]">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase shadow-sm">
                Filtro de Risco
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              🚦 Pré-Análise de Viabilidade
            </h2>
            <span className="text-xs text-slate-500 font-medium">O log de pesquisa é armazenado automaticamente.</span>
          </div>
        </div>

        {/* BARRA DE PESQUISA */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <form onSubmit={executarPreAnalise} className="flex flex-col sm:flex-row gap-3 pl-2">
            <input 
              type="text"
              required
              placeholder="Digite o CNPJ..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 p-3.5 border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none rounded-xl font-bold text-slate-800 text-sm shadow-inner uppercase tracking-wider max-w-md font-mono"
            />
            <button
              type="submit"
              disabled={carregando}
              className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-md cursor-pointer"
            >
              {carregando ? "⏳ Extraindo e Gravando Log..." : "🚦 Extrair Raio-X"}
            </button>
          </form>
        </div>

        {/* CONTEÚDO DA PRÉ-ANÁLISE */}
        {dadosEmpresa && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in slide-in-from-bottom-2">
            
            {/* COLUNA ESQUERDA: CADASTRO E FINANCEIRO */}
            <div className="space-y-6">
              
              {/* PAINEL CADASTRO (BIGQUERY) */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">🏢</div>
                <div className="border-b border-slate-100 pb-3 relative z-10">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Base Receita Federal</span>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-1">{dadosEmpresa.razao_social}</h3>
                  <p className="text-slate-500 font-mono text-xs mt-1 font-bold">{dadosEmpresa.cnpj}</p>
                  <p className="text-slate-500 font-medium text-[11px] mt-2 uppercase flex items-center gap-1.5">
                    Situação: 
                    <span className={`font-bold px-2 py-0.5 rounded ${dadosEmpresa.situacao === 'ATIVA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {dadosEmpresa.situacao}
                    </span>
                  </p>
                </div>
              </div>

              {/* PAINEL FINANCEIRO (CREDITHUB) */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">💳</div>
                <div className="border-b border-slate-100 pb-3 relative z-10 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Bureau (CreditHub)</span>
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mt-1">Risco Financeiro</h3>
                  </div>
                  {dadosFinanceiros && !dadosFinanceiros.erro && (
                    <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-sm ${dadosFinanceiros.possui_apontamento ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {dadosFinanceiros.possui_apontamento ? "🔴 Apontamentos" : "🟢 Nada Consta"}
                    </span>
                  )}
                </div>

                {dadosFinanceiros ? (
                  dadosFinanceiros.erro ? (
                    <div className="p-4 bg-rose-50 text-center text-rose-600 font-bold italic text-xs rounded-lg border border-dashed border-rose-300">
                      ❌ Erro na API: {dadosFinanceiros.mensagem}
                    </div>
                  ) : (
                    <div className="space-y-3 relative z-10">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-600 uppercase">Dívidas / Pendências</span>
                        <span className="font-mono font-black text-slate-900">{dadosFinanceiros.quantidade_dividas || 0} ocorrências</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-600 uppercase">Valor Total (R$)</span>
                        <span className="font-mono font-black text-rose-600">{formatarMoeda(dadosFinanceiros.valor_total_dividas || 0)}</span>
                      </div>
                      {dadosFinanceiros.ccf && (
                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                          ⚠️ Alerta: Registro de Cheques sem Fundo (CCF) localizado.
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="p-4 bg-slate-50 text-center text-slate-400 font-bold italic text-xs rounded-lg border border-dashed border-slate-300">
                    Aguardando varredura financeira...
                  </div>
                )}
              </div>

              {/* BOTAO DE LARGADA */}
              <div className="pt-2">
                <button
                  onClick={enviarParaMesa}
                  disabled={dadosEmpresa.situacao !== 'ATIVA'}
                  className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  ✅ Enviar para Mesa de Crédito
                </button>
              </div>

            </div>

            {/* COLUNA DIREITA: PROCESSOS (DATAJUD) */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[720px]">
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center shrink-0">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">⚖️ Histórico Clínico de Litígios (DataJud)</h3>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2.5 py-1 rounded-md shadow-sm border border-indigo-200">
                  {processosEncontrados.length} Processos
                </span>
              </div>

              <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse text-[12px] min-w-[600px]">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 shadow-sm z-10">
                    <tr className="text-slate-500 font-black uppercase text-[10px] tracking-wider h-11">
                      <th className="p-4 w-48">Nº Processo (CNJ)</th>
                      <th className="p-4">Classe Processual</th>
                      <th className="p-4 w-32">Tribunal</th>
                      <th className="p-4 text-center w-28">Alerta Risco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {processosEncontrados.map((proc, idx) => {
                      const avaliacao = avaliarRiscoProcesso(proc.classe);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-900 select-all text-[11px]">{proc.numero}</td>
                          <td className="p-4 uppercase font-bold text-slate-600 text-[11px] truncate max-w-[200px]" title={proc.classe}>{proc.classe}</td>
                          <td className="p-4 font-black text-slate-400 uppercase text-[10px]">{proc.tribunal}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-xs ${avaliacao.cor}`}>
                              {avaliacao.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {processosEncontrados.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-400 font-bold italic bg-slate-50/50">
                          Nenhum registro pendente localizado na base pública do CNJ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}