import type { EstornoRequestStatus } from "@/lib/estornoRequests";

const LABELS: Record<EstornoRequestStatus, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  recusado: "Recusado",
};

const COLORS: Record<EstornoRequestStatus, string> = {
  pendente: "var(--brand-orange)",
  concluido: "var(--status-good)",
  recusado: "var(--status-critical)",
};

export function EstornoStatusBadge({ status }: { status: EstornoRequestStatus }) {
  const color = COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {LABELS[status]}
    </span>
  );
}
