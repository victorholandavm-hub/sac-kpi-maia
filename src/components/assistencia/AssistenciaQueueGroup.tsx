"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { setAssistenciaOrderAction } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS, DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import type { RequestItem, ServiceRequestSummary } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

type PaymentFlag = "none" | "partial" | "complete" | "no_items";

// Sempre mostra algo (inclusive "tudo certo") -- silêncio quando o valor já
// tava definido dava a impressão de que nada tinha sido conferido ainda.
// Chamado sem item nenhum (removido depois, ou nunca cadastrado) também
// precisa de um selo -- sem isso, "items.length === 0" caía no silêncio de
// novo, a mesma falta que motivou esse badge existir.
function paymentValueFlag(items: RequestItem[]): PaymentFlag {
  if (items.length === 0) return "no_items";
  const withValue = items.filter((i) => i.unitValue != null).length;
  if (withValue === 0) return "none";
  if (withValue < items.length) return "partial";
  return "complete";
}

const PAYMENT_FLAG_LABELS: Record<PaymentFlag, string> = {
  none: "💰 Valor não definido",
  partial: "💰 Valor parcial",
  complete: "✓ Valor definido",
  no_items: "⚠ Sem produto cadastrado",
};
const PAYMENT_FLAG_COLORS: Record<PaymentFlag, string> = {
  none: "var(--status-critical)",
  partial: "var(--status-warning)",
  complete: "var(--status-good)",
  no_items: "var(--status-critical)",
};

// Fila reordenável com feedback visual: ao clicar ▲▼, os dois cards que
// trocam de lugar deslizam pra posição nova em vez de simplesmente
// "teleportar" -- técnica FLIP (mede a posição antes de trocar o estado,
// depois anima do delta até zero), sem precisar de biblioteca nova. Mesma
// ideia de mover-e-persistir de DriverRouteGroup.tsx (setas ▲▼, grava em
// segundo plano com trava de corrida via expectedOrder), adaptada pra fila
// da assistência: só reordena dentro do grupo do dia mostrado na tela, não
// mistura ordem entre dias diferentes.
export function AssistenciaQueueGroup({
  items,
  reorderable,
  now,
  showCreatedDate,
}: {
  items: ServiceRequestSummary[];
  reorderable: boolean;
  // Vem do servidor (ver fila/page.tsx) em vez de Date.now() aqui dentro --
  // esse componente usa hooks ("use client"), e chamar função impura direto
  // no corpo do render quebra a regra de pureza do React Compiler.
  now: number;
  // Grupo por data (aba Visitas) já deixa a data óbvia no cabeçalho do
  // grupo -- só repete aqui (dentro do card) quando o agrupamento é por
  // outra coisa, ex. rota (aba Entregas), pedido do Victor 18/08/2026.
  showCreatedDate?: boolean;
}) {
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
        // Só montagem/desmontagem tem valor de montador a pagar por item --
        // confirmado com o usuário que troca de peça não entra aqui (#4588
        // era falso positivo).
        const showPaymentFlag = (r.type === "montagem" || r.type === "desmontagem") && (r.status === "concluida" || isPartialCompletion);
        const paymentFlag = showPaymentFlag ? paymentValueFlag(r.items) : null;
        // "Aberta" parada há muito tempo sem ninguém sequer entrar em
        // contato -- indício de triagem esquecida, não de trabalho em
        // andamento (esse já muda pra "em_contato"/"em_andamento").
        const staleOpen = r.status === "aberta" && now - new Date(r.createdAt).getTime() > 4 * 3_600_000;

        return (
          <div
            key={r.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(r.id, el);
              else nodeRefs.current.delete(r.id);
            }}
            className="flex flex-col gap-2 p-4"
            style={needsAttention ? { borderLeft: `4px solid ${r.escalationRisk ? "var(--status-critical)" : "var(--status-warning)"}` } : undefined}
          >
          <div className="flex items-center gap-2 flex-wrap">
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
                  {/* Troca/entrega/envio de peça usam o status simplificado
                      (Programado/Concluído) desde o pedido do Victor
                      19/08/2026 -- montagem/desmontagem/vistoria/troca de
                      peça (aba Visitas) continuam com o status detalhado,
                      onde as etapas fazem sentido de verdade. */}
                  {(DELIVERY_REQUEST_TYPES as readonly string[]).includes(r.type) ? (
                    <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
                  ) : (
                    <StatusBadge status={r.status} />
                  )}
                  {r.type === "troca_produto" && r.exchangeRound > 1 ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: "#fff", background: "var(--status-warning)" }}
                    >
                      {r.exchangeRound}ª troca
                    </span>
                  ) : null}
                  {staleOpen ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: "var(--status-critical)", color: "#fff" }}
                    >
                      ⏱ parada há {Math.floor((now - new Date(r.createdAt).getTime()) / 3_600_000)}h
                    </span>
                  ) : null}
                  <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
                  {isPartialCompletion ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
                    >
                      ◐ Concluída parcialmente
                    </span>
                  ) : null}
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
                        background: `color-mix(in srgb, ${PAYMENT_FLAG_COLORS[paymentFlag]} 35%, var(--surface-1))`,
                      }}
                    >
                      {PAYMENT_FLAG_LABELS[paymentFlag]}
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
                <span>
                  Aberta {showCreatedDate ? `em ${new Date(r.createdAt).toLocaleDateString("pt-BR")} ` : ""}às{" "}
                  {new Date(r.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
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

          {r.montadorInstruction ? (
            // Recolhida por padrão -- expandida sempre (era o normal antes),
            // ela sozinha esgota boa parte da rolagem da fila quando tem
            // muito chamado com instrução. `<details>` nativo, sem JS extra.
            <details
              className="rounded-lg p-2.5"
              style={{ background: "color-mix(in srgb, var(--status-warning) 12%, var(--surface-1))", border: "2px solid var(--status-warning)" }}
            >
              <summary className="text-xs font-bold cursor-pointer" style={{ color: "var(--text-primary)" }}>
                ⚠ Instrução pro montador
              </summary>
              <p className="text-sm whitespace-pre-line mt-1" style={{ color: "var(--text-primary)" }}>
                {r.montadorInstruction}
              </p>
            </details>
          ) : null}
          </div>
        );
      })}
    </div>
  );
}
