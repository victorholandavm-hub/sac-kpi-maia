"use client";

import { useState } from "react";

export function ArsenalCategorySection({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
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
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h2 className="text-base font-bold flex-1" style={{ color: "var(--text-primary)" }}>
          {label}
        </h2>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: "color-mix(in srgb, var(--brand-green) 16%, transparent)", color: "var(--brand-green)" }}
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
