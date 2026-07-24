import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { signOut } from "@/app/assistencia/actions";
import { listRequests } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, ROLE_LABELS, SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SacHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin" && profile.role !== "assistencia") {
    redirect("/assistencia/inicio");
  }

  const { view } = await searchParams;
  const showCompleted = view === "concluidas";

  const { items } = await listRequests({
    types: [...SAC_MANAGED_TYPES],
    status: showCompleted ? "concluida" : undefined,
  });
  const requests = showCompleted ? items : items.filter((r) => r.status !== "concluida" && r.status !== "cancelada");

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="SAC — Lojas Maia" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`}>
        <div className="flex items-center gap-3">
          <Link
            href="/assistencia/sac/nova"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Nova solicitação
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/sac"
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
          href="/assistencia/sac?view=concluidas"
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

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {showCompleted ? "Nenhuma solicitação concluída ainda." : "Nenhuma notificação ou troca em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/assistencia/${r.id}`}
                className="flex items-center justify-between gap-3 p-4 flex-wrap hover:opacity-80"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      #{r.ticketNumber}
                    </span>
                    <StatusBadge status={r.status} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                    </span>
                    {r.type === "troca_produto" && !r.pickupCompleted && r.status !== "concluida" && r.status !== "cancelada" ? (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ color: "var(--brand-orange)", border: "1px solid var(--brand-orange)" }}
                      >
                        Recolher produto
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                    {r.clientName ?? "Sem nome de cliente"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {r.storeName}
                    {r.driverName ? ` · Motorista: ${r.driverName}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/assistencia" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
