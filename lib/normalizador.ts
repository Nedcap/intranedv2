// src/lib/normalizador.ts (ou src/utils/normalizador.ts)

export interface BaseUniversal {
  id?: string;
  cnpj: string;
  nome_oficial: string;
  nome_fantasia: string | null;
  nome_curto: string | null;
  variacoes: string[] | null;
}

export function limparNome(texto: any): string {
  if (!texto) return "";
  let n = String(texto).toUpperCase().trim();
  n = n.replace(/^\d+[\s\-\.\_]+/, ""); // Mata códigos iniciais
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
  n = n.replace(/[^A-Z0-9\s]/g, " "); 
  n = n.replace(/\b(LTDA|SA|S A|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, ""); 
  return n.replace(/\s+/g, " ").trim();
}

export function limparCnpj(valor: any): string {
  if (!valor) return "";
  // Deixa apenas os números
  let apenasNumeros = String(valor).replace(/\D/g, "");
  if (!apenasNumeros) return "";
  // Se o Excel comeu zeros à esquerda, devolve os 14 dígitos
  return apenasNumeros.padStart(14, "0"); 
}

export function normalizarPelaBaseUniversal(
  nomeBruto: string, 
  cnpjBruto: any, 
  base: BaseUniversal[]
): string {
  const cnpjLimpo = limparCnpj(cnpjBruto);
  const nomeLimpo = limparNome(nomeBruto);

  // 1. TENTA PRIMEIRO PELO CNPJ (Mais seguro)
  if (cnpjLimpo && cnpjLimpo.length === 14) {
    const matchCnpj = base.find(b => limparCnpj(b.cnpj) === cnpjLimpo);
    if (matchCnpj) return matchCnpj.nome_oficial;
  }

  // 2. SE NÃO ACHOU POR CNPJ (Ou não tem CNPJ), TENTA POR NOME
  if (!nomeLimpo) return ""; // Retorna vazio se não sobrou nada para não criar lixo

  const matchNome = base.find(b => {
    const oficialLimpo = limparNome(b.nome_oficial);
    if (oficialLimpo === nomeLimpo || oficialLimpo.includes(nomeLimpo) || nomeLimpo.includes(oficialLimpo)) return true;

    if (b.nome_fantasia) {
      const fantasiaLimpo = limparNome(b.nome_fantasia);
      if (fantasiaLimpo === nomeLimpo || fantasiaLimpo.includes(nomeLimpo) || nomeLimpo.includes(fantasiaLimpo)) return true;
    }

    if (b.nome_curto) {
      const curtoLimpo = limparNome(b.nome_curto);
      if (curtoLimpo === nomeLimpo || curtoLimpo.includes(nomeLimpo) || nomeLimpo.includes(curtoLimpo)) return true;
    }

    if (b.variacoes && Array.isArray(b.variacoes)) {
      for (const variacao of b.variacoes) {
        const vLimpo = limparNome(variacao);
        if (vLimpo === nomeLimpo || vLimpo.includes(nomeLimpo) || nomeLimpo.includes(vLimpo)) return true;
      }
    }
    return false;
  });

  // 3. O FALLBACK SEGURO
  // Se não achou na base, devolve o nome limpo em vez de criar um CNPJ feio como nome.
  return matchNome ? matchNome.nome_oficial : nomeLimpo; 
}