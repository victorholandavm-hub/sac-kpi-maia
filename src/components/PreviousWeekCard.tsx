"use client";

import { useState } from "react";
import type { PreviousWeekSummary } from "@/lib/kpi";
import { categoryLabel, storeLabel } from "@/lib/labels";
import { CategoryTicketsModal } from "./CategoryTicketsModal";

function formatDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function PreviousWeekCard({ data }: { data: PreviousWeekSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderLeft: "3px solid var(--brand-orange)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Semana anterior ({formatDate(data.from)} a {formatDate(data.to)})
      </h3>
      {data.totalTickets === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Ainda não há uma semana anterior completa com dados (o histórico começa em 06/07/2026).
        </p>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>{data.totalTickets}</strong> chamados no total.{" "}
          Loja com mais chamados:{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {data.topStore ? `${storeLabel(data.topStore.label)} (${data.topStore.count})` : "—"}
          </strong>
          . Problema mais comum:{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {data.topCategory ? `${categoryLabel(data.topCategory.label)} (${data.topCategory.count})` : "—"}
          </strong>
          {data.topCategoryTickets.length > 0 ? (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-xs underline"
                style={{ color: "var(--brand-green)" }}
              >
                Ver chamados
              </button>
            </>
          ) : null}
          .
        </p>
      )}

      {open && data.topCategory ? (
        <CategoryTicketsModal
          title={categoryLabel(data.topCategory.label)}
          totalCount={data.topCategory.count}
          tickets={data.topCategoryTickets}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
