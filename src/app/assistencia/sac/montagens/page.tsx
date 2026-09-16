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
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const { view, q } = await searchParams;
  const showCompleted = view === "concluidas";

  // Ver OWN_ASSEMBLER_STORE_IDS -- SAC também não enxerga montagem/
  // desmontagem/vistoria de Mamanguape/Campina Grande (exceto se for admin).
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  // Busca por cliente/CPF/telefone/produto/nº do chamado -- pedido do
  // Victor 16/09/2026: "poderem consultar caso já tenha alguma solicitação
  // em aberto do cliente específico". Sem `q`, a busca já cobre esses
  // campos (ver listRequests, serviceRequests.ts) -- com o filtro
  // preenchido, ignora o toggle Em aberto/Concluídas e mostra os dois (não
  // faz sentido escolher escondido enquanto procura um cliente específico).
  const { items } = await listRequests({
    types: [...ASSISTENCIA_MANAGED_TYPES],
    status: q ? undefined : showCompleted ? "concluida" : undefined,
    q,
    excludeOwnAssemblerStoreIds,
  });
  const requests = q ? items : showCompleted ? items : items.filter((r) => r.status !== "concluida" && r.status !== "cancelada");

  return (
    <div className="max-w-6xl mx-auto w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Montagens e serviços" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />

      <SacTabs active="montagens" />

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Visão só de acompanhamento — quem gerencia montagem, desmontagem, recolhimento, troca de peça e vistoria continua sendo a
        assistência técnica.
      </p>

      <form action="/assistencia/sac/montagens" method="GET" className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por cliente, CPF, telefone, produto ou nº do chamado…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 pl-8 pr-3 py-2 text-sm w-full text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
          />
        </div>
        <button type="submit" className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 font-medium text-gray-800 dark:text-gray-100">
          Buscar
        </button>
        {q ? (
          <Link href="/assistencia/sac/montagens" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Limpar busca
          </Link>
        ) : null}
      </form>

      {!q ? (
        <div className="flex items-center gap-2">
          <FilterPill label="Em aberto" selected={!showCompleted} href="/assistencia/sac/montagens" />
          <FilterPill label="Concluídas" selected={showCompleted} href="/assistencia/sac/montagens?view=concluidas" />
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {q ? "Nenhum chamado encontrado." : showCompleted ? "Nenhuma concluída ainda." : "Nenhuma em aberto no momento."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/assistencia/${r.id}`}
                className="flex items-center justify-between gap-3 p-4 flex-wrap hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500">#{r.ticketNumber}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{REQUEST_TYPE_LABELS[r.type] ?? r.type}</span>
                  </div>
                  <p className="text-base font-bold truncate text-gray-800 dark:text-gray-100">{r.clientName ?? "Sem nome de cliente"}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {r.storeName}
                    {r.assemblerName ? ` · Montador: ${r.assemblerName}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
