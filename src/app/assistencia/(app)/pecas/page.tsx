import Link from "next/link";
import { listPartOrders, isPartOrderStatus, type PartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";

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

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function buildHref(params: { status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
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
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const filterStatus = isPartOrderStatus(status) ? status : undefined;
  const orders: PartOrder[] = await listPartOrders({ status: filterStatus, q });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={buildHref({ status: f.value ?? undefined, q })}
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

      <form action="/assistencia/pecas" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
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
            href={buildHref({ status: filterStatus })}
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
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/assistencia/pecas/${o.id}`}
                className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  {o.status === "aguardando_peca" ? (
                    <span style={{ color: "var(--status-warning)" }}>{daysSince(o.createdAt)} dias aguardando</span>
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
