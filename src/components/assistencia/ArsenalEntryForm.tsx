"use client";

import { useState } from "react";
import { createArsenalEntryAction, updateArsenalEntryAction } from "@/app/assistencia/arsenal-actions";
import { useQuickAction } from "./useQuickAction";
import { ARSENAL_CATEGORIES, type ArsenalCategory, type ArsenalEntry } from "@/lib/arsenalSac";
import { ARSENAL_CATEGORY_LABELS } from "@/lib/assistenciaLabels";

const EMPTY_CATEGORY = ARSENAL_CATEGORIES[0];

export function ArsenalEntryForm({ entry, onCancel }: { entry?: ArsenalEntry; onCancel?: () => void }) {
  const { pending, run } = useQuickAction();
  const [category, setCategory] = useState<ArsenalCategory>(entry?.category ?? EMPTY_CATEGORY);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [keywords, setKeywords] = useState(entry?.keywords ?? "");

  function submit() {
    const input = { category, title, body, keywords: keywords.trim() || null };
    run(async () => {
      if (entry) {
        await updateArsenalEntryAction(entry.id, input);
        onCancel?.();
      } else {
        await createArsenalEntryAction(input);
        setCategory(EMPTY_CATEGORY);
        setTitle("");
        setBody("");
        setKeywords("");
      }
    }, entry ? "Entrada atualizada." : "Entrada criada.");
  }

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      {!entry ? (
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Nova entrada
        </h3>
      ) : null}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as ArsenalCategory)}
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      >
        {ARSENAL_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {ARSENAL_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Conteúdo"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="Palavras-chave (opcional, separadas por vírgula — sinônimos que o time realmente usa)"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={pending || !title.trim() || !body.trim()}
          onClick={submit}
          className="text-xs rounded px-3 py-2 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Salvando…" : entry ? "Salvar" : "Criar entrada"}
        </button>
        {onCancel ? (
          <button onClick={onCancel} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
