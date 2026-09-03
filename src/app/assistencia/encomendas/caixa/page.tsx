import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveEncomendaRequester, canEditPedido } from "@/lib/encomendaRequester";
import { caixaSignOut } from "@/app/assistencia/caixa-actions";
import { lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  listPedidosByStores,
  listEventsForPedidos,
  listOpenPedidoEncomendaQueueIds,
  OPEN_PEDIDO_ENCOMENDA_STATUSES,
  type PedidoEncomendaSummary,
} from "@/lib/pedidosEncomenda";
import { listEncomendaPhotosForPedidos } from "@/lib/pedidoEncomendaPhotos";
import { PedidoEncomendaStatusBadge } from "@/components/assistencia/PedidoEncomendaStatusBadge";
import { PedidoEncomendaTimeline } from "@/components/assistencia/PedidoEncomendaTimeline";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { StatTile } from "@/components/StatTile";
import { LojaTabs } from "@/components/assistencia/LojaTabs";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listLojaNotificationsAction } from "@/app/assistencia/notifications-actions";

// Precisa refletir os pedidos em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

const OPEN_STATUSES: string[] = OPEN_PEDIDO_ENCOMENDA_STATUSES;

export default async function EncomendasCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const requester = await resolveEncomendaRequester();
  if (!requester) {
    redirect("/assistencia/encomendas");
  }
  // CD/fábrica não têm loja fixa pra acompanhar aqui — a fila interna
  // (requireEncomendaActor) já mostra os pedidos de todas as lojas pra eles.
  if (requester.kind === "cd" || requester.kind === "fabrica") {
    redirect("/assistencia/encomendas/fila");
  }
  // SAC também não tem loja fixa, mas não tem acesso à fila interna (essa é
  // só de quem processa o pedido -- CD/fábrica/admin/assistência, ver
  // requireEncomendaActor) -- tem a própria tela, por pedido lançado por ele
  // em vez de por loja (ver encomendas/sac/page.tsx).
  if (requester.kind === "sac") {
    redirect("/assistencia/encomendas/sac");
  }

  const storeIds = requester.kind === "gerente" ? requester.storeIds : [requester.storeId];
  const signOutAction = requester.kind === "caixa" ? caixaSignOut : lojaGerenteSignOut;

  const { view } = await searchParams;
  const showCompleted = view === "concluidos";

  const admin = getSupabaseAdmin();
  const [{ data: stores }, allPedidos, queueIds] = await Promise.all([
    admin.from("stores").select("name").in("id", storeIds),
    listPedidosByStores(storeIds),
    showCompleted ? Promise.resolve([]) : listOpenPedidoEncomendaQueueIds(),
  ]);
  const queuePosition = new Map(queueIds.map((id, i) => [id, i + 1]));
  const storeLabel = (stores ?? []).map((s) => s.name).join(", ") || "sua loja";
  const pedidos = allPedidos
    .filter((p) => (showCompleted ? !OPEN_STATUSES.includes(p.status) : OPEN_STATUSES.includes(p.status)))
    // Em aberto: mais antigo primeiro, igual ao "Nº na fila" (senão o 2º
    // aparecia antes do 1º). Entregues/cancelados: mais recente primeiro,
    // como já era.
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

  const viewHref = (v: string) => (v === "abertos" ? "/assistencia/encomendas/caixa" : `/assistencia/encomendas/caixa?view=${v}`);

  return (
    // Largura total -- pedido do Victor 31/08/2026, mesmo tratamento
    // das outras telas fora do grupo (app).
    // Revisado 03/09/2026 -- achado do Victor: "na aba encomendas ainda
    // está muito largo... revise as telas e deixe como na aba de
    // solicitações". Mesmo teto do (app)/layout.tsx (max-w-[1600px]
    // mx-auto, revisão de 02/09/2026) -- essa tela ficou de fora por
    // estar fora do grupo (app), ver mesma nota em encomendas/fila/page.tsx.
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6 min-w-0">
      <RealtimeQueueRefresher table="pedidos_encomenda" eventsTable="pedido_encomenda_events" />
      <AssistenciaHeader
        title={`Encomendas — ${storeLabel}`}
        subtitle="Acompanhamento em tempo real com o CD e a fábrica"
      >
        <div className="flex items-center gap-3">
          <NotificationBell fetchAction={listLojaNotificationsAction} storageKey="loja" />
          <Link
            href="/assistencia/encomendas/solicitar"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
            style={{ background: "#1B5E3C" }}
          >
            + Novo pedido
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      {requester.kind === "gerente" ? <LojaTabs /> : null}

      <div className="flex items-center gap-2">
        <FilterPill href={viewHref("abertos")} label="Em aberto" selected={!showCompleted} />
        <FilterPill href={viewHref("concluidos")} label="Entregues/cancelados" selected={showCompleted} />
      </div>

      {!showCompleted ? (
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
            {showCompleted ? "Nenhum pedido entregue/cancelado ainda." : "Nenhum pedido em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {pedidos.map((p: PedidoEncomendaSummary) => (
              <details key={p.id} className="p-4">
                <summary className="flex items-start gap-2 cursor-pointer list-none">
                  {/* Selo compacto e fixo à esquerda -- pista visual imediata da ordem
                      da fila, sem depender de ler o resto do texto. */}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Solicitado por: {p.requestedByName}
                    {storeIds.length > 1 ? ` (${p.storeName})` : ""}
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
      )}

      <Link
        href={requester.kind === "gerente" ? "/assistencia/loja" : "/assistencia/encomendas"}
        className="text-sm underline self-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        ← Voltar
      </Link>
    </div>
  );
}
