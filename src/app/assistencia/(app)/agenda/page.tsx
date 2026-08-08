import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listScheduledRequests, agendaEffectiveDate, type ServiceRequestSummary, type AgendaRange } from "@/lib/serviceRequests";
import { listAssemblers } from "@/lib/payments";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { AgendaDayGroups } from "@/components/assistencia/AgendaDayGroups";
import { ROTAS, ROTA_LABELS, isRota } from "@/lib/rotas";

function groupByDate(requests: ServiceRequestSummary[]) {
  const groups: { dateKey: string; label: string; items: ServiceRequestSummary[] }[] = [];
  for (const r of requests) {
    const dateKey = agendaEffectiveDate(r) ?? "";
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

const FILTERS: { label: string; value: AgendaRange | null }[] = [
  { label: "Tudo", value: null },
  { label: "Atrasado", value: "atrasado" },
  { label: "Hoje", value: "hoje" },
  { label: "Próximos 7 dias", value: "semana" },
];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; rota?: string; assembler?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { range, rota, assembler } = await searchParams;
  const filterRange = (["atrasado", "hoje", "semana"] as const).includes(range as AgendaRange)
    ? (range as AgendaRange)
    : undefined;
  const filterRota = isRota(rota) ? rota : undefined;
  const [allRequests, assemblers] = await Promise.all([listScheduledRequests({ range: filterRange }), listAssemblers()]);
  const requests = allRequests
    .filter((r) => !filterRota || r.rota === filterRota)
    .filter((r) => !assembler || r.assemblerName === assembler);
  const groups = groupByDate(requests);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Visitas técnicas com data marcada — troca de peça, vistoria, montagem e desmontagem na casa do cliente.
        </p>
        <Link
          href="/assistencia/nova-rapida"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova visita
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const sp = new URLSearchParams();
          if (f.value) sp.set("range", f.value);
          if (filterRota) sp.set("rota", filterRota);
          if (assembler) sp.set("assembler", assembler);
          const qs = sp.toString();
          return (
            <Link
              key={f.label}
              href={qs ? `/assistencia/agenda?${qs}` : "/assistencia/agenda"}
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: (f.value ?? undefined) === filterRange ? "var(--surface-1)" : "transparent",
                color: (f.value ?? undefined) === filterRange ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: (f.value ?? undefined) === filterRange ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[{ label: "Todas as rotas", value: undefined }, ...ROTAS.map((r) => ({ label: ROTA_LABELS[r], value: r }))].map((f) => {
          const sp = new URLSearchParams();
          if (filterRange) sp.set("range", filterRange);
          if (f.value) sp.set("rota", f.value);
          if (assembler) sp.set("assembler", assembler);
          const qs = sp.toString();
          return (
            <Link
              key={f.label}
              href={qs ? `/assistencia/agenda?${qs}` : "/assistencia/agenda"}
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: f.value === filterRota ? "var(--surface-1)" : "transparent",
                color: f.value === filterRota ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: f.value === filterRota ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {filterRange ? "Nenhuma visita nesse período." : "Nenhuma visita agendada ainda."}
          </p>
        </div>
      ) : (
        <AgendaDayGroups groups={groups} todayKey={todayKey} />
      )}
    </div>
  );
}
