import Link from "next/link";
import { redirect } from "next/navigation";
import { listOpenRequestsForLoja, groupRequestsByDate } from "@/lib/serviceRequests";
import { getLojaGerenteSession, lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { REQUEST_TYPE_LABELS, STATUS_LABELS, SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { StatTile } from "@/components/StatTile";
import { LojaTabs } from "@/components/assistencia/LojaTabs";
import { LojaDeadlineControl } from "@/components/assistencia/LojaDeadlineControl";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listLojaNotificationsAction } from "@/app/assistencia/notifications-actions";

// Precisa refletir a demanda em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

export default async function LojaTrocasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) {
    redirect("/assistencia/loja/login");
  }

  const { view } = await searchParams;
  const showCompleted = view === "concluidas";

  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  // Sem loja vinculada não tem o que buscar — evita mandar storeIds: [] pro
  // Supabase, que na prática (.in com array vazio) não filtra nada.
  const requests =
    gerenteStoreIds.length === 0
      ? []
      : await listOpenRequestsForLoja({ storeIds: gerenteStoreIds, types: SAC_MANAGED_TYPES, onlyCompleted: showCompleted });

  const byStatus: Record<string, number> = {};
  for (const r of requests) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const viewHref = (v: string) => (v === "abertas" ? "/assistencia/loja/trocas" : `/assistencia/loja/trocas?view=${v}`);

  return (
    <ToastProvider>
    {/* Largura total -- pedido do Victor 31/08/2026, mesmo tratamento
        das outras telas fora do grupo (app). */}
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <RealtimeQueueRefresher />
      <AssistenciaHeader title="Gerente de loja" subtitle="Trocas, entregas e notificações do SAC — só da sua loja">
        <div className="flex items-center gap-3 flex-wrap">
          <NotificationBell fetchAction={listLojaNotificationsAction} storageKey="loja" />
          <Link
            href="/assistencia/loja/equipe"
            className="text-sm underline whitespace-nowrap"
            style={{ color: "var(--text-secondary)" }}
          >
            Equipe da loja
          </Link>
          <form action={lojaGerenteSignOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <LojaTabs />

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
            {showCompleted ? "Nenhuma troca concluída ainda." : "Nenhuma troca do SAC em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupRequestsByDate(requests, showCompleted).map(([dateLabel, group]) => (
            <div key={dateLabel} className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
              <div className="px-4 py-2 flex items-center gap-2 flex-wrap" style={{ background: "var(--brand-green)" }}>
                <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--brand-green-ink)" }}>
                  {showCompleted ? `Concluídas em ${dateLabel}` : `Solicitado em ${dateLabel}`}
                </span>
              </div>
              <div className="divide-y" style={{ background: "var(--surface-1)", borderColor: "var(--gridline)" }}>
                {group.map((r) => {
                  return (
                    <div key={r.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                            #{r.ticketNumber}
                          </span>
                          <StatusBadge status={r.status} showInfo size="sm" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                          </span>
                          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            · {r.storeName}
                          </span>
                        </div>
                        <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>
                          {r.clientName ?? "Sem nome de cliente"}
                          {r.productSummary ? ` · ${r.productSummary}` : ""}
                        </p>
                        {r.driverName ? (
                          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            Motorista: {r.driverName}
                          </p>
                        ) : null}
                      </div>
                      {!showCompleted ? (
                        <div
                          className="shrink-0 pt-3 mt-1 border-t sm:pt-0 sm:mt-0 sm:border-t-0 w-full sm:w-auto"
                          style={{ borderColor: "var(--gridline)" }}
                        >
                          <LojaDeadlineControl
                            requestId={r.id}
                            requestedDeadline={r.requestedDeadline}
                            deadlineStatus={r.deadlineStatus}
                            approvedDeadline={r.approvedDeadline}
                            highlight={false}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/assistencia/loja" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
    </ToastProvider>
  );
}
