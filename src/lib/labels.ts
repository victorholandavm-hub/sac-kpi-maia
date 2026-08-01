const CATEGORY_LABELS: Record<string, string> = {
  "cat-atraso": "Atraso na entrega",
  "cat-avaria": "Produto avariado",
  "cat-assistencia": "Assistência técnica",
  "cat-produtoerrado": "Produto errado",
  "cat-garantia": "Garantia",
  "cat-errovendedor": "Erro do vendedor",
  "cat-duvida": "Dúvida",
  "cat-entregaerrada": "Entrega/endereço errado",
  "cat-entregador": "Problema com entregador",
  "cat-errocd": "Erro do centro de distribuição",
  "cat-erroloja": "Erro da loja",
  "cat-erroconferencia": "Erro de conferência",
  "cat-conserto": "Conserto/reparo",
  "cat-pecafaltante": "Peça faltante",
  "cat-trocamedida": "Troca por medida errada",
  "cat-trocaproduto": "Troca de produto",
  "cat-vendasemestoque": "Venda sem estoque",
};

export function categoryLabel(tag: string): string {
  if (CATEGORY_LABELS[tag]) return CATEGORY_LABELS[tag];
  return tag
    .replace(/^cat-/, "")
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

// Mapa filial -> "Loja + Nome da filial", conforme planilha de contatos da rede.
// Numeros que nao aparecerem aqui caem no fallback "Loja {numero}".
const STORE_LABELS: Record<string, string> = {
  "201": "Maia Bayeux",
  "202": "Maia Santa Rita",
  "203": "Líder Santo Elias",
  "204": "Líder Tambaú",
  "205": "Líder 1 Mangabeira",
  "206": "Maia 2 Mangabeira",
  "207": "Maia 3 Mangabeira",
  "208": "GL",
  "209": "Pluma",
  "210": "Maia Cabedelo",
  "211": "Maia Barão",
  "212": "Maia Shopping M",
  "213": "Maia CD",
  "214": "Maia Mamanguape",
  "215": "Líder Manaíra",
  "216": "Maia Campina Grande",
};

export function storeLabel(tag: string): string {
  const match = tag.match(/^loja-(\d+)$/);
  if (!match) return tag;
  const number = match[1];
  return STORE_LABELS[number] ?? `Loja ${number}`;
}

export function productLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export const URGENCY_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const BLOCKING_LABELS: Record<string, string> = {
  "aguardando-loja": "Aguardando loja",
  "aguardando-operacao": "Aguardando operação",
};

export function blockingLabel(tag: string): string {
  if (BLOCKING_LABELS[tag]) return BLOCKING_LABELS[tag];
  return tag
    .replace(/^aguardando-/, "Aguardando ")
    .replace(/-/g, " ");
}

const ESCALATION_TARGET_LABELS: Record<string, string> = {
  loja: "Loja",
  gerente: "Gerente da loja",
  operacao: "Operação/outro setor",
  outro: "Outro",
};

export function escalationTargetLabel(target: string): string {
  return ESCALATION_TARGET_LABELS[target] ?? target;
}
