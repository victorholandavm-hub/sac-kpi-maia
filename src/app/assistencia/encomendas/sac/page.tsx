import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveEncomendaRequester } from "@/lib/encomendaRequester";
import { signOut } from "@/app/assistencia/actions";
import {
  listPedidosByRequester,
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
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";

// Precisa refletir os pedidos em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

const OPEN_STATUSES: string[] = OPEN_PEDIDO_ENCOMENDA_STATUSES;

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

  const [allPedidos, queueIds] = await Promise.all([
    listPedidosByRequester(requester.name),
    showCompleted ? Promise.resolve([]) : listOpenPedidoEncomendaQueueIds(),
  ]);
  const queuePosition = new Map(queueIds.map((id, i) => [id, i + 1]));
  const pedidos = allPedidos
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
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Nova encomenda
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <div className="flex items-center gap-2">
        <Link
          href={viewHref("abertos")}
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: !showCompleted ? "var(--surface-1)" : "transparent",
            color: !showCompleted ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: !showCompleted ? 600 : 400,
          }}
        >
          Em aberto
        </Link>
        <Link
          href={viewHref("concluidos")}
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: showCompleted ? "var(--surface-1)" : "transparent",
            color: showCompleted ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: showCompleted ? 600 : 400,
          }}
        >
          Entregues/cancelados
        </Link>
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
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {showCompleted ? "Nenhum pedido entregue/cancelado ainda." : "Nenhum pedido em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
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
                        <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                          #{p.pedidoNumber}
                        </span>
                        <PedidoEncomendaStatusBadge status={p.status} />
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          {p.storeName}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                      <span className="text-xs font-bold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      {p.prazoCdLoja ? (
                        <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                          Na loja: {new Date(`${p.prazoCdLoja}T00:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                      ) : p.prazoFabricaCd ? (
                        <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          No CD: {new Date(`${p.prazoFabricaCd}T00:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </summary>
                <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--gridline)" }}>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Fornecedor: {p.fornecedorTipo === "fabrica_externa" ? `Externo: ${p.fornecedorExterno}` : p.fabricaNome}
                  </p>
                  {p.vendedorName ? (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Vendedor: {p.vendedorName}
                    </p>
                  ) : null}
                  {p.clienteCodigo ? (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Código do cliente: {p.clienteCodigo}
                    </p>
                  ) : null}
                  {p.carga ? (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Carga: {p.carga}
                    </p>
                  ) : null}
                  {p.nfE ? (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      NF-e: {p.nfE}
                    </p>
                  ) : null}
                  {(photosByPedido.get(p.id) ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(photosByPedido.get(p.id) ?? []).map((photo) => (
                        <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt="Cupom fiscal"
                            className="h-20 w-20 object-cover rounded border"
                            style={{ borderColor: "var(--border)" }}
                          />
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

      <Link href="/assistencia/sac" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
