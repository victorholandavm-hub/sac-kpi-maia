import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveEncomendaRequester, canEditPedido, type EncomendaRequester } from "@/lib/encomendaRequester";
import { signOut } from "@/app/assistencia/actions";
import {
  listPedidosByRequester,
  listAllPedidos,
  listEventsForPedidos,
  listOpenPedidoEncomendaQueueIds,
  OPEN_PEDIDO_ENCOMENDA_STATUSES,
  type PedidoEncomendaSummary,
} from "@/lib/pedidosEncomenda";
import { listEncomendaPhotosForPedidos } from "@/lib/pedidoEncomendaPhotos";
import { PedidoEncomendaStatusBadge } from "@/components/assistencia/PedidoEncomendaStatusBadge";
import { PedidoEncomendaTimeline } from "@/components/assistencia/PedidoEncomendaTimeline";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { StatTile } from "@/components/StatTile";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { bucketByScheduledDate, type DateBucketKey } from "@/lib/dateBuckets";

// Precisa refletir os pedidos em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

const OPEN_STATUSES: string[] = OPEN_PEDIDO_ENCOMENDA_STATUSES;

// Agrupado por prazo -- mesma lógica de PedidoEncomendaFilaList.tsx (pedido
// do Victor 20/08/2026: "deixe com a mesma organização que fizemos na tela
// dos admin, e nas encomendas, na tela do sac, mesma coisa, separado por
// data e organizado por ordem cronológica. Passou a data? vai lá pra
// baixo"). Só se aplica à aba "Minhas em aberto" -- concluídas/todas
// continuam ordenadas por data de criação, que é o que importa num
// histórico, não numa fila.
function effectiveDeadline(p: PedidoEncomendaSummary): string | null {
  return p.prazoCdLoja ?? p.prazoFabricaCd ?? null;
}

const NO_DEADLINE_KEY = "sem_prazo";
const DEADLINE_BUCKET_RANK: Record<DateBucketKey, number> = {
  hoje: 0,
  amanha: 1,
  depois: 2,
  atrasado: 3,
  sem_data: 4,
};

type DeadlineGroup = { dateKey: string; label: string; pedidos: PedidoEncomendaSummary[] };

