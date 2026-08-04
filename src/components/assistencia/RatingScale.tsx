"use client";

const RATING_VALUES = Array.from({ length: 11 }, (_, i) => i);

export function RatingScale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {RATING_VALUES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="text-lg rounded-lg w-12 h-12 font-bold border-2 shrink-0"
            style={
              value === n
                ? { background: "var(--brand-green)", color: "var(--brand-green-ink)", borderColor: "var(--brand-green)" }
                : { borderColor: "var(--border)", color: "var(--text-primary)" }
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
