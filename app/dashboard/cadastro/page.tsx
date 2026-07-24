/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { limparNome } from "@/lib/normalizador";

// Função para formatar o CNPJ enquanto digita ou exibe
const formatarCNPJ = (cnpj: string) => {
  if (!cnpj) return "";
  let v = cnpj.replace(/\D/g, "");
  if (v.length > 14) v = v.substring(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return v.replace(/(\d{2})(\d+)/, "$1.$2");
  if (v.length <= 8) return v.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (v.length <= 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, "$1.$2.$3/$4-$5");
};

// Configuração ORIGINAL das Etapas (Usada para gerar o Formulário Expansível)
const STEPS_SEC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_sec", label: "Documentos" },
  { key: "dt_geracao_contrato_sec", label: "Geração Contrato" },
  { key: "dt_assinatura_contrato_sec", label: "Assinatura" },
  { key: "dt_apto_sec", label: "Apto Operar" }
];

const STEPS_FIDC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_fidc", label: "Documentos" },
  { key: "dt_geracao_contrato_fidc", label: "Ger. Contrato" },
  { key: "dt_assinatura_contrato_fidc", label: "Assinatura" },
  { key: "dt_envio_gestora_fidc", label: "Envio Gestora" },
  { key: "dt_aprovacao_gestora_fidc", label: "Aprov. Gestora" },
  { key: "dt_envio_admin_fidc", label: "Envio Admin" },
  { key: "dt_aprovacao_admin_fidc", label: "Aprov. Admin" },
  { key: "dt_apto_fidc", label: "Apto Operar" }
];

const VISUAL_STEPS_SEC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_sec", label: "Documentos" },
  { key: "dt_geracao_contrato_sec", label: "Ger. Contrato" },
  { key: "dt_assinatura_contrato_sec", label: "Assinatura" },
  { key: "na_1", label: "Envio Gestora", isNA: true },
  { key: "na_2", label: "Aprov. Gestora", isNA: true },
  { key: "na_3", label: "Envio Admin", isNA: true },
  { key: "na_4", label: "Aprov. Admin", isNA: true },
  { key: "dt_apto_sec", label: "Apto Operar" }
];

const VISUAL_STEPS_FIDC = [
  { key: "dt_aprovacao_comite", label: "Aprov. Comitê" },
  { key: "dt_documentos_fidc", label: "Documentos" },
  { key: "dt_geracao_contrato_fidc", label: "Ger. Contrato" },
  { key: "dt_assinatura_contrato_fidc", label: "Assinatura" },
  { key: "dt_envio_gestora_fidc", label: "Envio Gestora" },
  { key: "dt_aprovacao_gestora_fidc", label: "Aprov. Gestora" },
  { key: "dt_envio_admin_fidc", label: "Envio Admin" },
  { key: "dt_aprovacao_admin_fidc", label: "Aprov. Admin" },
  { key: "dt_apto_fidc", label: "Apto Operar" }
];

const formatarDataBr = (dataString: string) => {
  if (!dataString) return "";
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
};

// 🌟 FUNÇÃO MÁGICA: Substitui as tags pelo dado real e insere os documentos e o fundo
const aplicarTagsDinamicas = (texto: string, item: any, docsSelecionados: string[] = [], fundo: string = "") => {
  if (!texto) return "";
  const primeiroNomeComercial = item.comercial ? item.comercial.split(' ')[0] : "Equipe";
  const listaDocsFormatada = docsSelecionados.length > 0 
    ? docsSelecionados.map(d => `• ${d}`).join('\n') 
    : "Nenhum documento especificado.";

  return texto
    .replace(/\{empresa\}/gi, item.cedente || "Empresa Não Informada")
    .replace(/\{cnpj\}/gi, formatarCNPJ(item.cnpj) || "Sem CNPJ")
    .replace(/\{contato\}/gi, primeiroNomeComercial)
    .replace(/\{comercial\}/gi, item.comercial || "Comercial")
    .replace(/\{limite\}/gi, item.limite || "R$ 0,00")
    .replace(/\{taxa\}/gi, item.taxa || "0,00%")
    .replace(/\{documentos\}/gi, listaDocsFormatada)
    .replace(/\{fundo\}/gi, fundo); // 🌟 TAG DE FUNDO (SEC OU FIDC) AQUI!
};

