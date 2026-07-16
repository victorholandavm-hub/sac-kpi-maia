import { STATUS_LABELS, STATUS_COLORS } from "@/lib/assistenciaLabels";

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, border: `1px solid ${color}` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
