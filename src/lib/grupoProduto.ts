// Avaria/Assistência separadas em dois grupos -- Victor 30/10/2026: estofados
// (poltronas, sofás, colchões e base, box, baús) e madeiras (todo o resto dos
// móveis). No Odoo quase todo produto está na categoria "All", então vai pelo nome.
export type GrupoProduto = "estofados" | "madeiras";

const ESTOFADOS = /\b(COLCH(AO|OES|ONETE)|BOX|BAU|BAUS|SOFA|SOFAS|POLTRONAS?|ESTOFAD[OA]S?|PUFF?E?S?|RECAMIER|CHAISE|DIVA|ESPUMA|TRAVESSEIROS?)\b/;

export function grupoProduto(nome: string): GrupoProduto {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (ESTOFADOS.test(n)) return "estofados";
  if (/\bBASES?\b/.test(n) && !/\b(TV|PAINEL|RACK|MESA)\b/.test(n)) return "estofados";
  return "madeiras";
}
