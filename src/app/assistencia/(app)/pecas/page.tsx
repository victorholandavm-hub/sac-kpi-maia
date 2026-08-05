import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPartOrders, listSuppliers, isPartOrderStatus, type PartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";

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

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function isOverdue(expectedAt: string | null): boolean {
  if (!expectedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today > expectedAt;
}

function buildHref(params: { status?: string; q?: string; supplier?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.supplier) sp.set("supplier", params.supplier);
  const qs = sp.toString();
  return qs ? `/assistencia/pecas?${qs}` : "/assistencia/pecas";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: "Aguardando peça", value: "aguardando_peca" },
  { label: "Peça recebida", value: "peca_recebida" },
  { label: "Enviada ao cliente", value: "enviada_ao_cliente" },
  { label: "Encerrados", value: "encerrado" },
];

export default async function PecasQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; supplier?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { status, q, supplier } = await searchParams;
  const filterStatus = isPartOrderStatus(status) ? status : undefined;
  const [orders, suppliers]: [PartOrder[], string[]] = await Promise.all([
    listPartOrders({ status: filterStatus, q, supplier }),
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
          href="/assistencia/pecas/nova"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Novo pedido de peça
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="supplier" placeholder="Todos os fornecedores" options={suppliers} />
      </div>

      <form action="/assistencia/pecas" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {supplier ? <input type="hidden" name="supplier" value={supplier} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por cliente, produto, peça ou código…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
        {q ? (
          <Link
            href={buildHref({ status: filterStatus, supplier })}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Limpar busca
          </Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum pedido de peça encontrado.
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/assistencia/pecas/${o.id}`}
                className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
              >
                <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      #{o.ticketNumber}
                    </span>
                    <StatusBadge status={o.status} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {o.partName}
                    </span>
                    {o.supplier ? (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {o.supplier}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                    {o.clientName ?? "Sem cliente"}
                    {o.product ? ` · ${o.product}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {o.status !== "encerrado" ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        color: "var(--text-primary)",
                        background: `color-mix(in srgb, ${isOverdue(o.expectedAt) ? "var(--status-critical)" : "var(--status-warning)"} 35%, var(--surface-1))`,
                      }}
                    >
                      {daysSince(o.createdAt)} dias aguardando{isOverdue(o.expectedAt) ? " · atrasado" : ""}
                    </span>
                  ) : (
                    <span>{new Date(o.createdAt).toLocaleDateString("pt-BR")}</span>
                  )}
                  <span>{o.requestedBy ? `Pedido por ${o.requestedBy}` : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
