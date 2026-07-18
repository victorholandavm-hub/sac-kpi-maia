import Link from "next/link";
import { listSupplierReturns, isSupplierReturnStatus, type SupplierReturn } from "@/lib/supplierReturns";
import { listSuppliers } from "@/lib/partOrders";
import { SUPPLIER_RETURN_STATUS_LABELS, SUPPLIER_RETURN_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";

function formatBRL(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function isOverdue(expectedReturnAt: string | null): boolean {
  if (!expectedReturnAt) return false;
  return new Date().toISOString().slice(0, 10) > expectedReturnAt;
}

function buildHref(params: { status?: string; q?: string; supplier?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.supplier) sp.set("supplier", params.supplier);
  const qs = sp.toString();
  return qs ? `/assistencia/fornecedores?${qs}` : "/assistencia/fornecedores";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: "Aguardando envio", value: "aguardando_envio" },
  { label: "Enviado", value: "enviado" },
  { label: "Recebido", value: "recebido" },
  { label: "Reembolsado", value: "reembolsado" },
  { label: "Finalizado", value: "finalizado" },
];

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; supplier?: string }>;
}) {
  const { status, q, supplier } = await searchParams;
  const filterStatus = isSupplierReturnStatus(status) ? status : undefined;
  const [returns, suppliers]: [SupplierReturn[], string[]] = await Promise.all([
    listSupplierReturns({ status: filterStatus, q, supplier }),
    listSuppliers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={buildHref({ status: f.value ?? undefined, q, supplier })}
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: (f.value ?? undefined) === filterStatus ? "var(--surface-1)" : "transparent",
                color: (f.value ?? undefined) === filterStatus ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: (f.value ?? undefined) === filterStatus ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <Link
          href="/assistencia/fornecedores/nova"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova remessa
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="supplier" placeholder="Todos os fornecedores" options={suppliers} />
      </div>

      <form action="/assistencia/fornecedores" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {supplier ? <input type="hidden" name="supplier" value={supplier} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por peça, produto ou nota fiscal…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Buscar
        </button>
      </form>

      {returns.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma remessa encontrada.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {returns.map((r) => {
              const overdue = r.status !== "finalizado" && isOverdue(r.expectedReturnAt);
              return (
                <Link
                  key={r.id}
                  href={`/assistencia/fornecedores/${r.id}`}
                  className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
                >
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        #{r.ticketNumber}
                      </span>
                      <StatusBadge status={r.status} />
                      {overdue ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: "var(--status-critical)", border: "1px solid var(--status-critical)" }}>
                          Atrasado
                        </span>
                      ) : null}
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {r.partName}
                      </span>
                      {r.supplier ? (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {r.supplier}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                      {r.product ?? "Sem produto"}
                      {r.invoiceNumber ? ` · NF ${r.invoiceNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>Faturado: {formatBRL(r.invoiceValue)}</span>
                    {r.status !== "finalizado" ? <span>{daysSince(r.createdAt)} dias</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
