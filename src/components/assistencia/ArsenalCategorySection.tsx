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
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 py-1.5 w-full text-left">
        <span className={`text-[10px] shrink-0 transition-transform duration-150 text-gray-400 dark:text-gray-500 ${open ? "rotate-90" : ""}`} aria-hidden="true">
          ▶
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `color-mix(in srgb, ${color} 70%, var(--foreground))` }}>
          {label}
        </h2>
        <span
          className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-semibold"
          style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface-1))`, color: `color-mix(in srgb, ${color} 70%, var(--foreground))` }}
        >
          {count}
        </span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
      </button>
      {open ? <div className="flex flex-col gap-2 pl-4">{children}</div> : null}
    </div>
  );
}
