import type { KpiInsight } from "@/lib/kpiInsights";

const STATUS_STYLE: Record<KpiInsight["status"], { color: string; icon: string; label: string }> = {
  good: { color: "var(--status-good)", icon: "✓", label: "Está bom" },
  warning: { color: "var(--status-warning)", icon: "!", label: "Atenção" },
  critical: { color: "var(--status-critical)", icon: "!!", label: "Crítico" },
};

// Card "tipo Clarity" -- explica o número (não só mostra), diz se está bom
// ou ruim, e o que fazer a respeito. Ver src/lib/kpiInsights.ts pras regras.
export function InsightCard({ insight }: { insight: KpiInsight }) {
  const style = STATUS_STYLE[insight.status];
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-2"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderLeft: `3px solid ${style.color}` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center rounded-full text-xs font-bold shrink-0"
          style={{ width: "1.25rem", height: "1.25rem", background: style.color, color: "#fff" }}
        >
          {style.icon}
        </span>
        <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {insight.title}
        </h4>
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {insight.explanation}
      </p>
      {insight.action ? (
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>O que fazer:</strong> {insight.action}
        </p>
      ) : null}
    </div>
  );
}

export function InsightGrid({ insights }: { insights: KpiInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </section>
  );
}
