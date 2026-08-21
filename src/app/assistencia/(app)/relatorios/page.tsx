import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { getRequestsReport, getServiceTypeIndicators, type ReportRow, type ReportRowItem, type IndicatorItem } from "@/lib/serviceRequests";
import { listPaymentItems, paymentStage, type PaymentItem } from "@/lib/payments";
import { getSupplierReconciliation, type SupplierReconciliationItem } from "@/lib/supplierReturns";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS, STATUS_LABELS, STATUS_COLORS, SUPPLIER_RETURN_STATUS_LABELS, MANOEL_ONLY_ASSEMBLER } from "@/lib/assistenciaLabels";
import { StatTile } from "@/components/StatTile";

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

function formatDateBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Manoel é o único montador funcionário nosso (o resto é terceirizado, ver
// MANOEL_ONLY_ASSEMBLER/MANOEL_ONLY_TYPES em assistenciaLabels.ts) --
// pedido do Victor 21/08/2026: "Colocar Manoel pra baixo na lista de
// montadores pois ele é o único que é funcionário nosso e não
// terceirizado". Não muda a ordenação por total (continua maior pro
// menor) -- só empurra a linha do Manoel pro final da lista, mesmo que o
// total dele fosse alto o bastante pra aparecer no meio.
function sortManoelLast<T>(rows: T[], nameOf: (r: T) => string): T[] {
  const rest = rows.filter((r) => nameOf(r) !== MANOEL_ONLY_ASSEMBLER);
  const manoel = rows.filter((r) => nameOf(r) === MANOEL_ONLY_ASSEMBLER);
  return [...rest, ...manoel];
}

function buildReportHref(params: { from?: string; to?: string; alvo?: string }) {
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.alvo) sp.set("alvo", params.alvo);
  const qs = sp.toString();
  return qs ? `/assistencia/relatorios?${qs}` : "/assistencia/relatorios";
}

// Filtro "montagem de mostruário" x "cliente" -- pedido do Victor
// 21/08/2026: "coloque Filtro de montagem de mostruário e cliente". Só se
// aplica ao relatório principal (getRequestsReport tem order_code/
// client_name na consulta; a seção de indicadores por tipo e os
// pagamentos, não).
const ALVO_FILTERS: { label: string; value: "mostruario" | "cliente" | undefined }[] = [
  { label: "Todos", value: undefined },
  { label: "Mostruário", value: "mostruario" },
  { label: "Cliente", value: "cliente" },
];

