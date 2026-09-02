import { ENTREGA_RISCO_NIVEL_LABELS, ENTREGA_RISCO_NIVEL_COLORS } from "@/lib/assistenciaLabels";

// Preenchimento suave (14% da cor sobre branco) + texto escurecido via
// color-mix -- Guia de Componentes Maia (Design System, 01/09/2026),
// mesma anatomia de badge de StatusBadge.tsx.
export function EntregaRiscoNivelBadge({ nivel }: { nivel: string }) {
  const color = ENTREGA_RISCO_NIVEL_COLORS[nivel] ?? "#9CA3AF";
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: `color-mix(in srgb, ${color} 70%, black)`, background: `color-mix(in srgb, ${color} 14%, white)` }}
    >
      {ENTREGA_RISCO_NIVEL_LABELS[nivel] ?? nivel}
    </span>
  );
}