function groupByDeadline(pedidos: PedidoEncomendaSummary[]): DeadlineGroup[] {
  const groups: DeadlineGroup[] = [];
  for (const p of pedidos) {
    const deadline = effectiveDeadline(p);
    const dateKey = deadline ?? NO_DEADLINE_KEY;
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label = deadline
        ? new Date(`${deadline}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
        : "Sem prazo definido";
      group = { dateKey, label, pedidos: [] };
      groups.push(group);
    }
    group.pedidos.push(p);
  }
  groups.sort((a, b) => {
    const rankA = DEADLINE_BUCKET_RANK[bucketByScheduledDate(a.dateKey === NO_DEADLINE_KEY ? null : a.dateKey)];
    const rankB = DEADLINE_BUCKET_RANK[bucketByScheduledDate(b.dateKey === NO_DEADLINE_KEY ? null : b.dateKey)];
    if (rankA !== rankB) return rankA - rankB;
    return a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0;
  });
  return groups;
}

export default async function EncomendasSacPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const requester = await resolveEncomendaRequester();
  if (!requester) {
    redirect("/assistencia/encomendas");
  }
  // Essa tela é só do SAC acompanhando o que ele mesmo lançou -- os outros
  // papéis têm a própria tela (caixa/gerente por loja, CD/fábrica na fila
  // interna, ver caixa/page.tsx e fila/page.tsx).
  if (requester.kind !== "sac") {
    redirect("/assistencia/encomendas");
  }

  const { view } = await searchParams;
  const showCompleted = view === "concluidos";
  const showAll = view === "todas";

  const [meusPedidos, todosPedidos, queueIds] = await Promise.all([
    listPedidosByRequester(requester.name),
    showAll ? listAllPedidos() : Promise.resolve([]),
    showAll || showCompleted ? Promise.resolve([]) : listOpenPedidoEncomendaQueueIds(),
  ]);
  const allPedidos = meusPedidos;
  const queuePosition = new Map(queueIds.map((id, i) => [id, i + 1]));
  const pedidos = showAll
    ? [...todosPedidos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : allPedidos
        .filter((p) => (showCompleted ? !OPEN_STATUSES.includes(p.status) : OPEN_STATUSES.includes(p.status)))
        .sort((a, b) =>
          showCompleted
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

  const byStatus: Record<string, number> = {};
  for (const p of allPedidos) {
    if (OPEN_STATUSES.includes(p.status)) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  }

  const eventsByPedido = await listEventsForPedidos(pedidos.map((p) => p.id));
  const photosByPedido = await listEncomendaPhotosForPedidos(pedidos.map((p) => p.id));

  const viewHref = (v: string) => (v === "abertos" ? "/assistencia/encomendas/sac" : `/assistencia/encomendas/sac?view=${v}`);

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <RealtimeQueueRefresher table="pedidos_encomenda" eventsTable="pedido_encomenda_events" />
      <AssistenciaHeader title="Minhas encomendas" subtitle="Acompanhamento em tempo real com o CD e a fábrica">
        <div className="flex items-center gap-3">
          <Link
            href="/assistencia/encomendas/solicitar"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
            style={{ background: "#1B5E3C" }}
          >
            + Nova encomenda
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <SacTabs active="encomendas" />

      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill href={viewHref("abertos")} label="Minhas em aberto" selected={!showCompleted && !showAll} />
        <FilterPill href={viewHref("concluidos")} label="Minhas entregues/canceladas" selected={showCompleted} />
        <FilterPill href={viewHref("todas")} label="Todas as encomendas" selected={showAll} />
      </div>

      {showAll ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Visão só de acompanhamento — quem gerencia cada pedido continua sendo a loja, o CD e a fábrica.
        </p>
      ) : null}

      {!showCompleted && !showAll ? (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile label="Em aberto" value={pedidos.length} />
          <StatTile label="Em produção" value={byStatus.em_producao ?? 0} />
          <StatTile label="Em carga" value={byStatus.em_carga ?? 0} />
          <StatTile label="Faturados" value={byStatus.faturado ?? 0} />
        </section>
      ) : null}

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {showAll ? "Nenhuma encomenda lançada ainda." : showCompleted ? "Nenhum pedido entregue/cancelado ainda." : "Nenhum pedido em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(showCompleted || showAll ? [{ dateKey: "flat", label: "", pedidos }] : groupByDeadline(pedidos)).map((group) =>
            group.label ? (
              // Recolhido por padrão -- achado do Victor 24/08/2026: "toda
              // vez que eu entrar em qualquer tela, as demandas agrupadas
              // precisam aparecer recolhidas".
              <details key={group.dateKey} className="group flex flex-col gap-1.5">
                <summary className="flex items-center gap-2 px-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-block transition-transform group-open:rotate-90 text-gray-400 dark:text-gray-500">▶</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.label}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({group.pedidos.length})</span>
                </summary>
                <PedidosDetailGroup
                  pedidos={group.pedidos}
                  queuePosition={queuePosition}
                  requester={requester}
                  eventsByPedido={eventsByPedido}
                  photosByPedido={photosByPedido}
                />
              </details>
            ) : (
              <PedidosDetailGroup
                key={group.dateKey}
                pedidos={group.pedidos}
                queuePosition={queuePosition}
                requester={requester}
                eventsByPedido={eventsByPedido}
                photosByPedido={photosByPedido}
              />
            )
          )}
        </div>
      )}

      <Link href="/assistencia/sac" className="text-sm underline self-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        ← Voltar
      </Link>
    </div>
  );
}

function PedidosDetailGroup({
  pedidos,
  queuePosition,
  requester,
  eventsByPedido,
  photosByPedido,
}: {
  pedidos: PedidoEncomendaSummary[];
  queuePosition: Map<string, number>;
  requester: EncomendaRequester;
  eventsByPedido: Awaited<ReturnType<typeof listEventsForPedidos>>;
  photosByPedido: Awaited<ReturnType<typeof listEncomendaPhotosForPedidos>>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {pedidos.map((p: PedidoEncomendaSummary) => (
          <details key={p.id} className="p-4">
            <summary className="flex items-start gap-2 cursor-pointer list-none">
              <div className="flex items-center justify-center w-9 shrink-0 pt-0.5">
                {queuePosition.get(p.id) ? (
                  <div
                    className="rounded flex flex-col items-center justify-center px-1 py-0.5 shrink-0 leading-none"
                    style={{ background: "var(--brand-green)", color: "#fff" }}
                  >
                    <span className="text-sm font-bold">{queuePosition.get(p.id)}º</span>
                    <span className="text-[7px] font-semibold uppercase tracking-wide">na fila</span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-1 min-w-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">#{p.pedidoNumber}</span>
                    <PedidoEncomendaStatusBadge status={p.status} />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{p.storeName}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">{p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}</p>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                  <span className="text-xs font-bold whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  {p.prazoCdLoja ? (
                    <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                      Na loja: {new Date(`${p.prazoCdLoja}T00:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                  ) : p.prazoFabricaCd ? (
                    <span className="text-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                      No CD: {new Date(`${p.prazoFabricaCd}T00:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                </div>
              </div>
            </summary>
            <div className="mt-3 pt-3 flex flex-col gap-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Fornecedor: {p.fornecedorTipo === "fabrica_externa" ? `Externo: ${p.fornecedorExterno}` : p.fabricaNome}
              </p>
              {canEditPedido(requester, p) ? (
                <Link
                  href={`/assistencia/encomendas/${p.id}/editar`}
                  className="text-xs underline self-start"
                  style={{ color: "var(--brand-green)" }}
                >
                  Editar pedido
                </Link>
              ) : null}
              {p.vendedorName ? <p className="text-xs text-gray-500 dark:text-gray-400">Vendedor: {p.vendedorName}</p> : null}
              {p.clienteCodigo ? <p className="text-xs text-gray-500 dark:text-gray-400">Código do cliente: {p.clienteCodigo}</p> : null}
              {p.carga ? <p className="text-xs text-gray-500 dark:text-gray-400">Carga: {p.carga}</p> : null}
              {p.nfE ? <p className="text-xs text-gray-500 dark:text-gray-400">NF-e: {p.nfE}</p> : null}
              {(photosByPedido.get(p.id) ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(photosByPedido.get(p.id) ?? []).map((photo) => (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="Cupom fiscal" className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                    </a>
                  ))}
                </div>
              ) : null}
              <PedidoEncomendaTimeline events={eventsByPedido.get(p.id) ?? []} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
