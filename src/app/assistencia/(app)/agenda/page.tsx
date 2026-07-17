import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { listScheduledRequests, type ServiceRequestSummary } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";

function groupByDate(requests: ServiceRequestSummary[]) {
  const groups: { dateKey: string; label: string; items: ServiceRequestSummary[] }[] = [];
  for (const r of requests) {
    const dateKey = r.scheduledDate ?? "";
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const [y, m, d] = dateKey.split("-");
      const label = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      group = { dateKey, label, items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }
  return groups;
}

export default async function AgendaPage() {
  const profile = await getProfile();
  const requests = await listScheduledRequests(profile);
  const groups = groupByDate(requests);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Visitas técnicas com data marcada — troca de peça, vistoria, montagem e desmontagem na casa do cliente.
      </p>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma visita agendada ainda. Marque uma data na tela de cada solicitação.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.dateKey} className="flex flex-col gap-2">
            <h3
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: group.dateKey === todayKey ? "var(--brand-orange)" : "var(--text-muted)" }}
            >
              {group.label}
              {group.dateKey === todayKey ? " · hoje" : ""}
            </h3>
            <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
              <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {group.items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/assistencia/${r.id}`}
                    className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={r.status} />
                        {r.shift ? (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                          >
                            {SHIFT_LABELS[r.shift] ?? r.shift}
                          </span>
                        ) : null}
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {r.storeName}
                        </span>
                      </div>
                      <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                        {r.clientName ?? "Sem nome de cliente"}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{r.assemblerName ? `Técnico: ${r.assemblerName}` : "Sem técnico definido"}</span>
                      <span>{r.assignedToName ? `Com ${r.assignedToName}` : "Sem responsável"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
