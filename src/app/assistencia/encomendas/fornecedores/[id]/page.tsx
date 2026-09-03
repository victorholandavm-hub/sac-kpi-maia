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
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-3 ${className}`}>
      {title ? <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3> : null}
      {children}
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
        <p className="text-sm text-gray-400 dark:text-gray-500">Pedido não encontrado.</p>
      </div>
    );
  }

  const { pedido, events } = result;

  return (
    <ToastProvider>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
        <RealtimeQueueRefresher requestId={pedido.id} table="pedidos_fornecedor" eventsTable="pedido_fornecedor_events" eventsIdColumn="pedido_id" />

        <Link href="/assistencia/encomendas/fornecedores" className="text-sm underline self-start text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          ← Voltar
        </Link>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono text-gray-400 dark:text-gray-500">Pedido #{pedido.pedidoNumber}</span>
          <PedidoFornecedorStatusBadge status={pedido.status} />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{pedido.fornecedor}</h2>
        </div>

        <Card title="Produtos">
          <ul className="flex flex-col gap-1">
            {pedido.items.map((item) => (
              <li key={item.id} className="text-sm text-gray-800 dark:text-gray-100">
                {item.quantidade}x {item.produtoDescricao}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Detalhes">
          <div className="grid sm:grid-cols-2 gap-4">
            <Row label="Pedido feito por" value={pedido.requestedByName} />
            <Row label="Criado em" value={formatDateTimeBr(pedido.createdAt)} />
            <Row label="Observações" value={pedido.notes} />
          </div>
        </Card>

        <PedidoFornecedorPrazoField pedidoId={pedido.id} expectedAt={pedido.expectedAt} />

        <PedidoFornecedorActions pedidoId={pedido.id} status={pedido.status} />

        <Card title="Histórico">
          <PedidoFornecedorTimeline events={events} />
        </Card>
      </div>
    </ToastProvider>
  );
}
