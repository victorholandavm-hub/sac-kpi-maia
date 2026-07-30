import type { OrderHistoryRow } from "@/lib/customerProfile";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function Rows({ data }: { data: OrderHistoryRow[] }) {
  return (
    <>
      {data.map((row) => (
        <tr key={row.invoice + row.issueDate} style={{ borderTop: "1px solid var(--gridline)" }}>
          <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
            {row.invoice}
          </td>
          <td className="py-2 pr-4">{formatDate(row.issueDate)}</td>
          <td className="py-2 pr-4">{row.type === "Venda" ? "Venda" : "Devolução"}</td>
          <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(row.invoiceTotal)}
          </td>
          <td className="py-2 pr-4">{row.sellerName ?? "—"}</td>
        </tr>
      ))}
    </>
  );
}

export function ClientOrderHistoryTable({ data }: { data: OrderHistoryRow[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma compra registrada ainda.
        </p>
      </div>
    );
  }

  const visible = data.slice(0, 5);
  const rest = data.slice(5);

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Histórico de compras
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
          <thead>
            <tr className="text-left" style={{ color: "var(--text-muted)" }}>
              <th className="py-1 pr-4 font-normal">NF</th>
              <th className="py-1 pr-4 font-normal">Data</th>
              <th className="py-1 pr-4 font-normal">Tipo</th>
              <th className="py-1 pr-4 font-normal">Valor</th>
              <th className="py-1 pr-4 font-normal">Vendedor</th>
            </tr>
          </thead>
          <tbody>
            <Rows data={visible} />
          </tbody>
        </table>
      </div>
      {rest.length > 0 ? (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            Ver todas ({data.length})
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
              <tbody>
                <Rows data={rest} />
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
