"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

const formatarData = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatarHora = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const traduzirEvento = (tipo: string) => {
  const mapa: Record<string, string> = {
    "ENTRADA": "📥 Entrada",
    "SAIDA_ALMOCO": "🍔 Saída Almoço",
    "RETORNO_ALMOCO": "🔙 Retorno Almoço",
    "SAIDA": "🏠 Saída (Fim)"
  };
  return mapa[tipo] || tipo;
};

export default function GestaoPontoPage() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const [registroEmEdicao, setRegistroEmEdicao] = useState<any>(null);
  const [novaHora, setNovaHora] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const carregarRegistros = async () => {
    try {
      setCarregando(true);

      const { data: pontosData, error: errPonto } = await supabase
        .from("registro_ponto")
        .select("*")
        .order("data_hora", { ascending: false });

      if (errPonto) throw errPonto;

      // 🔥 BUSCA SÓ QUEM É CLT (bate_ponto = true)
      const { data: usersData, error: errUsers } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("bate_ponto", true);

      if (errUsers) throw errUsers;

      const mapUsuarios = new Map(usersData?.map(u => [u.id, u.nome]));
      
      // Filtra o histórico para mostrar apenas registros dos usuários habilitados no RH
      const mesclados = pontosData
        ?.filter(p => mapUsuarios.has(p.usuario_id))
        .map(p => ({
          ...p,
          nome_funcionario: mapUsuarios.get(p.usuario_id)
        })) || [];

      setRegistros(mesclados);
    } catch (error: any) {
      alert(`❌ Erro ao carregar gestão: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarRegistros();
  }, []);

  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => r.data_hora.startsWith(mesFiltro));
  }, [registros, mesFiltro]);

  const abrirModalEdicao = (reg: any) => {
    const d = new Date(reg.data_hora);
    const horaLocal = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setNovaHora(horaLocal);
    setRegistroEmEdicao(reg);
  };

  const salvarNovaHora = async () => {
    if (!registroEmEdicao || !novaHora) return;
    try {
      setSalvandoEdicao(true);
      
      const d = new Date(registroEmEdicao.data_hora);
      const [horas, minutos] = novaHora.split(":");
      d.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);

      const { error } = await supabase
        .from("registro_ponto")
        .update({ data_hora: d.toISOString() })
        .eq("id", registroEmEdicao.id);

      if (error) throw error;

      alert("✅ Horário corrigido com sucesso!");
      setRegistroEmEdicao(null);
      carregarRegistros();
    } catch (err: any) {
      alert(`❌ Erro ao atualizar hora: ${err.message}`);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const exportarCSVConsolidado = () => {
    if (registrosFiltrados.length === 0) return alert("Nenhum registro para exportar nesse mês.");

    const diasAgrupados: Record<string, any> = {};

    const arrayOrdenado = [...registrosFiltrados].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

    arrayOrdenado.forEach(r => {
      const dataStr = formatarData(r.data_hora);
      const key = `${r.usuario_id}_${dataStr}`;

      if (!diasAgrupados[key]) {
        diasAgrupados[key] = {
          funcionario: r.nome_funcionario,
          data: dataStr,
          ENTRADA: null,
          SAIDA_ALMOCO: null,
          RETORNO_ALMOCO: null,
          SAIDA: null
        };
      }
      diasAgrupados[key][r.tipo] = new Date(r.data_hora);
    });

    const cabecalho = ["Data", "Funcionário", "Entrada", "Saída Almoço", "Volta Almoço", "Saída Final", "Atraso Entrada (Min)", "Horas Trabalhadas", "Bonificação"];
    
    const linhas = Object.values(diasAgrupados).map(dia => {
      const e = dia.ENTRADA;
      const sa = dia.SAIDA_ALMOCO;
      const ra = dia.RETORNO_ALMOCO;
      const s = dia.SAIDA;

      const fH = (data: Date | null) => data ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-";

      let atrasoMinutos = 0;
      if (e) {
        const horasEntrada = e.getHours();
        const minEntrada = e.getMinutes();
        if (horasEntrada > 8 || (horasEntrada === 8 && minEntrada > 5)) { 
          atrasoMinutos = (horasEntrada - 8) * 60 + minEntrada;
        }
      }

      let horasTrabalhadas = "-";
      if (e && s) {
        let totalMs = s.getTime() - e.getTime();
        if (sa && ra) {
          const almocoMs = Math.max(0, ra.getTime() - sa.getTime());
          totalMs -= almocoMs;
        } else {
          totalMs -= (60 * 60 * 1000); 
        }
        
        const horasTotais = Math.floor(totalMs / (1000 * 60 * 60));
        const minutosTotais = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        horasTrabalhadas = `${String(horasTotais).padStart(2, '0')}:${String(minutosTotais).padStart(2, '0')}`;
      }

      const bonificacao = "1 Hora (Saída antecipada 17h)";

      return [
        dia.data,
        dia.funcionario,
        fH(e),
        fH(sa),
        fH(ra),
        fH(s),
        atrasoMinutos > 0 ? `${atrasoMinutos} min` : "0 min",
        horasTrabalhadas,
        bonificacao
      ];
    });

    const csvContent = [
      cabecalho.join(";"),
      ...linhas.map(linha => linha.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Folha_Ponto_Consolidada_${mesFiltro}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="text-3xl">📋</span> Gestão de Ponto
            </h2>
            <span className="text-sm text-slate-500 font-medium mt-1 block">Acompanhamento e auditoria de jornada.</span>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <input 
              type="month" 
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="p-2 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all flex-1 md:flex-none"
            />
            <button 
              onClick={exportarCSVConsolidado}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Folha Consolidada (.CSV)
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-12">
                  <th className="px-6 py-3 w-32">Data</th>
                  <th className="px-6 py-3 w-40">Hora</th>
                  <th className="px-6 py-3">Funcionário</th>
                  <th className="px-6 py-3">Evento</th>
                  <th className="px-6 py-3 text-center">Status GPS</th>
                  <th className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="text-center p-10 text-slate-400 font-bold animate-pulse">Buscando auditoria de ponto...</td>
                  </tr>
                ) : registrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-10 text-slate-400 italic">Nenhum ponto registrado no mês de {mesFiltro}.</td>
                  </tr>
                ) : (
                  registrosFiltrados.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50 transition-colors font-medium">
                      <td className="px-6 py-4 text-slate-600">{formatarData(reg.data_hora)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800">{formatarHora(reg.data_hora)}</td>
                      <td className="px-6 py-4 font-bold text-indigo-700">{reg.nome_funcionario}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200">
                          {traduzirEvento(reg.tipo)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {reg.latitude && reg.longitude ? (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${reg.latitude},${reg.longitude}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-[10px] font-bold transition-colors bg-emerald-50 px-2 py-1 rounded border border-emerald-200"
                          >
                            📍 VER MAPA
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200">SEM SINAL</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => abrirModalEdicao(reg)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                          title="Ajustar Horário"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE EDIÇÃO MANUAL */}
        {registroEmEdicao && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-black text-slate-800 mb-2">Ajuste Manual</h3>
              <p className="text-sm text-slate-500 mb-6">
                Corrigindo o evento <strong className="text-indigo-600">{traduzirEvento(registroEmEdicao.tipo)}</strong> de <strong>{registroEmEdicao.nome_funcionario}</strong> no dia {formatarData(registroEmEdicao.data_hora)}.
              </p>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Novo Horário</label>
                <input 
                  type="time" 
                  value={novaHora}
                  onChange={(e) => setNovaHora(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all text-slate-800"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setRegistroEmEdicao(null)}
                  disabled={salvandoEdicao}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={salvarNovaHora}
                  disabled={salvandoEdicao}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"
                >
                  {salvandoEdicao ? "Salvando..." : "Gravar Ajuste"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}