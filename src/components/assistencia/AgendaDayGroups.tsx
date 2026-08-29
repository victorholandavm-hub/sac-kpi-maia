"use client";

import { useState } from "react";
import { AgendaQueueGroup } from "./AgendaQueueGroup";
import { groupIntoMonths, isCurrentMonth } from "@/lib/weekGrouping";
import { MonthAccordion } from "./MonthAccordion";
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

// Agrupa os dias por mês > semana (do mês) antes de renderizar --
// pedido do Victor 25/08/2026 (proposta de melhorias na Agenda): "Agrupe
// primeiro por Mês ou Semana... Dentro da semana, exiba os dias" --
// completado em 28/08/2026: "mantenha a divisão por semana mas de
// acordo com as semanas do mês e aí quando fechar o mês, ela ficaria
// agrupada dentro do mês --> semana --> dia" (mês corrente não ganha
// esse embrulho a mais, só os já fechados -- ver isCurrentMonth; e só
// embrulha se sobrar mais de um mês na tela -- ver agendaMonths abaixo).
// Só na lista empilhada do desktop (ver AgendaDayGroups abaixo) -- o
// seletor de dia do celular já é outro paradigma (tira uma faixa
// horizontal, não empilha), agrupar por semana/mês ali não se encaixa.
// groupIntoMonths compartilhado com a aba Visitas (fila/page.tsx) -- ver
// weekGrouping.ts.

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
  // A Agenda já filtra por mês no próprio topo (seletor "← Agosto de 2026
  // →", ver agenda/page.tsx: `listScheduledRequests({..., month:
  // filterMonth})`) -- então quase sempre `groups` inteiro é de UM mês só
  // (o que foi escolhido no seletor, não necessariamente o mês corrente
  // de verdade). Achado do Victor 28/08/2026: navegar pro mês seguinte
  // (ex.: Setembro) escondia TUDO atrás de um único acordeão "SETEMBRO DE
  // 2026" recolhido -- redundante, já que o seletor de mês é a própria
  // navegação. Só embrulha quando sobra mais de um mês na tela (acontece
  // nos filtros "Tudo"/"Atrasado"/"Próximos 7 dias", que ignoram o
  // seletor de mês -- ver `month: filterRange ? undefined : filterMonth`
  // em agenda/page.tsx -- aí sim pode vir gente de meses diferentes
  // misturada, e o acordeão volta a fazer sentido).
  const agendaMonths = groupIntoMonths(groups, (g) => g.dateKey);

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

      <div className="hidden sm:flex flex-col gap-3">
        {/* Mês -> semana (do mês) -- pedido do Victor 28/08/2026: "mantenha
            a divisão por semana mas de acordo com as semanas do mês e aí
            quando fechar o mês, ela ficaria agrupada dentro do mês -->
            semana --> dia". Mês corrente não ganha o embrulho a mais (ver
            isCurrentMonth) -- só os já fechados. Grupo nomeado (group/week)
            -- DayCard já usa "group" sem nome pro próprio ícone de abrir/
            fechar; sem o nome, abrir a semana giraria também as setas de
            todos os dias lá dentro, mesmo fechados. */}
        {agendaMonths.map((month) => {
          const weeksJsx = month.weeks.map((week) => {
            const weekTotal = week.days.reduce((sum, g) => sum + g.items.length, 0);
            return (
              <details key={week.weekKey} className="rounded-xl overflow-hidden group/week" style={{ border: "2px solid var(--border)" }}>
                <summary
                  className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="text-xs shrink-0 transition-transform duration-150 group-open/week:rotate-90"
                    style={{ color: "var(--text-secondary)" }}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    {week.label}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    ({weekTotal})
                  </span>
                </summary>
                <div className="flex flex-col gap-3 p-3" style={{ background: "var(--surface-1)" }}>
                  {week.days.map((g) => (
                    <DayCard key={g.dateKey} group={g} todayKey={todayKey} />
                  ))}
                </div>
              </details>
            );
          });
          if (isCurrentMonth(month.monthKey, todayKey) || agendaMonths.length === 1) return weeksJsx;
          const monthTotal = month.weeks.reduce((sum, w) => sum + w.days.reduce((s, g) => s + g.items.length, 0), 0);
          return (
            <MonthAccordion key={month.monthKey} label={month.label} total={monthTotal}>
              {weeksJsx}
            </MonthAccordion>
          );
        })}
      </div>
    </div>
  );
}
