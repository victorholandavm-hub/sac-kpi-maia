"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { setAssistenciaOrderAction } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS, SHIFT_LABELS, DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";
import { ROTA_LABELS, ROTA_COLORS } from "@/lib/rotas";
import { StatusBadge } from "./StatusBadge";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";

// Mesma mecânica de reordenar (setas ▲▼ com animação FLIP, grava em
// assistencia_order) de AssistenciaQueueGroup.tsx (fila) -- pedido do
// usuário pra poder organizar a agenda do dia (ex.: por bairro) do mesmo
// jeito que já dava pra fazer na fila. É o mesmo campo assistencia_order
// dos dois lados: como fila agrupa por data de abertura e agenda por data
// da visita, um chamado normalmente cai em grupos diferentes em cada tela,
// então reordenar num não bagunça o outro.
export function AgendaQueueGroup({ items, isOverdue }: { items: ServiceRequestSummary[]; isOverdue: boolean }) {
  const [order, setOrder] = useState(items);
  const [saving, setSaving] = useState(false);
  const [syncedItems, setSyncedItems] = useState(items);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef<Map<string, DOMRect> | null>(null);

  if (items !== syncedItems && !saving) {
    setSyncedItems(items);
    setOrder(items);
  }

  useLayoutEffect(() => {
    const prev = prevRects.current;
    if (!prev) return;
    prevRects.current = null;
    for (const [id, el] of nodeRefs.current) {
      const before = prev.get(id);
      if (!before) continue;
      const after = el.getBoundingClientRect();
      const deltaY = before.top - after.top;
      if (deltaY) {
        el.style.transition = "none";
        el.style.transform = `translateY(${deltaY}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 220ms ease";
          el.style.transform = "";
        });
      }
    }
  }, [order]);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    const rects = new Map<string, DOMRect>();
    for (const [id, el] of nodeRefs.current) rects.set(id, el.getBoundingClientRect());
    prevRects.current = rects;

    const previous = order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setSaving(true);
    try {
      await setAssistenciaOrderAction(next.map((r) => ({ id: r.id, expectedOrder: r.assistenciaOrder })));
      setOrder(next.map((r, i) => ({ ...r, assistenciaOrder: i + 1 })));
    } catch {
      setOrder(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
      {order.map((r, i) => {
        const rowOverdue = isOverdue && r.status !== "concluida" && r.status !== "cancelada";
        return (
          <div
            key={r.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(r.id, el);
              else nodeRefs.current.delete(r.id);
            }}
            className="flex items-center gap-2 p-4 flex-wrap"
            style={rowOverdue ? { borderLeft: "4px solid var(--status-critical)" } : undefined}
          >
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0 || saving}
                aria-label="Mover pra cima"
                className="text-sm leading-none px-1 disabled:opacity-25"
                style={{ color: "var(--text-secondary)" }}
              >
                ▲
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1 || saving}
                aria-label="Mover pra baixo"
                className="text-sm leading-none px-1 disabled:opacity-25"
                style={{ color: "var(--text-secondary)" }}
              >
                ▼
              </button>
            </div>

            <Link
              href={`/assistencia/${r.id}`}
              className="flex items-center justify-between gap-4 flex-wrap hover:opacity-80 flex-1 min-w-0"
            >
              <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    #{r.ticketNumber}
                  </span>
                  <StatusBadge status={r.status} />
                  {rowOverdue ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 35%, var(--surface-1))" }}
                    >
                      Atrasada
                    </span>
                  ) : null}
                  {r.scheduledTime ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {r.scheduledTime.slice(0, 5)}
                    </span>
                  ) : null}
                  {r.shift ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {SHIFT_LABELS[r.shift] ?? r.shift}
                    </span>
                  ) : null}
                  {/* Rota (praia/sul/centro) é só pra visita de motorista --
                      montagem/desmontagem/vistoria/troca de peça não têm
                      rota, mesmo que exista algum dado velho errado no banco. */}
                  {r.rota && (DELIVERY_REQUEST_TYPES as readonly string[]).includes(r.type) ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${ROTA_COLORS[r.rota]} 35%, var(--surface-1))` }}
                    >
                      {ROTA_LABELS[r.rota]}
                      {r.rotaExceptionNote ? " ⚠" : ""}
                    </span>
                  ) : null}
                  <span
                    className="text-sm font-medium px-1.5 py-0.5 rounded"
                    style={{
                      color: "var(--text-primary)",
                      background: `color-mix(in srgb, ${REQUEST_TYPE_COLORS[r.type] ?? "var(--text-secondary)"} 20%, var(--surface-1))`,
                    }}
                  >
                    {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {r.storeName}
                  </span>
                </div>
                <p className="text-sm truncate">
                  {/* Negrito + caixa alta -- pedido do Victor 25/08/2026
                      ("guia de padronização"): "Nome do Cliente (Bold,
                      caixa alta)", mesmo tratamento das outras 2 telas
                      (aqui era mais fraco -- text-secondary, sem negrito
                      -- alinhado agora). */}
                  <span className="font-bold uppercase" style={{ color: "var(--text-primary)" }}>
                    {r.clientName ?? "Sem nome de cliente"}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {r.clientNeighborhood ? ` · 📍 ${r.clientNeighborhood}` : ""}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {/* Troca/entrega de produto e envio de peça saem de motorista,
                    o resto (montagem/vistoria/etc.) é montador -- mesma
                    distinção que separa DeliveryRequestDetailContent de
                    RequestDetailContent. */}
                {(DELIVERY_REQUEST_TYPES as readonly string[]).includes(r.type) ? (
                  <span>{r.driverName ? `Motorista: ${r.driverName}` : "Sem motorista definido"}</span>
                ) : (
                  <span>{r.assemblerName ? `Técnico: ${r.assemblerName}` : "Sem técnico definido"}</span>
                )}
                <span>{r.assignedToName ? `Com ${r.assignedToName}` : "Sem responsável"}</span>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