export default function CadastroPage() {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState("");
  const [cnpjsCopiados, setCnpjsCopiados] = useState<Record<string, boolean>>({});
  
  const [usuarioAtual, setUsuarioAtual] = useState<{ id: string; nome: string; perfil: string; email: string } | null>(null);
  const [gmailConectado, setGmailConectado] = useState(false); 

  const [cedentesEmEdicaoDeNome, setCedentesEmEdicaoDeNome] = useState<Record<string, boolean>>({});
  const [linhasExpandidas, setLinhasExpandidas] = useState<Record<string, boolean>>({});
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "cedente",
    direction: "asc"
  });
  
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "PENDENTE_ENVIO" | "AGUARDANDO_ASSINATURA" | "EM_ANDAMENTO" | "APTO">("TODOS");

  // ================= ESTADOS DO MODAL DE DISPARO =================
  const [modalDisparoAberto, setModalDisparoAberto] = useState(false);
  const [tipoDisparoAtual, setTipoDisparoAtual] = useState<"ASSINATURA" | "GESTORA" | "APTO" | "PENDENCIA" | null>(null);
  const [cedentesDisponiveis, setCedentesDisponiveis] = useState<any[]>([]);
  const [selecionadosParaDisparo, setSelecionadosParaDisparo] = useState<string[]>([]);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [logsDisparo, setLogsDisparo] = useState<string[]>([]);

  // 🌟 NOVOS ESTADOS PARA PESQUISA E FUNDO NO MODAL
  const [buscaModalDisparo, setBuscaModalDisparo] = useState("");
  const [fundoDisparo, setFundoDisparo] = useState<Record<string, "SEC" | "FIDC">>({});

  // 🌟 ESTADO DOS TEMPLATES E DOCUMENTOS
  const [templatesEmail, setTemplatesEmail] = useState<any[]>([]);
  const [templateSelecionadoId, setTemplateSelecionadoId] = useState<string>("");
  const [listaDocsGerais, setListaDocsGerais] = useState<string[]>([]);
  const [docsMarcadosParaEnvio, setDocsMarcadosParaEnvio] = useState<string[]>([]);
  const [buscaDoc, setBuscaDoc] = useState("");
  const [novoDocInput, setNovoDocInput] = useState("");

  const carregarCadastro = useCallback(async () => {
    try {
      setCarregando(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: perfilData } = await supabase.from('usuarios').select('nome, cargo, email').eq('id', user.id).single();
        
        let emailDoUsuario = ""; 
        
        if (perfilData) {
          emailDoUsuario = perfilData.email?.toLowerCase().trim();
          setUsuarioAtual({ 
            id: user.id, 
            nome: perfilData.nome,
            email: emailDoUsuario,
            perfil: (perfilData.cargo || "").toLowerCase() 
          });
        }

        if (emailDoUsuario) {
          const { data: integracoes, error: intError } = await supabase
            .from("usuarios_integracoes")
            .select("id")
            .eq("email_usuario", emailDoUsuario)
            .limit(1); 
            
          if (intError) {
             console.error("Erro ao buscar integracao:", intError);
          }
            
          if (integracoes && integracoes.length > 0) {
            setGmailConectado(true);
          } else {
            console.log("⚠️ Nenhuma integração Google achada para:", emailDoUsuario);
          }
        }
      }

      // BUSCA OS TEMPLATES DO BANCO
      const { data: tpls } = await supabase.from("crm_email_templates").select("*").order("created_at", { ascending: false });
      if (tpls) setTemplatesEmail(tpls);

      // BUSCA A LISTA DE DOCUMENTOS DO BANCO (JSON)
      const { data: configDocs } = await supabase.from("crm_configuracoes").select("valor").eq("chave", "docs_homologacao").single();
      if (configDocs && configDocs.valor) {
        setListaDocsGerais(configDocs.valor as string[]);
      } else {
        setListaDocsGerais(["Contrato Social", "Balanço Patrimonial / DRE", "Faturamento Fiscal 12 meses", "Documento dos Sócios"]);
      }

      const { data } = await supabase.from("cadastro_cedentes").select("*");
      
      if (data) {
        setCedentes(data.map(item => ({ ...item, _isEditado: false, _isNovo: false })));
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setCarregando(false); 
    }
  }, []);

  useEffect(() => {
    carregarCadastro();
  }, [carregarCadastro]);

  // ================= LÓGICA DE DISPARO EM LOTE =================

  const abrirModalDisparo = (tipo: "ASSINATURA" | "GESTORA" | "APTO" | "PENDENCIA") => {
    setTipoDisparoAtual(tipo);
    setSelecionadosParaDisparo([]);
    setLogsDisparo([]);
    setDocsMarcadosParaEnvio([]);
    setBuscaDoc("");
    setNovoDocInput("");
    setTemplateSelecionadoId(""); 
    setBuscaModalDisparo(""); // Reseta a busca interna do modal
    setFundoDisparo({}); // Reseta a marcação de fundos

    const filtrados = cedentes.filter(c => {
      if (c._isNovo) return false;
      if (tipo === "APTO") return !!(c.dt_apto_sec || c.dt_apto_fidc);
      if (tipo === "GESTORA") return !!c.dt_envio_gestora_fidc && !c.dt_aprovacao_gestora_fidc && !c.dt_apto_fidc;
      if (tipo === "ASSINATURA") return ((c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || (c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc)) && !c.dt_apto_sec && !c.dt_apto_fidc;
      if (tipo === "PENDENCIA") return !c.dt_apto_sec && !c.dt_apto_fidc; 
      return false;
    });

    setCedentesDisponiveis(filtrados);
    setModalDisparoAberto(true);
  };

  const toggleSelecaoDisparo = (id: string) => {
    setSelecionadosParaDisparo(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        // Quando seleciona, já seta "SEC" como padrão
        setFundoDisparo(f => ({ ...f, [id]: "SEC" }));
        return [...prev, id];
      }
    });
  };

  // Filtra as opções no modal baseadas na busca interna
  const cedentesModalFiltrados = useMemo(() => {
    return cedentesDisponiveis.filter(c => 
      c.cedente.toLowerCase().includes(buscaModalDisparo.toLowerCase()) ||
      (c.cnpj && c.cnpj.includes(buscaModalDisparo.replace(/\D/g, "")))
    );
  }, [cedentesDisponiveis, buscaModalDisparo]);

  const selecionarTodosDisparo = () => {
    if (selecionadosParaDisparo.length === cedentesModalFiltrados.length) {
      setSelecionadosParaDisparo([]);
    } else {
      const ids = cedentesModalFiltrados.map(c => c.id);
      setSelecionadosParaDisparo(ids);
      
      const novosFundos = { ...fundoDisparo };
      ids.forEach(id => {
        if (!novosFundos[id]) novosFundos[id] = "SEC"; // Marca como SEC os que não tinham fundo atrelado
      });
      setFundoDisparo(novosFundos);
    }
  };

  const toggleDocMarcado = (doc: string) => {
    setDocsMarcadosParaEnvio(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]);
  };

  const salvarNovoDocumentoNoBanco = async () => {
    if (!novoDocInput.trim()) return;
    const docLimpo = novoDocInput.trim();
    if (listaDocsGerais.includes(docLimpo)) return setNovoDocInput(""); 
    
    const novaLista = [...listaDocsGerais, docLimpo];
    setListaDocsGerais(novaLista);
    setDocsMarcadosParaEnvio(prev => [...prev, docLimpo]); 
    setNovoDocInput("");

    try {
      await supabase.from("crm_configuracoes").upsert({ chave: "docs_homologacao", valor: novaLista });
    } catch (e) {
      console.error("Erro ao salvar doc no config:", e);
    }
  };

  const executarDisparoEmLote = async () => {
    if (selecionadosParaDisparo.length === 0 || !usuarioAtual?.email || !tipoDisparoAtual || !templateSelecionadoId) return;
    if (tipoDisparoAtual === "PENDENCIA" && docsMarcadosParaEnvio.length === 0) return alert("Selecione ao menos um documento pendente para enviar.");
    
    const templateAtivo = templatesEmail.find(t => t.id === templateSelecionadoId);
    if (!templateAtivo) return;

    setEnviandoLote(true);
    setLogsDisparo(["🚀 Iniciando disparos com o roteiro:", `- ${templateAtivo.nome}`]);

    const itensParaEnviar = cedentesDisponiveis.filter(c => selecionadosParaDisparo.includes(c.id));

    for (const item of itensParaEnviar) {
      try {
        setLogsDisparo(prev => [...prev, `⏳ Buscando comercial de ${item.cedente}...`]);
        
        let emailDestino = "";
        if (item.responsavel_id) {
          const { data: usu } = await supabase.from('usuarios').select('email').eq('id', item.responsavel_id).single();
          if (usu) emailDestino = usu.email;
        }
        if (!emailDestino && item.comercial) {
          const { data: usuNome } = await supabase.from('usuarios').select('email').eq('nome', item.comercial).single();
          if (usuNome) emailDestino = usuNome.email;
        }

        if (!emailDestino) {
          setLogsDisparo(prev => [...prev, `❌ Pulando ${item.cedente}: E-mail do comercial não encontrado.`]);
          continue; 
        }

        // 🌟 IDENTIFICA O FUNDO ESCOLHIDO PARA ESTE ITEM
        const fundoSelecionado = fundoDisparo[item.id] || "SEC";

        // 🌟 APLICA AS TAGS DINÂMICAS (DOCUMENTOS + FUNDO SEC/FIDC)
        const assuntoFinal = aplicarTagsDinamicas(templateAtivo.assunto, item, docsMarcadosParaEnvio, fundoSelecionado);
        const textoFinal = aplicarTagsDinamicas(templateAtivo.corpo, item, docsMarcadosParaEnvio, fundoSelecionado);

        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: usuarioAtual.email,
            para: emailDestino,
            cc: templateAtivo.cc || "", 
            assunto: assuntoFinal,
            textoResposta: textoFinal
          })
        });

        if (!res.ok) throw new Error("Falha na API de envio");
        
        setLogsDisparo(prev => [...prev, `✅ Enviado para ${item.comercial} (${item.cedente}) - Via ${fundoSelecionado}`]);
        await new Promise(r => setTimeout(r, 1000));

      } catch (err: any) {
        setLogsDisparo(prev => [...prev, `❌ Falha ao enviar ${item.cedente}: ${err.message}`]);
      }
    }

    setLogsDisparo(prev => [...prev, "🎉 Processo de lote finalizado!"]);
    setEnviandoLote(false);
  };


  // ================= RESTANTE DAS FUNÇÕES ORIGINAIS =================
  const buscarAprovadasDoComite = async () => {
    try {
      setSincronizando(true);
      
      const { data: analises, error: errAnalises } = await supabase
        .from("analises")
        .select("empresa_nome, comercial, status, criado_em, responsavel_id, cnpj");
      
      if (errAnalises) throw errAnalises;
      if (!analises) return;

      const aprovadas = analises.filter(a => {
        const st = (a.status || "").toLowerCase();
        return st.includes("aprovado") || st.includes("finalizado") || st.includes("com restritivo");
      });

      const nomesNaEsteira = new Set(cedentes.map(c => c.cedente.toUpperCase().trim()));
      const novosCedentes = [];

      for (const analise of aprovadas) {
        const nomeLimpo = limparNome(analise.empresa_nome).toUpperCase();
        
        if (!nomesNaEsteira.has(nomeLimpo)) {
           const dtComiteRaw = analise.criado_em;
           const dtComiteFormatada = dtComiteRaw ? dtComiteRaw.split('T')[0] : null;
           const cnpjLimpo = analise.cnpj ? analise.cnpj.replace(/\D/g, "") : null;

           novosCedentes.push({
             cedente: nomeLimpo,
             cnpj: cnpjLimpo,
             comercial: analise.comercial,
             dt_aprovacao_comite: dtComiteFormatada,
             atualizado_em: new Date().toISOString(),
             responsavel_id: analise.responsavel_id || usuarioAtual?.id 
           });
           nomesNaEsteira.add(nomeLimpo);
        }
      }

      if (novosCedentes.length > 0) {
        const { error } = await supabase.from("cadastro_cedentes").insert(novosCedentes);
        if (error) throw error;
        alert(`🎉 Sucesso! ${novosCedentes.length} novas empresas aprovadas no comitê foram integradas à Esteira.`);
        await carregarCadastro();
      } else {
        alert("💡 A Esteira já está atualizada! Nenhuma nova empresa aprovada no comitê para integrar.");
      }

    } catch (err: any) {
      console.error(err);
      alert(`❌ Erro ao buscar aprovações do comitê: ${err.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const handleInputChange = (index: number, campo: string, valor: any) => {
    const novos = [...cedentes]; 
    novos[index][campo] = valor;
    novos[index]["_isEditado"] = true;
    setCedentes(novos);
  };

  const handleCnpjChange = (index: number, valorRaw: string) => {
    const apenasNumeros = valorRaw.replace(/\D/g, "").slice(0, 14);
    handleInputChange(index, "cnpj", apenasNumeros);
  };

  const handleLimiteInputChange = (index: number, valorRaw: string) => {
    const apenasNumeros = valorRaw.replace(/\D/g, "");
    if (!apenasNumeros) {
      handleInputChange(index, "limite", "");
      return;
    }
    const valorNumerico = parseFloat(apenasNumeros) / 100;
    const formatado = valorNumerico.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    handleInputChange(index, "limite", formatado);
  };

  const adicionarNovaLinha = () => {
    const novaLinha = {
      cedente: "", cnpj: null, limite: "", taxa: "", obs: "",
      dt_aprovacao_comite: null,
      dt_documentos_sec: null, dt_geracao_contrato_sec: null, dt_assinatura_contrato_sec: null, dt_apto_sec: null,
      dt_documentos_fidc: null, dt_geracao_contrato_fidc: null, dt_assinatura_contrato_fidc: null, 
      dt_envio_gestora_fidc: null, dt_aprovacao_gestora_fidc: null, dt_envio_admin_fidc: null, dt_aprovacao_admin_fidc: null, dt_apto_fidc: null,
      nao_opera_sec: false, nao_opera_fidc: false,
      comercial: usuarioAtual?.perfil === "comercial" || usuarioAtual?.perfil === "sdr" ? usuarioAtual.nome : "",
      _isNovo: true, _isEditado: true
    };
    
    setFiltroStatus("TODOS"); 
    setBusca("");
    setCedentes([novaLinha, ...cedentes]);
    setLinhasExpandidas(prev => ({ ...prev, [`novo-0`]: true }));
  };

  const excluirCedente = async (id: string | undefined, index: number, nome: string) => {
    const confirmacao = window.confirm(`⚠️ TEM CERTEZA?\n\nVocê está prestes a excluir permanentemente o cadastro de:\n"${nome || "Novo Cedente"}"\n\nEssa ação não pode ser desfeita.`);
    if (!confirmacao) return;

    try {
      setCarregando(true);
      if (id) {
        const { error } = await supabase.from("cadastro_cedentes").delete().eq("id", id);
        if (error) throw error;
      }
      
      const novos = [...cedentes];
      novos.splice(index, 1);
      setCedentes(novos);
      setCedentesEmEdicaoDeNome({});
      setLinhasExpandidas({});
      
    } catch (err: any) {
      alert(`❌ Erro ao excluir: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const toggleEditarNome = (idOuIndex: string) => setCedentesEmEdicaoDeNome(prev => ({ ...prev, [idOuIndex]: !prev[idOuIndex] }));
  const toggleExpandirLinha = (idOuIndex: string) => setLinhasExpandidas(prev => ({ ...prev, [idOuIndex]: !prev[idOuIndex] }));
  const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc" }));
  
  const handleExpandirTudo = () => {
    const novoEstado: Record<string, boolean> = {};
    const jaEstaoTodosAbertos = Object.keys(linhasExpandidas).length === cedentesProcessados.length;
    if (!jaEstaoTodosAbertos) {
      cedentesProcessados.forEach((c, idx) => novoEstado[c.id || `novo-${idx}`] = true);
    }
    setLinhasExpandidas(novoEstado);
  };

  const copiarCNPJ = (cnpjRaw: string, idUnico: string) => {
    const cnpjFormatado = formatarCNPJ(cnpjRaw);
    navigator.clipboard.writeText(cnpjFormatado);
    
    setCnpjsCopiados(prev => ({ ...prev, [idUnico]: true }));
    setTimeout(() => {
      setCnpjsCopiados(prev => ({ ...prev, [idUnico]: false }));
    }, 2000);
  };

  const salvarLinha = async (item: any) => {
    try {
      setSalvando(true);
      if (item._isNovo && (!item.cedente || item.cedente.trim() === "")) {
        alert("⚠️ Preencha o nome do Cedente antes de salvar!");
        setSalvando(false);
        return;
      }
      
      const cnpjFinal = item.cnpj ? item.cnpj.replace(/\D/g, "") : null;

      const payload: any = {
        cedente: limparNome(item.cedente), limite: item.limite || "", taxa: item.taxa || "", obs: item.obs || "",
        cnpj: cnpjFinal === "" ? null : cnpjFinal,
        dt_aprovacao_comite: item.dt_aprovacao_comite || null,
        dt_documentos_sec: item.dt_documentos_sec || null, dt_geracao_contrato_sec: item.dt_geracao_contrato_sec || null,
        dt_assinatura_contrato_sec: item.dt_assinatura_contrato_sec || null, dt_apto_sec: item.dt_apto_sec || null,
        dt_documentos_fidc: item.dt_documentos_fidc || null, dt_geracao_contrato_fidc: item.dt_geracao_contrato_fidc || null,
        dt_assinatura_contrato_fidc: item.dt_assinatura_contrato_fidc || null, dt_envio_gestora_fidc: item.dt_envio_gestora_fidc || null,
        dt_aprovacao_gestora_fidc: item.dt_aprovacao_gestora_fidc || null, dt_envio_admin_fidc: item.dt_envio_admin_fidc || null,
        dt_aprovacao_admin_fidc: item.dt_aprovacao_admin_fidc || null, dt_apto_fidc: item.dt_apto_fidc || null,
        nao_opera_sec: item.nao_opera_sec || false, nao_opera_fidc: item.nao_opera_fidc || false,
        comercial: item.comercial, atualizado_em: new Date().toISOString()
      };

      if (item._isNovo) payload.responsavel_id = usuarioAtual?.id;
      if (item.id) payload.id = item.id;

      const { error } = await supabase.from("cadastro_cedentes").upsert(payload);
      if (error) {
        if (error.code === '23505' && error.message.includes('cnpj')) {
           throw new Error("Este CNPJ já está cadastrado em outro cedente.");
        }
        throw error;
      }
      
      await carregarCadastro();
      alert(`✅ Cadastro salvo com sucesso!`);
      
    } catch (err: any) { 
      alert(`❌ Erro ao salvar: ${err.message}`); 
    } finally { 
      setSalvando(false); 
    }
  };

  const salvarAlteracoes = async () => {
    try {
      setSalvando(true);
      const linhasInvalidas = cedentes.filter(c => c._isNovo && (!c.cedente || c.cedente.trim() === ""));
      if (linhasInvalidas.length > 0) {
        alert("⚠️ Preencha o nome do Cedente nas novas linhas antes de salvar!");
        setSalvando(false);
        return;
      }

      const alvosEnvio = cedentes.filter(c => c._isEditado || c._isNovo);
      if (alvosEnvio.length === 0) {
        alert("💡 Nenhuma alteração pendente para salvar.");
        setSalvando(false);
        return;
      }

      for (const item of alvosEnvio) {
        const cnpjFinal = item.cnpj ? item.cnpj.replace(/\D/g, "") : null;
        
        const payload: any = {
          cedente: limparNome(item.cedente), limite: item.limite || "", taxa: item.taxa || "", obs: item.obs || "",
          cnpj: cnpjFinal === "" ? null : cnpjFinal,
          dt_aprovacao_comite: item.dt_aprovacao_comite || null,
          dt_documentos_sec: item.dt_documentos_sec || null, dt_geracao_contrato_sec: item.dt_geracao_contrato_sec || null,
          dt_assinatura_contrato_sec: item.dt_assinatura_contrato_sec || null, dt_apto_sec: item.dt_apto_sec || null,
          dt_documentos_fidc: item.dt_documentos_fidc || null, dt_geracao_contrato_fidc: item.dt_geracao_contrato_fidc || null,
          dt_assinatura_contrato_fidc: item.dt_assinatura_contrato_fidc || null, dt_envio_gestora_fidc: item.dt_envio_gestora_fidc || null,
          dt_aprovacao_gestora_fidc: item.dt_aprovacao_gestora_fidc || null, dt_envio_admin_fidc: item.dt_envio_admin_fidc || null,
          dt_aprovacao_admin_fidc: item.dt_aprovacao_admin_fidc || null, dt_apto_fidc: item.dt_apto_fidc || null,
          nao_opera_sec: item.nao_opera_sec || false, nao_opera_fidc: item.nao_opera_fidc || false,
          comercial: item.comercial, atualizado_em: new Date().toISOString()
        };

        if (item._isNovo) payload.responsavel_id = usuarioAtual?.id;
        if (item.id) payload.id = item.id;
        const { error } = await supabase.from("cadastro_cedentes").upsert(payload);
        if (error) {
          if (error.code === '23505' && error.message.includes('cnpj')) {
            throw new Error(`O CNPJ de ${item.cedente} já está sendo usado por outro cadastro.`);
          }
          throw error;
        }
      }
      
      alert("🎉 Alterações gravadas com sucesso!");
      setCedentesEmEdicaoDeNome({});
      setLinhasExpandidas({});
      await carregarCadastro();
    } catch (err: any) { 
      alert(`❌ Erro ao salvar: ${err.message}`); 
    } finally { 
      setSalvando(false); 
    }
  };

  const analiseEsteira = useMemo(() => {
    let pendenteEnvio = 0, aguardandoAssinatura = 0, emAndamento = 0, aptos = 0, somaDiasSla = 0, totalContratosAssinados = 0;

    cedentes.forEach(c => {
      const isApto = c.dt_apto_sec || c.dt_apto_fidc;
      if (isApto) aptos++;
      else {
        const isEmAndamento = 
          (!c.nao_opera_sec && c.dt_assinatura_contrato_sec && !c.dt_apto_sec) || 
          (!c.nao_opera_fidc && c.dt_assinatura_contrato_fidc && !c.dt_apto_fidc);

        if (isEmAndamento) {
          emAndamento++;
        } else if (
          (!c.nao_opera_sec && c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || 
          (!c.nao_opera_fidc && c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc)
        ) {
          aguardandoAssinatura++;
        } else if (!c.dt_aprovacao_comite && (!c.nao_opera_sec || !c.nao_opera_fidc)) {
          pendenteEnvio++;
        }
      }

      if (c.dt_aprovacao_comite && (c.dt_assinatura_contrato_sec || c.dt_assinatura_contrato_fidc)) {
        const d1 = new Date(c.dt_aprovacao_comite);
        const d2 = new Date(c.dt_assinatura_contrato_sec || c.dt_assinatura_contrato_fidc);
        somaDiasSla += Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        totalContratosAssinados++;
      }
    });

    return { pendenteEnvio, aguardandoAssinatura, emAndamento, aptos, slaMedio: totalContratosAssinados > 0 ? (somaDiasSla / totalContratosAssinados).toFixed(0) : "0" };
  }, [cedentes]);

  const getStatusWeight = (c: any) => {
    const isApto = c.dt_apto_sec || c.dt_apto_fidc;
    if (isApto) return 4;
    const isEmAndamento = (!c.nao_opera_sec && c.dt_assinatura_contrato_sec) || (!c.nao_opera_fidc && c.dt_assinatura_contrato_fidc);
    if (isEmAndamento) return 3;
    const isAguardandoAssinatura = (!c.nao_opera_sec && c.dt_geracao_contrato_sec) || (!c.nao_opera_fidc && c.dt_geracao_contrato_fidc);
    if (isAguardandoAssinatura) return 2;
    return 1;
  };

  const cedentesProcessados = useMemo(() => {
    let resultado = cedentes.filter(c => {
      if (busca && !c.cedente.toLowerCase().includes(busca.toLowerCase())) return false;
      const isApto = c.dt_apto_sec || c.dt_apto_fidc;
      if (filtroStatus === "TODOS") return true;
      if (filtroStatus === "APTO") return !!isApto;
      
      const isEmAndamento = (!c.nao_opera_sec && c.dt_assinatura_contrato_sec && !c.dt_apto_sec) || (!c.nao_opera_fidc && c.dt_assinatura_contrato_fidc && !c.dt_apto_fidc);
      if (filtroStatus === "EM_ANDAMENTO") return !isApto && isEmAndamento;
      
      const isAguardando = (!c.nao_opera_sec && c.dt_geracao_contrato_sec && !c.dt_assinatura_contrato_sec) || (!c.nao_opera_fidc && c.dt_geracao_contrato_fidc && !c.dt_assinatura_contrato_fidc);
      if (filtroStatus === "AGUARDANDO_ASSINATURA") return !isApto && !isEmAndamento && isAguardando;
      
      if (filtroStatus === "PENDENTE_ENVIO") return !isApto && !isEmAndamento && !isAguardando && !c.dt_aprovacao_comite;

      return true;
    });

    resultado.sort((a: any, b: any) => {
      if (sortConfig.key === "status") {
        return sortConfig.direction === "asc" ? getStatusWeight(a) - getStatusWeight(b) : getStatusWeight(b) - getStatusWeight(a);
      }
      
      let valA = a[sortConfig.key], valB = b[sortConfig.key];
      if (sortConfig.key === "limite") {
        valA = parseFloat(String(valA || "").replace(/\D/g, "")) || 0;
        valB = parseFloat(String(valB || "").replace(/\D/g, "")) || 0;
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }
      if (typeof valA === "string") return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortConfig.direction === "asc" ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
    });

    return resultado;
  }, [cedentes, filtroStatus, sortConfig, busca]);

  const renderTimelineUI = (visualSteps: any[], item: any, type: "SEC" | "FIDC") => {
    const isFidc = type === "FIDC";
    const naoOpera = isFidc ? item.nao_opera_fidc : item.nao_opera_sec;
    
    const doneLineClass = isFidc ? "bg-purple-200" : "bg-blue-200";
    const doneDotClass = isFidc ? "bg-purple-500 border-purple-500" : "bg-blue-500 border-blue-500";
    const currentBorderClass = isFidc ? "border-purple-600" : "border-blue-600";
    const currentPulseBg = isFidc ? "bg-purple-600" : "bg-blue-600";
    const currentTextClass = isFidc ? "text-purple-700" : "text-blue-700";
    const passedEmptyDotClass = isFidc ? "border-purple-300 bg-purple-50" : "border-blue-300 bg-blue-50";

    const validSteps = visualSteps.filter(s => !s.isNA);

    let lastFilledValidIndex = -1;
    for (let i = validSteps.length - 1; i >= 0; i--) {
      if (item[validSteps[i].key]) {
        lastFilledValidIndex = i;
        break;
      }
    }

    const currentValidStepIndex = (lastFilledValidIndex === validSteps.length - 1 || naoOpera) ? -1 : lastFilledValidIndex + 1;
    const currentValidStepKey = currentValidStepIndex !== -1 ? validSteps[currentValidStepIndex].key : null;
    const currentVisualIndex = currentValidStepKey ? visualSteps.findIndex(s => s.key === currentValidStepKey) : -1;

    return (
      <div className={`flex w-full relative pt-2 pb-1 ${naoOpera ? "grayscale opacity-80" : ""}`}>
        {visualSteps.map((step, idx) => {
          const isNAOrig = !!step.isNA; 
          const isDone = !isNAOrig && !!item[step.key];
          const isNA = isNAOrig || (naoOpera && !isDone);
          const isCurrent = !isNA && idx === currentVisualIndex;
          const isLast = idx === visualSteps.length - 1;
          const isPassedAndEmpty = !isNA && !isDone && (currentVisualIndex === -1 || idx < currentVisualIndex);
          const isLineActive = currentVisualIndex === -1 ? true : idx < currentVisualIndex;

          let circleClasses = "w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all duration-300 border-2 ";
          if (isNA) circleClasses += "bg-slate-200 border-slate-300 text-slate-400 opacity-60";
          else if (isDone) circleClasses += `${doneDotClass} text-white opacity-50`;
          else if (isCurrent) circleClasses += `bg-white border-[3px] ${currentBorderClass} shadow-md`;
          else if (isPassedAndEmpty) circleClasses += passedEmptyDotClass;
          else circleClasses += "bg-white border-slate-200";

          return (
            <div key={step.key} className={`relative flex flex-col items-center group ${isLast ? "flex-none w-12" : "flex-1"}`}>
              {!isLast && (
                <div className={`absolute top-2.5 left-1/2 w-full h-1 -z-10 transition-all duration-500 ${isLineActive && !naoOpera ? doneLineClass : "bg-slate-200/60 rounded-full"}`} />
              )}
              <div className="relative flex items-center justify-center">
                {isCurrent && !naoOpera && <div className={`absolute w-8 h-8 rounded-full animate-ping opacity-30 ${currentPulseBg}`} />}
                <div className={circleClasses}>
                  {isNA ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className={`w-2.5 h-2.5 rounded-full ${naoOpera ? "bg-slate-300" : `animate-pulse ${currentPulseBg}`}`} />
                  ) : null}
                </div>
              </div>
              <span className={`text-[9px] mt-1.5 text-center leading-tight transition-colors absolute top-7 w-20 
                ${isNA ? "text-slate-400 font-medium opacity-60" : 
                  isDone ? "text-slate-400 font-semibold" : 
                  isCurrent ? `${currentTextClass} font-black` : 
                  isPassedAndEmpty ? "text-slate-700 font-bold" : 
                  "text-slate-400 font-medium"}
              `}>
                {step.label}
              </span>
              {isDone && !isNAOrig && (
                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2.5 rounded-md shadow-lg pointer-events-none z-50 whitespace-nowrap">
                  {formatarDataBr(item[step.key])}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8 font-sans text-slate-800" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* OVERLAY DE LOADING GLOBAL */}
        {statusTexto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center font-bold text-white text-sm gap-4 transition-all">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="tracking-wide uppercase text-xs">{statusTexto}</span>
          </div>
        )}

        {/* HEADER MODERNO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Esteira de Cadastro e Aprovações</h2>
            </div>
            <span className="text-sm text-slate-500 font-medium ml-12">Monitoramento de cadastro, conversão e emissão de contratos.</span>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button 
              onClick={buscarAprovadasDoComite} 
              disabled={sincronizando || carregando} 
              className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sincronizando ? (
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Sincronizar Comitê
            </button>

            <button onClick={adicionarNovaLinha} disabled={salvando || carregando} className="flex-1 md:flex-none px-4 py-2.5 bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              Novo Manual
            </button>
            
            <button onClick={salvarAlteracoes} disabled={salvando || carregando} className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 w-full md:w-auto">
              {salvando ? (
                 <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              )}
              Salvar Tudo
            </button>
          </div>
        </div>

        {/* PAINEL DE KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          <button onClick={() => setFiltroStatus("TODOS")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "TODOS" ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md text-slate-800"}`}>
            <span className={`text-[11px] font-bold uppercase tracking-widest block mb-2 ${filtroStatus === "TODOS" ? "text-slate-400" : "text-slate-500"}`}>Total em Esteira</span>
            <span className="text-4xl font-black">{cedentes.length}</span>
          </button>
          
          <button onClick={() => setFiltroStatus("PENDENTE_ENVIO")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-50 border-rose-200 shadow-md shadow-rose-100" : "bg-white border-slate-200 hover:border-rose-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "PENDENTE_ENVIO" ? "bg-rose-500" : "bg-rose-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Pendente Comitê</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.pendenteEnvio}</span>
          </button>

          <button onClick={() => setFiltroStatus("AGUARDANDO_ASSINATURA")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "bg-amber-50 border-amber-200 shadow-md shadow-amber-100" : "bg-white border-slate-200 hover:border-amber-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "AGUARDANDO_ASSINATURA" ? "bg-amber-500" : "bg-amber-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Em Assinatura</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.aguardandoAssinatura}</span>
          </button>

          <button onClick={() => setFiltroStatus("EM_ANDAMENTO")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "EM_ANDAMENTO" ? "bg-fuchsia-50 border-fuchsia-200 shadow-md shadow-fuchsia-100" : "bg-white border-slate-200 hover:border-fuchsia-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "EM_ANDAMENTO" ? "bg-fuchsia-500" : "bg-fuchsia-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-fuchsia-500"></div> Em Andamento</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.emAndamento}</span>
          </button>

          <button onClick={() => setFiltroStatus("APTO")} className={`relative overflow-hidden p-5 rounded-2xl text-left transition-all duration-300 border ${filtroStatus === "APTO" ? "bg-emerald-50 border-emerald-200 shadow-md shadow-emerald-100" : "bg-white border-slate-200 hover:border-emerald-200 hover:shadow-md"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${filtroStatus === "APTO" ? "bg-emerald-500" : "bg-emerald-400/50"}`}></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 block mb-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Aptos a Operar</span>
            <span className="text-4xl font-black text-slate-800">{analiseEsteira.aptos}</span>
          </button>

          <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-600/30 border border-indigo-500">
             <svg className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
             <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-100 block mb-2">SLA Médio Aprovação</span>
             <div className="flex items-baseline gap-1.5">
               <span className="text-4xl font-black">{analiseEsteira.slaMedio}</span>
               <span className="text-sm font-bold text-indigo-200">dias</span>
             </div>
          </div>
        </div>

        {/* =============== NOVOS BOTÕES DE DISPARO EM LOTE =============== */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Notificações Automáticas</h3>
              <p className="text-[10px] text-slate-500">Avisar os comerciais sobre as mudanças de fase na esteira</p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0">
            {!gmailConectado ? (
              <a 
                href={`/api/auth/google?user=${usuarioAtual?.email}&origin=/dashboard/cadastro`}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-black transition-colors whitespace-nowrap flex items-center gap-2 uppercase tracking-wide shadow-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.333.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                Conectar Conta Google
              </a>
            ) : (
              <>
                <button 
                  onClick={() => abrirModalDisparo("PENDENCIA")}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  Avisar Pendência (Docs)
                </button>
                <button 
                  onClick={() => abrirModalDisparo("ASSINATURA")}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  Avisar Assinaturas
                </button>
                <button 
                  onClick={() => abrirModalDisparo("GESTORA")}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  Avisar FIDC (Gestora)
                </button>
                <button 
                  onClick={() => abrirModalDisparo("APTO")}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  Avisar Aptos a Operar
                </button>
              </>
            )}
          </div>
        </div>

        {/* BARRA DE BUSCA */}
        <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <svg className="w-5 h-5 text-slate-400 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por nome do Cedente..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-slate-700 font-medium p-2"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="mr-3 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* ÁREA DA TABELA */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-widest h-14">
                  <th className="w-14 px-4 text-center">
                    <button onClick={handleExpandirTudo} title="Expandir/Recolher" className="w-7 h-7 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                    </button>
                  </th>
                  <th onClick={() => handleSort("cedente")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-72">
                    <div className="flex items-center gap-1">Cedente / CNPJ {sortConfig.key === "cedente" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                  {usuarioAtual?.perfil !== "comercial" && (
                    <th onClick={() => handleSort("comercial")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-32">
                      <div className="flex items-center gap-1">Responsável {sortConfig.key === "comercial" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                    </th>
                  )}
                  <th onClick={() => handleSort("limite")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-32">
                    <div className="flex items-center gap-1">Limite R$ {sortConfig.key === "limite" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                  <th onClick={() => handleSort("taxa")} className="px-4 cursor-pointer hover:text-indigo-600 transition-colors w-24">
                    <div className="flex items-center gap-1">Taxa % {sortConfig.key === "taxa" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                  <th onClick={() => handleSort("status")} className="px-6 min-w-[600px] cursor-pointer hover:text-indigo-600 transition-colors">
                    <div className="flex items-center gap-1">Status Operacional (Sec / FIDC) {sortConfig.key === "status" && (sortConfig.direction === "asc" ? "↑" : "↓")}</div>
                  </th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-sm">
                {cedentesProcessados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500 font-medium">Nenhum cedente encontrado para esse filtro.</td>
                  </tr>
                ) : cedentesProcessados.map((item) => {
                  const index = cedentes.findIndex(c => c === item);
                  const identificadorUnico = item.id || `novo-${index}`;
                  const isEditandoNome = !!cedentesEmEdicaoDeNome[identificadorUnico] || item._isNovo;
                  const isOpen = !!linhasExpandidas[identificadorUnico];

                  return (
                    <tr key={identificadorUnico} style={{ display: "contents" }}>
                      <tr className={`group transition-all duration-200 ${isOpen ? "bg-indigo-50/30" : "hover:bg-slate-50"} ${item._isNovo ? "bg-amber-50/30" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => toggleExpandirLinha(identificadorUnico)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-all border ${isOpen ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30" : "bg-white text-slate-400 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 shadow-sm"}`}
                          >
                            <svg className={`w-4 h-4 transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </td>
                        
                        {/* COLUNA DO CEDENTE + CNPJ */}
                        <td className="px-4 py-3 align-top">
                          {isEditandoNome ? (
                            <div className="flex flex-col gap-2">
                              <input 
                                type="text" placeholder="NOME DA EMPRESA" value={item.cedente} 
                                onChange={(e) => handleInputChange(index, "cedente", e.target.value.toUpperCase())} 
                                className="w-full p-2 border-2 border-indigo-300 rounded-lg font-black text-sm uppercase bg-white shadow-inner outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                                autoFocus={item._isNovo}
                              />
                              <input 
                                type="text" placeholder="CNPJ (Apenas números)" value={formatarCNPJ(item.cnpj)} 
                                onChange={(e) => handleCnpjChange(index, e.target.value)}
                                maxLength={18}
                                className="w-full p-1.5 border border-slate-300 rounded-md font-mono text-xs bg-slate-50 outline-none focus:border-indigo-400 focus:bg-white transition-all text-slate-600" 
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 mt-1">
                              <div className="flex items-center gap-3">
                                <span className="font-extrabold text-slate-800 tracking-tight truncate max-w-[200px]" title={item.cedente}>{item.cedente}</span>
                                <button onClick={() => toggleEditarNome(identificadorUnico)} className="opacity-0 group-hover:opacity-100 text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-md transition-all">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              </div>
                              
                              {/* EXIBIÇÃO DO CNPJ FORMATADO */}
                              {item.cnpj ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono font-semibold text-slate-500 select-all cursor-text" title="Duplo clique para selecionar">
                                    {formatarCNPJ(item.cnpj)}
                                  </span>
                                  <button 
                                    onClick={() => copiarCNPJ(item.cnpj, identificadorUnico)} 
                                    className={`p-1 rounded transition-colors ${cnpjsCopiados[identificadorUnico] ? "text-emerald-500 bg-emerald-50" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"}`}
                                    title="Copiar CNPJ"
                                  >
                                    {cnpjsCopiados[identificadorUnico] ? (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => toggleEditarNome(identificadorUnico)} className="text-[10px] text-slate-400 hover:text-indigo-600 hover:border-indigo-400 text-left border border-dashed border-slate-300 rounded px-1.5 py-0.5 w-max transition-colors mt-0.5">
                                  + Add CNPJ
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {usuarioAtual?.perfil !== "comercial" && (
                          <td className="px-4 py-3 align-top pt-4">
                             <input type="text" value={item.comercial || ""} onChange={(e) => handleInputChange(index, "comercial", e.target.value)} 
                               className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-md text-sm font-semibold text-indigo-700 bg-transparent transition-all outline-none" 
                               placeholder="Comercial" />
                          </td>
                        )}

                        <td className="px-4 py-3 align-top pt-4">
                          <input type="text" value={item.limite || ""} onChange={(e) => handleLimiteInputChange(index, e.target.value)} 
                            className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-md text-sm font-bold font-mono text-slate-700 bg-transparent transition-all outline-none" 
                            placeholder="R$ 0,00" />
                        </td>
                        
                        <td className="px-4 py-3 align-top pt-4">
                          <input type="text" value={item.taxa || ""} onChange={(e) => handleInputChange(index, "taxa", e.target.value)} 
                            className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-md text-sm font-bold font-mono text-slate-600 bg-transparent transition-all outline-none" 
                            placeholder="0,00%" />
                        </td>

                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                              <span className={`text-[10px] font-black w-8 py-1 rounded-md text-center transition-colors ${item.nao_opera_sec ? "bg-slate-100 text-slate-400" : "text-blue-600 bg-blue-50"}`}>SEC</span>
                              <div className="flex-1">{renderTimelineUI(VISUAL_STEPS_SEC, item, "SEC")}</div>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <span className={`text-[10px] font-black w-8 py-1 rounded-md text-center transition-colors ${item.nao_opera_fidc ? "bg-slate-100 text-slate-400" : "text-purple-600 bg-purple-50"}`}>FIDC</span>
                              <div className="flex-1">{renderTimelineUI(VISUAL_STEPS_FIDC, item, "FIDC")}</div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={usuarioAtual?.perfil !== "comercial" ? 6 : 5} className="bg-slate-50 border-b-2 border-indigo-100 p-6 shadow-inner">
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                              
                              <div className="xl:col-span-3 space-y-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                                  <button
                                    onClick={() => excluirCedente(item.id, index, item.cedente)}
                                    className="absolute top-3 right-3 text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 p-1.5 rounded transition-colors"
                                    title="Excluir Cedente"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                  
                                  <div className="flex items-center gap-2 mb-3 pr-8">
                                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600">🏁</div>
                                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">Início da Esteira</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase">Data Comitê de Crédito</label>
                                    <input type="date" value={item.dt_aprovacao_comite || ""} onChange={(e) => handleInputChange(index, "dt_aprovacao_comite", e.target.value)} 
                                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 hover:bg-white" />
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <label className="flex items-center gap-2 mb-2 text-[10px] text-slate-500 font-bold uppercase">
                                    <div className="w-2 h-2 rounded-full bg-amber-400"></div> Observações e Impasses
                                  </label>
                                  <textarea value={item.obs || ""} onChange={(e) => handleInputChange(index, "obs", e.target.value)} 
                                    className="w-full p-3 border border-slate-300 rounded-lg text-sm h-[88px] resize-none outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 bg-slate-50 hover:bg-white transition-all text-slate-700" 
                                    placeholder="Ex: No aguardo das certidões..." />
                                </div>
                              </div>

                              <div className="xl:col-span-9 space-y-4">
                                <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                                  <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${item.nao_opera_sec ? "bg-slate-300" : "bg-blue-500"}`}></div>
                                  <div className="flex items-center justify-between gap-2 mb-4 ml-2 mr-2">
                                    <span className={`font-black text-xs uppercase tracking-wider transition-colors ${item.nao_opera_sec ? "text-slate-400 line-through" : "text-blue-800"}`}>🏦 Fluxo Securitizadora</span>
                                    <button 
                                      onClick={() => handleInputChange(index, "nao_opera_sec", !item.nao_opera_sec)} 
                                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all border ${item.nao_opera_sec ? "bg-rose-100 text-rose-700 border-rose-200 shadow-inner" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 shadow-sm"}`}
                                    >
                                      {item.nao_opera_sec ? "🚫 NÃO OPERA (INATIVO)" : "Desativar Securitizadora"}
                                    </button>
                                  </div>
                                  <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ml-2 transition-opacity duration-300 ${item.nao_opera_sec ? "opacity-40 pointer-events-none" : ""}`}>
                                    {STEPS_SEC.slice(1).map(step => (
                                      <div key={step.key} className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-blue-600/80 font-bold uppercase truncate" title={step.label}>{step.label}</label>
                                        <input type="date" value={item[step.key] || ""} onChange={(e) => handleInputChange(index, step.key, e.target.value)} 
                                          className="p-2 border border-blue-200 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white shadow-sm transition-all" />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                                  <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${item.nao_opera_fidc ? "bg-slate-300" : "bg-purple-500"}`}></div>
                                  <div className="flex items-center justify-between gap-2 mb-4 ml-2 mr-2">
                                    <span className={`font-black text-xs uppercase tracking-wider transition-colors ${item.nao_opera_fidc ? "text-slate-400 line-through" : "text-purple-800"}`}>🔮 Fluxo FIDC</span>
                                    <button 
                                      onClick={() => handleInputChange(index, "nao_opera_fidc", !item.nao_opera_fidc)} 
                                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all border ${item.nao_opera_fidc ? "bg-rose-100 text-rose-700 border-rose-200 shadow-inner" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 shadow-sm"}`}
                                    >
                                      {item.nao_opera_fidc ? "🚫 NÃO OPERA (INATIVO)" : "Desativar FIDC"}
                                    </button>
                                  </div>
                                  <div className={`grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4 ml-2 transition-opacity duration-300 ${item.nao_opera_fidc ? "opacity-40 pointer-events-none" : ""}`}>
                                    {STEPS_FIDC.slice(1).map(step => (
                                      <div key={step.key} className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-purple-600/80 font-bold uppercase truncate" title={step.label}>{step.label}</label>
                                        <input type="date" value={item[step.key] || ""} onChange={(e) => handleInputChange(index, step.key, e.target.value)} 
                                          className="p-2 border border-purple-200 rounded-lg text-sm font-mono font-bold text-slate-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 bg-white shadow-sm transition-all" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="xl:col-span-12 flex justify-end mt-2 pt-4 border-t border-slate-200/60">
                                <button 
                                  onClick={() => salvarLinha(item)} 
                                  disabled={salvando || (!item._isEditado && !item._isNovo)} 
                                  className={`px-5 py-2.5 font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2
                                    ${salvando || (!item._isEditado && !item._isNovo) 
                                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30"
                                    }`}
                                >
                                  {salvando ? (
                                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  )}
                                  {item._isEditado || item._isNovo ? "Salvar Cadastro" : "Salvo"}
                                </button>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ======================= MODAL DE DISPARO EM LOTE ======================= */}
      {modalDisparoAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Disparo: {tipoDisparoAtual === "APTO" ? "Aptos a Operar" : tipoDisparoAtual === "GESTORA" ? "Em Análise Gestora" : tipoDisparoAtual === "PENDENCIA" ? "Pendência de Documentos" : "Em Assinatura"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure o envio automático para os comerciais.</p>
              </div>
              <button onClick={() => !enviandoLote && setModalDisparoAberto(false)} disabled={enviandoLote} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-white space-y-6">
              
              {/* SELECT DE TEMPLATES */}
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-900 mb-2 uppercase">1. Selecione o Roteiro (Template):</label>
                <select 
                  value={templateSelecionadoId}
                  onChange={(e) => setTemplateSelecionadoId(e.target.value)}
                  disabled={enviandoLote || templatesEmail.length === 0}
                  className="w-full p-3 bg-white border border-indigo-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                >
                  <option value="" disabled>-- Clique para escolher um template --</option>
                  {templatesEmail.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
                {templatesEmail.length === 0 && <p className="text-[10px] text-rose-500 mt-1">Nenhum template cadastrado no banco.</p>}
              </div>

              {/* 🌟 MÓDULO EXCLUSIVO PARA PENDÊNCIAS DE DOCUMENTOS */}
              {tipoDisparoAtual === "PENDENCIA" && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                  <label className="block text-xs font-bold text-rose-900 mb-2 uppercase">2. Selecione os Documentos Pendentes:</label>
                  
                  {/* Busca e Adição de Documento */}
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="text" 
                      placeholder="Buscar doc ou digitar novo..." 
                      value={novoDocInput} 
                      onChange={(e) => {
                        setNovoDocInput(e.target.value);
                        setBuscaDoc(e.target.value); 
                      }}
                      className="flex-1 p-2 border border-rose-300 rounded-lg text-sm outline-none focus:border-rose-500"
                    />
                    <button 
                      onClick={salvarNovoDocumentoNoBanco}
                      disabled={!novoDocInput.trim()}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg disabled:opacity-50 transition-colors"
                    >
                      + Cadastrar Novo
                    </button>
                  </div>

                  {/* Lista de Documentos */}
                  <div className="max-h-40 overflow-y-auto border border-rose-200 rounded-lg bg-white p-2 space-y-1">
                    {listaDocsGerais.filter(d => d.toLowerCase().includes(buscaDoc.toLowerCase())).map(doc => (
                      <label key={doc} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${docsMarcadosParaEnvio.includes(doc) ? "bg-rose-100" : "hover:bg-slate-50"}`}>
                        <input 
                          type="checkbox" 
                          checked={docsMarcadosParaEnvio.includes(doc)} 
                          onChange={() => toggleDocMarcado(doc)} 
                          disabled={enviandoLote}
                          className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                        />
                        <span className="text-sm text-slate-700 font-medium flex-1">{doc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* SELEÇÃO DE CLIENTES */}
              {cedentesDisponiveis.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum cliente está nesta fase no momento.
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      {tipoDisparoAtual === "PENDENCIA" ? "3." : "2."} Selecione os Clientes ({cedentesModalFiltrados.length}):
                    </label>
                    <button 
                      onClick={selecionarTodosDisparo} 
                      disabled={enviandoLote}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      {selecionadosParaDisparo.length === cedentesModalFiltrados.length && cedentesModalFiltrados.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
                    </button>
                  </div>

                  {/* 🌟 LUPA DE PESQUISA INTERNA NO MODAL */}
                  <div className="mb-3 relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input 
                      type="text" 
                      placeholder="🔍 Buscar cedente para notificar..." 
                      value={buscaModalDisparo}
                      onChange={(e) => setBuscaModalDisparo(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:bg-white focus:border-indigo-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {cedentesModalFiltrados.map(c => (
                      <div key={c.id} className={`flex items-center justify-between p-3 border rounded-xl transition-colors ${selecionadosParaDisparo.includes(c.id) ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:bg-slate-50"}`}>
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input 
                            type="checkbox" 
                            checked={selecionadosParaDisparo.includes(c.id)} 
                            onChange={() => toggleSelecaoDisparo(c.id)} 
                            disabled={enviandoLote}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div>
                            <p className="font-bold text-sm text-slate-800">{c.cedente}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Comercial: {c.comercial || "Não definido"}</p>
                          </div>
                        </label>
                        
                        {/* 🌟 BOTÃO TOGGLE SEC/FIDC */}
                        {selecionadosParaDisparo.includes(c.id) && (
                          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner ml-2 shrink-0">
                            <button 
                              onClick={() => setFundoDisparo(prev => ({...prev, [c.id]: "SEC"}))}
                              disabled={enviandoLote}
                              className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all uppercase tracking-wider ${fundoDisparo[c.id] === "SEC" || !fundoDisparo[c.id] ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}
                            >
                              SEC
                            </button>
                            <button 
                              onClick={() => setFundoDisparo(prev => ({...prev, [c.id]: "FIDC"}))}
                              disabled={enviandoLote}
                              className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all uppercase tracking-wider ${fundoDisparo[c.id] === "FIDC" ? "bg-purple-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}
                            >
                              FIDC
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {cedentesModalFiltrados.length === 0 && (
                      <div className="text-center text-xs text-slate-400 py-4 italic">Nenhum cedente encontrado com este nome.</div>
                    )}
                  </div>
                </div>
              )}

              {/* LOGS DE ENVIO */}
              {logsDisparo.length > 0 && (
                <div className="p-3 bg-slate-900 rounded-xl max-h-32 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 border border-slate-700">
                  {logsDisparo.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">
                {selecionadosParaDisparo.length} selecionado(s)
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setModalDisparoAberto(false)} 
                  disabled={enviandoLote}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Fechar
                </button>
                <button 
                  onClick={executarDisparoEmLote}
                  disabled={enviandoLote || selecionadosParaDisparo.length === 0 || !templateSelecionadoId}
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                  {enviandoLote ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Processando Lote...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Disparar E-mails
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ESTILOS DE SCROLL E HIDE */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}