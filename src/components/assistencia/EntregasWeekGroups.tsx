import { EntregasGroupsList } from "./EntregasGroupsList";
import { countByDeliveryStatus } from "./DeliveryStatusBadge";
import { groupIntoMonths, isCurrentMonth } from "@/lib/weekGrouping";
import { MonthAccordion } from "./MonthAccordion";
import type { QueueGroup } from "@/lib/entregaQueueGrouping";

// Agrupa a aba Entregas/notificações do SAC por mês > semana (do mês) >
// dia -- pedido do Victor 26/08/2026: "divida os agrupamentos igual é na
// tela de visitas, agrupados por semana, deixando de fora apenas as
// notificações de 'hoje' que ficam no kanban" + 28/08/2026: "quando
// fechar o mês, ela ficaria agrupada dentro do mês --> semana --> dia".
// `groups` aqui já vem sem "hoje" (ver EntregasKanbanHoje pro que sobrou)
// -- todo o resto (futuro + atrasado + sem rota) entra. Mesmo
// `groupIntoMonths` que Visitas já usa (weekGrouping.ts), só que precisa
// da data crua de cada grupo (dateKey, ver entregaQueueGrouping.ts) em
// vez do `key` composto (`${data}_${rota}`) que Entregas usa pra
// identificar unicamente cada grupo.
//
// "Sem data definida" (nenhum item com scheduledDate nem approvedDeadline --
// caso raro, não visto em produção até agora) não entra em semana nenhuma --
// não tem data pra calcular segunda-feira da semana. Renderiza solto, fora
// dos acordeões de semana, depois deles (mesma prioridade mais baixa que já
// tinha no agrupamento original, ver SCHEDULED_DATE_BUCKET_RANK).
export function EntregasWeekGroups({ groups, now }: { groups: QueueGroup[]; now: number }) {
  const dated = groups.filter((g): g is QueueGroup & { dateKey: string } => !!g.dateKey);
  const undated = groups.filter((g) => !g.dateKey);
  const months = groupIntoMonths(dated, (g) => g.dateKey);
  // Mesmo `now` já usado pro resto da tela (badges ATRASADO etc.) -- não
  // chama `new Date()` de novo à toa, só deriva a chave do dia daquele
  // mesmo timestamp.
  const todayKey = new Date(now).toISOString().slice(0, 10);

  function renderWeek(week: (typeof months)[number]["weeks"][number]) {
        // Semana "pura futuro" (só amanhã/depois, nada atrasado dentro)
        // ganha cor de destaque diferente -- pedido do Victor: "as futuras
        // você classifica do mesmo jeito, só com cor diferente". Uma
        // semana com atrasado misturado (comum: a semana atual, que já
        // teve dias passados antes de hoje) fica com o visual neutro de
        // sempre -- as badges FUTURA/ATRASADA de cada grupo (mantidas, ver
        // EntregasGroupsList) já dizem o que é o quê lá dentro.
        //
        // Badge no cabeçalho da SEMANA também -- pedido seguinte do Victor
        // 26/08/2026: "no agrupamento semanal que tiver alguma atrasada
        // coloque a badge na semana... e se for futura, da mesma forma,
        // coloque a badge futura na semana e nao só no dia". Mesmo
        // critério de "atrasada de verdade" que cada grupo já usa
        // (EntregasGroupsList) -- um dia atrasado com tudo já
        // concluído/cancelado (0 Programado) não conta pra essa badge,
        // não sobrou nada pra remarcar (mesmo raciocínio, achado do
        // Victor 25/08/2026: "tire a badge de 'atrasada' nas datas em que
        // as notificações programadas estão zeradas").
        const hasFuture = week.days.some((g) => g.dateBucket === "amanha" || g.dateBucket === "depois");
        const hasAtrasado = week.days.some((g) => g.dateBucket === "atrasado" && countByDeliveryStatus(g.items).programado > 0);
        const isFutureWeek = hasFuture && !hasAtrasado;
        const weekTotal = week.days.reduce((sum, g) => sum + g.items.length, 0);
        return (
          <details
            key={week.weekKey}
            className="rounded-xl overflow-hidden group/week"
            style={{ border: `2px solid ${isFutureWeek ? "var(--brand-green)" : "var(--border)"}` }}
          >
            <summary
              className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden"
              style={{ background: isFutureWeek ? "var(--brand-green-soft)" : "var(--surface-2)" }}
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
              {hasAtrasado ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: "var(--status-critical)", color: "#fff" }}
                >
                  Atrasada
                </span>
              ) : null}
              {isFutureWeek ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: "var(--brand-green)", color: "#fff" }}
                >
                  Futura
                </span>
              ) : null}
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                ({weekTotal})
              </span>
            </summary>
            <div className="flex flex-col gap-3 p-3" style={{ background: "var(--surface-1)" }}>
              <EntregasGroupsList groups={week.days} now={now} />
            </div>
          </details>
        );
  }

  // Mês -> semana -- pedido do Victor 28/08/2026: "quando fechar o mês,
  // ela ficaria agrupada dentro do mês --> semana --> dia". Mês corrente
  // não ganha o embrulho a mais (ver isCurrentMonth) -- só os já fechados.
  return (
    <div className="flex flex-col gap-3">
      {months.map((month) => {
        const weeksJsx = month.weeks.map(renderWeek);
        if (isCurrentMonth(month.monthKey, todayKey)) return weeksJsx;
        const monthTotal = month.weeks.reduce((sum, w) => sum + w.days.reduce((s, g) => s + g.items.length, 0), 0);
        return (
          <MonthAccordion key={month.monthKey} label={month.label} total={monthTotal}>
            {weeksJsx}
          </MonthAccordion>
        );
      })}
      {undated.length > 0 ? <EntregasGroupsList groups={undated} now={now} /> : null}
    </div>
  );
}
