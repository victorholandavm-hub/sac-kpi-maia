import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { listRequests } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, ROLE_LABELS, ASSISTENCIA_MANAGED_TYPES, OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";

export const dynamic = "force-dynamic";

// Visão só de leitura pro SAC acompanhar montagem/desmontagem/recolhimento/
// troca de peça/vistoria -- tipos geridos pela assistência técnica, fora do
// escopo de SAC_MANAGED_TYPES (ver /assistencia/sac/page.tsx). SAC não cria
// nem edita nada aqui -- só consulta; quem gerencia continua sendo
// assistência/admin (ver canManage em [id]/page.tsx, que já bloqueia ações
// pra quem não gerencia o tipo).
export default async function SacMontagensPage({
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

  // Ver OWN_ASSEMBLER_STORE_IDS -- SAC também não enxerga montagem/
  // desmontagem/vistoria de Mamanguape/Campina Grande (exceto se for admin).
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const { items } = await listRequests({
    types: [...ASSISTENCIA_MANAGED_TYPES],
    status: showCompleted ? "concluida" : undefined,
    excludeOwnAssemblerStoreIds,
  });
  const requests = showCompleted ? items : items.filter((r) => r.status !== "concluida" && r.status !== "cancelada");

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Montagens e serviços" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />

      <SacTabs active="montagens" />

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Visão só de acompanhamento — quem gerencia montagem, desmontagem, recolhimento, troca de peça e vistoria continua sendo a
        assistência técnica.
      </p>

      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/sac/montagens"
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
          href="/assistencia/sac/montagens?view=concluidas"
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
                    {r.assemblerName ? ` · Montador: ${r.assemblerName}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/assistencia/sac" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
