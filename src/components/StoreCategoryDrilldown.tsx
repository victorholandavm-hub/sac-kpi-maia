"use client";

import { useState } from "react";
import type { StoreBreakdownTicket } from "@/lib/kpi";
import { CategoryTicketsModal } from "./CategoryTicketsModal";

// Mesmo padrão de NpsDetractorsList.tsx -- botão + modal artesanal, só que
// aqui pra abrir o que está por trás do "problema mais comum" de uma loja.
export function StoreCategoryDrilldown({
  store,
  category,
  totalCount,
  tickets,
}: {
  store: string;
  category: string;
  totalCount: number;
  tickets: StoreBreakdownTicket[];
}) {
  const [open, setOpen] = useState(false);
  if (tickets.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline whitespace-nowrap"
        style={{ color: "var(--brand-green)" }}
      >
        Ver chamados
      </button>

      {open ? (
        <CategoryTicketsModal
          title={`${category} · ${store}`}
          totalCount={totalCount}
          tickets={tickets}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
