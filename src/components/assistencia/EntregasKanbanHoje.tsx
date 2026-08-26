import Link from "next/link";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { DELIVERY_TYPE_COLORS } from "./AssistenciaQueueGroup";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { driverNameForRota, JP_EXTRA_ROTA, type RotaDayOverview } from "@/lib/rotas";
import type { QueueGroup } from "@/lib/entregaQueueGrouping";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";

// Quadro Kanban só pro dia de HOJE -- pedido do Victor 25/08/2026: "Para a
// operação de Hoje, um quadro estilo Kanban funciona muito bem: Coluna Sem
// Rota, Coluna por rota (com o motorista), ...". Os outros dias continuam
// na sanfona de sempre (EntregasGroupsList.tsx) -- só hoje é operação em
// tempo real o bastante pra justificar ver tudo lado a lado de uma vez.
// Sem arrastar-e-soltar entre colunas -- não foi pedido, e mudar
// rota/motorista de um card já tem fluxo próprio (dentro do detalhe do
// chamado); aqui é só uma visão, mais rápida de escanear que a sanfona.
export function EntregasKanbanHoje({ groups, todayOverview }: { groups: QueueGroup[]; todayOverview: RotaDayOverview | null }) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        📌 Hoje
      </span>
      <div className="flex items-start gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {groups.map((group) => {
          // "Rota extra" genérica (ver JP_EXTRA_ROTA) pode ter mais de um
          // motorista no mesmo dia (Joalison, Eduardo, ...) -- todos
          // compartilham o mesmo rotaKey="extra" (só a UI de escolha
          // distingue "Rota extra 1"/"Rota extra 2", ver
          // labelAvailableRota; o valor salvo em cada chamado é sempre
          // "extra"). driverNameForRota (rotas.ts) faz
          // extras.find(rota === "extra") -- pega só a PRIMEIRA
          // atribuição extra do dia, mesmo quando o chamado individual
          // tem outro motorista (r.driverName, sempre correto -- é o que
          // a tela do chamado mostra). Achado do Victor 26/08/2026: "eu
          // mudei o motorista, nao foi joalison, foi eduardo que fez, mas
          // na tela ainda aparece joalison". Rotas fixas (praia/sul/
          // centro/CG) só têm UM motorista por dia -- header único
          // continua certo pra elas; só a "extra" é ambígua, aí o nome
          // vem por card (KanbanCard), não mais um só pro grupo inteiro.
          const isExtraGroup = group.rotaKey === JP_EXTRA_ROTA;
          const driverName =
            !isExtraGroup && todayOverview && group.rotaKey && group.rotaKey !== "sem_rota" ? driverNameForRota(todayOverview, group.rotaKey) : null;
          return (
            <div key={group.key} className="flex flex-col rounded-xl shrink-0 w-72 overflow-hidden" style={{ border: `2px solid ${group.borderColor}` }}>
              <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: group.headerBg }}>
                <span className="text-sm font-bold" style={{ color: group.headerText }}>
                  {group.rotaLabel}
                </span>
                <span className="text-xs font-semibold" style={{ color: group.headerText, opacity: 0.85 }}>
                  ({group.items.length})
                </span>
              </div>
              {driverName ? (
                <div className="px-3 py-1 text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  🚚 {driverName}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[65vh]" style={{ background: "var(--surface-1)" }}>
                {group.items.map((r) => (
                  <KanbanCard key={r.id} r={r} showDriver={isExtraGroup} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Card compacto, empilhado -- diferente do EntregaCardRow (fila/sanfona),
// pensado pra ficar largo (linha inteira, 6 colunas percentuais); numa
// coluna de Kanban de ~280px isso ficaria ilegível, então é um card
// vertical novo, não reaproveitado dali.
function KanbanCard({ r, showDriver }: { r: ServiceRequestSummary; showDriver?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg p-2.5 shadow-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--gridline)" }}>
      {/* Campos que navegam pro chamado -- display:contents (mesmo padrão
          de EntregaCardRow/VisitaCardRow) pra Ver produtos, fora do link,
          continuar clicável sem disparar navegação. */}
      <Link href={`/assistencia/${r.id}`} className="contents">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            #{r.ticketNumber}
          </span>
          <div className="flex items-center gap-1">
            <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
            <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
          </div>
        </div>
        {/* Caixa alta -- pedido do Victor 25/08/2026 ("guia de
            padronização"): "Nome do Cliente (Bold, caixa alta)", mesmo
            tratamento de AssistenciaQueueGroup.tsx. */}
        <span className="text-sm font-bold truncate uppercase" style={{ color: "var(--text-primary)" }}>
          {r.clientName ?? "Sem nome de cliente"}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
          {r.clientPhone ?? "—"} · {r.clientNeighborhood ?? "—"}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: DELIVERY_TYPE_COLORS[r.type] ?? "var(--text-muted)", color: "#fff" }}
          >
            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
          </span>
          {r.scheduledTime ? (
            <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              🕐 {r.scheduledTime.slice(0, 5)}
            </span>
          ) : null}
          {/* Só pra grupo "Rota extra" (showDriver, ver EntregasKanbanHoje
              acima) -- nas rotas fixas o header do grupo já mostra o
              motorista certo (um só por dia); na "extra" o header não dá
              conta de mais de um motorista no mesmo dia, então o nome vem
              daqui, por chamado (r.driverName, sempre correto). */}
          {showDriver ? (
            <span className="text-[10px] whitespace-nowrap font-medium" style={{ color: "var(--text-secondary)" }}>
              🚚 {r.driverName ?? "Sem motorista"}
            </span>
          ) : null}
        </div>
      </Link>
      <ProductsModalButton items={r.items} />
    </div>
  );
}
