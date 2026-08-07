// Fonte única das fábricas próprias e externas -- usada tanto no formulário
// de encomenda quanto na validação do server action (ver
// supabase/migrations/0052_pedido_encomenda_fornecedor.sql). Fábricas
// externas não viram tabela: não têm login/PIN/status próprios, só entram
// como rótulo no pedido.

export type InternalFabrica = { id: string; nome: string };

// Cidade na frente do nome de propósito -- pessoal confundia as duas
// fábricas próprias (mesmo grupo Beds/Aiam, unidades diferentes).
export const INTERNAL_FABRICAS: InternalFabrica[] = [
  { id: "colchoes", nome: "(Conde) Beds/Aiam Colchões" },
  { id: "estofados", nome: "(Bayeux) Beds/Aiam Estofados" },
];

export const EXTERNAL_FABRICAS: string[] = [
  "Nesher",
  "Conceito Estofados",
  "Probel",
  "Kappesberg",
  "Tekshine",
  "Tuboarte",
  "Valdemoveis",
];

export function findInternalFabrica(id: string | null | undefined): InternalFabrica | undefined {
  return INTERNAL_FABRICAS.find((f) => f.id === id);
}

export function isExternalFabrica(nome: string | null | undefined): boolean {
  return !!nome && EXTERNAL_FABRICAS.includes(nome);
}
