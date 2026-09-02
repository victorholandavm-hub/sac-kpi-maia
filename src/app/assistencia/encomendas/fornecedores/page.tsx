import Link from "next/link";
import { requireFornecedorPedidoActor } from "@/lib/fornecedorPedidoAuth";
import { listSuppliers } from "@/lib/partOrders";
import { listPedidosFornecedor, isPedidoFornecedorStatus } from "@/lib/pedidosFornecedor";
import { PEDIDO_FORNECEDOR_STATUS_LABELS } from "@/lib/assistenciaLabels";
import { PedidoFornecedorStatusBadge } from "@/components/assistencia/PedidoFornecedorStatusBadge";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { formatDateTimeBr } from "@/lib/formatDateTime";

export const dynamic = "force-dynamic";

function buildHref(params: { status?: string; fornecedor?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.fornecedor) sp.set("fornecedor", params.fornecedor);
  const qs = sp.toString();
  return qs ? `/assistencia/encomendas/fornecedores?${qs}` : "/assistencia/encomendas/fornecedores";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: PEDIDO_FORNECEDOR_STATUS_LABELS.pedido_feito, value: "pedido_feito" },
  { label: PEDIDO_FORNECEDOR_STATUS_LABELS.recebido, value: "recebido" },
  { label: PEDIDO_FORNECEDOR_STATUS_LABELS.cancelado, value: "cancelado" },
];

export default async function PedidosFornecedorPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; fornecedor?: string; enviado?: string; pedido?: string }>;
}) {
  const actor = await requireFornecedorPedidoActor();
  const { status, fornecedor, enviado, pedido } = await searchParams;
  const filterStatus = isPedidoFornecedorStatus(status) ? status : undefined;

  const [pedidos, suppliers] = await Promise.all([
    listPedidosFornecedor({ status: filterStatus, fornecedor }),
    listSuppliers(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher table="pedidos_fornecedor" eventsTable="pedido_fornecedor_events" />

      <AssistenciaHeader title="Pedidos a fornecedores" subtitle="Reposição de estoque comprada de fábricas/fornecedores externos (não são a nossa fábrica).">
        <div className="flex items-center gap-3">
          <Link
            href="/assistencia/encomendas/fornecedores/novo"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
            style={{ background: "#1B5E3C" }}
          >
            + Novo pedido
          </Link>
          <Link href="/assistencia/encomendas/fila" className="text-sm underline text-gray-500 hover:text-gray-700">
            ← Fila de encomendas
          </Link>
        </div>
      </AssistenciaHeader>

      {enviado ? (
        <div
          className="rounded-lg p-4"
          style={{ background: "color-mix(in srgb, var(--status-good) 20%, var(--surface-1))", border: "2px solid var(--status-good)" }}
        >
          <p className="text-sm font-medium text-gray-800">Pedido enviado com sucesso!{pedido ? ` Pedido #${pedido}.` : ""}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <FilterPill
            key={f.label}
            href={buildHref({ status: f.value ?? undefined, fornecedor })}
            label={f.label}
            selected={(f.value ?? undefined) === filterStatus}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="fornecedor" placeholder="Todos os fornecedores" options={suppliers} />
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-400">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {pedidos.map((p) => {
              const atrasado = p.status === "pedido_feito" && !!p.expectedAt && p.expectedAt < today;
              return (
                <Link
                  key={p.id}
                  href={`/assistencia/encomendas/fornecedores/${p.id}`}
                  className="flex items-center justify-between gap-4 p-4 flex-wrap hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">#{p.pedidoNumber}</span>
                      <PedidoFornecedorStatusBadge status={p.status} />
                      {atrasado ? (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 35%, var(--surface-1))" }}
                        >
                          Atrasado
                        </span>
                      ) : null}
                      <span className="text-sm font-medium text-gray-800">{p.fornecedor}</span>
                    </div>
                    <p className="text-sm truncate text-gray-500">{p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
                    <span>{formatDateTimeBr(p.createdAt)}</span>
                    <span>Pedido por {p.requestedByName}</span>
                    {p.expectedAt ? (
                      <span
                        className="font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: "var(--text-primary)",
                          background: `color-mix(in srgb, ${atrasado ? "var(--status-critical)" : "var(--status-good)"} 35%, var(--surface-1))`,
                        }}
                      >
                        Previsão: {new Date(`${p.expectedAt}T00:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-center text-gray-400">
        {actor.name} · {actor.role === "cd" ? "CD" : actor.role === "admin" ? "Administrador" : "Assistência"}
      </p>
    </div>
  );
}
