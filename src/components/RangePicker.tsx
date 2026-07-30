import Link from "next/link";
import type { DateRange } from "@/lib/dateRange";

const PRESETS: { key: DateRange["preset"]; label: string; href: string }[] = [
  { key: "7d", label: "7 dias", href: "/kpis?range=7d" },
  { key: "month", label: "Este mês", href: "/kpis?range=month" },
  { key: "year", label: "Este ano", href: "/kpis?range=year" },
  { key: "all", label: "Tudo", href: "/kpis?range=all" },
];

function pillStyle(active: boolean) {
  return {
    color: active ? "var(--surface-1)" : "var(--text-secondary)",
    background: active ? "var(--brand-green)" : "transparent",
    border: `1px solid ${active ? "var(--brand-green)" : "var(--border)"}`,
  };
}

export function RangePicker({ range }: { range: DateRange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          className="text-sm px-3 py-1 rounded-full"
          style={pillStyle(range.preset === p.key)}
        >
          {p.label}
        </Link>
      ))}
      <form method="get" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
        <input
          type="date"
          name="from"
          defaultValue={range.preset === "custom" && range.from ? range.from.toISOString().slice(0, 10) : undefined}
          className="rounded px-2 py-1 text-xs"
          style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <span>até</span>
        <input
          type="date"
          name="to"
          defaultValue={range.preset === "custom" ? range.to.toISOString().slice(0, 10) : undefined}
          className="rounded px-2 py-1 text-xs"
          style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          className="text-xs px-2 py-1 rounded"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
