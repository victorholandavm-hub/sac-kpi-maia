import Link from "next/link";
import { requireFornecedorPedidoActor } from "@/lib/fornecedorPedidoAuth";
import { getPedidoFornecedorDetail } from "@/lib/pedidosFornecedor";
import { PedidoFornecedorStatusBadge } from "@/components/assistencia/PedidoFornecedorStatusBadge";
import { PedidoFornecedorActions } from "@/components/assistencia/PedidoFornecedorActions";
import { PedidoFornecedorTimeline } from "@/components/assistencia/PedidoFornecedorTimeline";
import { PedidoFornecedorPrazoField } from "@/components/assistencia/PedidoFornecedorPrazoField";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { formatDateTimeBr } from "@/lib/formatDateTime";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export default async function PedidoFornecedorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFornecedorPedidoActor();
  const { id } = await params;
  const result = await getPedidoFornecedorDetail(id);

  if (!result) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Pedido não encontrado.
        </p>
      </div>
    );
  }

  const { pedido, events } = result;

  return (
    <ToastProvider>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
        <RealtimeQueueRefresher requestId={pedido.id} table="pedidos_fornecedor" eventsTable="pedido_fornecedor_events" eventsIdColumn="pedido_id" />

        <Link href="/assistencia/encomendas/fornecedores" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Pedido #{pedido.pedidoNumber}
          </span>
          <PedidoFornecedorStatusBadge status={pedido.status} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {pedido.fornecedor}
          </h2>
        </div>

        <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Produtos
          </h3>
          <ul className="flex flex-col gap-1">
            {pedido.items.map((item) => (
              <li key={item.id} className="text-sm" style={{ color: "var(--text-primary)" }}>
                {item.quantidade}x {item.produtoDescricao}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg p-4 grid sm:grid-cols-2 gap-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
            Detalhes
          </h3>
          <Row label="Pedido feito por" value={pedido.requestedByName} />
          <Row label="Criado em" value={formatDateTimeBr(pedido.createdAt)} />
          <Row label="Observações" value={pedido.notes} />
        </div>

        <PedidoFornecedorPrazoField pedidoId={pedido.id} expectedAt={pedido.expectedAt} />

        <PedidoFornecedorActions pedidoId={pedido.id} status={pedido.status} />

        <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Histórico
          </h3>
          <PedidoFornecedorTimeline events={events} />
        </div>
      </div>
    </ToastProvider>
  );
}
