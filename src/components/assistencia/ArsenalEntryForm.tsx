"use client";

import { useState } from "react";
import { createArsenalEntryAction, updateArsenalEntryAction } from "@/app/assistencia/arsenal-actions";
import { useQuickAction } from "./useQuickAction";
import { ARSENAL_CATEGORIES, ARSENAL_HIGHLIGHT_TYPES, type ArsenalCategory, type ArsenalEntry, type ArsenalHighlightType } from "@/lib/arsenalSac";
import { ARSENAL_CATEGORY_LABELS, ARSENAL_HIGHLIGHT_LABELS } from "@/lib/assistenciaLabels";

const EMPTY_CATEGORY = ARSENAL_CATEGORIES[0];

export function ArsenalEntryForm({ entry, onCancel }: { entry?: ArsenalEntry; onCancel?: () => void }) {
  const { pending, run } = useQuickAction();
  const [category, setCategory] = useState<ArsenalCategory>(entry?.category ?? EMPTY_CATEGORY);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [keywords, setKeywords] = useState(entry?.keywords ?? "");
  const [highlightType, setHighlightType] = useState<ArsenalHighlightType>(entry?.highlightType ?? "normal");

  function submit() {
    const input = { category, title, body, keywords: keywords.trim() || null, highlightType };
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
        setHighlightType("normal");
      }
    }, entry ? "Entrada atualizada." : "Entrada criada.");
  }

  const fieldClass =
    "rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2">
      {!entry ? <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Nova entrada</h3> : null}
      <select value={category} onChange={(e) => setCategory(e.target.value as ArsenalCategory)} className={fieldClass}>
        {ARSENAL_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {ARSENAL_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className={fieldClass} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Conteúdo" className={fieldClass} />
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="Palavras-chave (opcional, separadas por vírgula — sinônimos que o time realmente usa)"
        className={fieldClass}
      />
      <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
        Destaque
        <select value={highlightType} onChange={(e) => setHighlightType(e.target.value as ArsenalHighlightType)} className={fieldClass}>
          <option value="normal">Nenhum (padrão)</option>
          {ARSENAL_HIGHLIGHT_TYPES.filter((t) => t !== "normal").map((t) => (
            <option key={t} value={t}>
              {ARSENAL_HIGHLIGHT_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={pending || !title.trim() || !body.trim()}
          onClick={submit}
          className="text-xs rounded-lg px-3.5 py-2 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60"
          style={{ background: "#1B5E3C" }}
        >
          {pending ? "Salvando…" : entry ? "Salvar" : "Criar entrada"}
        </button>
        {onCancel ? (
          <button onClick={onCancel} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150">
            cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
