import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listRequests, listStores, isRequestStatus, type ServiceRequestSummary } from "@/lib/serviceRequests";
import { listAssemblers } from "@/lib/payments";
import { ASSISTENCIA_MANAGED_TYPES, STATUS_COLORS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaQueueGroup } from "@/components/assistencia/AssistenciaQueueGroup";

// listRequests só ordena por created_at (ver comentário lá) -- a ordem
// manual (assistencia_order) só faz sentido DENTRO de um grupo do mesmo dia
// (é onde reordenar aparece na tela), então aplica aqui, por grupo, depois de
// já ter separado por data. Grupos em si vêm sempre do mais novo pro mais
// antigo, direto pela dateKey (string YYYY-MM-DD ordena igual data).
function groupByDate(requests: ServiceRequestSummary[]) {
  const groups: { dateKey: string; label: string; items: ServiceRequestSummary[] }[] = [];
  for (const r of requests) {
    const date = new Date(r.createdAt);
    const dateKey = date.toISOString().slice(0, 10);
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      group = { dateKey, label, items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }
  groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
  for (const group of groups) {
    group.items.sort((a, b) => {
      if (a.assistenciaOrder !== null && b.assistenciaOrder !== null) return a.assistenciaOrder - b.assistenciaOrder;
      if (a.assistenciaOrder !== null) return -1;
      if (b.assistenciaOrder !== null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  return groups;
}

function buildHref(params: { status?: string; q?: string; page?: number; store?: string; assembler?: string; from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  if (params.assembler) sp.set("assembler", params.assembler);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/assistencia/fila?${qs}` : "/assistencia/fila";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todas", value: null },
  { label: "Abertas", value: "aberta" },
  { label: "Em contato", value: "em_contato" },
  { label: "Em andamento", value: "em_andamento" },
  { label: "Concluídas", value: "concluida" },
  { label: "Canceladas", value: "cancelada" },
];

export default async function AssistenciaQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; store?: string; assembler?: string; from?: string; to?: string }>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  const { status, q, page: pageParam, store, assembler, from, to } = await searchParams;
  const filterStatus = isRequestStatus(status) ? status : undefined;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const dateFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const dateTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
  // Assistência só enxerga o próprio domínio (montagem/desmontagem/troca de
  // peça/vistoria) — admin continua vendo tudo, inclusive chamados de SAC,
  // como supervisão.
  const types = profile.role === "assistencia" ? [...ASSISTENCIA_MANAGED_TYPES] : undefined;
  const [{ items: requests, total, pageSize }, stores, assemblers] = await Promise.all([
    listRequests({ status: filterStatus, q, page, storeId: store, assemblerName: assembler, types, dateFrom, dateTo }),
    listStores(),
    listAssemblers(),
  ]);
  const groups = groupByDate(requests);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher notifyOnInsert="Nova solicitação recebida!" />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const selected = (f.value ?? undefined) === filterStatus;
            const color = f.value ? STATUS_COLORS[f.value] ?? "var(--text-secondary)" : "var(--text-secondary)";
            return (
              <Link
                key={f.label}
                href={buildHref({ status: f.value ?? undefined, q, store, assembler, from: dateFrom, to: dateTo })}
                className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
                style={
                  f.value
                    ? {
                        color: "var(--text-primary)",
                        background: selected ? `color-mix(in srgb, ${color} 35%, var(--surface-1))` : "transparent",
                        fontWeight: selected ? 600 : 400,
                        border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${color} 40%, transparent)`}`,
                      }
                    : {
                        borderColor: "var(--border)",
                        border: "1px solid var(--border)",
                        background: selected ? "var(--surface-1)" : "transparent",
                        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: selected ? 600 : 400,
                      }
                }
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/assistencia/nova-rapida"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova solicitação
        </Link>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} solicitaç{total === 1 ? "ão" : "ões"} encontrada{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />
      </div>

      <form action="/assistencia/fila" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {assembler ? <input type="hidden" name="assembler" value={assembler} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nº do chamado, cliente, produto, CPF, telefone ou código do pedido…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          De
          <input
            type="date"
            name="from"
            defaultValue={dateFrom ?? ""}
            className="rounded border px-2 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Até
          <input
            type="date"
            name="to"
            defaultValue={dateTo ?? ""}
            className="rounded border px-2 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
        {q || dateFrom || dateTo ? (
          <Link
            href={buildHref({ status: filterStatus, store, assembler })}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Limpar busca/data
          </Link>
        ) : null}
      </form>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma solicitação encontrada.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.dateKey} className="rounded-xl border" style={{ borderColor: "var(--brand-green)" }}>
            <div className="px-4 py-2 rounded-t-xl" style={{ background: "var(--brand-green)" }}>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--brand-green-ink)" }}>
                {group.label}
              </span>
            </div>
            <div style={{ background: "var(--surface-1)" }}>
              <AssistenciaQueueGroup items={group.items} reorderable />
            </div>
          </div>
        ))
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page - 1, store, assembler, from: dateFrom, to: dateTo })}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              ← Anterior
            </Link>
          ) : null}
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page + 1, store, assembler, from: dateFrom, to: dateTo })}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Próxima →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
