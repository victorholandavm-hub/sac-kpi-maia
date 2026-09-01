import { AssistenciaQueueGroup } from "./AssistenciaQueueGroup";
import { countByDeliveryStatus } from "./DeliveryStatusBadge";
import { DATE_BUCKET_TAG, type QueueGroup } from "@/lib/entregaQueueGrouping";

// Renderização dos grupos de rota da aba Entregas -- extraído de
// fila/page.tsx (24/08/2026) pra ser compartilhado com a tela de
// notificações do SAC (assistencia/sac/notificacoes/page.tsx), que tinha
// sua própria versão dessa mesma lista foi divergindo (visual diferente,
// contagem diferente) -- achado do Victor 24/08/2026: "a tela de
// notificação de assistencia do sac deve ser igual a de admin". Agora as
// duas telas renderizam com esse componente único.
export function EntregasGroupsList({ groups, now }: { groups: QueueGroup[]; now: number }) {
  return (
    <>
      {groups.map((group) => {
        // Divisão programado/concluído/cancelado, com o número ao lado de
        // cada um.
        const statusCounts = countByDeliveryStatus(group.items);
        return (
          // Recolhível, recolhido por padrão -- achado do Victor 24/08/2026:
          // "toda vez que eu entrar em qualquer tela, as demandas agrupadas
          // precisam aparecer recolhidas" (antes abria tudo, poluía a tela
          // com pedido grande). <details> nativo, sem JS extra, sem `open`
          // já nasce fechado. Destaque na barra da rota aberta (`open:`,
          // pseudo-classe nativa do <details>, reage sozinha ao clique) +
          // opacidade reduzida pra rota/data já passada (só `atrasado`).
          // Agrupador cronológico -- Guia de Componentes Maia (Design
          // System, 01/09/2026): "barras horizontais finas, elegantes,
          // ocupando 100% da largura, com fontes limpas e contadores
          // numéricos em badges neutros cinza-claros", mesmo padrão do
          // cabeçalho de mês/semana já convertidos (MonthAccordion.tsx,
          // EntregasWeekGroups.tsx). Substitui a barra cheia colorida por
          // rota de antes -- a cor por rota (group.headerBg/headerText)
          // não é mais usada aqui; a rota já está no texto do label, e as
          // tags Atrasada/Futura/Hoje/Sem rota continuam carregando o
          // significado semântico que importa.
          <details key={group.key} className={`group flex flex-col gap-2 ${group.dateBucket === "atrasado" ? "opacity-60" : ""}`}>
            <summary className="flex items-center gap-3 py-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="text-[10px] shrink-0 transition-transform duration-150 group-open:rotate-90 text-gray-400" aria-hidden="true">
                ▶
              </span>
              <span className="text-sm font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">{group.label}</span>
              {group.isSemRota ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-gray-100 text-gray-500">Sem rota</span>
              ) : group.dateBucket &&
                DATE_BUCKET_TAG[group.dateBucket] &&
                // "Atrasada" só faz sentido enquanto sobra algo pra
                // remarcar -- achado do Victor 25/08/2026: "tire a badge
                // de 'atrasada' nas datas em que as notificações
                // programadas estão zeradas" (grupo com 0 Programado, só
                // Concluído/Cancelado, não precisa de remarcar mais
                // nada, mesmo com a data no passado). Só essa tag -- Hoje/
                // Futura continuam aparecendo mesmo com tudo já resolvido,
                // ainda dizem algo útil sobre a data em si.
                !(group.dateBucket === "atrasado" && statusCounts.programado === 0) ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide text-white"
                  style={{ background: DATE_BUCKET_TAG[group.dateBucket]!.bg }}
                >
                  {DATE_BUCKET_TAG[group.dateBucket]!.label}
                </span>
              ) : null}
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                {group.items.length}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="flex items-center gap-2 text-[11px] font-medium text-gray-400 whitespace-nowrap">
                <span>
                  {statusCounts.programado} Programado{statusCounts.programado === 1 ? "" : "s"}
                </span>
                <span>
                  {statusCounts.concluido} Concluído{statusCounts.concluido === 1 ? "" : "s"}
                </span>
                <span>
                  {statusCounts.cancelado} Cancelado{statusCounts.cancelado === 1 ? "" : "s"}
                </span>
              </span>
            </summary>
            <div>
              <AssistenciaQueueGroup items={group.items} reorderable now={now} showCreatedDate printable showStaleBadge={false} />
            </div>
          </details>
        );
      })}
    </>
  );
}
