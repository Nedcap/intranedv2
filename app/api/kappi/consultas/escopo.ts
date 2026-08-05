// Interface base que garante os campos obrigatórios de TODOS os robôs da Kappi
export interface BaseKappiAnalysis {
  id: string;
  ok: boolean;
  title: string;
  nivel: number;
  type: string;
  _diligence_id: string;
  evidences?: Array<{
    _links: string;
    source: string;
  }>;
  _cpf_relation?: string;
  _cnpj_relation?: string;
  [key: string]: any; // Polimorfismo: Permite que os campos específicos de cada robô passem sem erro de tipagem
}

// ============================================================================
// REGRAS DE NEGÓCIO - ESCOPOS SOLICITADOS
// Os nomes aqui DEVEM bater exatamente com o campo "title" retornado pela API
// ============================================================================

export const ESCOPO_PJ = [
  "Certificado de Regularidade do FGTS",           // CND FGTS
  "Sanções e Restrições (PJ)",                     // Sanções e restrições
  "Processos Judiciais",                           // Processos judiciais (Pode vir como "Processo Judiciais" em alguns casos, tratamos no filtro)
  "Processo Judiciais",                            // Variação de nomenclatura
  "Improbidade Administrativa e Inelegibilidade",  // Improbidade Adm e Inelegibilidade
  "CND Débitos Estaduais",                         // CND - Débitos Estaduais
  "CND Dívida Ativa - PGFN"                        // CND Dívida Ativa - PGFN
];

export const ESCOPO_PF = [
  "Sanções e Restrições",                          // Sanções e Restrições
  "Antecedentes Criminais - Polícia Federal",      // Antecedentes Criminais
  "Processos Judiciais",                           // Processos Judiciais
  "Processo Judiciais",                            // Variação de nomenclatura
  "Improbidade Administrativa e Inelegibilidade"   // Improbidade Adm e Inelegibilidade
];

// ============================================================================
// FUNÇÃO DE FILTRAGEM
// ============================================================================

/**
 * Filtra o array gigante de análises da Kappi mantendo apenas o escopo desejado.
 * @param analyses O array de análises bruto retornado pela Kappi
 * @param tipo O tipo de documento consultado ('PF' ou 'PJ')
 * @returns Um array limpo apenas com as análises que você pediu
 */
export function filtrarAnalisesPorEscopo(
  analyses: BaseKappiAnalysis[], 
  tipo: 'PF' | 'PJ'
): BaseKappiAnalysis[] {
  
  const escopoDesejado = tipo === 'PJ' ? ESCOPO_PJ : ESCOPO_PF;
  
  return analyses.filter(analise => {
    // Verifica se o título do robô que a Kappi retornou está na nossa lista de desejados
    return escopoDesejado.includes(analise.title);
  });
}