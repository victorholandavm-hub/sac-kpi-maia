import Link from "next/link";
import { redirect } from "next/navigation";
import { listOpenRequestsForLoja, listOpenMontagemQueueIds, listStores, type OpenRequestForLoja, type DeadlineStatus } from "@/lib/serviceRequests";
import { getLojaStorePreference } from "@/app/assistencia/actions";
import { getLojaGerenteSession, lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { REQUEST_TYPE_LABELS, STATUS_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { StatTile } from "@/components/StatTile";
import { LojaStoreFilter } from "@/components/assistencia/LojaStoreFilter";
import { LojaDeadlineControl } from "@/components/assistencia/LojaDeadlineControl";
import { ToastProvider } from "@/components/assistencia/ToastProvider";

// Precisa refletir a demanda em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

const DEADLINE_STATUS_COLOR: Record<DeadlineStatus, string> = {
  aprovado: "var(--brand-green)",
  recusado: "var(--status-critical)",
  pendente: "var(--status-warning)",
};

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Prazo só de leitura (sem botão de propor outra data) pra chamado de loja
// que não é do gerente logado — ele pode ver, mas só quem gerencia aquela
// loja pode negociar o prazo (ver proposeNewDeadline no servidor).
function ReadOnlyDeadline({
  requestedDeadline,
  deadlineStatus,
  approvedDeadline,
}: {
  requestedDeadline: string | null;
  deadlineStatus: DeadlineStatus;
  approvedDeadline: string | null;
}) {
  const shownDate = deadlineStatus === "aprovado" ? approvedDeadline : deadlineStatus === "recusado" ? approvedDeadline : requestedDeadline;
  const statusLabel =
    deadlineStatus === "aprovado" ? "aprovado" : deadlineStatus === "recusado" ? "nova data proposta" : "aguardando aprovação";
  const color = DEADLINE_STATUS_COLOR[deadlineStatus] ?? "var(--text-muted)";

  if (!shownDate) {
    return (
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Sem prazo definido
      </span>
    );
  }

  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-lg"
      style={{ color, background: "var(--surface-1)", border: `1.5px solid ${color}` }}
    >
      Prazo: {formatDateOnly(shownDate)} ({statusLabel})
    </span>
  );
}

export default async function LojaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; view?: string }>;
}) {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) {
    redirect("/assistencia/loja/login");
  }

  const { store, view } = await searchParams;
  const storePref = store !== undefined ? store : await getLojaStorePreference();
  const storeId = storePref ?? "";
  const showCompleted = view === "concluidas";

  const [requests, stores, gerenteStoreIds, montagemQueueIds] = await Promise.all([
    listOpenRequestsForLoja({ storeId: storeId || undefined, onlyCompleted: showCompleted }),
    listStores(),
    getGerenteStoreIds(gerenteName),
    showCompleted ? Promise.resolve([]) : listOpenMontagemQueueIds(),
  ]);

  const montagemPosition = new Map(montagemQueueIds.map((id, i) => [id, i + 1]));

  const byStatus: Record<string, number> = {};
  for (const r of requests) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const viewHref = (v: string) => {
    const sp = new URLSearchParams();
    if (storeId) sp.set("store", storeId);
    if (v !== "abertas") sp.set("view", v);
    const qs = sp.toString();
    return qs ? `/assistencia/loja?${qs}` : "/assistencia/loja";
  };

  return (
    <ToastProvider>
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Gerente de loja" subtitle="Demanda em aberto de todas as lojas">
        <div className="flex items-center gap-3">
          <Link
            href="/assistencia/solicitar"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Nova solicitação
          </Link>
          <form action={lojaGerenteSignOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <LojaStoreFilter stores={stores} selectedStoreId={storeId} />

      <div className="flex items-center gap-2">
        <Link
          href={viewHref("abertas")}
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: !showCompleted ? "var(--surface-1)" : "transparent",
            color: !showCompleted ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: !showCompleted ? 600 : 400,
          }}
        >
          Em aberto
        </Link>
        <Link
          href={viewHref("concluidas")}
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: showCompleted ? "var(--surface-1)" : "transparent",
            color: showCompleted ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: showCompleted ? 600 : 400,
          }}
        >
          Concluídas
        </Link>
      </div>

      {!showCompleted ? (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile label="Em aberto" value={requests.length} />
          <StatTile label={STATUS_LABELS.aberta} value={byStatus.aberta ?? 0} />
          <StatTile label={STATUS_LABELS.em_contato} value={byStatus.em_contato ?? 0} />
          <StatTile label={STATUS_LABELS.em_andamento} value={byStatus.em_andamento ?? 0} />
        </section>
      ) : null}

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {showCompleted ? "Nenhuma solicitação concluída ainda." : "Nenhuma solicitação em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupByDate(requests, showCompleted).map(([dateLabel, group]) => (
            <div key={dateLabel} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--brand-green)" }}>
              <div className="px-4 py-2" style={{ background: "var(--brand-green)" }}>
                <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--brand-green-ink)" }}>
                  {showCompleted ? `Concluídas em ${dateLabel}` : `Solicitado em ${dateLabel}`}
                </span>
              </div>
              <div className="divide-y" style={{ background: "var(--surface-1)", borderColor: "var(--gridline)" }}>
                {group.map((r) => {
                  const isOwnStore = gerenteStoreIds.includes(r.storeId);
                  const isOwnRequest = r.requestedByName === gerenteName;
                  const position = montagemPosition.get(r.id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-4 p-4 flex-wrap"
                      style={
                        isOwnRequest
                          ? { background: "var(--brand-green-soft)", borderLeft: "4px solid var(--brand-green)" }
                          : undefined
                      }
                    >
                      <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                            #{r.ticketNumber}
                          </span>
                          <StatusBadge status={r.status} showInfo size={isOwnRequest ? "md" : "sm"} />
                          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                          </span>
                          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            {r.storeName}
                          </span>
                          {r.type === "montagem" && position ? (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ color: "#fff", background: "var(--brand-orange)" }}
                            >
                              {position}º na fila
                            </span>
                          ) : null}
                          {isOwnRequest ? (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ color: "var(--brand-green-ink)", background: "var(--brand-green)" }}
                            >
                              Sua solicitação
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {r.clientName ?? "Sem nome de cliente"}
                          {r.productSummary ? ` · ${r.productSummary}` : ""}
                        </p>
                        {r.type === "troca_produto" ? (
                          r.driverName ? (
                            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                              Motorista: {r.driverName}
                            </p>
                          ) : null
                        ) : r.assemblerName ? (
                          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            Montador: {r.assemblerName}
                          </p>
                        ) : null}
                      </div>
                      {!showCompleted ? (
                        isOwnStore ? (
                          <LojaDeadlineControl
                            requestId={r.id}
                            requestedDeadline={r.requestedDeadline}
                            deadlineStatus={r.deadlineStatus}
                            approvedDeadline={r.approvedDeadline}
                            highlight={isOwnRequest}
                          />
                        ) : (
                          <ReadOnlyDeadline
                            requestedDeadline={r.requestedDeadline}
                            deadlineStatus={r.deadlineStatus}
                            approvedDeadline={r.approvedDeadline}
                          />
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/assistencia" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
    </ToastProvider>
  );
}

// Lista já vem ordenada (criação asc pra abertas, conclusão desc pra
// concluídas) — aqui só clusteriza itens consecutivos do mesmo dia em blocos,
// preservando a ordem original entre e dentro dos blocos.
function groupByDate(requests: OpenRequestForLoja[], showCompleted: boolean): [string, OpenRequestForLoja[]][] {
  const groups = new Map<string, OpenRequestForLoja[]>();
  for (const r of requests) {
    const dateField = showCompleted ? (r.completedAt ?? r.createdAt) : r.createdAt;
    const label = new Date(dateField).toLocaleDateString("pt-BR");
    const group = groups.get(label);
    if (group) group.push(r);
    else groups.set(label, [r]);
  }
  return [...groups.entries()];
}
