"use client";

import { useState, useEffect } from "react";
import { registrarPonto, buscarUltimoStatusPonto } from "@/actions/ponto-actions";

export default function PontoEletronicoPage() {
  const [carregando, setCarregando] = useState(true);
  const [localizacao, setLocalizacao] = useState<{ lat: number; lng: number } | null>(null);
  const [ultimoStatus, setUltimoStatus] = useState<string>("NENHUM");
  const [horaAtual, setHoraAtual] = useState<string>("");

  useEffect(() => {
    // Relógio em tempo real só para visual
    const timer = setInterval(() => {
      setHoraAtual(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);

    // Pede permissão de GPS
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocalizacao({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("GPS ignorado/bloqueado:", err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    // Busca o status de hoje no banco
    buscarUltimoStatusPonto().then(status => {
      setUltimoStatus(status);
      setCarregando(false);
    });

    return () => clearInterval(timer);
  }, []);

  const handleBaterPonto = async (tipo: string) => {
    try {
      setCarregando(true);
      
      // TRAVA OPCIONAL DE GPS:
      // Se você quiser obrigar que tenha GPS ativo para clicar, descomente abaixo:
      /* 
      if (!localizacao) {
        alert("⚠️ Ative a localização (GPS) do navegador para bater o ponto.");
        setCarregando(false);
        return;
      } 
      */

      await registrarPonto(localizacao?.lat || null, localizacao?.lng || null, tipo);
      
      setUltimoStatus(tipo);
      alert("✅ Ponto registrado com sucesso no Servidor!");
    } catch (e: any) {
      alert(`❌ Erro: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  };

  if (carregando && ultimoStatus === "NENHUM") {
    return <div className="flex h-screen items-center justify-center text-slate-400 font-bold animate-pulse">Sincronizando relógio...</div>;
  }

  // Máquina de Estado do Botão
  let proximoPasso = "";
  let corBotao = "";
  let icone = "";

  if (ultimoStatus === "NENHUM") {
    proximoPasso = "ENTRADA";
    corBotao = "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40";
    icone = "➡️";
  } else if (ultimoStatus === "ENTRADA") {
    proximoPasso = "SAIDA_ALMOCO";
    corBotao = "bg-amber-500 hover:bg-amber-600 shadow-amber-500/40";
    icone = "🍔";
  } else if (ultimoStatus === "SAIDA_ALMOCO") {
    proximoPasso = "RETORNO_ALMOCO";
    corBotao = "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40";
    icone = "🔙";
  } else if (ultimoStatus === "RETORNO_ALMOCO") {
    proximoPasso = "SAIDA";
    corBotao = "bg-rose-500 hover:bg-rose-600 shadow-rose-500/40";
    icone = "🏠";
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 font-sans">
      
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-200 flex flex-col items-center w-full max-w-md relative overflow-hidden">
        {/* Enfeite visual */}
        <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-cyan-500"></div>

        <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">{horaAtual || "--:--:--"}</h1>
        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-10 text-center">
          Status Hoje: <br/>
          <span className="text-indigo-600 text-lg mt-1 block">
            {ultimoStatus.replace("_", " ")}
          </span>
        </div>

        {ultimoStatus === "SAIDA" ? (
          <div className="w-full bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center">
            <span className="text-4xl block mb-2">🎉</span>
            <span className="text-slate-600 font-bold block">Expediente encerrado.</span>
            <span className="text-slate-400 text-sm font-medium">Bom descanso! Nos vemos amanhã.</span>
          </div>
        ) : (
          <button
            onClick={() => handleBaterPonto(proximoPasso)}
            disabled={carregando}
            className={`w-64 h-64 rounded-[40px] text-xl font-black text-white shadow-2xl transition-all duration-300 hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center gap-3 ${corBotao} ${carregando ? "opacity-50 pointer-events-none animate-pulse" : ""}`}
          >
            {carregando ? (
               <svg className="animate-spin w-10 h-10 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <>
                <span className="text-5xl">{icone}</span>
                <span className="tracking-wide">BATER {proximoPasso.replace("_", " ")}</span>
              </>
            )}
          </button>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 w-full text-[10px] font-mono text-slate-400 text-center flex flex-col gap-1">
          <span className="flex items-center justify-center gap-1">
            <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            IP e Horário validados pelo Servidor
          </span>
          {localizacao ? (
            <span>📍 Localização: {localizacao.lat.toFixed(4)}, {localizacao.lng.toFixed(4)}</span>
          ) : (
            <span className="text-amber-500">⏳ Buscando sinal de GPS...</span>
          )}
        </div>
      </div>
    </div>
  );
}