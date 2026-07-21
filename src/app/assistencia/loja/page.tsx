import Link from "next/link";
import { redirect } from "next/navigation";
import { listOpenRequestsForLoja, listStores, type OpenRequestForLoja } from "@/lib/serviceRequests";
import { getLojaStorePreference } from "@/app/assistencia/actions";
import { getLojaGerenteSession, lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { REQUEST_TYPE_LABELS, STATUS_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { StatTile } from "@/components/StatTile";
import { LojaStoreFilter } from "@/components/assistencia/LojaStoreFilter";
import { LojaDeadlineControl } from "@/components/assistencia/LojaDeadlineControl";
import { ToastProvider } from "@/components/assistencia/ToastProvider";

// Precisa refletir a demanda em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

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

  const [requests, stores] = await Promise.all([
    listOpenRequestsForLoja({ storeId: storeId || undefined, onlyCompleted: showCompleted }),
    listStores(),
  ]);

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
        <div className="flex flex-col gap-4">
          {groupByDate(requests, showCompleted).map(([dateLabel, group]) => (
            <div key={dateLabel} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                {showCompleted ? `Concluídas em ${dateLabel}` : `Solicitado em ${dateLabel}`}
              </span>
              <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
                <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                  {group.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                      <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            #{r.ticketNumber}
                          </span>
                          <StatusBadge status={r.status} showInfo />
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {r.storeName}
                          </span>
                        </div>
                        <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                          {r.clientName ?? "Sem nome de cliente"}
                          {r.productSummary ? ` · ${r.productSummary}` : ""}
                        </p>
                      </div>
                      {!showCompleted ? (
                        <LojaDeadlineControl
                          requestId={r.id}
                          requestedDeadline={r.requestedDeadline}
                          deadlineStatus={r.deadlineStatus}
                          approvedDeadline={r.approvedDeadline}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
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
