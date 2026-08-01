import Link from "next/link";
import { requireFornecedorPedidoActor } from "@/lib/fornecedorPedidoAuth";
import { listSuppliers } from "@/lib/partOrders";
import { listPedidosFornecedor, isPedidoFornecedorStatus } from "@/lib/pedidosFornecedor";
import { PEDIDO_FORNECEDOR_STATUS_LABELS } from "@/lib/assistenciaLabels";
import { PedidoFornecedorStatusBadge } from "@/components/assistencia/PedidoFornecedorStatusBadge";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
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
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Novo pedido
          </Link>
          <Link href="/assistencia/encomendas/fila" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Fila de encomendas
          </Link>
        </div>
      </AssistenciaHeader>

      {enviado ? (
        <div
          className="rounded-lg border p-4"
          style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
            Pedido enviado com sucesso!{pedido ? ` Pedido #${pedido}.` : ""}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={buildHref({ status: f.value ?? undefined, fornecedor })}
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

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="fornecedor" placeholder="Todos os fornecedores" options={suppliers} />
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum pedido encontrado.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {pedidos.map((p) => {
              const atrasado = p.status === "pedido_feito" && !!p.expectedAt && p.expectedAt < today;
              return (
                <Link
                  key={p.id}
                  href={`/assistencia/encomendas/fornecedores/${p.id}`}
                  className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
                >
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        #{p.pedidoNumber}
                      </span>
                      <PedidoFornecedorStatusBadge status={p.status} />
                      {atrasado ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: "#fff", background: "var(--status-critical)" }}>
                          Atrasado
                        </span>
                      ) : null}
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {p.fornecedor}
                      </span>
                    </div>
                    <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                      {p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{formatDateTimeBr(p.createdAt)}</span>
                    <span>Pedido por {p.requestedByName}</span>
                    {p.expectedAt ? (
                      <span style={{ color: atrasado ? "var(--status-critical)" : "var(--status-good)", fontWeight: 600 }}>
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

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        {actor.name} · {actor.role === "cd" ? "CD" : actor.role === "admin" ? "Administrador" : "Assistência"}
      </p>
    </div>
  );
}
