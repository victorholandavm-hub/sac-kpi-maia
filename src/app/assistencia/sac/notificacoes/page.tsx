import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listRequests } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { getRotaWeekOverview, startOfRotaWeek } from "@/lib/rotas";
import { REQUEST_TYPE_LABELS, ROLE_LABELS, DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";

export const dynamic = "force-dynamic";

// Aba própria pra troca de produto, entrega de produto e envio de peça --
// antes misturados dentro de "Solicitações" (junto com notificação
// externa). Pedido do Victor 17/08/2026: aba nova de verdade, não só um
// componente de detalhe diferente por trás da mesma lista -- e tirar esses
// 3 tipos de "Solicitações" (que agora só sobra notificação externa),
// pra não duplicar o mesmo chamado em duas abas.
export default async function SacNotificacoesPage({
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
  const today = new Date().toISOString().slice(0, 10);

  const [{ items }, drivers, rotaOverview] = await Promise.all([
    listRequests({
      types: [...DELIVERY_REQUEST_TYPES],
      status: showCompleted ? "concluida" : undefined,
    }),
    listDrivers(),
    getRotaWeekOverview(startOfRotaWeek(today), 14),
  ]);
  const requests = showCompleted ? items : items.filter((r) => r.status !== "concluida" && r.status !== "cancelada");

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Notificação de Assistência" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />

      <SacTabs active="notificacoes" />

      {/* Mesmo painel de /assistencia/fila (aba Entregas) -- SAC não
          alcança a fila da assistência (redirectIfSac), então precisa
          desse atalho aqui também pra não depender de pedir pra
          assistência mudar o motorista do dia (pedido do Victor
          17/08/2026). */}
      <RotaMotoristaDoDia today={today} initialOverview={rotaOverview} drivers={drivers} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/assistencia/sac/notificacoes"
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
            href="/assistencia/sac/notificacoes?view=concluidas"
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
        <Link
          href="/assistencia/sac/nova"
          className="text-sm px-4 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova solicitação
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {showCompleted ? "Nenhuma concluída ainda." : "Nenhuma em aberto no momento."}
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
    </div>
  );
}
