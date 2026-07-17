"use client";

import { setSacCategory } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { SAC_CATEGORIES, SAC_CATEGORY_LABELS } from "@/lib/assistenciaLabels";

export function SacCategoryField({ requestId, value }: { requestId: string; value: string | null }) {
  const { pending, run } = useQuickAction();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const category = e.target.value;
    if (!category) return;
    run(() => setSacCategory(requestId, category), "Categoria SAC atualizada.");
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Categoria SAC
      </span>
      <select
        value={value ?? ""}
        onChange={handleChange}
        disabled={pending}
        className="rounded border px-2 py-1 text-sm disabled:opacity-60"
        style={{ borderColor: "var(--border)" }}
      >
        <option value="" disabled>
          Selecione…
        </option>
        {SAC_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {SAC_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
    </div>
  );
}
