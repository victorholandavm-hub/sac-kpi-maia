"use client";

import { useState } from "react";
import { AgendaQueueGroup } from "./AgendaQueueGroup";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";

type Group = { dateKey: string; label: string; items: ServiceRequestSummary[] };

function shortDayLabel(dateKey: string): { weekday: string; dayMonth: string } {
  const [y, m, d] = dateKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toUpperCase();
  return { weekday, dayMonth: `${d}/${m}` };
}

function isGroupOverdue(group: Group, todayKey: string): boolean {
  const hasPending = group.items.some((r) => r.status !== "concluida" && r.status !== "cancelada");
  return group.dateKey < todayKey && hasPending;
}

// Recolhível, recolhido por padrão -- pedido do Victor 25/08/2026: "na
// tela de agenda, precisa por padrão estar recolhido o agrupamento".
// <details> nativo, sem JS extra, sem `open` já nasce fechado (mesmo
// padrão de EntregasGroupsList.tsx/fila/notificações do SAC).
function DayCard({ group, todayKey }: { group: Group; todayKey: string }) {
  const isOverdue = isGroupOverdue(group, todayKey);
  return (
    <details className="rounded-xl overflow-hidden group" style={{ border: "2px solid var(--brand-green)" }}>
      <summary
        className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        style={{ background: "var(--brand-green)" }}
      >
        <span
          className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
          style={{ color: "var(--brand-green-ink)" }}
          aria-hidden="true"
        >
          ▶
        </span>
        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--brand-green-ink)" }}>
          {group.label}
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--brand-green-ink)", opacity: 0.85 }}>
          ({group.items.length})
        </span>
        {group.dateKey === todayKey ? (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: "var(--text-primary)", background: "var(--surface-1)" }}
          >
            HOJE
          </span>
        ) : isOverdue ? (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 45%, var(--surface-1))" }}
          >
            ATRASADO
          </span>
        ) : null}
      </summary>
      <div style={{ background: "var(--surface-1)" }}>
        <AgendaQueueGroup items={group.items} isOverdue={isOverdue} />
      </div>
    </details>
  );
}

// No celular, rolagem única com todos os dias empilhados era difícil de
// escanear -- vira um seletor de dia estilo calendário semanal no topo,
// mostrando só o dia escolhido embaixo. No desktop/tablet ("sm" pra cima)
// continua empilhado, um dia embaixo do outro, como sempre foi.
export function AgendaDayGroups({ groups, todayKey }: { groups: Group[]; todayKey: string }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedGroup = groups.find((g) => g.dateKey === selectedKey) ?? groups[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="sm:hidden flex items-center gap-2 overflow-x-auto -mx-1 px-1">
        {groups.map((g) => {
          const { weekday, dayMonth } = shortDayLabel(g.dateKey);
          const selected = g.dateKey === (selectedKey ?? groups[0]?.dateKey);
          const isToday = g.dateKey === todayKey;
          const isOverdue = isGroupOverdue(g, todayKey);
          return (
            <button
              key={g.dateKey}
              onClick={() => setSelectedKey(g.dateKey)}
              className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 shrink-0"
              style={
                selected
                  ? { background: "var(--brand-green)", color: "var(--brand-green-ink)" }
                  : {
                      border: `1px solid ${isOverdue ? "var(--status-critical)" : "var(--border)"}`,
                      color: isToday ? "var(--brand-green)" : "var(--text-secondary)",
                    }
              }
            >
              <span className="text-[10px] font-bold uppercase">{weekday}</span>
              <span className="text-sm font-semibold">{dayMonth}</span>
            </button>
          );
        })}
      </div>

      <div className="sm:hidden">{selectedGroup ? <DayCard group={selectedGroup} todayKey={todayKey} /> : null}</div>

      <div className="hidden sm:flex flex-col gap-4">
        {groups.map((g) => (
          <DayCard key={g.dateKey} group={g} todayKey={todayKey} />
        ))}
      </div>
    </div>
  );
}
