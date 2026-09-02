import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPartOrders, listSuppliers, isPartOrderStatus, type PartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { FilterPill } from "@/components/assistencia/FilterPill";

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
      {/* "Controle Assistência" -- pedido do Victor 27/08/2026: "coloque
          dessa mesma forma em outra aba peças/fornecedores/estoque e
          nomeie essa aba como controle assistencia" (mesmo desenho da
          fileira de pílulas Visitas/Entregas/Agenda em fila/page.tsx).
          3 rotas próprias, dado/filtro cada uma o seu -- sem layout
          compartilhado, cada página renderiza sua própria fileira. */}
      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/pecas"
          className="text-sm font-semibold px-4 py-2 rounded-full text-white shadow-sm"
          style={{ background: "color-mix(in srgb, var(--brand-green) 78%, black)" }}
        >
          Peças
        </Link>
        <Link
          href="/assistencia/fornecedores"
          className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors duration-150"
        >
          Fornecedores
        </Link>
        <Link
          href="/assistencia/estoque"
          className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors duration-150"
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
          href="/assistencia/pecas/nova"
          className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
          style={{ background: "#1B5E3C" }}
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
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm flex-1 min-w-[240px]"
        />
        <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-800">
          Buscar
        </button>
        {q ? (
          <Link href={buildHref({ status: filterStatus, supplier })} className="text-xs underline text-gray-500 hover:text-gray-700">
            Limpar busca
          </Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-400">Nenhum pedido de peça encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/assistencia/pecas/${o.id}`}
                className="flex items-center justify-between gap-4 p-4 flex-wrap hover:bg-gray-50 transition-colors duration-150"
              >
                <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">#{o.ticketNumber}</span>
                    <StatusBadge status={o.status} />
                    <span className="text-sm font-medium text-gray-800">{o.partName}</span>
                    {o.supplier ? <span className="text-xs text-gray-400">{o.supplier}</span> : null}
                  </div>
                  <p className="text-sm truncate text-gray-500">
                    {o.clientName ?? "Sem cliente"}
                    {o.product ? ` · ${o.product}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
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
