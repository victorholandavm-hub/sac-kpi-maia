import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { getPartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { PartOrderActions } from "@/components/assistencia/PartOrderActions";
import { ExpectedAtField } from "@/components/assistencia/ExpectedAtField";
import { formatDateTimeBr } from "@/lib/formatDateTime";

function StatusBadge({ status }: { status: string }) {
  const color = PART_ORDER_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {PART_ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

export default async function PartOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirectIfSac(await getProfile());
  const { id } = await params;
  const order = await getPartOrder(id);

  if (!order) {
    return <p className="text-sm text-gray-400">Pedido de peça não encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-mono text-gray-400">Chamado #{order.ticketNumber}</span>
        <StatusBadge status={order.status} />
        <h2 className="text-lg font-semibold text-gray-800">{order.partName}</h2>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 grid sm:grid-cols-2 gap-4">
        <h3 className="text-sm font-semibold text-gray-800 sm:col-span-2">Detalhes</h3>
        <Row label="Código da peça" value={order.partCode} />
        <Row label="Cor" value={order.color} />
        <Row label="Fornecedor" value={order.supplier} />
        <Row label="Representante" value={order.representative} />
        <Row label="Produto do cliente" value={order.product} />
        <Row label="Cliente" value={order.clientName} />
        <Row label="CPF" value={order.clientCpf} />
        <Row label="Telefone" value={order.clientPhone} />
        <Row label="E-mail" value={order.clientEmail} />
        <Row label="Pedido por" value={order.requestedBy} />
        <Row label="Criado em" value={formatDateTimeBr(order.createdAt)} />
        <ExpectedAtField orderId={order.id} expectedAt={order.expectedAt} />
        {order.partArrivedAt ? (
          <Row label="Peça chegou em" value={new Date(order.partArrivedAt).toLocaleDateString("pt-BR")} />
        ) : null}
        {order.sentToClientAt ? (
          <Row label="Enviada ao cliente em" value={new Date(order.sentToClientAt).toLocaleDateString("pt-BR")} />
        ) : null}
        {order.closedAt ? (
          <Row label="Encerrado em" value={new Date(order.closedAt).toLocaleDateString("pt-BR")} />
        ) : null}
        {order.serviceRequestId ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400">Solicitação vinculada</span>
            <Link href={`/assistencia/${order.serviceRequestId}`} className="text-sm underline text-gray-800 hover:text-gray-600">
              Ver solicitação
            </Link>
          </div>
        ) : null}
      </div>

      <PartOrderActions orderId={order.id} status={order.status} />

      {order.notes ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Observações</h3>
          <p className="text-sm whitespace-pre-line text-gray-500">{order.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
