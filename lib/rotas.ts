export interface RotaSistema {
  nome: string;
  path: string;
  icone: string;
  categoria: "Operações" | "Crédito" | "Administração";
  defaultMaster: boolean;
}

export const MAPA_DE_ROTAS: RotaSistema[] = [
  // ⚡ A MÁQUINA DE ORIGINAÇÃO COMERCIAL INTEGRADA:
  { nome: "NedHub Comercial", path: "/dashboard/nedhub", icone: "🚀", categoria: "Operações", defaultMaster: true },

  // DEMAIS ITENS DE OPERAÇÕES
  { nome: "Dashboard Principal", path: "/dashboard", icone: "📈", categoria: "Operações", defaultMaster: true },
  { nome: "Importação de Dados", path: "/dashboard/importacao", icone: "📥", categoria: "Operações", defaultMaster: true },
  { nome: "Controle Comercial", path: "/dashboard/comercial", icone: "🎯", categoria: "Operações", defaultMaster: true },
  { nome: "Finalizados", path: "/dashboard/finalizados", icone: "🏁", categoria: "Operações", defaultMaster: true },

  // CRÉDITO / RISK
  { nome: "Estoque Cedentes", path: "/dashboard/estoque-cedentes", icone: "💼", categoria: "Crédito", defaultMaster: true },
  { nome: "Análises Em Comitê", path: "/dashboard/comite", icone: "📋", categoria: "Crédito", defaultMaster: true },
  { nome: "Carteira", path: "/dashboard/carteira", icone: "📊", categoria: "Crédito", defaultMaster: true },
  { nome: "Monitore Diário", path: "/dashboard/monitore-diario", icone: "🚨", categoria: "Crédito", defaultMaster: true },
  { nome: "Monitore Histórico", path: "/dashboard/monitore-historico", icone: "📚", categoria: "Crédito", defaultMaster: true },
  { nome: "Restritivos Sócios", path: "/dashboard/restritivos-socios", icone: "👥", categoria: "Crédito", defaultMaster: true },

  // ADMINISTRAÇÃO / CONTROLES CORE
  { nome: "Cadastro Cedentes", path: "/dashboard/cadastro", icone: "📝", categoria: "Administração", defaultMaster: true },
  { nome: "Revisão Cedentes", path: "/dashboard/revisao", icone: "🔍", categoria: "Administração", defaultMaster: true },
  { nome: "Gerenciar Usuários", path: "/dashboard/gerenciar-usuarios", icone: "⚙️", categoria: "Administração", defaultMaster: true }
];

export const obterRotasMaster = () => 
  MAPA_DE_ROTAS.filter(r => r.defaultMaster === true).map(r => r.path);