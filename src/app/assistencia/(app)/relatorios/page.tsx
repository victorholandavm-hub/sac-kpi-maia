import { getProfile, redirectIfSac } from "@/lib/dal";
import { getRequestsReport, getServiceTypeIndicators, type ReportRow } from "@/lib/serviceRequests";
import { listPaymentItems, paymentStage } from "@/lib/payments";
import { getSupplierReconciliation } from "@/lib/supplierReturns";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";

const REQUEST_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria", "notificacao_externa"] as const;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function sixMonthsAgoFirstDay(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTH_ABBREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTH_ABBREV[Number(m) - 1]}/${y}`;
}

function formatDays(days: number | null): string {
  if (days === null) return "—";
  const rounded = Math.max(0, days);
  return `${rounded.toFixed(1)} dia${rounded >= 2 ? "s" : ""}`;
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
    <details className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <summary className="text-base font-bold cursor-pointer px-4 py-3" style={{ color: "var(--brand-green)", borderBottom: "1px solid var(--gridline)" }}>
        {title} ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                <th className="text-left font-normal px-4 py-2 whitespace-nowrap">{keyLabel}</th>
                <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Total</th>
                <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Concluídas</th>
                <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Canceladas</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    {labelFor(r.key)}
                  </td>
                  <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    {r.total}
                  </td>
                  <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                    {r.concluida}
                  </td>
                  <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {r.cancelada}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tipo?: string; indFrom?: string; indTo?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { from, to, tipo, indFrom, indTo } = await searchParams;
  const dateFrom = from || firstDayOfMonth();
  const dateTo = to || today();

  const indicatorType = (REQUEST_TYPES as readonly string[]).includes(tipo ?? "") ? (tipo as (typeof REQUEST_TYPES)[number]) : "montagem";
  const indicatorDateFrom = indFrom || sixMonthsAgoFirstDay();
  const indicatorDateTo = indTo || today();

  const [report, paymentItems, supplierReconciliation, indicators] = await Promise.all([
    getRequestsReport({ dateFrom, dateTo }),
    listPaymentItems({ dateFrom, dateTo }),
    getSupplierReconciliation(),
    getServiceTypeIndicators(indicatorType, { dateFrom: indicatorDateFrom, dateTo: indicatorDateTo }),
  ]);

  const byAssembler = new Map<string, { total: number; pendente: number; itens: number }>();
  for (const item of paymentItems) {
    const name = item.assemblerName ?? "Sem montador definido";
    const entry = byAssembler.get(name) ?? { total: 0, pendente: 0, itens: 0 };
    const value = (item.unitValue ?? 0) * item.quantity;
    entry.total += value;
    entry.itens += 1;
    if (paymentStage(item.requestStatus, item.paymentReleased) === "pendente") entry.pendente += value;
    byAssembler.set(name, entry);
  }
  const assemblerRows = [...byAssembler.entries()].sort((a, b) => b[1].total - a[1].total);
  const paymentTotal = assemblerRows.reduce((sum, [, v]) => sum + v.total, 0);
  const paymentPending = assemblerRows.reduce((sum, [, v]) => sum + v.pendente, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Relatórios
      </h1>

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

      <div className="flex flex-col gap-3 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Indicadores de {REQUEST_TYPE_LABELS[indicatorType]?.toLowerCase() ?? indicatorType}
        </h3>

        <form action="/assistencia/relatorios" method="GET" className="flex items-center gap-2 flex-wrap">
          <input type="hidden" name="from" value={dateFrom} />
          <input type="hidden" name="to" value={dateTo} />
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Tipo
            <select name="tipo" defaultValue={indicatorType} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            De
            <input type="date" name="indFrom" defaultValue={indicatorDateFrom} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Até
            <input type="date" name="indTo" defaultValue={indicatorDateTo} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </label>
          <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            Aplicar
          </button>
        </form>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
            <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Por mês
            </h4>
          </div>
          {indicators.byMonth.length === 0 ? (
            <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
              Nenhuma solicitação desse tipo no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                    <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Mês</th>
                    <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Total</th>
                    <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Concluídas</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                  {indicators.byMonth.map((m) => (
                    <tr key={m.month}>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        {formatMonth(m.month)}
                      </td>
                      <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        {m.total}
                      </td>
                      <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                        {m.concluida}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
              <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Por montador
              </h4>
            </div>
            {indicators.byAssembler.length === 0 ? (
              <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
                Nenhuma solicitação desse tipo no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                      <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Montador</th>
                      <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Total</th>
                      <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Concluídas</th>
                      <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                    {indicators.byAssembler.map((a) => (
                      <tr key={a.assemblerName}>
                        <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {a.assemblerName}
                        </td>
                        <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {a.total}
                        </td>
                        <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                          {a.concluida}
                        </td>
                        <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                          {formatDays(a.avgDaysToComplete)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
              <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Por loja
              </h4>
            </div>
            {indicators.byStore.length === 0 ? (
              <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
                Nenhuma solicitação desse tipo no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                      <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Loja</th>
                      <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Total</th>
                      <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Concluídas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                    {indicators.byStore.map((s) => (
                      <tr key={s.storeId}>
                        <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {s.storeName}
                        </td>
                        <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {s.total}
                        </td>
                        <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                          {s.concluida}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

      <details className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <summary className="text-base font-bold cursor-pointer px-4 py-3" style={{ color: "var(--brand-green)", borderBottom: "1px solid var(--gridline)" }}>
          Pagamento por montador ({assemblerRows.length})
        </summary>
        {assemblerRows.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nenhum pagamento no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Montador</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Itens</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Total</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Pendente</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {assemblerRows.map(([name, v]) => (
                  <tr key={name}>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {name}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {v.itens}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {formatBRL(v.total)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: v.pendente > 0 ? "var(--status-warning)" : "var(--text-muted)" }}>
                      {formatBRL(v.pendente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <summary className="text-base font-bold cursor-pointer px-4 py-3" style={{ color: "var(--brand-green)", borderBottom: "1px solid var(--gridline)" }}>
          Reconciliação com fornecedor ({supplierReconciliation.length}) — acumulado, todas as remessas
        </summary>
        {supplierReconciliation.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nenhuma remessa registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Fornecedor</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Em devolução</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Faturado</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Reembolsado</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Pendente</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {supplierReconciliation.map((r) => (
                  <tr key={r.supplier}>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {r.supplier}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {formatBRL(r.emDevolucao)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {formatBRL(r.faturado)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                      {formatBRL(r.reembolsado)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: r.pendente > 0 ? "var(--status-warning)" : "var(--text-muted)" }}>
                      {formatBRL(r.pendente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
