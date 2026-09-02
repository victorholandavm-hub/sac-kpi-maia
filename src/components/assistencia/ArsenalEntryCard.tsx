"use client";

import { useState } from "react";
import { setArsenalEntryActiveAction } from "@/app/assistencia/arsenal-actions";
import { useQuickAction } from "./useQuickAction";
import { ArsenalEntryForm } from "./ArsenalEntryForm";
import type { ArsenalEntry } from "@/lib/arsenalSac";
import { ARSENAL_CATEGORY_COLORS, ARSENAL_HIGHLIGHT_LABELS, ARSENAL_HIGHLIGHT_COLORS } from "@/lib/assistenciaLabels";

const HIGHLIGHT_ICONS: Record<string, string> = {
  regra_ouro: "★",
  atencao: "⚠",
};

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

  // Card normal só ganha um traço fino da cor da categoria; 'regra_ouro' e
  // 'atencao' viram caixa de alerta de verdade (fundo tingido, borda grossa)
  // -- é o pedido do Victor de dar "cara" pras regras rígidas em vez delas
  // se perderem no meio do texto (ex.: "nunca deixar dois produtos na casa
  // do cliente").
  const categoryColor = ARSENAL_CATEGORY_COLORS[entry.category] ?? "var(--brand-green)";
  const highlightColor = ARSENAL_HIGHLIGHT_COLORS[entry.highlightType];
  const isHighlighted = entry.active && !!highlightColor;

  return (
    <div
      className="rounded-xl border bg-white shadow-sm p-4 flex flex-col gap-2"
      style={{
        background: isHighlighted ? `color-mix(in srgb, ${highlightColor} 6%, white)` : "#ffffff",
        borderColor: isHighlighted ? `color-mix(in srgb, ${highlightColor} 40%, transparent)` : "#E5E7EB",
        borderLeft: `${isHighlighted ? 4 : 3}px solid ${
          isHighlighted ? highlightColor : entry.active ? `color-mix(in srgb, ${categoryColor} 55%, transparent)` : "#E5E7EB"
        }`,
      }}
    >
      {isHighlighted ? (
        <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: highlightColor }}>
          <span aria-hidden>{HIGHLIGHT_ICONS[entry.highlightType]}</span>
          {ARSENAL_HIGHLIGHT_LABELS[entry.highlightType]}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug" style={{ color: !entry.active ? "#9CA3AF" : isHighlighted ? highlightColor : categoryColor }}>
          {entry.title}
          {!entry.active ? <span className="text-xs font-normal text-gray-400"> (inativa)</span> : null}
        </h3>
        {canEdit ? (
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150">
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
              className="text-xs font-medium transition-colors duration-150 disabled:opacity-60"
              style={{ color: entry.active ? "var(--status-critical)" : "var(--status-good)" }}
            >
              {entry.active ? "desativar" : "reativar"}
            </button>
          </div>
        ) : null}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-600">{entry.body}</p>
      {keywordList.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {keywordList.map((k) => (
            <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {k}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
