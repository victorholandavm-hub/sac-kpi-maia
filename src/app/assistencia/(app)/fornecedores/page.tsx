import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listSupplierReturns, isSupplierReturnStatus, type SupplierReturn } from "@/lib/supplierReturns";
import { listSuppliers } from "@/lib/partOrders";
import { SUPPLIER_RETURN_STATUS_LABELS, SUPPLIER_RETURN_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { FilterPill } from "@/components/assistencia/FilterPill";

function formatBRL(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: string }) {
  const color = SUPPLIER_RETURN_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
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
  redirectIfSac(await getProfile());
  const { status, q, supplier } = await searchParams;
  const filterStatus = isSupplierReturnStatus(status) ? status : undefined;
  const [returns, suppliers]: [SupplierReturn[], string[]] = await Promise.all([
    listSupplierReturns({ status: filterStatus, q, supplier }),
    listSuppliers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* "Controle Assistência" -- pedido do Victor 27/08/2026, mesmo
          desenho de pecas/page.tsx (ver lá). */}
      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/pecas"
          className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
        >
          Peças
        </Link>
        <Link
          href="/assistencia/fornecedores"
          className="text-sm font-semibold px-4 py-2 rounded-full text-white shadow-sm"
          style={{ background: "color-mix(in srgb, var(--brand-green) 78%, black)" }}
        >
          Fornecedores
        </Link>
        <Link
          href="/assistencia/estoque"
          className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
        >
          Estoque
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.label}
              label={f.label}
              selected={(f.value ?? undefined) === filterStatus}
              href={buildHref({ status: f.value ?? undefined, q, supplier })}
            />
          ))}
        </div>
        <Link
          href="/assistencia/fornecedores/nova"
          className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
          style={{ background: "#1B5E3C" }}
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
          className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm flex-1 min-w-[240px]"
        />
        <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100">
          Buscar
        </button>
      </form>

      {returns.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma remessa encontrada.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {returns.map((r) => {
              const overdue = r.status !== "finalizado" && isOverdue(r.expectedReturnAt);
              return (
                <Link
                  key={r.id}
                  href={`/assistencia/fornecedores/${r.id}`}
                  className="flex items-center justify-between gap-4 p-4 flex-wrap hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">#{r.ticketNumber}</span>
                      <StatusBadge status={r.status} />
                      {overdue ? (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 35%, var(--surface-1))" }}
                        >
                          Atrasado
                        </span>
                      ) : null}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{r.partName}</span>
                      {r.supplier ? <span className="text-xs text-gray-400 dark:text-gray-500">{r.supplier}</span> : null}
                    </div>
                    <p className="text-sm truncate text-gray-500 dark:text-gray-400">
                      {r.product ?? "Sem produto"}
                      {r.invoiceNumber ? ` · NF ${r.invoiceNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-gray-400 dark:text-gray-500">
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
