"use client";

import { useState } from "react";

export function ArsenalCategorySection({
  label,
  count,
  color,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
  color: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-lg px-4 py-3 w-full text-left border"
        style={{
          background: `color-mix(in srgb, ${color} 8%, var(--surface-1))`,
          borderColor: "var(--border)",
          borderLeft: `4px solid ${color}`,
        }}
      >
        <h2 className="text-base font-bold flex-1" style={{ color }}>
          {label}
        </h2>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          {count}
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }} aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? <div className="flex flex-col gap-2">{children}</div> : null}
    </div>
  );
}
