/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { gerarHtmlDossie } from "@/components/gerar-analise";
import GerarKappiViewer from "@/components/gerar-kappi";
import JSZip from "jszip";

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================
function calcularDiasUteis(dInicio: Date, dFim: Date) {
  let count = 0;
  const atual = new Date(dInicio.getTime());
  atual.setHours(12, 0, 0, 0);
  const fim = new Date(dFim.getTime());
  fim.setHours(12, 0, 0, 0);
  if (fim < atual) return 0;
  while (atual < fim) {
    atual.setDate(atual.getDate() + 1);
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      count++;
    }
  }
  return count;
}

function parseDataSegura(dataStr: string) {
  if (!dataStr) return null;
  const apenasData = dataStr.trim().split("T")[0];
  return new Date(`${apenasData}T12:00:00`);
}

function simplificarNome(nome: string): string {
  if (!nome) return "";
  let n = nome.trim().toUpperCase();
  n = n.replace(/\b(LTDA|SA|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, "");
  return n.replace(/\s+/g, " ").trim();
}

const obterIdsSubordinados = (usuarios: any[], liderId: string, visitados = new Set<string>()): string[] => {
  if (visitados.has(liderId)) return [];
  visitados.add(liderId);

  let resultado: string[] = [liderId];

  const subDiretos = usuarios.filter(u => {
    const lideres = u.permissoes?.lider_ids || (u.permissoes?.lider_id ? [u.permissoes.lider_id] : []);
    return Array.isArray(lideres) && lideres.includes(liderId);
  });

  subDiretos.forEach(sub => {
    resultado = [...resultado, ...obterIdsSubordinados(usuarios, sub.id, visitados)];
  });

  return Array.from(new Set(resultado));
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ComitePage() {
  const [analises, setAnalises] = useState<any[]>([]);
  const [empresasAnalise, setEmpresasAnalise] = useState<any[]>([]); 
  const [carregando, setCarregando] = useState(true);
  
  // 🎛️ CONTROLES DE FOCO E EXPANSÃO INTEGRADA
  const [idEmpresaExpandida, setIdEmpresaExpandida] = useState<string | null>(null);
  const [modoFocoComite, setModoFocoComite] = useState(false);
  const [empresaFocoAtivo, setEmpresaFocoAtivo] = useState<any>(null);
  const [htmlDossieRenderizado, setHtmlDossieRenderizado] = useState<string>("");

  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [diretoresBanco, setDiretoresBanco] = useState<string[]>([]);

  // Perfis de voto
  const [opcaoVoto, setOpcaoVoto] = useState("");
  const [justificativaVoto, setJustificativaVoto] = useState("");
  const [votoComoDecisao, setVotoComoDecisao] = useState(false); 
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = useState("");

  const [isMaster, setIsMaster] = useState(false);
  const [isDiretor, setIsDiretor] = useState(false); 
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("");

  // 🔥 NOVO ESTADO: Controle de Abas na Coluna ESQUERDA (Dossiê x Kappi)
  const [abaEsquerdaFoco, setAbaEsquerdaFoco] = useState<"dossie" | "kappi">("dossie");

  const carregarDiretores = async () => {
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("nome")
        .ilike("cargo", "Diretor");
      if (data) setDiretoresBanco(data.map(u => u.nome));
    } catch (err) {
      console.error("Erro ao buscar diretores:", err);
    }
  };

  const carregarVotosIniciais = useCallback(async (empresaNome: string) => {
    if (!empresaNome) return;
    const { data } = await supabase.from("votos").select("*").eq("empresa_nome", empresaNome);
    if (data) {
      setVotosAoVivo(prev => ({ ...prev, [empresaNome]: data }));
    }
  }, []);

  const vasculharImagensR2 = async (analiseItem: any) => {
    let prefixoPasta = `clientes/${analiseItem.id}/`; 
    
    if (analiseItem.dados_documentos && analiseItem.dados_documentos.length > 0) {
      try {
        const urlBase = new URL(analiseItem.dados_documentos[0]);
        const parts = urlBase.pathname.split('/'); 
        const idxClientes = parts.indexOf('clientes');
        if (idxClientes !== -1 && parts.length > idxClientes + 1) {
          prefixoPasta = `${parts[idxClientes]}/${parts[idxClientes + 1]}/`;
        }
      } catch(e) { /* ignora */ }
    }

    try {
      const res = await fetch('/api/listar-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: prefixoPasta })
      });
      if (res.ok) {
        const data = await res.json();
        const regexImagem = /\.(jpeg|jpg|gif|png|webp)/i;
        if (data.urls) {
          return data.urls.filter((url: string) => regexImagem.test(url));
        }
      }
    } catch (e) {
       console.error("Erro vasculhador R2", e);
    }
    return [];
  };

  const carregarComite = async () => {
    try {
      setCarregando(true);
      const userStr = localStorage.getItem("intraned_user");
      
      let queryComite = supabase.from("analises").select("*");
      let queryEsteira = supabase.from("analises").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

        if (cargoUser === "comercial" && user.nome) {
          queryComite = queryComite.ilike("comercial", `%${user.nome}%`);
          queryEsteira = queryEsteira.ilike("comercial", `%${user.nome}%`);
        }
      }
      
      const { data: dataComite } = await queryComite.eq("status", "aberta").order("criado_em", { ascending: false });
      if (dataComite) {
        const analisesComImagensR2 = await Promise.all(dataComite.map(async (item) => {
           const urlsR2 = await vasculharImagensR2(item);
           return { ...item, todas_as_imagens_r2: urlsR2 };
        }));

        setAnalises(analisesComImagensR2);
        for (const item of analisesComImagensR2) {
          await carregarVotosIniciais(item.empresa_nome);
        }
      }

      const { data: dataAnalise } = await queryEsteira.in("status", ["em_processamento_ia", "aguardando_docs"]).order("criado_em", { ascending: false });
      if (dataAnalise) setEmpresasAnalise(dataAnalise);

    } catch (err) {
      console.error("Erro ao carregar dados do comitê:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDiretores();
    carregarComite(); 

    try {
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setNomeUsuarioLogado(parsed.nome || "Membro Ned");
        
        const cargoLimpo = String(parsed.cargo || parsed.perfil || "").toLowerCase().trim();
        if (cargoLimpo === "master") setIsMaster(true);
        if (cargoLimpo === "diretor") setIsDiretor(true);
      }
    } catch (e) { console.error(e); }

    const canalVotos = supabase
      .channel("votos-live-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, (payload: any) => {
        const nomeEmp = payload.new?.empresa_nome || payload.old?.empresa_nome;
        if (nomeEmp) carregarVotosIniciais(nomeEmp);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalVotos);
    };
  }, [carregarVotosIniciais]);

  useEffect(() => {
    if (!idEmpresaExpandida) return;
    const empresaAlvo = analises.find(a => a.id === idEmpresaExpandida);
    if (!empresaAlvo) return;

    const canalChat = supabase
      .channel(`chat-live-${idEmpresaExpandida}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_comite", filter: `empresa_nome=eq.${empresaAlvo.empresa_nome}` }, (payload) => {
        setChatMsgs(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalChat);
    };
  }, [idEmpresaExpandida, analises]);

  const obter_emails_notificacao = async (empresaNome: string) => {
    const emails = new Set<string>();
    try {
      const { data: masters } = await supabase.from("usuarios").select("email").eq("cargo", "Master");
      masters?.forEach(m => m.email && emails.add(m.email));
    } catch {
      emails.add("diego@nedcapital.com.br");
    }
    return Array.from(emails).sort();
  };

  const dispararEmailResend = async (subject: string, html: string, listaEmails: string[]) => {
    if (!listaEmails.length) return;
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          from: "Sistema Ned <sistema@nedcapital.com.br>", 
          to: [listaEmails[0]], 
          cc: listaEmails.slice(1), 
          subject, 
          html 
        }),
      });
    } catch (err) { console.error("Erro na API de e-mail Resend:", err); }
  };

  const forcarDecisaoMaster = async (empresaItem: any, decisaoFinal: "Aprovado" | "Reprovado") => {
    const conf = confirm(`⚠️ DECISÃO EXECUTIVA: Deseja mover a empresa ${empresaItem.empresa_nome} para ${decisaoFinal}?`);
    if (!conf) return;

    try {
      setCarregando(true);
      const e = empresaItem.empresa_nome;

      const dcAtual = empresaItem.dados_consolidados || {};
      dcAtual.parecer_comite = `Decisão Executiva Master: Processo encerrado diretamente como [${decisaoFinal.toUpperCase()}] em ${new Date().toLocaleDateString('pt-BR')}.`;

      const { error } = await supabase
        .from("analises")
        .update({ 
          status: decisaoFinal.toLowerCase(),
          dados_consolidados: dcAtual 
        })
        .eq("id", empresaItem.id);

      if (error) throw error;

      const emailsAlvo = await obter_emails_notificacao(e);
      const htmlAta = `<html><body><h2>Ata de Comitê Encerrada: ${e}</h2><p>Veredito Final: <b>${decisaoFinal}</b></p></body></html>`;
      await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);

      alert(`✅ Orquestração concluída! Empresa movida para ${decisaoFinal}.`);
      if (modoFocoComite) desativarModoLupaExecutiva();
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro no painel Master: ${err.message}`);
    } finally { 
      setCarregando(false);
    }
  };

  const processarVotoWeb = async (empresaItem: any) => {
    if (!isMaster && !isDiretor) {
      alert("🚫 ACESSO NEGADO: Registro restrito a Diretores.");
      return;
    }
    if (!opcaoVoto || !justificativaVoto) {
      alert("Por favor, selecione o seu voto e preencha o parecer/justificativa.");
      return;
    }
    try {
      setEnviandoVoto(true);
      const e = empresaItem.empresa_nome;
      const autorDoVoto = (isMaster && votoComoDecisao) ? "Decisão" : nomeUsuarioLogado;

      await supabase.from("votos").upsert({ 
        empresa_nome: e, 
        membro_nome: autorDoVoto, 
        voto: opcaoVoto, 
        justificativa: justificativaVoto, 
        email_enviado: autorDoVoto === "Decisão"
      }, { onConflict: 'membro_nome,empresa_nome' });
      
      const { data: listaVotos } = await supabase.from("votos").select("*").eq("empresa_nome", e);
      const totalSim = listaVotos?.filter(v => v.voto === "Aprovado").length || 0;
      const totalNao = listaVotos?.filter(v => v.voto === "Reprovado").length || 0;
      
      const dcAtual = empresaItem.dados_consolidados || {};
      dcAtual.parecer_comite = `Placar do Comitê: ${totalSim} SIM / ${totalNao} NÃO. Detalhamento de Pareceres: ` + 
        listaVotos?.map(v => `[${v.membro_nome}: ${v.voto} - Parecer: ${v.justificativa}]`).join(" | ");

      let statusDestino = empresaItem.status;
      if (autorDoVoto === "Decisão") {
        statusDestino = opcaoVoto.toLowerCase();
      }

      const { error } = await supabase
        .from("analises")
        .update({ 
          dados_consolidados: dcAtual,
          status: statusDestino
        })
        .eq("id", empresaItem.id);

      if (error) throw error;
      
      if (autorDoVoto === "Decisão") {
        const emailsAlvo = await obter_emails_notificacao(e);
        const htmlAta = `<html><body><h2>Ata de Comitê Finalizada: ${e}</h2><p>Status Final: <b>${opcaoVoto}</b></p></body></html>`;
        await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);
        if (modoFocoComite) desativarModoLupaExecutiva();
      }
      
      alert(autorDoVoto === "Decisão" ? "🏁 Comitê encerrado e Ata salva!" : "🗳️ Seu voto foi computado e injetado no dossiê!");
      setJustificativaVoto(""); 
      setVotoComoDecisao(false);
      await carregarVotosIniciais(e);
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro ao computar voto: ${err.message}`);
    } finally { 
      setEnviandoVoto(false); 
    }
  };

  const handleCriarAnalise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaEmpresa.trim()) return;
    
    try {
      setCarregando(true);
      const { error } = await supabase.from("analises").insert({
        empresa_nome: nomeNovaEmpresa.trim().toUpperCase(),
        caminho_local: "INCLUSAO_MANUAL", 
        cnpj: `MANUAL-${Date.now()}`,
        status: "aguardando_docs"
      });
      if (error) throw error;
      setNomeNovaEmpresa("");
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleDeletarAnalise = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta empresa?")) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("analises").delete().eq("id", id);
      if (error) throw error;
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro: ${err.message}`);
    } finally { setCarregando(false); }
  };

  const handleForcarDecisaoPrompt = (item: any) => {
    const res = prompt(`Forçar Decisão Executiva para ${item.empresa_nome}\n\nDigite "Aprovar" ou "Reprovar":`);
    if (!res) return;
    const cleanRes = res.trim().toLowerCase();
    if (cleanRes === "aprovar" || cleanRes === "aprovado") {
      forcarDecisaoMaster(item, "Aprovado");
    } else if (cleanRes === "reprovar" || cleanRes === "reprovado") {
      forcarDecisaoMaster(item, "Reprovado");
    } else {
      alert("Comando inválido. Operação cancelada.");
    }
  };

  const activarModoLupaExecutiva = async (empresa: any) => {
    setCarregando(true);
    try {
      setEmpresaFocoAtivo(empresa);
      setIdEmpresaExpandida(empresa.id); 
      setAbaEsquerdaFoco("dossie"); // Reset pra aba Dossie principal
      setModoFocoComite(true);
      
      const htmlMontado = await gerarHtmlDossie(empresa);
      setHtmlDossieRenderizado(htmlMontado);
      
      const { data } = await supabase
        .from("chat_comite")
        .select("*")
        .eq("empresa_nome", empresa.empresa_nome)
        .order("id", { ascending: true });
      if (data) setChatMsgs(data);
    } catch (err) {
      console.error("Erro ao carregar chat ou HTML:", err);
    } finally {
      setCarregando(false);
    }
  };

  const desativarModoLupaExecutiva = () => {
    setModoFocoComite(false);
    setEmpresaFocoAtivo(null);
    setIdEmpresaExpandida(null); 
    setHtmlDossieRenderizado("");
    setChatMsgs([]);
  };

  const enviarMensagemChat = async (empresaNome: string) => {
    if (!novaMsg.trim()) return;
    const { data } = await supabase.from("chat_comite").insert({ 
      empresa_nome: empresaNome, 
      usuario: nomeUsuarioLogado || "Membro (Web)", 
      mensagem: novaMsg.trim() 
    }).select();
    if (data) setChatMsgs([...chatMsgs, data[0]]);
    setNovaMsg("");
  };

  // 🔮 MODO COMITÊ TELA CHEIA ATIVO (VISUAL LIGHT & CLEAN)
  if (modoFocoComite && empresaFocoAtivo) {
    const listaDeVotos = votosAoVivo[empresaFocoAtivo.empresa_nome] || [];

    return (
      <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px] animate-in fade-in duration-200">
        
        {/* CABEÇALHO DO COMITÊ (CLARO) */}
        <div className="bg-white text-slate-800 p-4 px-6 flex justify-between items-center shadow-sm border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Comitê Executivo Ativo</span>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase text-slate-900 tracking-tight">{empresaFocoAtivo.empresa_nome}</h2>
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-md uppercase">{empresaFocoAtivo.status || "Em análise"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={desativarModoLupaExecutiva} className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer uppercase tracking-wide">
              ✕ Sair da Mesa
            </button>
          </div>
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden w-full bg-slate-50/50">
          
          {/* LADO ESQUERDO: DOSSIÊ E KAPPI */}
          <div className="w-[70%] h-full p-5 pr-2.5 flex flex-col space-y-3">
            
            {/* 🔥 CONTROLE DE ABAS (ESQUERDA) */}
            <div className="flex gap-2">
               <button 
                  onClick={() => setAbaEsquerdaFoco("dossie")}
                  className={`px-5 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm ${abaEsquerdaFoco === "dossie" ? "bg-blue-600 text-white border-blue-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100 border"}`}
               >
                  📄 Dossiê Comercial / Crédito
               </button>
               <button 
                  onClick={() => setAbaEsquerdaFoco("kappi")}
                  className={`px-5 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm ${abaEsquerdaFoco === "kappi" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100 border"}`}
               >
                  🕵️‍♂️ Auditoria Kappi
               </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 relative flex flex-col">
              {abaEsquerdaFoco === "dossie" ? (
                htmlDossieRenderizado ? (
                  <iframe 
                    srcDoc={htmlDossieRenderizado} 
                    className="w-full h-full border-0 bg-white" 
                    sandbox="allow-scripts allow-same-origin" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 italic text-xs gap-3 font-mono">
                    <span className="animate-spin text-2xl">⏳</span>
                    Renderizando HTML estruturado...
                  </div>
                )
              ) : (
                <div className="flex-1 overflow-y-auto p-2 bg-slate-50 custom-scrollbar">
                   {/* Injeção do Gerador Kappi */}
                   <GerarKappiViewer />
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: CHAT E VOTOS (FIXO) */}
          <div className="w-[30%] h-full py-5 pl-2.5 pr-5 flex flex-col space-y-4 overflow-hidden">
            
            <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative">
              
              <div className="flex-1 flex flex-col space-y-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* PAINEL DE VOTAÇÃO */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4 shrink-0 text-left">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <span className="text-[12px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      🗳️ Painel de Voto
                    </span>
                    <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                      👤 {votoComoDecisao ? "Decisão Final" : nomeUsuarioLogado}
                    </span>
                  </div>
                  
                  {(!isMaster && !isDiretor) ? (
                    <div className="p-4 bg-slate-50 text-slate-500 font-bold text-xs rounded-xl border border-slate-200 text-center">
                      🔒 Seu perfil ({nomeUsuarioLogado}) é operacional. Voto desabilitado.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <select value={opcaoVoto} onChange={(e) => setOpcaoVoto(e.target.value)} className="w-full p-3 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm">
                        <option value="">Selecione o seu Veredito...</option>
                        <option value="Aprovado">🟢 Aprovado</option>
                        <option value="Reprovado">🔴 Reprovado</option>
                      </select>

                      {isMaster && (
                        <label className="flex items-center gap-2 p-3 text-slate-700 font-bold text-xs bg-amber-50 rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-100/80 transition-colors select-none shadow-sm">
                          <input type="checkbox" checked={votoComoDecisao} onChange={(e) => setVotoComoDecisao(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer" />
                          Assegurar como <span className="text-amber-700 uppercase tracking-wide">Decisão Final (Master)</span>
                        </label>
                      )}

                      <textarea value={justificativaVoto} onChange={(e) => setJustificativaVoto(e.target.value)} placeholder="Escreva sua justificativa técnica ou ressalvas..." className="w-full p-3 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/50 h-20 resize-none transition-all shadow-inner" />
                      
                      <button onClick={() => processarVotoWeb(empresaFocoAtivo)} disabled={enviandoVoto} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/30 uppercase tracking-wide">
                        {enviandoVoto ? "Computando..." : "Confirmar Voto"}
                      </button>
                    </div>
                  )}
                </div>

                {/* HISTÓRICO DE PARECERES */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col overflow-hidden text-left h-[25%] shrink-0">
                  <span className="text-[12px] font-black text-slate-700 uppercase block tracking-wider mb-3 border-b border-slate-100 pb-2.5">📋 Pareceres Registrados</span>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {listaDeVotos.length === 0 ? (
                      <p className="text-slate-400 italic text-xs py-4 text-center font-medium">A mesa ainda não possui votos computados.</p>
                    ) : (
                      listaDeVotos.map((v: any, idx: number) => (
                        <div key={idx} className="p-3.5 border border-slate-100 rounded-xl bg-slate-50 flex flex-col gap-2 text-xs shadow-sm transition-colors hover:border-slate-200">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-slate-800">{v.membro_nome}</span>
                            <span className={`px-2.5 py-1 rounded-md text-[9px] uppercase font-black tracking-wider ${v.voto === "Aprovado" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"}`}>{v.voto}</span>
                          </div>
                          <span className="text-slate-600 font-medium leading-relaxed italic">"{v.justificativa}"</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* CHAT / MESA DE DEBATES */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden text-left">
                  <span className="text-[12px] font-black text-slate-700 uppercase block tracking-wider mb-3 border-b border-slate-100 pb-2.5">💬 Mesa de Debates (Ao Vivo)</span>
                  <div className="flex-1 overflow-y-auto rounded-xl p-1 space-y-3 custom-scrollbar">
                    {chatMsgs.length === 0 ? (
                      <p className="text-center text-slate-400 py-10 text-xs italic font-medium">Nenhum comentário registrado no chat.</p>
                    ) : (
                      chatMsgs.map((m: any) => {
                        const ehMeu = m.usuario === nomeUsuarioLogado;
                        return (
                          <div key={m.id} className={`flex flex-col text-xs ${ehMeu ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">{m.usuario}</span>
                            <div className={`p-3 rounded-2xl max-w-[90%] shadow-sm ${ehMeu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-bl-none'}`}>
                              <span className="font-medium whitespace-pre-wrap break-words leading-relaxed">{m.mensagem}</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="flex gap-2 mt-4 shrink-0 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
                    <input type="text" value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagemChat(empresaFocoAtivo.empresa_nome)} placeholder="Digite sua mensagem..." className="flex-1 p-2 bg-transparent text-slate-800 text-xs outline-none font-medium placeholder-slate-400" />
                    <button onClick={() => enviarMensagemChat(empresaFocoAtivo.empresa_nome)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 rounded-lg cursor-pointer transition-all shadow-sm">Enviar</button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}} />
      </div>
    );
  }

  // 🏛️ RENDERIZAÇÃO DA VISÃO PADRÃO (CAPA)
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-800">
      {carregando && <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center font-bold text-slate-600 text-lg tracking-wide">Sincronizando esteira...</div>}
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Análises em Comitê</h2>
          </div>
          <span className="text-sm text-slate-500 font-medium ml-12">Mesa V8 - Deliberação e Votação de Crédito</span>
        </div>
        {isMaster && <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm">⚡ Perfil Master</span>}
      </div>

      {/* TABELA DE COMITÊ */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                <th className="p-4 pl-6">Empresa / Cedente</th>
                <th className="p-4 w-40">CNPJ</th>
                <th className="p-4 text-center w-36">Data Entrada</th>
                <th className="p-4 text-center w-40">Status Atual</th>
                <th className="p-4 text-center w-48">Ações</th>
                {isMaster && <th className="p-4 text-center text-amber-700 bg-amber-50/50 border-l border-slate-200 w-48">Ação Executiva</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {analises.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 pl-6 font-extrabold text-slate-900 uppercase tracking-tight">{item.empresa_nome}</td>
                  <td className="p-4 font-mono text-slate-500">{item.cnpj}</td>
                  <td className="p-4 text-center text-slate-500 font-mono">{new Date(item.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black rounded-md uppercase tracking-wider shadow-xs ${item.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : item.status === 'reprovado' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => activarModoLupaExecutiva(item)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-blue-500/20 transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 mx-auto w-[160px]">
                      🏛️ Entrar no Comitê 
                    </button>
                  </td>
                  {isMaster && (
                    <td className="p-4 bg-amber-50/20 border-l border-slate-200 text-center">
                      <button onClick={() => handleForcarDecisaoPrompt(item)} className="px-3 py-2 bg-white border border-amber-300 hover:bg-amber-50 hover:border-amber-400 text-amber-700 font-bold text-[11px] rounded-xl uppercase tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto w-[150px]">
                        ⚡ Forçar Veredito
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {analises.length === 0 && (
                <tr><td colSpan={isMaster ? 6 : 5} className="p-10 text-center text-slate-400 italic font-bold">Nenhuma análise aguardando comitê no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {/* HEADER ESTEIRA SECUNDÁRIA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Esteira de Processamento</h2>
              <span className="text-xs text-slate-500 font-medium">IA em andamento / Documentos Pendentes</span>
            </div>
          </div>
          <form onSubmit={handleCriarAnalise} className="flex gap-2 items-center w-full md:w-auto">
            <input type="text" placeholder="Nome da Empresa..." value={nomeNovaEmpresa} onChange={(e) => setNomeNovaEmpresa(e.target.value)} className="flex-1 md:w-[260px] p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-inner" />
            <button type="submit" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap">➕ Adicionar</button>
          </form>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="p-4 pl-6">Empresa</th>
                  <th className="p-4 w-40">CNPJ</th>
                  <th className="p-4 w-56">Status Interno</th>
                  <th className="p-4 text-center w-36">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {empresasAnalise.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic font-bold">Nenhuma esteira pendente de docs ou processamento IA.</td></tr>
                ) : (
                  empresasAnalise.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 pl-6 font-extrabold text-slate-900 uppercase tracking-tight">{item.empresa_nome}</td>
                      <td className="p-4 font-mono text-slate-500">{item.cnpj}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-black text-[10px] uppercase tracking-wider animate-pulse shadow-xs">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => handleDeletarAnalise(item.id)} className="px-4 py-1.5 bg-white text-rose-600 border border-rose-200 hover:border-rose-300 font-bold rounded-xl text-xs cursor-pointer hover:bg-rose-50 shadow-sm transition-all">✕ Remover</button>
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