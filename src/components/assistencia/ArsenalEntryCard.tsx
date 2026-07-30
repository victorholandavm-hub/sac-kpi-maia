"use client";

import { useState } from "react";
import { setArsenalEntryActiveAction } from "@/app/assistencia/arsenal-actions";
import { useQuickAction } from "./useQuickAction";
import { ArsenalEntryForm } from "./ArsenalEntryForm";
import type { ArsenalEntry } from "@/lib/arsenalSac";

export function ArsenalEntryCard({ entry, canEdit }: { entry: ArsenalEntry; canEdit: boolean }) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ArsenalEntryForm entry={entry} onCancel={() => setEditing(false)} />;
  }

  const keywordList = entry.keywords
    ? entry.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold leading-snug" style={{ color: entry.active ? "var(--text-primary)" : "var(--text-muted)" }}>
          {entry.title}
          {!entry.active ? (
            <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
              {" "}
              (inativa)
            </span>
          ) : null}
        </h3>
        {canEdit ? (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
              editar
            </button>
            <button
              disabled={pending}
              onClick={() =>
                run(
                  () => setArsenalEntryActiveAction(entry.id, !entry.active),
                  entry.active ? "Entrada desativada." : "Entrada reativada."
                )
              }
              className="text-xs underline disabled:opacity-60"
              style={{ color: entry.active ? "var(--status-critical)" : "var(--status-good)" }}
            >
              {entry.active ? "desativar" : "reativar"}
            </button>
          </div>
        ) : null}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {entry.body}
      </p>
      {keywordList.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {keywordList.map((k) => (
            <span
              key={k}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--background)", color: "var(--text-muted)" }}
            >
              {k}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
