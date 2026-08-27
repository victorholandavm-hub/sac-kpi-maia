import { EntregasGroupsList } from "./EntregasGroupsList";
import { groupIntoWeeks } from "@/lib/weekGrouping";
import type { QueueGroup } from "@/lib/entregaQueueGrouping";

// Agrupa a aba Entregas/notificações do SAC por semana -- pedido do Victor
// 26/08/2026: "divida os agrupamentos igual é na tela de visitas, agrupados
// por semana, deixando de fora apenas as notificações de 'hoje' que ficam
// no kanban". `groups` aqui já vem sem "hoje" (ver EntregasKanbanHoje pro
// que sobrou) -- todo o resto (futuro + atrasado + sem rota) entra. Mesmo
// `groupIntoWeeks` que Visitas já usa (weekGrouping.ts), só que precisa da
// data crua de cada grupo (dateKey, ver entregaQueueGrouping.ts) em vez do
// `key` composto (`${data}_${rota}`) que Entregas usa pra identificar
// unicamente cada grupo.
//
// "Sem data definida" (nenhum item com scheduledDate nem approvedDeadline --
// caso raro, não visto em produção até agora) não entra em semana nenhuma --
// não tem data pra calcular segunda-feira da semana. Renderiza solto, fora
// dos acordeões de semana, depois deles (mesma prioridade mais baixa que já
// tinha no agrupamento original, ver SCHEDULED_DATE_BUCKET_RANK).
export function EntregasWeekGroups({ groups, now }: { groups: QueueGroup[]; now: number }) {
  const dated = groups.filter((g): g is QueueGroup & { dateKey: string } => !!g.dateKey);
  const undated = groups.filter((g) => !g.dateKey);
  const weeks = groupIntoWeeks(dated, (g) => g.dateKey);

  return (
    <div className="flex flex-col gap-3">
      {weeks.map((week) => {
        // Semana "pura futuro" (só amanhã/depois, nada atrasado dentro)
        // ganha cor de destaque diferente -- pedido do Victor: "as futuras
        // você classifica do mesmo jeito, só com cor diferente". Uma
        // semana com atrasado misturado (comum: a semana atual, que já
        // teve dias passados antes de hoje) fica com o visual neutro de
        // sempre -- as badges FUTURA/ATRASADA de cada grupo (mantidas,
        // ver EntregasGroupsList) já dizem o que é o quê lá dentro.
        const hasFuture = week.days.some((g) => g.dateBucket === "amanha" || g.dateBucket === "depois");
        const hasAtrasado = week.days.some((g) => g.dateBucket === "atrasado");
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
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                ({weekTotal})
              </span>
            </summary>
            <div className="flex flex-col gap-3 p-3" style={{ background: "var(--surface-1)" }}>
              <EntregasGroupsList groups={week.days} now={now} />
            </div>
          </details>
        );
      })}
      {undated.length > 0 ? <EntregasGroupsList groups={undated} now={now} /> : null}
    </div>
  );
}
