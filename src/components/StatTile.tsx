export function StatTile({
  label,
  value,
  suffix,
  accent = "var(--brand-green)",
  size = "md",
  valueColor,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
  // "lg" -- usado no banner de resumo do topo do painel de KPIs, onde os
  // números precisam ser lidos à distância/de relance.
  size?: "md" | "lg";
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-1"
      style={{
        background: "var(--surface-1)",
        borderColor: "var(--border)",
        borderTop: `3px solid ${accent}`,
      }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span
        className={size === "lg" ? "text-4xl sm:text-5xl font-bold" : "text-3xl font-semibold"}
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {value}
        {suffix ? (
          <span className="text-base font-normal ml-1" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        ) : null}
      </span>
    </div>
  );
}
