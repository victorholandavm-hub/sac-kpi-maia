import Link from "next/link";
import { listPaymentItems, type PaymentItem } from "@/lib/payments";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function groupByAssembler(items: PaymentItem[]) {
  const groups: { assemblerName: string; items: PaymentItem[] }[] = [];
  for (const item of items) {
    const name = item.assemblerName ?? "Sem montador definido";
    let group = groups.find((g) => g.assemblerName === name);
    if (!group) {
      group = { assemblerName: name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups.sort((a, b) => a.assemblerName.localeCompare(b.assemblerName));
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ pendentes?: string }>;
}) {
  const { pendentes } = await searchParams;
  const allItems = await listPaymentItems();
  const items = pendentes ? allItems.filter((i) => !i.paymentReleased) : allItems;
  const groups = groupByAssembler(items);
  const grandTotal = items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
  const pendingTotal = items.filter((i) => !i.paymentReleased).reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/assistencia/pagamentos"
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: !pendentes ? "var(--surface-1)" : "transparent",
              color: !pendentes ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: !pendentes ? 600 : 400,
            }}
          >
            Todos
          </Link>
          <Link
            href="/assistencia/pagamentos?pendentes=1"
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: pendentes ? "var(--surface-1)" : "transparent",
              color: pendentes ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: pendentes ? 600 : 400,
            }}
          >
            Só pendentes de liberação
          </Link>
        </div>
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Total: <strong>{formatBRL(grandTotal)}</strong> · Pendente:{" "}
          <strong style={{ color: "var(--status-warning)" }}>{formatBRL(pendingTotal)}</strong>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum item com valor definido ainda. Defina o valor unitário na tela da solicitação.
          </p>
        </div>
      ) : (
        groups.map((group) => {
          const total = group.items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
          return (
            <div
              key={group.assemblerName}
              className="rounded-lg border overflow-hidden"
              style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--gridline)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {group.assemblerName}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {formatBRL(total)}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {group.items.map((item) => (
                  <Link
                    key={item.itemId}
                    href={`/assistencia/${item.requestId}`}
                    className="flex items-center justify-between gap-4 p-3 flex-wrap hover:opacity-80"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {item.quantity > 1 ? `${item.quantity}x ` : ""}
                        {item.product}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {item.clientName ?? "Sem cliente"} · {item.storeName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{formatBRL((item.unitValue ?? 0) * item.quantity)}</span>
                      <span
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          color: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
                          border: `1px solid ${item.paymentReleased ? "var(--status-good)" : "var(--status-warning)"}`,
                        }}
                      >
                        {item.paymentReleased ? "Liberado" : "Pendente"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