// Linha de detalhe de um chamado, dentro de uma linha expandida -- mesmo
// formato reaproveitado nas 3 tabelas de indicadores por tipo (mês/
// montador/loja) e no relatório principal (loja/tipo/vendedor/causa raiz).
function IndicatorItemsList({ items }: { items: IndicatorItem[] }) {
  return (
    <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
      {items.map((it) => (
        <div key={it.id} className="pl-9 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate" style={{ color: "var(--text-primary)" }}>
            #{it.ticketNumber} · {it.clientName ?? "Sem cliente"} · {formatDateBr(it.createdAt)}
          </span>
          <span className="shrink-0 font-medium" style={{ color: STATUS_COLORS[it.status] ?? "var(--text-muted)" }}>
            {STATUS_LABELS[it.status] ?? it.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// Linha de detalhe de um chamado do relatório principal -- inclui tipo
// (as tabelas dele misturam tipos diferentes, diferente das de
// indicadores, que já filtram por um tipo só).
function ReportRowItemsList({ items }: { items: ReportRowItem[] }) {
  return (
    <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
      {items.map((it) => (
        <div key={it.id} className="pl-9 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate" style={{ color: "var(--text-primary)" }}>
            #{it.ticketNumber} · {REQUEST_TYPE_LABELS[it.type] ?? it.type} · {it.storeName} · {formatDateBr(it.createdAt)}
          </span>
          <span className="shrink-0 font-medium" style={{ color: STATUS_COLORS[it.status] ?? "var(--text-muted)" }}>
            {STATUS_LABELS[it.status] ?? it.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// Cabeçalho de colunas fixo, acima da lista de linhas expansíveis -- as
// linhas viraram <details> (pra clicar e ver os chamados por trás, pedido
// do Victor 21/08/2026: "em todas as listas, assim que clicar, mostrar os
// detalhes"), então não tem mais um <table> de verdade com <thead> --
// isso replica visualmente as mesmas colunas.
function ColumnsHeader({ columns }: { columns: string[] }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
      <span className="w-3 shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">{columns[0]}</span>
      {columns.slice(1).map((c) => (
        <span key={c} className="w-20 shrink-0 text-right">
          {c}
        </span>
      ))}
    </div>
  );
}

function ExpandableRow({
  label,
  numbers,
  children,
}: {
  label: string;
  numbers: { value: number | string; color?: string }[];
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="w-3 shrink-0 text-xs transition-transform group-open:rotate-90" style={{ color: "var(--text-muted)" }} aria-hidden="true">
          ▶
        </span>
        <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        {numbers.map((n, i) => (
          <span key={i} className="w-20 shrink-0 text-right text-sm" style={{ color: n.color ?? "var(--text-primary)" }}>
            {n.value}
          </span>
        ))}
      </summary>
      {children}
    </details>
  );
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
    <details className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <summary className="text-base font-bold cursor-pointer px-4 py-3" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--gridline)" }}>
        {title} ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
          {emptyMessage}
        </p>
      ) : (
        <div>
          <ColumnsHeader columns={[keyLabel, "Total", "Concluídas", "Canceladas"]} />
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {rows.map((r) => (
              <ExpandableRow
                key={r.key}
                label={labelFor(r.key)}
                numbers={[
                  { value: r.total },
                  { value: r.concluida, color: "var(--status-good)" },
                  { value: r.cancelada, color: "var(--text-muted)" },
                ]}
              >
                <ReportRowItemsList items={r.items} />
              </ExpandableRow>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tipo?: string; indFrom?: string; indTo?: string; alvo?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { from, to, tipo, indFrom, indTo, alvo } = await searchParams;
  const dateFrom = from || firstDayOfMonth();
  const dateTo = to || today();
  const filterAlvo = alvo === "mostruario" || alvo === "cliente" ? alvo : undefined;

  const indicatorType = (REQUEST_TYPES as readonly string[]).includes(tipo ?? "") ? (tipo as (typeof REQUEST_TYPES)[number]) : "montagem";
  const indicatorDateFrom = indFrom || sixMonthsAgoFirstDay();
  const indicatorDateTo = indTo || today();

  const [report, paymentItems, supplierReconciliation, indicators] = await Promise.all([
    getRequestsReport({ dateFrom, dateTo, alvo: filterAlvo }),
    listPaymentItems({ dateFrom, dateTo }),
    getSupplierReconciliation(),
    getServiceTypeIndicators(indicatorType, { dateFrom: indicatorDateFrom, dateTo: indicatorDateTo }),
  ]);

  const byAssembler = new Map<string, { total: number; pendente: number; pago: number; itens: number; items: PaymentItem[] }>();
  for (const item of paymentItems) {
    const name = item.assemblerName ?? "Sem montador definido";
    const entry = byAssembler.get(name) ?? { total: 0, pendente: 0, pago: 0, itens: 0, items: [] };
    const value = (item.unitValue ?? 0) * item.quantity;
    entry.total += value;
    entry.itens += 1;
    entry.items.push(item);
    if (item.paymentReleased) entry.pago += value;
    else if (paymentStage(item.requestStatus, item.paymentReleased) === "pendente") entry.pendente += value;
    byAssembler.set(name, entry);
  }
  const assemblerRows = sortManoelLast([...byAssembler.entries()].sort((a, b) => b[1].total - a[1].total), ([name]) => name);
  // "Total" aqui é tudo que tem valor definido (inclusive item ainda não
  // montado, com valor pré-definido) -- mesmo critério de "Total" na aba
  // Pagamentos (ver pagamentos/page.tsx). "Pago" é só o que já foi
  // liberado -- faltava esse número aqui antes (achado da revisão do
  // Victor 21/08/2026: o card "Total pago a montadores" somava tudo, não
  // só o pago de verdade -- corrigido junto com o pedido de "Pendentes/
  // pago/total como na aba de pagamentos").
  const paymentTotal = assemblerRows.reduce((sum, [, v]) => sum + v.total, 0);
  const paymentPending = assemblerRows.reduce((sum, [, v]) => sum + v.pendente, 0);
  const paymentPaid = assemblerRows.reduce((sum, [, v]) => sum + v.pago, 0);

  const indicatorsByAssembler = sortManoelLast(indicators.byAssembler, (a) => a.assemblerName);

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
        {filterAlvo ? <input type="hidden" name="alvo" value={filterAlvo} /> : null}
        <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Aplicar
        </button>
      </form>

      {/* Mostruário (loja monta pra exposição própria, sem cliente real) x
          cliente de verdade -- pedido do Victor 21/08/2026: "coloque
          Filtro de montagem de mostruário e cliente". Só afeta o
          relatório principal logo abaixo (loja/tipo/vendedor/causa raiz)
          -- indicadores por tipo e pagamentos não têm essa distinção na
          consulta. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Alvo:
        </span>
        {ALVO_FILTERS.map((f) => {
          const selected = f.value === filterAlvo;
          return (
            <Link
              key={f.label}
              href={buildReportHref({ from: dateFrom, to: dateTo, alvo: f.value })}
              className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
              style={{
                border: "1px solid var(--border)",
                background: selected ? "var(--brand-green)" : "transparent",
                color: selected ? "var(--brand-green-ink)" : "var(--text-secondary)",
                fontWeight: selected ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <StatTile label="Solicitações no período" value={report.totalRequests} />
        <StatTile label="Total a pagar a montadores" value={formatBRL(paymentTotal)} />
        <StatTile label="Pago" value={formatBRL(paymentPaid)} accent="var(--status-good)" />
        <StatTile label="Pendente de liberação" value={formatBRL(paymentPending)} accent="var(--status-warning)" />
      </div>

      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
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
            <div>
              <ColumnsHeader columns={["Mês", "Total", "Concluídas"]} />
              <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {indicators.byMonth.map((m) => (
                  <ExpandableRow
                    key={m.month}
                    label={formatMonth(m.month)}
                    numbers={[{ value: m.total }, { value: m.concluida, color: "var(--status-good)" }]}
                  >
                    <IndicatorItemsList items={m.items} />
                  </ExpandableRow>
                ))}
              </div>
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
            {indicatorsByAssembler.length === 0 ? (
              <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
                Nenhuma solicitação desse tipo no período.
              </p>
            ) : (
              <div>
                <ColumnsHeader columns={["Montador", "Total", "Concluídas", "Tempo médio"]} />
                <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                  {indicatorsByAssembler.map((a) => (
                    <ExpandableRow
                      key={a.assemblerName}
                      label={a.assemblerName}
                      numbers={[
                        { value: a.total },
                        { value: a.concluida, color: "var(--status-good)" },
                        { value: formatDays(a.avgDaysToComplete), color: "var(--text-muted)" },
                      ]}
                    >
                      <IndicatorItemsList items={a.items} />
                    </ExpandableRow>
                  ))}
                </div>
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
              <div>
                <ColumnsHeader columns={["Loja", "Total", "Concluídas"]} />
                <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                  {indicators.byStore.map((s) => (
                    <ExpandableRow
                      key={s.storeId}
                      label={s.storeName}
                      numbers={[{ value: s.total }, { value: s.concluida, color: "var(--status-good)" }]}
                    >
                      <IndicatorItemsList items={s.items} />
                    </ExpandableRow>
                  ))}
                </div>
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
      <ReportTable
        title="Trocas de produto por causa raiz"
        rows={report.byCausaRaiz}
        keyLabel="Causa raiz"
        emptyMessage="Nenhuma troca de produto com causa raiz registrada nesse período."
        labelFor={(key) => CAUSA_RAIZ_LABELS[key] ?? key}
      />

      <details className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <summary className="text-base font-bold cursor-pointer px-4 py-3" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--gridline)" }}>
          Pagamento por montador ({assemblerRows.length})
        </summary>
        {assemblerRows.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nenhum pagamento no período.
          </p>
        ) : (
          <div>
            <ColumnsHeader columns={["Montador", "Itens", "Total", "Pago", "Pendente"]} />
            <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
              {assemblerRows.map(([name, v]) => (
                <ExpandableRow
                  key={name}
                  label={name}
                  numbers={[
                    { value: v.itens },
                    { value: formatBRL(v.total) },
                    { value: formatBRL(v.pago), color: "var(--status-good)" },
                    { value: formatBRL(v.pendente), color: v.pendente > 0 ? "var(--status-warning)" : "var(--text-muted)" },
                  ]}
                >
                  <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
                    {v.items.map((it) => (
                      <div key={it.itemId} className="pl-9 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate" style={{ color: "var(--text-primary)" }}>
                          {it.product} · {it.quantity}x · {it.clientName ?? it.storeName} · {formatDateBr(it.createdAt)}
                        </span>
                        <span
                          className="shrink-0 font-medium"
                          style={{ color: it.paymentReleased ? "var(--status-good)" : "var(--status-warning)" }}
                        >
                          {it.unitValue !== null ? formatBRL(it.unitValue * it.quantity) : "—"} · {it.paymentReleased ? "Pago" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </ExpandableRow>
              ))}
            </div>
          </div>
        )}
      </details>

      <details className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <summary className="text-base font-bold cursor-pointer px-4 py-3" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--gridline)" }}>
          Reconciliação com fornecedor ({supplierReconciliation.length}) — acumulado, todas as remessas
        </summary>
        {supplierReconciliation.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nenhuma remessa registrada ainda.
          </p>
        ) : (
          <div>
            <ColumnsHeader columns={["Fornecedor", "Em devolução", "Faturado", "Reembolsado", "Pendente"]} />
            <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
              {supplierReconciliation.map((r) => (
                <ExpandableRow
                  key={r.supplier}
                  label={r.supplier}
                  numbers={[
                    { value: formatBRL(r.emDevolucao) },
                    { value: formatBRL(r.faturado) },
                    { value: formatBRL(r.reembolsado), color: "var(--status-good)" },
                    { value: formatBRL(r.pendente), color: r.pendente > 0 ? "var(--status-warning)" : "var(--text-muted)" },
                  ]}
                >
                  <SupplierReturnItemsList items={r.items} />
                </ExpandableRow>
              ))}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}

function SupplierReturnItemsList({ items }: { items: SupplierReconciliationItem[] }) {
  return (
    <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
      {items.map((it) => (
        <div key={it.id} className="pl-9 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate" style={{ color: "var(--text-primary)" }}>
            #{it.ticketNumber} · {it.partName}
            {it.invoiceValue !== null ? ` · ${formatBRL(it.invoiceValue)}` : ""}
          </span>
          <span className="shrink-0 font-medium" style={{ color: "var(--text-muted)" }}>
            {SUPPLIER_RETURN_STATUS_LABELS[it.status] ?? it.status}
          </span>
        </div>
      ))}
    </div>
  );
}
