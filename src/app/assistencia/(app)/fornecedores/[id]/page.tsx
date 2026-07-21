import { getProfile, redirectIfSac } from "@/lib/dal";
import { getSupplierReturn } from "@/lib/supplierReturns";
import { SUPPLIER_RETURN_STATUS_LABELS, SUPPLIER_RETURN_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { SupplierReturnActions } from "@/components/assistencia/SupplierReturnActions";

function StatusBadge({ status }: { status: string }) {
  const color = SUPPLIER_RETURN_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, border: `1px solid ${color}` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {SUPPLIER_RETURN_STATUS_LABELS[status] ?? status}
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

function formatBRL(value: number | null) {
  if (value === null) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function SupplierReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirectIfSac(await getProfile());
  const { id } = await params;
  const supplierReturn = await getSupplierReturn(id);

  if (!supplierReturn) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Remessa não encontrada.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          Chamado #{supplierReturn.ticketNumber}
        </span>
        <StatusBadge status={supplierReturn.status} />
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {supplierReturn.partName}
        </h2>
      </div>

      <div
        className="rounded-lg border p-4 grid sm:grid-cols-2 gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <Row label="Produto do cliente" value={supplierReturn.product} />
        <Row label="Fornecedor" value={supplierReturn.supplier} />
        <Row label="Nº da nota fiscal" value={supplierReturn.invoiceNumber} />
        <Row label="Valor faturado" value={formatBRL(supplierReturn.invoiceValue)} />
        <Row label="Valor reembolsado" value={formatBRL(supplierReturn.reimbursedValue)} />
        <Row label="Enviado em" value={supplierReturn.sentAt ? new Date(supplierReturn.sentAt).toLocaleDateString("pt-BR") : null} />
        <Row
          label="Retorno esperado"
          value={supplierReturn.expectedReturnAt ? new Date(supplierReturn.expectedReturnAt).toLocaleDateString("pt-BR") : null}
        />
        <Row label="Recebido em" value={supplierReturn.receivedAt ? new Date(supplierReturn.receivedAt).toLocaleDateString("pt-BR") : null} />
        <Row label="Registrado por" value={supplierReturn.requestedBy} />
        <Row label="Criado em" value={new Date(supplierReturn.createdAt).toLocaleString("pt-BR")} />
      </div>

      <SupplierReturnActions returnId={supplierReturn.id} status={supplierReturn.status} />

      {supplierReturn.notes ? (
        <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Observações
          </h3>
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
            {supplierReturn.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
