"use client";

import { setItemDestino } from "@/app/assistencia/tecnico-actions";
import { useQuickAction } from "./useQuickAction";
import { ITEM_DESTINOS, ITEM_DESTINO_LABELS, ITEM_DESTINO_COLORS, type ItemDestino } from "@/lib/tecnicos";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TecnicoItemDestino({
  itemId,
  destino,
  destinoDefinidoPor,
  destinoDefinidoEm,
}: {
  itemId: string;
  destino: ItemDestino | null;
  destinoDefinidoPor: string | null;
  destinoDefinidoEm: string | null;
}) {
  const { pending, run } = useQuickAction();

  if (destino) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
          style={{ color: ITEM_DESTINO_COLORS[destino], borderColor: ITEM_DESTINO_COLORS[destino] }}
        >
          {ITEM_DESTINO_LABELS[destino]}
        </span>
        {destinoDefinidoPor ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {destinoDefinidoPor}
            {destinoDefinidoEm ? ` · ${formatDateTime(destinoDefinidoEm)}` : ""}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ITEM_DESTINOS.map((d) => (
        <button
          key={d}
          type="button"
          disabled={pending}
          onClick={() => run(() => setItemDestino(itemId, d), `Destino: ${ITEM_DESTINO_LABELS[d]}.`)}
          className="text-xs rounded-full px-2.5 py-1 border font-medium whitespace-nowrap disabled:opacity-60"
          style={{ borderColor: ITEM_DESTINO_COLORS[d], color: ITEM_DESTINO_COLORS[d] }}
        >
          {ITEM_DESTINO_LABELS[d]}
        </button>
      ))}
    </div>
  );
}
