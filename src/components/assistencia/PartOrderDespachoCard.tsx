import Image from "next/image";
import type { PartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS } from "@/lib/assistenciaLabels";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Papel físico do pedido de peça -- mesmo padrão visual de DespachoCard.tsx
// (chamados de assistência), pedido do Victor 10/09/2026: "preciso que
// cada solicitação dessa possa ser impressa igual o despacho das
// notificações de assistencia".
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ background: "var(--text-primary)", color: "var(--surface-1)" }}
    >
      {children}
    </div>
  );
}

export function PartOrderDespachoCard({ order }: { order: PartOrder }) {
  return (
    <div className="rounded-lg border overflow-hidden flex flex-col text-sm" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Lojas Maia" width={112} height={112} className="h-12 w-12 object-contain shrink-0" />
          <div className="flex flex-col">
            <h1 className="text-base font-bold leading-tight" style={{ color: "var(--brand-green)" }}>
              Solicitação de Peça
            </h1>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {order.externalReference ?? `Chamado #${order.ticketNumber}`}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-2xl font-black leading-none whitespace-nowrap" style={{ color: "#000" }}>
            {new Date(order.createdAt).toLocaleDateString("pt-BR")}
          </span>
          <span
            className="text-base font-bold italic whitespace-nowrap px-2 py-0.5 rounded-lg border-2"
            style={{ color: "#000", borderColor: "#000" }}
          >
            {PART_ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <SectionTitle>Dados do cliente</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3 px-4 py-3">
        <Field label="Nome" value={order.clientName} />
        <Field label="Telefone" value={order.clientPhone} />
        <Field label="CPF" value={order.clientCpf} />
        <Field label="E-mail" value={order.clientEmail} />
      </div>

      <SectionTitle>Peça</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3 px-4 py-3">
        <Field label="Produto do cliente" value={order.product} />
        <Field label="Peça" value={order.partName} />
        <Field label="Código da peça" value={order.partCode} />
        <Field label="Cor" value={order.color} />
      </div>

      <SectionTitle>Fornecedor</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3 px-4 py-3">
        <Field label="Fornecedor" value={order.supplier} />
        <Field label="Representante" value={order.representative} />
        <Field label="E-mail do representante" value={order.representativeEmail} />
        <Field label="Telefone do representante" value={order.representativePhone} />
      </div>

      <SectionTitle>Controle</SectionTitle>
      <div className="flex flex-col gap-2 px-4 py-3">
        <Field label="Solicitante" value={order.requestedBy} />
        <Field label="Criado em" value={formatDateTimeBr(order.createdAt)} />
        {order.partArrivedAt ? <Field label="Peça chegou em" value={new Date(order.partArrivedAt).toLocaleDateString("pt-BR")} /> : null}
        {order.sentToClientAt ? <Field label="Enviada ao cliente em" value={new Date(order.sentToClientAt).toLocaleDateString("pt-BR")} /> : null}
        {order.closedAt ? <Field label="Encerrado em" value={new Date(order.closedAt).toLocaleDateString("pt-BR")} /> : null}
        <Field label="Observação" value={order.notes} />
      </div>

      <div className="flex justify-center pb-4 pt-2">
        <div className="border-t w-56 text-center text-xs pt-1" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Assinatura
        </div>
      </div>
    </div>
  );
}
