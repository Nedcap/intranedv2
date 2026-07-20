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
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); // Formato YYYY-MM

  const carregarRegistros = async () => {
    try {
      setCarregando(true);

      // 1. Busca os pontos ordenados do mais recente pro mais antigo
      const { data: pontosData, error: errPonto } = await supabase
        .from("registro_ponto")
        .select("*")
        .order("data_hora", { ascending: false });

      if (errPonto) throw errPonto;

      // 2. Busca os nomes dos usuários na tabela pública
      const { data: usersData, error: errUsers } = await supabase
        .from("usuarios")
        .select("id, nome");

      if (errUsers) throw errUsers;

      // 3. Mescla tudo no front para evitar BOs de Foreign Key entre schemas diferentes
      const mapUsuarios = new Map(usersData?.map(u => [u.id, u.nome]));
      
      const mesclados = pontosData?.map(p => ({
        ...p,
        nome_funcionario: mapUsuarios.get(p.usuario_id) || "Usuário Desconhecido"
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

  // Filtra apenas o mês selecionado
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => r.data_hora.startsWith(mesFiltro));
  }, [registros, mesFiltro]);

  // Motor de Exportação CSV A Prova de Balas
  const exportarCSV = () => {
    if (registrosFiltrados.length === 0) return alert("Nenhum registro para exportar nesse mês.");

    const cabecalho = ["Data", "Horário", "Funcionário", "Evento", "IP Origem", "Localização (Lat, Lng)"];
    
    const linhas = registrosFiltrados.map(r => [
      formatarData(r.data_hora),
      formatarHora(r.data_hora),
      r.nome_funcionario,
      traduzirEvento(r.tipo),
      r.ip_origem || "N/A",
      r.latitude && r.longitude ? `${r.latitude}, ${r.longitude}` : "Sem GPS"
    ]);

    const csvContent = [
      cabecalho.join(";"),
      ...linhas.map(linha => linha.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // uFEFF é pro Excel ler os acentos em pt-BR
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Relatorio_Ponto_${mesFiltro}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="text-3xl">📋</span> Gestão de Ponto
            </h2>
            <span className="text-sm text-slate-500 font-medium mt-1 block">Acompanhamento e auditoria de jornada.</span>
          </div>

          <div className="flex items-center gap-4">
            <input 
              type="month" 
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="p-2 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            <button 
              onClick={exportarCSV}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exportar Mês (.CSV)
            </button>
          </div>
        </div>

        {/* TABELA DE REGISTROS */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-12">
                  <th className="px-6 py-3 w-32">Data</th>
                  <th className="px-6 py-3 w-32">Hora</th>
                  <th className="px-6 py-3">Funcionário</th>
                  <th className="px-6 py-3">Evento</th>
                  <th className="px-6 py-3">Autenticação IP</th>
                  <th className="px-6 py-3">Status GPS</th>
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
                      <td className="px-6 py-4 text-slate-600">{traduzirEvento(reg.tipo)}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{reg.ip_origem || "N/A"}</td>
                      <td className="px-6 py-4">
                        {reg.latitude && reg.longitude ? (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${reg.latitude},${reg.longitude}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-xs font-bold transition-colors bg-emerald-50 px-2 py-1 rounded"
                          >
                            📍 Ver no Mapa
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold bg-slate-100 px-2 py-1 rounded">Desativado</span>
                        )}
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