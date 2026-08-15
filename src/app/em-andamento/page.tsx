import Link from "next/link";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { getEmAndamentoList } from "@/lib/emAndamento";
import { AppHeader } from "@/components/AppHeader";
import { AutoRefresher } from "@/components/AutoRefresher";
import { storeLabel, categoryLabel, URGENCY_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const URGENCY_COLOR: Record<string, string> = {
  alta: "var(--status-critical)",
  media: "var(--brand-orange)",
  baixa: "var(--text-muted)",
};

export default async function EmAndamentoPage() {
  await requireDashboardAuth();
  const rows = await getEmAndamentoList();

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <AppHeader />
      <AutoRefresher />

      <div className="flex flex-col gap-1">
        <Link href="/kpis" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Atendimentos em andamento
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Clientes com a tag &quot;Em andamento&quot; agora, abertos nos últimos 7 dias — atualiza sozinho a cada 15s.
        </p>
      </div>

      <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum atendimento em andamento no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div
                key={row.conversationId}
                className="flex items-center justify-between gap-3 py-2 flex-wrap"
                style={{ borderTop: "1px solid var(--gridline)" }}
              >
                <div className="flex flex-col gap-0.5 min-w-[10rem]">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {row.clientName ?? "Cliente sem nome"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {row.clientPhone ?? "—"} · {row.storeTag ? storeLabel(row.storeTag) : "Loja não identificada"}
                  </span>
                </div>

                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {row.category ? categoryLabel(row.category) : "Sem categoria"}
                </span>

                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {row.agentName ?? "Sem atendente"}
                </span>

                <span
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ color: URGENCY_COLOR[row.urgency] ?? "var(--text-muted)", border: `1px solid ${URGENCY_COLOR[row.urgency] ?? "var(--border)"}` }}
                >
                  {URGENCY_LABELS[row.urgency] ?? row.urgency}
                </span>

                <span
                  className="text-xs whitespace-nowrap"
                  style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
                >
                  há {Math.round(row.horasEmAndamento)}h
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
