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
          // Recolhível, aberto por padrão -- <details> nativo, sem JS
          // extra. Destaque na barra da rota aberta (`open:`, pseudo-
          // classe nativa do <details>, reage sozinha ao clique) + opacidade
          // reduzida pra rota/data já passada (só `atrasado`).
          <details
            key={group.key}
            className={`group rounded-xl overflow-hidden border-2 open:border-4 transition-[border-width] ${group.dateBucket === "atrasado" ? "opacity-60" : ""}`}
            style={{ borderColor: group.borderColor }}
            open
          >
            <summary
              className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden group-open:brightness-95"
              style={{ background: group.headerBg }}
            >
              <span
                className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
                style={{ color: group.headerText }}
                aria-hidden="true"
              >
                ▶
              </span>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: group.headerText }}>
                {group.label}
              </span>
              {group.isSemRota ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}
                >
                  Sem rota
                </span>
              ) : group.dateBucket && DATE_BUCKET_TAG[group.dateBucket] ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: DATE_BUCKET_TAG[group.dateBucket]!.bg, color: "#fff" }}
                >
                  {DATE_BUCKET_TAG[group.dateBucket]!.label}
                </span>
              ) : null}
              <span className="text-xs font-semibold" style={{ color: group.headerText, opacity: 0.85 }}>
                ({group.items.length})
              </span>
              <span className="flex items-center gap-2 text-[11px] font-medium ml-auto" style={{ color: group.headerText }}>
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
            <div style={{ background: "var(--surface-1)" }}>
              <AssistenciaQueueGroup items={group.items} reorderable now={now} showCreatedDate printable showStaleBadge={false} />
            </div>
          </details>
        );
      })}
    </>
  );
}
