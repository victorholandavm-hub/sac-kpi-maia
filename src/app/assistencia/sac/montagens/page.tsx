import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { listRequests } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, ROLE_LABELS, ASSISTENCIA_MANAGED_TYPES, OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { FilterPill } from "@/components/assistencia/FilterPill";

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
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Montagens e serviços" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />

      <SacTabs active="montagens" />

      <p className="text-sm text-gray-500">
        Visão só de acompanhamento — quem gerencia montagem, desmontagem, recolhimento, troca de peça e vistoria continua sendo a
        assistência técnica.
      </p>

      <div className="flex items-center gap-2">
        <FilterPill label="Em aberto" selected={!showCompleted} href="/assistencia/sac/montagens" />
        <FilterPill label="Concluídas" selected={showCompleted} href="/assistencia/sac/montagens?view=concluidas" />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-400">{showCompleted ? "Nenhuma concluída ainda." : "Nenhuma em aberto no momento."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/assistencia/${r.id}`}
                className="flex items-center justify-between gap-3 p-4 flex-wrap hover:bg-gray-50 transition-colors duration-150"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">#{r.ticketNumber}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-sm font-medium text-gray-800">{REQUEST_TYPE_LABELS[r.type] ?? r.type}</span>
                  </div>
                  <p className="text-base font-bold truncate text-gray-800">{r.clientName ?? "Sem nome de cliente"}</p>
                  <p className="text-xs text-gray-400">
                    {r.storeName}
                    {r.assemblerName ? ` · Montador: ${r.assemblerName}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
