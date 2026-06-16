// lib/rotas.ts

export interface RotaSistema {
  nome: string;
  path: string;
  icone: string;
  categoria: "Operações" | "Crédito" | "Administração";
  defaultMaster: boolean; // Se true, o Master ganha automático
}

export const MAPA_DE_ROTAS: RotaSistema[] = [
  { nome: "Dashboard Principal", path: "/dashboard", icone: "📈", categoria: "Operações", defaultMaster: true },
  { nome: "Importação de Dados", path: "/dashboard/importacao", icone: "📥", categoria: "Operações", defaultMaster: true },
  { nome: "Controle Comercial", path: "/dashboard/comercial", icone: "🎯", categoria: "Operações", defaultMaster: true },
  { nome: "Análises Em Comitê", path: "/dashboard/comite", icone: "📋", categoria: "Crédito", defaultMaster: true },
  { nome: "Carteira", path: "/dashboard/carteira", icone: "📊", categoria: "Crédito", defaultMaster: true },
  { nome: "Finalizados", path: "/dashboard/finalizados", icone: "🏁", categoria: "Operações", defaultMaster: true },
  { nome: "Cadastro Cedentes", path: "/dashboard/cadastro", icone: "📝", categoria: "Administração", defaultMaster: true },
  { nome: "Revisão Cedentes", path: "/dashboard/revisao", icone: "🔍", categoria: "Administração", defaultMaster: true },
  { nome: "Monitore Diário", path: "/dashboard/monitore-diario", icone: "🚨", categoria: "Crédito", defaultMaster: true },
  { nome: "Monitore Histórico", path: "/dashboard/monitore-historico", icone: "📚", categoria: "Crédito", defaultMaster: true },
  { nome: "Restritivos Sócios", path: "/dashboard/restritivos-socios", icone: "👥", categoria: "Crédito", defaultMaster: true },
  { nome: "Gerenciar Usuários", path: "/dashboard/gerenciar-usuarios", icone: "⚙️", categoria: "Administração", defaultMaster: true }
];

// Fix: Agora a função respeita a flag de controle para permitir rotas ocultas ou em testes no futuro
export const obterRotasMaster = () => 
  MAPA_DE_ROTAS.filter(r => r.defaultMaster === true).map(r => r.path);