export function StatTile({
  label,
  value,
  suffix,
  accent = "var(--brand-green)",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
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
      <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
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
