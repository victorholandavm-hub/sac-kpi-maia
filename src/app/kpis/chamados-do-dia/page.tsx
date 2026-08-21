import Link from "next/link";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { listTicketsForDay } from "@/lib/kpi";
import { categoryLabel, storeLabel, productLabel, URGENCY_LABELS } from "@/lib/labels";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const DEFAULT_FROM = "07:30";
const DEFAULT_TO = "18:30";

function todayBusinessTz(): string {
  // América/Fortaleza (João Pessoa), UTC-3 -- mesmo ajuste usado em
  // dateBuckets.ts, pra "hoje" bater com o dia local, não o do processo
  // (a VPS roda em UTC).
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isValidDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string | undefined): value is string {
  return !!value && /^\d{2}:\d{2}$/.test(value);
}

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const URGENCY_COLORS: Record<string, string> = {
  alta: "var(--status-critical)",
  media: "var(--status-warning)",
  baixa: "var(--text-muted)",
};

// "Chamados do dia" -- pedido do Victor 20/08/2026: "eu consigo pegar do
// GHL, todos os chamados do dia do sac e ver o resumo da conversa de cada
// um... das 7h30 até as 18h30". Tela própria (não modal, pode ter muitos
// chamados num dia inteiro) -- data + janela de horário configuráveis, mas
// já vem com o padrão pedido (7h30–18h30 de hoje).
export default async function ChamadosDoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  await requireDashboardAuth();
  const params = await searchParams;
  const date = isValidDate(params.date) ? params.date : todayBusinessTz();
  const from = isValidTime(params.from) ? params.from : DEFAULT_FROM;
  const to = isValidTime(params.to) ? params.to : DEFAULT_TO;

  const tickets = await listTicketsForDay(date, from, to);

  return (
    <div className="max-w-3xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Chamados do dia
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Todos os chamados do SAC abertos num dia, com o resumo da conversa de cada um.
        </p>
      </div>

      <form
        action="/kpis/chamados-do-dia"
        method="GET"
        className="rounded-lg p-3 flex items-center gap-3 flex-wrap"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Data
          <input type="date" name="date" defaultValue={date} className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          De
          <input type="time" name="from" defaultValue={from} className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Até
          <input type="time" name="to" defaultValue={to} className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <button type="submit" className="text-sm px-4 py-1.5 rounded font-medium" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          Buscar
        </button>
        {from !== DEFAULT_FROM || to !== DEFAULT_TO ? (
          <Link href={`/kpis/chamados-do-dia?date=${date}`} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            Voltar pro horário padrão (7h30–18h30)
          </Link>
        ) : null}
      </form>

      <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
        {formatDateBr(date)}, {from} às {to} · {tickets.length} chamado{tickets.length === 1 ? "" : "s"}.
      </p>

      {tickets.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum chamado nesse dia/horário.
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <div className="flex flex-col divide-y" style={{ background: "var(--surface-1)", borderColor: "var(--gridline)" }}>
            {tickets.map((t) => (
              <div key={t.conversationId} className="flex flex-col gap-1.5 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {t.clientName ?? "Sem nome"}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                    {formatDateTimeBr(t.openedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {t.storeTag ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      {storeLabel(t.storeTag)}
                    </span>
                  ) : null}
                  {t.category ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      {categoryLabel(t.category)}
                    </span>
                  ) : null}
                  {t.product ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      {productLabel(t.product)}
                    </span>
                  ) : null}
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ color: URGENCY_COLORS[t.urgency] ?? "var(--text-muted)", background: "color-mix(in srgb, currentColor 15%, transparent)" }}
                  >
                    {URGENCY_LABELS[t.urgency] ?? t.urgency}
                  </span>
                </div>
                {t.clientPhone ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t.clientPhone}
                  </span>
                ) : null}
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {t.summaryAi ?? "Sem resumo disponível pra essa conversa."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
