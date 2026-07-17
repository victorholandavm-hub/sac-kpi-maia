"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSacCategory } from "@/app/assistencia/actions";
import { SAC_CATEGORIES, SAC_CATEGORY_LABELS } from "@/lib/assistenciaLabels";

export function SacCategoryField({ requestId, value }: { requestId: string; value: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const category = e.target.value;
    if (!category) return;
    startTransition(async () => {
      await setSacCategory(requestId, category);
      router.refresh();
    });
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
