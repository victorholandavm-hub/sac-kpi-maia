import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { listRequests, listStores, isRequestStatus, type RequestItem, type ServiceRequestSummary } from "@/lib/serviceRequests";
import { listAssemblers } from "@/lib/payments";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";

function itemsSummary(items: RequestItem[]): string | null {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  const firstLabel = first.quantity > 1 ? `${first.quantity}x ${first.product}` : first.product;
  return rest.length > 0 ? `${firstLabel} +${rest.length} item${rest.length > 1 ? "s" : ""}` : firstLabel;
}

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
  return groups;
}

function buildHref(params: { status?: string; q?: string; page?: number; store?: string; assembler?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  if (params.assembler) sp.set("assembler", params.assembler);
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
  searchParams: Promise<{ status?: string; q?: string; page?: string; store?: string; assembler?: string }>;
}) {
  await getProfile();
  const { status, q, page: pageParam, store, assembler } = await searchParams;
  const filterStatus = isRequestStatus(status) ? status : undefined;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const [{ items: requests, total, pageSize }, stores, assemblers] = await Promise.all([
    listRequests({ status: filterStatus, q, page, storeId: store, assemblerName: assembler }),
    listStores(),
    listAssemblers(),
  ]);
  const groups = groupByDate(requests);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={buildHref({ status: f.value ?? undefined, q, store, assembler })}
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: (f.value ?? undefined) === filterStatus ? "var(--surface-1)" : "transparent",
                color: (f.value ?? undefined) === filterStatus ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: (f.value ?? undefined) === filterStatus ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <Link
          href="/assistencia/solicitar"
          target="_blank"
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
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
        {q ? (
          <Link
            href={buildHref({ status: filterStatus, store, assembler })}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Limpar busca
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
          <div key={group.dateKey} className="flex flex-col gap-2">
            <h3
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              {group.label}
            </h3>
            <div
              className="rounded-lg border overflow-hidden"
              style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
            >
              <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {group.items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/assistencia/${r.id}`}
                    className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
                  >
                    <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          #{r.ticketNumber}
                        </span>
                        <StatusBadge status={r.status} />
                        {r.deadlineStatus === "pendente" ? (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ color: "var(--status-warning)", border: "1px solid var(--status-warning)" }}
                          >
                            Prazo pendente
                          </span>
                        ) : null}
                        {r.escalationRisk ? (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ color: "var(--status-critical)", border: "1px solid var(--status-critical)" }}
                          >
                            ⚠ Risco de escalonamento
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
                        {itemsSummary(r.items) ? ` · ${itemsSummary(r.items)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>Aberta às {new Date(r.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      {r.completedAt ? (
                        <span>Concluída em {new Date(r.completedAt).toLocaleString("pt-BR")}</span>
                      ) : null}
                      <span>{r.assignedToName ? `Com ${r.assignedToName}` : "Sem responsável"}</span>
                      {r.assemblerName ? <span>Montador: {r.assemblerName}</span> : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page - 1, store, assembler })}
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
              href={buildHref({ status: filterStatus, q, page: page + 1, store, assembler })}
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
