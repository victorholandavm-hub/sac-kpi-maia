import type { EntregaOdoo } from "./logisticaTipos";

// Outras saídas em aberto do mesmo cliente das marcadas -- Victor 30/10/2026
// (Jhon: ao marcar um cliente, avisar se ele tem mais pedidos em aberto, pra
// não sair numa carga e deixar o outro pra trás). Cliente pelo id do Odoo; sem
// id, pelo nome.
export type AvisoCliente = { cliente: string; outros: Pick<EntregaOdoo, "picking_id" | "pedido" | "nome" | "pendencia" | "pendencia_motivo" | "data_programada">[] };

const chave = (e: Pick<EntregaOdoo, "cliente_id" | "cliente">) =>
  e.cliente_id ? `id:${e.cliente_id}` : `nome:${(e.cliente ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase()}`;

export function outrosPedidosDoCliente(todas: EntregaOdoo[], marcadas: Set<number>): AvisoCliente[] {
  const porCliente = new Map<string, EntregaOdoo[]>();
  for (const e of todas) porCliente.set(chave(e), [...(porCliente.get(chave(e)) ?? []), e]);
  const avisos: AvisoCliente[] = [];
  const vistos = new Set<string>();
  for (const e of todas) {
    const k = chave(e);
    if (!marcadas.has(e.picking_id) || vistos.has(k)) continue;
    vistos.add(k);
    const outros = (porCliente.get(k) ?? []).filter((o) => !marcadas.has(o.picking_id));
    if (outros.length) avisos.push({ cliente: e.cliente, outros });
  }
  return avisos;
}
