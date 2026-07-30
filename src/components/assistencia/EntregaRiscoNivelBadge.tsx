import { ENTREGA_RISCO_NIVEL_LABELS, ENTREGA_RISCO_NIVEL_COLORS } from "@/lib/assistenciaLabels";

export function EntregaRiscoNivelBadge({ nivel }: { nivel: string }) {
  const color = ENTREGA_RISCO_NIVEL_COLORS[nivel] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {ENTREGA_RISCO_NIVEL_LABELS[nivel] ?? nivel}
    </span>
  );
}
