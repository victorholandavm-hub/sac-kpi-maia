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
// agrupada dentro do mês --> semana --> dia" (só embrulha se sobrar mais
// de um mês na tela -- ver agendaMonths abaixo; quando embrulha, o mês
// corrente nasce ABERTO por padrão -- ver defaultOpen/isCurrentMonth,
// MonthAccordion.tsx, corrigido 29/08/2026).
// Só na lista empilhada do desktop (ver AgendaDayGroups abaixo) -- o
// seletor de dia do celular já é outro paradigma (tira uma faixa
// horizontal, não empilha), agrupar por semana/mês ali não se encaixa.
// groupIntoMonths compartilhado com a aba Visitas (fila/page.tsx) -- ver
// weekGrouping.ts.

// Recolhível, recolhido por padrão -- pedido do Victor 25/08/2026: "na
// tela de agenda, precisa por padrão estar recolhido o agrupamento".
// <details> nativo, sem JS extra, sem `open` já nasce fechado (mesmo
// padrão de EntregasGroupsList.tsx/fila/notificações do SAC).
// Card branco, borda fina -- Guia de Componentes Maia (Design System,
// 01/09/2026), mesmo tratamento que os cards de dia da aba Visitas
// (fila/page.tsx) já receberam, no lugar da barra verde cheia de antes.
// HOJE continua com destaque verde (badge sólido); ATRASADO com destaque
// vermelho -- as duas únicas cores "de alerta" na linha, o resto (▶,
// label, contador) segue a mesma escala neutra de cinza de sempre.
function DayCard({ group, todayKey }: { group: Group; todayKey: string }) {
  const isOverdue = isGroupOverdue(group, todayKey);
  const isToday = group.dateKey === todayKey;
  return (
    <details className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <summary className="px-4 py-2.5 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 transition-colors duration-150">
        <span className="text-[10px] shrink-0 transition-transform duration-150 group-open:rotate-90 text-gray-400" aria-hidden="true">
          ▶
        </span>
        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{group.label}</span>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
          {group.items.length}
        </span>
        {isToday ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap text-white" style={{ background: "var(--brand-green)" }}>
            HOJE
          </span>
        ) : isOverdue ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap text-white" style={{ background: "var(--status-critical)" }}>
            ATRASADO
          </span>
        ) : null}
      </summary>
      <div className="border-t border-gray-100">
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
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 shrink-0 transition-colors duration-150 ${
                selected ? "text-white shadow-sm" : "bg-white border hover:border-gray-300"
              }`}
              style={
                selected
                  ? { background: "var(--brand-green)" }
                  : { borderColor: isOverdue ? "var(--status-critical)" : "#E5E7EB", color: isToday ? "var(--brand-green)" : "#6B7280" }
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
            semana --> dia". TODO mês ganha o embrulho quando aparece mais
            de um (ver agendaMonths.length acima) -- o mês corrente só
            nasce ABERTO por padrão (defaultOpen/isCurrentMonth,
            MonthAccordion.tsx), corrigido 29/08/2026 (achado do Victor:
            "agosto precisa ficar do mesmo jeito que setembro, com as
            semanas dentro"). Grupo nomeado (group/week) -- DayCard já usa
            "group" sem nome pro próprio ícone de abrir/fechar; sem o
            nome, abrir a semana giraria também as setas de todos os dias
            lá dentro, mesmo fechados. */}
        {agendaMonths.map((month) => {
          const weeksJsx = month.weeks.map((week) => {
            const weekTotal = week.days.reduce((sum, g) => sum + g.items.length, 0);
            return (
              // Agrupador cronológico -- Guia de Componentes Maia (Design
              // System, 01/09/2026): linha fina + badge discreto, mesmo
              // padrão do cabeçalho de semana já convertido na aba Visitas
              // (fila/page.tsx), no lugar do bloco cinza cheio de antes.
              <details key={week.weekKey} className="group/week flex flex-col gap-2">
                <summary className="flex items-center gap-3 py-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-[10px] shrink-0 transition-transform duration-150 group-open/week:rotate-90 text-gray-400" aria-hidden="true">
                    ▶
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">{week.label}</span>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                    {weekTotal}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </summary>
                <div className="flex flex-col gap-2 pl-4">
                  {week.days.map((g) => (
                    <DayCard key={g.dateKey} group={g} todayKey={todayKey} />
                  ))}
                </div>
              </details>
            );
          });
          if (agendaMonths.length === 1) return weeksJsx;
          const monthTotal = month.weeks.reduce((sum, w) => sum + w.days.reduce((s, g) => s + g.items.length, 0), 0);
          return (
            <MonthAccordion key={month.monthKey} label={month.label} total={monthTotal} defaultOpen={isCurrentMonth(month.monthKey, todayKey)}>
              {weeksJsx}
            </MonthAccordion>
          );
        })}
      </div>
    </div>
  );
}
