import type { ClientSegment } from "@/lib/customerProfile";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Rows({ data }: { data: ClientSegment[] }) {
  return (
    <>
      {data.map((row) => (
        <tr key={row.key} style={{ borderTop: "1px solid var(--gridline)" }}>
          <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
            {row.key}
          </td>
          <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
            {row.clientCount}
          </td>
          <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(row.avgTicket)}
          </td>
          <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(row.totalRevenue)}
          </td>
          <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
            {row.avgFrequencyPerYear !== null ? row.avgFrequencyPerYear.toFixed(1) : "—"}
          </td>
        </tr>
      ))}
    </>
  );
}

export function ClientSegmentTable({ data, groupLabel }: { data: ClientSegment[]; groupLabel: string }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum cliente com compra registrada ainda.
        </p>
      </div>
    );
  }

  const top = data.slice(0, 10);
  const rest = data.slice(10);

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-base font-bold mb-3" style={{ color: "var(--brand-orange)" }}>
        Padrões de compra por {groupLabel}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
          <thead>
            <tr className="text-left" style={{ color: "var(--text-muted)" }}>
              <th className="py-1 pr-4 font-normal">{groupLabel}</th>
              <th className="py-1 pr-4 font-normal">Nº de clientes</th>
              <th className="py-1 pr-4 font-normal">Ticket médio</th>
              <th className="py-1 pr-4 font-normal">Valor total</th>
              <th className="py-1 pr-4 font-normal">Compras/ano (média)</th>
            </tr>
          </thead>
          <tbody>
            <Rows data={top} />
          </tbody>
        </table>
      </div>
      {rest.length > 0 ? (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            Ver todos ({data.length})
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
