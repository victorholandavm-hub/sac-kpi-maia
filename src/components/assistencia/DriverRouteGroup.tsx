"use client";

import { useState } from "react";
import Link from "next/link";
import { setDriverOrderAction } from "@/app/assistencia/driver-actions";
import { SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import type { DriverRequestView } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Lista reordenável: o motorista decide a própria sequência (ex.: seguir por
// bairro) com os botões ▲▼ -- reordena local na hora (resposta imediata) e
// grava em segundo plano via setDriverOrderAction. Só reorganiza dentro do
// próprio grupo (mesmo dia + mesma rota) que está sendo mostrado -- não mistura
// numa ordem global entre dias/rotas diferentes.
export function DriverRouteGroup({
  items,
  showCompleted,
  reorderable,
}: {
  items: DriverRequestView[];
  showCompleted: boolean;
  reorderable: boolean;
}) {
  const [order, setOrder] = useState(items);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setDriverOrderAction(next.map((r) => r.id)).catch(() => {
      // Reverte a ordem local se não conseguiu gravar -- evita a tela
      // mostrar uma ordem que na próxima visita some porque não salvou.
      setOrder(items);
    });
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
        {order.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2 p-4 flex-wrap">
            {reorderable && order.length > 1 ? (
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Mover pra cima"
                  className="text-sm leading-none px-1 disabled:opacity-25"
                  style={{ color: "var(--text-secondary)" }}
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="Mover pra baixo"
                  className="text-sm leading-none px-1 disabled:opacity-25"
                  style={{ color: "var(--text-secondary)" }}
                >
                  ▼
                </button>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 flex-wrap flex-1 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    #{r.ticketNumber}
                  </span>
                  <StatusBadge status={r.status} />
                  {r.shift === "urgencia" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: "#fff", background: "var(--status-critical)" }}>
                      Urgente!
                    </span>
                  ) : null}
                  {!showCompleted && !r.pickupCompleted ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: "var(--brand-orange)", border: "1px solid var(--brand-orange)" }}
                    >
                      Recolher produto
                    </span>
                  ) : null}
                </div>
                <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {r.clientName ?? "Sem nome de cliente"}
                </p>
                {r.clientNeighborhood ? (
                  <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    📍 {r.clientNeighborhood}
                  </p>
                ) : null}
                {r.productSummary ? (
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {r.productSummary}
                  </p>
                ) : null}
                {r.scheduledDate ? (
                  <p className="text-xs font-medium" style={{ color: "var(--brand-green)" }}>
                    {formatDateOnly(r.scheduledDate)}
                    {r.scheduledTime ? ` às ${r.scheduledTime.slice(0, 5)}` : ""}
                    {r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
                  </p>
                ) : (r.approvedDeadline ?? r.requestedDeadline) ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Prazo: {formatDateOnly(r.approvedDeadline ?? r.requestedDeadline)}
                  </p>
                ) : null}
                {r.rotaExceptionNote ? (
                  <p className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                    ⚠ Fora da rota do dia: {r.rotaExceptionNote}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/assistencia/motorista/${r.id}`}
                className="text-sm rounded-lg px-3 py-2 font-medium shrink-0"
                style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
              >
                Ver rota
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
