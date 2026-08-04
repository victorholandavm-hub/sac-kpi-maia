import { PEDIDO_FORNECEDOR_STATUS_LABELS, PEDIDO_FORNECEDOR_STATUS_COLORS } from "@/lib/assistenciaLabels";

export function PedidoFornecedorStatusBadge({ status }: { status: string }) {
  const color = PEDIDO_FORNECEDOR_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {PEDIDO_FORNECEDOR_STATUS_LABELS[status] ?? status}
    </span>
  );
}
