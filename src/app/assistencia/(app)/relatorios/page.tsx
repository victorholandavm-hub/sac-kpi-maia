import { getRequestsReport, type ReportRow } from "@/lib/serviceRequests";
import { listPaymentItems } from "@/lib/payments";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ReportTable({
  title,
  rows,
  keyLabel,
  emptyMessage,
  labelFor = (key) => key,
}: {
  title: string;
  rows: ReportRow[];
  keyLabel: string;
  emptyMessage: string;
  labelFor?: (key: string) => string;
}) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
          {emptyMessage}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
              <th className="text-left font-normal px-4 py-2">{keyLabel}</th>
              <th className="text-right font-normal px-4 py-2">Total</th>
              <th className="text-right font-normal px-4 py-2">Concluídas</th>
              <th className="text-right font-normal px-4 py-2">Canceladas</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                  {labelFor(r.key)}
                </td>
                <td className="text-right px-4 py-2" style={{ color: "var(--text-primary)" }}>
                  {r.total}
                </td>
                <td className="text-right px-4 py-2" style={{ color: "var(--status-good)" }}>
                  {r.concluida}
                </td>
                <td className="text-right px-4 py-2" style={{ color: "var(--text-muted)" }}>
                  {r.cancelada}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const dateFrom = from || firstDayOfMonth();
  const dateTo = to || today();

  const [report, paymentItems] = await Promise.all([
    getRequestsReport({ dateFrom, dateTo }),
    listPaymentItems({ dateFrom, dateTo }),
  ]);

  const byAssembler = new Map<string, { total: number; pendente: number; itens: number }>();
  for (const item of paymentItems) {
    const name = item.assemblerName ?? "Sem montador definido";
    const entry = byAssembler.get(name) ?? { total: 0, pendente: 0, itens: 0 };
    const value = (item.unitValue ?? 0) * item.quantity;
    entry.total += value;
    entry.itens += 1;
    if (!item.paymentReleased) entry.pendente += value;
    byAssembler.set(name, entry);
  }
  const assemblerRows = [...byAssembler.entries()].sort((a, b) => b[1].total - a[1].total);
  const paymentTotal = assemblerRows.reduce((sum, [, v]) => sum + v.total, 0);
  const paymentPending = assemblerRows.reduce((sum, [, v]) => sum + v.pendente, 0);

  return (
    <div className="flex flex-col gap-4">
      <form action="/assistencia/relatorios" method="GET" className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          De
          <input type="date" name="from" defaultValue={dateFrom} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Até
          <input type="date" name="to" defaultValue={dateTo} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Aplicar
        </button>
      </form>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {report.totalRequests}
          </span>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Solicitações no período
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {formatBRL(paymentTotal)}
          </span>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Total pago a montadores
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <span className="text-2xl font-semibold" style={{ color: "var(--status-warning)" }}>
            {formatBRL(paymentPending)}
          </span>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pendente de liberação
          </p>
        </div>
      </div>

      <ReportTable title="Solicitações por loja" rows={report.byStore} keyLabel="Loja" emptyMessage="Nenhuma solicitação no período." />
      <ReportTable
        title="Solicitações por tipo"
        rows={report.byType}
        keyLabel="Tipo"
        emptyMessage="Nenhuma solicitação no período."
        labelFor={(key) => REQUEST_TYPE_LABELS[key] ?? key}
      />
      <ReportTable
        title="Solicitações por vendedor(a)"
        rows={report.bySeller}
        keyLabel="Vendedor(a)"
        emptyMessage="Nenhuma solicitação com vendedor(a) preenchido nesse período — campo novo, só passa a existir dado a partir de agora."
      />

      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Pagamento por montador
          </h3>
        </div>
        {assemblerRows.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nenhum pagamento no período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                <th className="text-left font-normal px-4 py-2">Montador</th>
                <th className="text-right font-normal px-4 py-2">Itens</th>
                <th className="text-right font-normal px-4 py-2">Total</th>
                <th className="text-right font-normal px-4 py-2">Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
              {assemblerRows.map(([name, v]) => (
                <tr key={name}>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                    {name}
                  </td>
                  <td className="text-right px-4 py-2" style={{ color: "var(--text-primary)" }}>
                    {v.itens}
                  </td>
                  <td className="text-right px-4 py-2" style={{ color: "var(--text-primary)" }}>
                    {formatBRL(v.total)}
                  </td>
                  <td className="text-right px-4 py-2" style={{ color: v.pendente > 0 ? "var(--status-warning)" : "var(--text-muted)" }}>
                    {formatBRL(v.pendente)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
