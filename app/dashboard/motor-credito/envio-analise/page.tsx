"use client";

import { useState, useEffect } from "react";
import UploadDocs from "@/components/UploadDocs";
import { supabase } from "@/lib/supabase";

interface Empresa {
  cnpj: string;
  razao_social: string;
  uf: string;
  cidadeExtenso?: string;
  capital_social?: number;
}

interface FilaItem {
  id: string;
  razao_social: string;
  cnpj: string;
  status: string;
}

export default function MotorCreditoPage() {
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [filaReal, setFilaReal] = useState<FilaItem[]>([]);

  useEffect(() => {
    carregarFilaComercial();
  }, []);

  const carregarFilaComercial = async () => {
    try {
      const { data, error } = await supabase
        .from("analises_credito")
        .select("id, razao_social, cnpj, status")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      if (data) setFilaReal(data);
    } catch (err) {
      console.error("Erro ao carregar esteira:", err);
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
      const res = await fetch("/api/prospeccao-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptUsuario: cnpjLimpo, limite: 1 }),
      });
      const data = await res.json();
      
      if (data.leads && data.leads.length > 0) {
        setEmpresas(data.leads);
      } else {
        alert("❌ Nenhuma empresa ativa localizada com este CNPJ na base da Receita.");
        setEmpresas([]);
      }
    } catch (err) {
      console.error("Erro ao buscar CNPJ:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatarCnpj = (cnpj: string) => {
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

  const resetarAposSucesso = () => {
    setEmpresaSelecionada(null);
    setEmpresas([]);
    setCnpjBusca("");
    carregarFilaComercial();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6 font-sans antialiased text-[13px]">
      <div className="max-w-[1700px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase animate-pulse">
                Cloudflare R2 Active
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase">
                Receita Federal Sync
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-1.5 flex items-center gap-2">
              🚀 Motor de Análise de Crédito <span className="text-indigo-600">Esteira V8</span>
            </h1>
          </div>
        </div>

        {/* BOX DE SOLICITAÇÃO ESTREITA POR CNPJ COM BOTÃO E INPUTS VOLTADOS */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 transition-all"></div>
          
          {!empresaSelecionada ? (
            <form onSubmit={handleBuscarPorCnpj} className="space-y-4">
              <div>
                <label className="block font-black text-slate-500 uppercase text-[10px] tracking-widest mb-2">
                  Buscar Empresa por CNPJ Oficial (Apenas Números)
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

              {/* RETORNO DA CONSULTA DO CNPJ COM CABEÇALHOS CORRETOS */}
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
            /* LOCK DA EMPRESA + CONTAINER DO COFRE DE UPLOAD REATIVADO */
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
                <UploadDocs empresa={empresaSelecionada} onSucesso={resetarAposSucesso} />
              </div>
            </div>
          )}
        </div>

        {/* TABELA DE STATUS DO COMERCIAL INTEGRA COM CABEÇALHOS DO PROJETO */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <span className="font-black text-slate-700 uppercase tracking-widest text-[11px] flex items-center gap-2">
              📊 Status do Fluxo da Equipe Comercial ({filaReal.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                  <th className="p-3.5">Razão Social da Empresa</th>
                  <th className="p-3.5">CNPJ Oficial</th>
                  <th className="p-3.5">Estágio Atual</th>
                  <th className="p-3.5 text-center">Painel Detalhado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {filaReal.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-bold bg-slate-50/50">
                      Nenhuma análise em andamento na esteira comercial por enquanto.
                    </td>
                  </tr>
                ) : (
                  filaReal.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-black text-slate-900 uppercase truncate max-w-[300px]">{item.razao_social}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-600">{formatarCnpj(item.cnpj)}</td>
                      <td className="p-3.5">
                        {item.status === "robo_processando" ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider animate-pulse">
                            🤖 Robô Extraindo Dados
                          </span>
                        ) : item.status === "em_revisao_humana" ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                            🕵️ Em Auditoria de Risco
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                            {item.status.toUpperCase().replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          disabled={true}
                          className="bg-slate-100 text-slate-400 border border-slate-200 font-bold px-3 py-1 rounded text-[11px] cursor-not-allowed flex items-center gap-1 mx-auto"
                        >
                          🔒 Restrito Admin
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}