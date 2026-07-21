import { STATUS_LABELS, STATUS_COLORS, STATUS_DESCRIPTIONS } from "@/lib/assistenciaLabels";

export function StatusBadge({ status, showInfo }: { status: string; showInfo?: boolean }) {
  const color = STATUS_COLORS[status] ?? "var(--text-muted)";
  const description = showInfo ? STATUS_DESCRIPTIONS[status] : undefined;

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ color, border: `1px solid ${color}` }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {STATUS_LABELS[status] ?? status}
      </span>
      {description ? (
        <details className="relative inline-block">
          <summary
            className="list-none marker:hidden [&::-webkit-details-marker]:hidden cursor-pointer w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold select-none"
            style={{ color, border: `1px solid ${color}` }}
            aria-label={`O que significa "${STATUS_LABELS[status] ?? status}"?`}
          >
            i
          </summary>
          <div
            className="absolute z-10 top-full left-0 mt-1 w-56 rounded-lg border p-2 text-xs shadow-lg"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {description}
          </div>
        </details>
      ) : null}
    </span>
  );
}
