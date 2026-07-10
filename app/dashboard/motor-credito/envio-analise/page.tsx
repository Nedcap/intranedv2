"use client";

import { useState, useEffect } from "react";
import UploadDocs from "@/components/UploadDocs";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Empresa {
  cnpj: string;
  razao_social: string;
  uf: string;
  cidadeExtenso?: string;
  capital_social?: number;
}

interface FilaItem {
  id: string;
  empresa_nome: string;
  cnpj: string;
  status: string;
  criado_em: string;
  ia_inicio?: string;
  ia_fim?: string;
  status_comite?: string;
}

export default function MotorCreditoPage() {
  const router = useRouter();
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusTexto, setStatusTexto] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [filaReal, setFilaReal] = useState<FilaItem[]>([]);

  useEffect(() => {
    carregarFilaComercial();
  }, []);

  const carregarFilaComercial = async () => {
    try {
      // 📊 Busca na tabela 'analises' incluindo as novas colunas de IA
      // Não precisamos colocar filtro de .eq() aqui, o RLS do Supabase vai fazer isso automaticamente!
      const { data, error } = await supabase
        .from("analises")
        .select("id, empresa_nome, cnpj, status, criado_em, ia_inicio, ia_fim, status_comite")
        .in("status", ["aberta", "aprovado", "reprovado", "aguardando_docs", "em_revisao_humana"])
        .order("criado_em", { ascending: false });

      if (error) throw error;
      if (data) setFilaReal(data as any);
    } catch (err) {
      console.error("Erro ao carregar esteira comercial:", err);
    }
  };

  const handleBuscarPorCnpj = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjLimpo = cnpjBusca.replace(/\D/g, "");
    if (cnpjLimpo.length < 14) {
      alert("⚠️ Digite um CNPJ completo com 14 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/buscar-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpjLimpo }),
      });
      
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (data.found && data.empresa) {
        setEmpresas([data.empresa]);
      } else {
        alert("❌ CNPJ não localizado na base oficial.\n💡 Liberando modo de entrada manual.");
        setEmpresas([{
          cnpj: cnpjLimpo,
          razao_social: "EMPRESA DIGITADA MANUALMENTE",
          uf: "PR",
          cidadeExtenso: "Curitiba",
          capital_social: 0
        }]);
      }
    } catch (err: any) {
      console.error("Erro ao buscar CNPJ:", err);
      alert("❌ Falha na conexão: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const registrarAnaliseNoSupabase = async (urlsDocumentos: string[]) => {
    if (!empresaSelecionada) return;

    setLoading(true);
    setStatusTexto("🤖 Registrando lote de entrada na mesa...");
    try {
      // 🎯 1. PEGA O USUÁRIO LOGADO ANTES DE SALVAR NO BANCO
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("Usuário não autenticado. Faça login novamente.");
      }

      const cnpjLimpo = empresaSelecionada.cnpj.replace(/\D/g, "");

      const { data: novaAnalise, error } = await supabase
        .from("analises")
        .insert({
          cnpj: cnpjLimpo,
          empresa_nome: empresaSelecionada.razao_social.toUpperCase(),
          caminho_local: "Upload via Motor V8 / R2",
          status: "em_revisao_humana", 
          status_comite: "pendente",
          ia_inicio: new Date().toISOString(),
          
          // 🎯 2. VINCULA A ANÁLISE AO USUÁRIO QUE A ENVIOU
          responsavel_id: user.id,

          dados_documentos: urlsDocumentos,
          dados_consolidados: {
            uf: empresaSelecionada.uf || "PR",
            cidade: empresaSelecionada.cidadeExtenso || "Curitiba",
            capital_social: empresaSelecionada.capital_social || 0,
            dados_gerais: { fundacao: "", ramo: "", site: "", relacionamento: "Prospect", gerente: "" },
            proposta: { modalidade: "Desconto", limite: 50000, prazo: 30, tranche: 10000, taxa: 0.04, garantia: "Aval", rating: "C" },
            dados_faturamento: { "2024": {}, "2025": {}, "2026": {} },
            dados_potencial: { ticket_medio: 0, prazo_medio_vendas: 0, vending_prazo_perc: 100 },
            dados_endividamento_resumo: { curto_prazo: 0, longo_prazo: 0 },
            endividamento_detalhado: [],
            restritivos: [],
            socios: [],
            anexos: { organograma_url: "", fachada_url: "" },
            parecer_comite: ""
          }
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Este CNPJ já possui uma análise ativa ou cadastrada na mesa!");
        }
        throw error;
      }

      if (novaAnalise && urlsDocumentos.length > 0) {
        setStatusTexto("🔮 Robô V8 lendo e estruturando dados em background...");
        
        const resIA = await fetch("/api/motor-ia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analise_id: novaAnalise.id,
            urls_documentos: urlsDocumentos
          })
        });

        if (!resIA.ok) {
          console.error("Aviso: Falha na resposta imediata da IA.");
        }
      }

      alert("🚀 Empresa enviada! O Motor V8 assumiu o processamento inteligente.");
      setEmpresaSelecionada(null);
      setEmpresas([]);
      setCnpjBusca("");
      await carregarFilaComercial();

    } catch (err: any) {
      console.error("Erro ao inserir na tabela analises:", err);
      alert("⚠️ Erro ao registrar na esteira: " + err.message);
    } finally {
      setLoading(false);
      setStatusTexto("");
    }
  };

  const formatarCnpj = (cnpj: string) => {
    if (!cnpj) return "";
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) return cnpj;
    return `${limpo.substring(0, 2)}.${limpo.substring(2, 5)}.${limpo.substring(5, 8)}/${limpo.substring(8, 12)}-${limpo.substring(12, 14)}`;
  };

  const aplicarMascaraCnpj = (val: string) => {
    const limpo = val.replace(/\D/g, "").substring(0, 14);
    let masc = limpo;
    if (limpo.length > 2) masc = `${limpo.substring(0, 2)}.${limpo.substring(2)}`;
    if (limpo.length > 5) masc = `${masc.substring(0, 6)}.${masc.substring(6)}`;
    if (limpo.length > 8) masc = `${masc.substring(0, 10)}/${masc.substring(10)}`;
    if (limpo.length > 12) masc = `${masc.substring(0, 15)}-${masc.substring(15)}`;
    setCnpjBusca(masc);
  };

  const formatarDataHora = (isoString?: string) => {
    if (!isoString) return "---";
    const data = new Date(isoString);
    return data.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        {statusTexto && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex flex-col items-center justify-center font-bold text-white text-sm gap-2">
            <span className="animate-spin text-xl">⚡</span>
            {statusTexto}
          </div>
        )}

        {/* HEADER */}
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
                Cloudflare R2 Active
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
                Mesa V8 Síncrona
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-1.5 flex items-center gap-2">
              🚀 Motor de Análise de Crédito <span className="text-indigo-600">Esteira V8</span>
            </h1>
          </div>
        </div>

        {/* BOX DE SOLICITAÇÃO POR CNPJ */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 transition-all"></div>
          
          {!empresaSelecionada ? (
            <form onSubmit={handleBuscarPorCnpj} className="space-y-4">
              <div>
                <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-2">
                  Buscar Empresa por CNPJ Oficial
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cnpjBusca}
                    onChange={(e) => aplicarMascaraCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all max-w-[300px]"
                  />
                  <button
                    type="submit"
                    disabled={loading || cnpjBusca.replace(/\D/g, "").length < 14}
                    className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-40 shadow-md cursor-pointer"
                  >
                    {loading ? "Verificando..." : "Verificar CNPJ"}
                  </button>
                </div>
              </div>

              {empresas.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-slate-50 overflow-hidden mt-3 max-w-[600px]">
                  {empresas.map((emp) => (
                    <div
                      key={emp.cnpj}
                      className="p-4 flex justify-between items-center bg-slate-50 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      onClick={() => setEmpresaSelecionada(emp)}
                    >
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase">{emp.razao_social}</p>
                        <p className="text-[11px] font-mono font-bold text-slate-500 mt-1">
                          CNPJ: {formatarCnpj(emp.cnpj)} — {emp.cidadeExtenso || "MATRIZ"}/{emp.uf.toUpperCase()}
                        </p>
                      </div>
                      <span className="text-[10px] bg-indigo-600 text-white font-black uppercase tracking-wider px-3 py-1.5 rounded-md shadow-sm">
                        Confirmar & Avançar
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 border border-emerald-200 bg-emerald-50/40 rounded-lg flex justify-between items-center">
                <div>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md block w-max mb-1">
                    CNPJ Vinculado à Mesa de Crédito
                  </span>
                  <h3 className="text-sm font-black text-slate-900 uppercase leading-none">{empresaSelecionada.razao_social}</h3>
                  <span className="font-mono font-bold text-slate-500 text-xs mt-1 block">{formatarCnpj(empresaSelecionada.cnpj)}</span>
                </div>
                <button
                  onClick={() => { setEmpresaSelecionada(null); setEmpresas([]); setCnpjBusca(""); }}
                  className="bg-white border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 text-[11px] shadow-sm cursor-pointer"
                >
                  ✕ Mudar CNPJ
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-inner">
                <UploadDocs empresa={empresaSelecionada as any} onSucesso={registrarAnaliseNoSupabase} />
              </div>
            </div>
          )}
        </div>

        {/* TABELA DE RETORNO DO COMERCIAL */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <span className="font-black text-slate-700 uppercase tracking-widest text-[11px]">
              📊 Retorno da Mesa de Risco ({filaReal.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                  <th className="p-3.5">Empresa</th>
                  <th className="p-3.5 text-center">Início IA</th>
                  <th className="p-3.5 text-center">Fim IA</th>
                  <th className="p-3.5 text-center">Decisão Crédito</th>
                  <th className="p-3.5 text-center">Decisão Comitê</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {filaReal.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold bg-slate-50/50">
                      Nenhum resultado processado pela mesa no momento.
                    </td>
                  </tr>
                ) : (
                  filaReal.map((item) => {
                    const statusComite = item.status_comite?.toLowerCase() || "pendente";
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <p className="font-black text-slate-900 uppercase truncate max-w-[250px]">{item.empresa_nome}</p>
                          <p className="font-mono font-bold text-slate-500 text-[10px] mt-0.5">{formatarCnpj(item.cnpj)}</p>
                        </td>
                        
                        <td className="p-3.5 text-center font-mono text-slate-500 font-bold">
                          {item.ia_inicio ? formatarDataHora(item.ia_inicio) : "---"}
                        </td>
                        
                        <td className="p-3.5 text-center font-mono text-slate-500 font-bold">
                          {item.ia_fim 
                            ? formatarDataHora(item.ia_fim) 
                            : item.ia_inicio 
                              ? <span className="text-indigo-400 italic">⏳ Processando...</span>
                              : "---"}
                        </td>
                        
                        <td className="p-3.5 text-center">
                          {item.status === "aberta" ? (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                              📄 Aberta
                            </span>
                          ) : item.status === "aguardando_docs" ? (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                              📥 Devolvido
                            </span>
                          ) : item.status === "em_revisao_humana" ? (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider animate-pulse">
                              🔮 Mesa Risco
                            </span>
                          ) : item.status === "aprovado" ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                              ✅ Aprovado
                            </span>
                          ) : item.status === "reprovado" ? (
                            <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                              ❌ Reprovado
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                              {item.status}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {statusComite === "aprovado" ? (
                            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider shadow-sm">
                              🟢 Aprovado
                            </span>
                          ) : statusComite === "reprovado" ? (
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider shadow-sm">
                              🔴 Reprovado
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                              🟡 Pendente
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => router.push(`/dashboard/motor-credito/analise?id=${item.id}`)}
                            className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-black px-3 py-1 rounded text-[11px] flex items-center gap-1 mx-auto shadow-sm cursor-pointer transition-all"
                          >
                            👁️ Ver Parecer
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}