// "ODOO-S01589" (como a camada compat grava em totvs_deliveries) ou "S01589".
export function nomePedidoOdoo(pedido: string): string | null {
  const m = pedido.trim().match(/^(?:ODOO-)?(S\d+)$/i);
  return m ? m[1].toUpperCase() : null;
}
