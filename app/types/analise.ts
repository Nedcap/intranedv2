// types/analise.ts
export interface FilaItem {
  id: string;
  empresa_nome: string;
  cnpj: string;
  status: string;
}

export interface EmpresaPrincipal {
  razao_social: string;
  cnpj: string;
}

export interface PropostaItem {
  modalidade: string;
  limite: number;
  prazo: string;
  tranche: number;
  taxa: string;
  garantia: string;
}

export interface EmpresaItem {
  empresa: string;
  cnpj: string;
  fundacao: string;
  idade: string;
}

export interface SocioItem {
  nome: string;
  perc: number;
  funcao: string;
  figura_contrato: string;
}

export interface PatrimonioItem {
  socio: string;
  descricao: string;
  valor: number;
}

export interface FaturamentoMes {
  [mes: string]: number | string;
}

export interface EndividamentoItem {
  instituicao: string;
  modalidade: string;
  saldo: number;
  tipo: "Banco" | "Fundo";
  prazo: "Curto Prazo" | "Longo Prazo";
}

export interface ReferenciaItem {
  instituicao: string;
  rnx: string;
  cliente_desde: string;
  ultima_operacao: string;
  vop?: number; 
  limite_global: number;
  risco_total: number;
  risco_1: number;
  operacao_1: string;
  vcto_1: string;
  risco_2: number;
  operacao_2: string;
  vcto_2: string;
  liquidez_5_dias: string | number; 
  liquidez_pontual: string | number;
  atraso_5_dias: string | number;
  atraso_15_dias: string | number;
  recompra: string;
  concentracao: number;
}

export interface RestritivoItem {
  tipo_restritivo?: string; 
  restritivo?: string; 
  quantidade_somada?: number;
  qtd?: number;
  valor_somado?: number;
  valor?: number;
  data_mais_recente?: string;
  data?: string;
  credores_resumo?: string;
  observacao?: string;
  empresa_socio?: string;
}

export interface EmpresaSocietario {
  papel_no_grupo?: string;
  razao_social: string;
  cnpj: string;
  fundacao?: string;
  capital_social?: number;
  localizacao?: string;
  ramo?: string;
  regra_assinatura?: string;
  socios: SocioItem[];
}

export interface EmpresaFaturamento {
  razao_social: string;
  cnpj: string;
  faturamento: Record<string, FaturamentoMes>;
}

export interface EmpresaEndividamento {
  razao_social: string;
  cnpj: string;
  saldo_total_empresa: number;
  endividamento: EndividamentoItem[];
}

export interface EmpresaSerasa {
  nome_entidade: string;
  documento: string;
  valor_total_entidade: number;
  restritivos: RestritivoItem[];
}

export interface NoticiasMercado {
  risco_midia_nivel?: "baixo" | "medio" | "alto";
  alertas_graves?: string[];
  panorama_setor?: string;
  parecer_analista?: string;
}

export interface AnaliseData {
  id: string | null;
  cnpj: string; 
  razao_social: string; 
  status?: string;
  comercial?: string; 
  dados_documentos?: string[]; 
  is_grupo_economico?: boolean; 

  empresas_principais: EmpresaPrincipal[];
  data_analise: string;
  relacionamento: string;
  analista: string;
  gerente: string;
  rating: string;
  
  fundacao: string;
  capital_social: number;
  localizacao: string;
  ramo: string;
  licencas: string;
  balanco_auditado: string;
  consultoria_gestao: string;
  site: string;

  propostas: PropostaItem[];
  empresas_grupo: EmpresaItem[];
  
  empresas_societario: EmpresaSocietario[];
  empresas_faturamento: EmpresaFaturamento[];
  empresas_endividamento: EmpresaEndividamento[];
  empresas_serasa: EmpresaSerasa[];

  socios: SocioItem[]; 
  regra_assinatura: string;
  aval_societario: string;
  patrimonios: PatrimonioItem[];
  
  dados_faturamento: Record<string, FaturamentoMes>; 
  dados_potencial: { 
    ticket_medio: number; 
    prazo_medio_dpls: string; 
    prazo_medio_comissaria: string; 
    prazo_medio_intercompany: string;
    forma_recebimento_vista: number; 
    forma_recebimento_prazo: number; 
    composicao_dpls: number; 
    composicao_comissaria: number; 
    composicao_intercompany: number;
    composicao_outros: number;
    potencial_estimado: number; 
  };
  
  endividamento_resumo: { renegociando: string };
  endividamento_detalhado: EndividamentoItem[]; 
  referencias: ReferenciaItem[];
  
  restritivos_quadro: { pefin: number; refin: number; protesto: number; div_vencida: number; acao_judicial: number; cheque_sem_fundo: number };
  restritivos: RestritivoItem[]; 
  
  resumo_visita: string;
  noticias_midia: string; 
  noticias_mercado?: NoticiasMercado; 
  parecer_analista: string;
  parecer_comite?: string;
  recomendacao_analista?: string;
  anexos: { organograma_url: string; fachada_url: string; satelite_url: string; fotos_visita_url: string };

  dados_juridico: { relatorio_completo: string; entidades?: any[] };
  parecer_executivo: string;
  organograma_json?: { nodes: any[], edges: any[] } | null;

  [key: string]: any;
}