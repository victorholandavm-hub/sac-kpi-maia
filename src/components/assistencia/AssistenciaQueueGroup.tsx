"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { setAssistenciaOrderAction } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import type { RequestItem, ServiceRequestSummary } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Sinaliza só quando falta alguma coisa (item sem valor de montador
// definido) — de propósito sem badge nenhum quando já está tudo certo, pra
// não poluir a fila com uma marcação em toda montagem concluída.
function paymentValueFlag(items: RequestItem[]): "none" | "partial" | null {
  if (items.length === 0) return null;
  const withValue = items.filter((i) => i.unitValue != null).length;
  if (withValue === 0) return "none";
  if (withValue < items.length) return "partial";
  return null;
}

// Fila reordenável com feedback visual: ao clicar ▲▼, os dois cards que
// trocam de lugar deslizam pra posição nova em vez de simplesmente
// "teleportar" -- técnica FLIP (mede a posição antes de trocar o estado,
// depois anima do delta até zero), sem precisar de biblioteca nova. Mesma
// ideia de mover-e-persistir de DriverRouteGroup.tsx (setas ▲▼, grava em
// segundo plano com trava de corrida via expectedOrder), adaptada pra fila
// da assistência: só reordena dentro do grupo do dia mostrado na tela, não
// mistura ordem entre dias diferentes.
export function AssistenciaQueueGroup({ items, reorderable }: { items: ServiceRequestSummary[]; reorderable: boolean }) {
  const [order, setOrder] = useState(items);
  const [saving, setSaving] = useState(false);
  const [syncedItems, setSyncedItems] = useState(items);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef<Map<string, DOMRect> | null>(null);

  // Mesmo ajuste-durante-render de DriverRouteGroup.tsx: RealtimeQueueRefresher
  // traz dado novo do Server Component pai sem remontar este client component.
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
      // Reflete localmente o assistencia_order que acabou de ser gravado,
      // senão o próximo clique manda um expectedOrder desatualizado.
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
        const needsAttention = r.deadlineStatus === "pendente" || r.escalationRisk;
        // Só scheduledDate (ScheduleField) ou approvedDeadline
        // (approveDeadline/rejectDeadline) -- as duas são decisão da
        // assistência. De propósito SEM cair pra requestedDeadline (o pedido
        // da loja, ainda não aprovado): mostrar isso aqui como se fosse a
        // data definida enganaria quem tá vendo a fila -- pra esse caso já
        // existe o badge "Prazo pendente".
        const effectiveDate = r.scheduledDate ?? r.approvedDeadline;
        // "Concluída parcialmente" não é um status próprio -- vira
        // "remarcar" com os itens já feitos marcados (ver
        // montadorCompletePartially em montador-actions.ts).
        const isPartialCompletion = r.status === "remarcar" && r.items.some((item) => item.completed);
        const showPaymentFlag = (r.type === "montagem" || r.type === "desmontagem") && (r.status === "concluida" || isPartialCompletion);
        const paymentFlag = showPaymentFlag ? paymentValueFlag(r.items) : null;

        return (
          <div
            key={r.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(r.id, el);
              else nodeRefs.current.delete(r.id);
            }}
            className="flex items-center gap-2 p-4 flex-wrap"
            style={needsAttention ? { borderLeft: `4px solid ${r.escalationRisk ? "var(--status-critical)" : "var(--status-warning)"}` } : undefined}
          >
            {reorderable ? (
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
            ) : null}

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
                  <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
                  {r.deadlineStatus === "pendente" ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-warning) 35%, var(--surface-1))" }}
                    >
                      Prazo pendente
                    </span>
                  ) : null}
                  {r.escalationRisk ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 35%, var(--surface-1))" }}
                    >
                      ⚠ Risco de escalonamento
                    </span>
                  ) : null}
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  {r.comboMontagemDesmontagem ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
                    >
                      {r.type === "montagem" ? "+ desmontagem" : "+ montagem"}
                    </span>
                  ) : null}
                  {effectiveDate ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-green) 35%, var(--surface-1))" }}
                    >
                      📅 {formatDateOnly(effectiveDate)}
                      {effectiveDate === r.scheduledDate && r.scheduledTime ? ` ${r.scheduledTime.slice(0, 5)}` : ""}
                      {effectiveDate === r.scheduledDate && r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
                    </span>
                  ) : null}
                  {paymentFlag ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        color: "var(--text-primary)",
                        background: `color-mix(in srgb, ${paymentFlag === "none" ? "var(--status-critical)" : "var(--status-warning)"} 35%, var(--surface-1))`,
                      }}
                    >
                      💰 {paymentFlag === "none" ? "Valor não definido" : "Valor parcial"}
                    </span>
                  ) : null}
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {r.storeName}
                  </span>
                </div>
                <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                  {r.clientName ?? "Sem nome de cliente"}
                  {r.clientPhone ? ` · 📞 ${r.clientPhone}` : ""}
                  {r.clientNeighborhood ? ` · 📍 ${r.clientNeighborhood}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Aberta às {new Date(r.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                {r.completedAt ? <span>Concluída em {formatDateTimeBr(r.completedAt)}</span> : null}
                <span>{r.assignedToName ? `Com ${r.assignedToName}` : "Sem responsável"}</span>
                {r.assemblerName ? <span>Montador: {r.assemblerName}</span> : null}
                {r.driverName ? <span>Motorista: {r.driverName}</span> : null}
              </div>
            </Link>

            <div className="shrink-0">
              <ProductsModalButton items={r.items} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
