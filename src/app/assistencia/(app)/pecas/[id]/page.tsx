import Link from "next/link";
import { getPartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { PartOrderActions } from "@/components/assistencia/PartOrderActions";
import { ExpectedAtField } from "@/components/assistencia/ExpectedAtField";

function StatusBadge({ status }: { status: string }) {
  const color = PART_ORDER_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, border: `1px solid ${color}` }}
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
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export default async function PartOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getPartOrder(id);

  if (!order) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Pedido de peça não encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={order.status} />
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {order.partName}
        </h2>
      </div>

      <div
        className="rounded-lg border p-4 grid sm:grid-cols-2 gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
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
        <Row label="Criado em" value={new Date(order.createdAt).toLocaleString("pt-BR")} />
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
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Solicitação vinculada
            </span>
            <Link
              href={`/assistencia/${order.serviceRequestId}`}
              className="text-sm underline"
              style={{ color: "var(--text-primary)" }}
            >
              Ver solicitação
            </Link>
          </div>
        ) : null}
      </div>

      <PartOrderActions orderId={order.id} status={order.status} />

      {order.notes ? (
        <div
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Observações
          </h3>
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
            {order.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
