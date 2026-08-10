import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { signOut } from "@/app/assistencia/actions";
import { listRequests } from "@/lib/serviceRequests";
import { countEntregasEmRiscoOverview } from "@/lib/entregasRisco";
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
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const { view } = await searchParams;
  const showCompleted = view === "concluidas";

  const [{ items }, riscos] = await Promise.all([
    listRequests({
      // Envio de peça (gerido pela assistência) sai no mesmo carro/rota do
      // dia que troca/entrega de produto do SAC -- mostra aqui também, pra
      // quem monta a rota ver tudo que vai naquele carro, mesmo sem poder
      // editar o que não é seu (canManage barra a ação, não a visão).
      types: [...SAC_MANAGED_TYPES, "envio_peca"],
      status: showCompleted ? "concluida" : undefined,
    }),
    countEntregasEmRiscoOverview(),
  ]);
  const requests = showCompleted ? items : items.filter((r) => r.status !== "concluida" && r.status !== "cancelada");

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="SAC — Lojas Maia" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/assistencia/sac/arsenal"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-orange)", color: "#fff" }}
          >
            Arsenal do SAC
          </Link>
          <Link
            href="/assistencia/sac/entregas-risco"
            className={`text-sm px-4 py-2 rounded font-medium whitespace-nowrap border ${riscos.alerta > 0 ? "animate-pulse" : ""}`}
            style={{
              background: riscos.alerta > 0 ? "var(--status-critical)" : "var(--surface-1)",
              color: riscos.alerta > 0 ? "#fff" : "var(--text-primary)",
              borderColor: "var(--border)",
            }}
          >
            Entregas em risco{riscos.alerta > 0 ? ` (${riscos.alerta})` : ""}
          </Link>
          <Link
            href="/assistencia/sac/nova"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Nova solicitação
          </Link>
          <Link
            href="/assistencia/encomendas/solicitar"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap border"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            + Nova encomenda
          </Link>
          <Link
            href="/assistencia/encomendas/sac"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap border"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            Minhas encomendas
          </Link>
          <Link
            href="/assistencia/sac/montagens"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap border"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            Montagens e serviços
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <h2 className="text-xl font-bold" style={{ color: "var(--brand-orange)" }}>
        Solicitações
      </h2>

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
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
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
                        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
                      >
                        Recolher produto
                      </span>
                    ) : null}
                    {r.type === "troca_produto" && r.exchangeRound > 1 ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--status-warning)", color: "#fff" }}
                      >
                        {r.exchangeRound}ª troca
                      </span>
                    ) : null}
                  </div>
                  <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
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
