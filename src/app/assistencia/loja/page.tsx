import Link from "next/link";
import { listOpenRequestsForLoja, listStores } from "@/lib/serviceRequests";
import { getLojaStorePreference } from "@/app/assistencia/actions";
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
  searchParams: Promise<{ store?: string }>;
}) {
  const { store } = await searchParams;
  const storePref = store !== undefined ? store : await getLojaStorePreference();
  const storeId = storePref ?? "";

  const [openRequests, stores] = await Promise.all([
    listOpenRequestsForLoja({ storeId: storeId || undefined }),
    listStores(),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of openRequests) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  return (
    <ToastProvider>
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Gerente de loja" subtitle="Demanda em aberto de todas as lojas">
        <Link
          href="/assistencia/solicitar"
          className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova solicitação
        </Link>
      </AssistenciaHeader>

      <LojaStoreFilter stores={stores} selectedStoreId={storeId} />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Em aberto" value={openRequests.length} />
        <StatTile label={STATUS_LABELS.aberta} value={byStatus.aberta ?? 0} />
        <StatTile label={STATUS_LABELS.em_contato} value={byStatus.em_contato ?? 0} />
        <StatTile label={STATUS_LABELS.em_andamento} value={byStatus.em_andamento ?? 0} />
      </section>

      {openRequests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma solicitação em aberto no momento.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {openRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={r.status} />
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
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <LojaDeadlineControl
                    requestId={r.id}
                    requestedDeadline={r.requestedDeadline}
                    deadlineStatus={r.deadlineStatus}
                    approvedDeadline={r.approvedDeadline}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/assistencia" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
    </ToastProvider>
  );
}
