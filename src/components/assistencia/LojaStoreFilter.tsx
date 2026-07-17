"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { setLojaStorePreference } from "@/app/assistencia/actions";
import type { Store } from "@/lib/serviceRequests";

export function LojaStoreFilter({ stores, selectedStoreId }: { stores: Store[]; selectedStoreId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const storeId = e.target.value;
    startTransition(async () => {
      await setLojaStorePreference(storeId);
      router.push(storeId ? `${pathname}?store=${storeId}` : pathname);
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
      Ver:
      <select
        value={selectedStoreId}
        onChange={handleChange}
        disabled={pending}
        className="rounded border px-3 py-2 text-sm disabled:opacity-60"
        style={{ borderColor: "var(--border)" }}
      >
        <option value="">Todas as lojas</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
