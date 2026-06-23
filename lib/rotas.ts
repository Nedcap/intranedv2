/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RotaSistema {
  nome: string;
  path: string;
  icone: string;
  // Tipagem atualizada com as novas categorias
  categoria: "Geral" | "Comercial" | "Crédito" | "Financeiro" | "Cadastro" | "Configurações";
  defaultMaster: boolean;
}

export const MAPA_DE_ROTAS: RotaSistema[] = [
  // 🏠 GERAL
  { nome: "Início (Home)", path: "/dashboard", icone: "🏠", categoria: "Geral", defaultMaster: true },

  // 🎯 COMERCIAL
  { nome: "NedHub Comercial", path: "/dashboard/nedhub", icone: "🚀", categoria: "Comercial", defaultMaster: true },
  { nome: "Controle Comercial", path: "/dashboard/comercial", icone: "🎯", categoria: "Comercial", defaultMaster: true },

  // 🛡️ CRÉDITO E RISCO
  { nome: "Análises Em Comitê", path: "/dashboard/comite", icone: "📋", categoria: "Crédito", defaultMaster: true },
  { nome: "Finalizados", path: "/dashboard/finalizados", icone: "🏁", categoria: "Crédito", defaultMaster: true },
  { nome: "Monitore Diário", path: "/dashboard/monitore-diario", icone: "🚨", categoria: "Crédito", defaultMaster: true },
  { nome: "Monitore Histórico", path: "/dashboard/monitore-historico", icone: "📚", categoria: "Crédito", defaultMaster: true },
  { nome: "Restritivos Sócios", path: "/dashboard/restritivos-socios", icone: "👥", categoria: "Crédito", defaultMaster: true },
  { nome: "Carteira Dinâmica", path: "/dashboard/carteira", icone: "📈", categoria: "Crédito", defaultMaster: true },
  { nome: "Estoque Cedentes", path: "/dashboard/estoque-cedentes", icone: "💼", categoria: "Crédito", defaultMaster: true },

  // 💰 FINANCEIRO
  { nome: "Painel de Indicadores (BI)", path: "/dashboard/powerbi", icone: "📊", categoria: "Financeiro", defaultMaster: true },
  { nome: "Controle Financeiro", path: "/dashboard/financeiro", icone: "💰", categoria: "Financeiro", defaultMaster: true },
  { nome: "Controle de Checagem", path: "/dashboard/checagem", icone: "✅", categoria: "Financeiro", defaultMaster: true },
  { nome: "Simulador de Rentabilidade", path: "/dashboard/simulador", icone: "🧮", categoria: "Financeiro", defaultMaster: true }, // <-- Adicionado com sucesso!
  { nome: "Importação de Dados", path: "/dashboard/importacao", icone: "📥", categoria: "Financeiro", defaultMaster: true },

  // 📝 CADASTRO
  { nome: "Cadastro Cedentes", path: "/dashboard/cadastro", icone: "📝", categoria: "Cadastro", defaultMaster: true },
  { nome: "Revisão Cedentes", path: "/dashboard/revisao", icone: "🔍", categoria: "Cadastro", defaultMaster: true },

  // ⚙️ CONFIGURAÇÕES
  { nome: "Gerenciar Usuários", path: "/dashboard/gerenciar-usuarios", icone: "⚙️", categoria: "Configurações", defaultMaster: true },
  { nome: "Hierarquias e Acessos", path: "/dashboard/configuracoes/hierarquia", icone: "🌳", categoria: "Configurações", defaultMaster: true },
  { nome: "Templates de E-mail", path: "/dashboard/configuracoes/templates", icone: "✉️", categoria: "Configurações", defaultMaster: true }
];

export const obterRotasMaster = () => 
  MAPA_DE_ROTAS.filter(r => r.defaultMaster === true).map(r => r.path);