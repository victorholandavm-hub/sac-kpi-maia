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

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: entry.active ? "var(--text-primary)" : "var(--text-muted)" }}>
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
      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
        {entry.body}
      </p>
      {entry.keywords ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Palavras-chave: {entry.keywords}
        </p>
      ) : null}
    </div>
  );
}
