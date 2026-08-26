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

type KanbanColumn = {
  key: string;
  rotaLabel: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
  items: ServiceRequestSummary[];
  driverName: string | null;
};

// "Rota extra" genérica (ver JP_EXTRA_ROTA, rotas.ts) pode ter mais de um
// motorista atribuído no mesmo dia (Joalison, Eduardo, ...) -- todos
// compartilham o mesmo rotaKey="extra" salvo em cada chamado (só a UI de
// escolha distingue "Rota extra 1"/"Rota extra 2" na hora de agendar, ver
// labelAvailableRota). Primeiro achado do Victor 26/08/2026: "eu mudei o
// motorista, nao foi joalison, foi eduardo que fez, mas na tela ainda
// aparece joalison" -- um cabeçalho só pro grupo mostrava sempre o mesmo
// motorista (driverNameForRota pega a primeira atribuição extra do dia).
// Ajuste pedido em seguida, mesma conversa: "eu prefiro que seja dois
// cards diferentes no kanban, um para cada motorista" -- em vez de um card
// com o motorista errado (ou, na correção anterior, o nome certo repetido
// dentro de cada linha), o grupo "extra" agora vira uma COLUNA POR
// MOTORISTA, cada uma com seu cabeçalho certo -- mesmo tratamento visual
// que as rotas fixas (praia/sul/centro/CG) já tinham (um motorista, um
// cabeçalho). Rotas fixas continuam uma coluna só, sem mudança.
function buildColumns(groups: QueueGroup[], todayOverview: RotaDayOverview | null): KanbanColumn[] {
  return groups.flatMap((group): KanbanColumn[] => {
    if (group.rotaKey === JP_EXTRA_ROTA) {
      const byDriver = new Map<string, ServiceRequestSummary[]>();
      for (const r of group.items) {
        const driverKey = r.driverName ?? "";
        const list = byDriver.get(driverKey) ?? [];
        list.push(r);
        byDriver.set(driverKey, list);
      }
      // Sem motorista definido fica sempre por último -- mesmo raciocínio
      // de sortedOverview/pinSemRotaFirst: pendência não deve se misturar
      // no meio das colunas já resolvidas.
      return Array.from(byDriver.entries())
        .sort(([a], [b]) => {
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b, "pt-BR");
        })
        .map(([driverKey, items]) => ({
          key: `${group.key}_${driverKey || "sem_motorista"}`,
          rotaLabel: group.rotaLabel ?? group.label,
          headerBg: group.headerBg,
          headerText: group.headerText,
          borderColor: group.borderColor,
          items,
          driverName: driverKey || null,
        }));
    }
    const driverName =
      todayOverview && group.rotaKey && group.rotaKey !== "sem_rota" ? driverNameForRota(todayOverview, group.rotaKey) : null;
    return [
      {
        key: group.key,
        rotaLabel: group.rotaLabel ?? group.label,
        headerBg: group.headerBg,
        headerText: group.headerText,
        borderColor: group.borderColor,
        items: group.items,
        driverName,
      },
    ];
  });
}

export function EntregasKanbanHoje({ groups, todayOverview }: { groups: QueueGroup[]; todayOverview: RotaDayOverview | null }) {
  if (groups.length === 0) return null;
  const columns = buildColumns(groups, todayOverview);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        📌 Hoje
      </span>
      <div className="flex items-start gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {columns.map((column) => (
          <div key={column.key} className="flex flex-col rounded-xl shrink-0 w-72 overflow-hidden" style={{ border: `2px solid ${column.borderColor}` }}>
            <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: column.headerBg }}>
              <span className="text-sm font-bold" style={{ color: column.headerText }}>
                {column.rotaLabel}
              </span>
              <span className="text-xs font-semibold" style={{ color: column.headerText, opacity: 0.85 }}>
                ({column.items.length})
              </span>
            </div>
            {column.driverName ? (
              <div className="px-3 py-1 text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                🚚 {column.driverName}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[65vh]" style={{ background: "var(--surface-1)" }}>
              {column.items.map((r) => (
                <KanbanCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Card compacto, empilhado -- diferente do EntregaCardRow (fila/sanfona),
// pensado pra ficar largo (linha inteira, 6 colunas percentuais); numa
// coluna de Kanban de ~280px isso ficaria ilegível, então é um card
// vertical novo, não reaproveitado dali.
function KanbanCard({ r }: { r: ServiceRequestSummary }) {
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
        </div>
      </Link>
      <ProductsModalButton items={r.items} />
    </div>
  );
}
