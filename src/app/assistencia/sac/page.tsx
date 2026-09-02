import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { signOut } from "@/app/assistencia/actions";
import { listRequests, countMontagensOverview, countEntregasOverview, listRecentlyHandledBySac } from "@/lib/serviceRequests";
import { countEntregasEmRiscoOverview } from "@/lib/entregasRisco";
import { countPedidosEncomendaSolicitados } from "@/lib/pedidosEncomenda";
import { REQUEST_TYPE_LABELS, ROLE_LABELS, OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listSacNotificationsAction } from "@/app/assistencia/notifications-actions";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { StatTile } from "@/components/StatTile";
import { formatDateTimeBr } from "@/lib/formatDateTime";

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

  // Ver OWN_ASSEMBLER_STORE_IDS -- mesma exclusão da fila/inicio, aplicada
  // aqui pro stat "Montagens abertas" não denunciar loja com montador
  // próprio que a SAC não devia nem saber que tem chamado pendente.
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const [{ items }, riscos, montagensAbertas, entregasAbertas, encomendasSolicitadas, recentlyHandled] = await Promise.all([
    // Troca/entrega de produto e envio de peça saíram daqui 17/08/2026 --
    // ganharam aba própria (ver /assistencia/sac/notificacoes), pra não
    // duplicar o mesmo chamado em duas abas. Só sobra notificação externa
    // (prazo legal/protocolo, sem motorista/rota -- natureza diferente).
    listRequests({
      types: ["notificacao_externa"],
      status: showCompleted ? "concluida" : undefined,
    }),
    countEntregasEmRiscoOverview(),
    countMontagensOverview(excludeOwnAssemblerStoreIds),
    countEntregasOverview(),
    countPedidosEncomendaSolicitados(),
    listRecentlyHandledBySac(profile.id),
  ]);
  const requests = showCompleted ? items : items.filter((r) => r.status !== "concluida" && r.status !== "cancelada");

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="SAC — Lojas Maia" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`}>
        <div className="flex items-center gap-3">
          <NotificationBell fetchAction={listSacNotificationsAction} storageKey="sac" />
          <form action={signOut}>
            <button type="submit" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150">
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <SacTabs active="solicitacoes" />

      {/* Cards de destaque -- Guia de Componentes Maia (Design System,
          01/09/2026): cards brancos com borda fina + sombra sutil no
          lugar do preenchimento sólido cheio de antes. Arsenal continua
          com o acento laranja (é uma ação, não um alerta); Entregas em
          risco continua pulsando/sólida vermelha só quando há alerta de
          verdade -- essa é uma cor de alerta legítima, não decoração. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/assistencia/sac/arsenal"
          className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col justify-center gap-1 hover:border-gray-300 transition-colors duration-150"
        >
          <span className="text-lg font-semibold" style={{ color: "var(--brand-orange)" }}>
            Arsenal do SAC
          </span>
          <span className="text-sm text-gray-500">Scripts, políticas e respostas prontas</span>
        </Link>
        <Link
          href="/assistencia/sac/entregas-risco"
          className={`rounded-xl p-5 flex items-center justify-between gap-4 shadow-sm transition-colors duration-150 ${riscos.alerta > 0 ? "animate-pulse text-white" : "border border-gray-200 bg-white hover:border-gray-300 text-gray-800"}`}
          style={riscos.alerta > 0 ? { background: "var(--status-critical)" } : undefined}
        >
          <span className="text-lg font-semibold">Entregas em risco</span>
          <span className="text-4xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {riscos.alerta}
          </span>
        </Link>
      </div>

      {/* Indicadores numéricos -- desktop mostra 4 colunas lado a lado,
          mobile colapsa pra 2 (mesma convenção de sm: do resto do app). */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatTile label="Solicitações abertas" value={requests.length} />
        <Link href="/assistencia/sac/notificacoes" className="block">
          <StatTile label="Notificação de Assistência" value={entregasAbertas} />
        </Link>
        <StatTile
          label="Entregas — acompanhamento"
          value={riscos.acompanhamento}
          accent={riscos.acompanhamento > 0 ? "var(--status-warning)" : undefined}
        />
        <Link href="/assistencia/sac/montagens" className="block">
          <StatTile label="Montagens e serviços" value={montagensAbertas} />
        </Link>
        <Link href="/assistencia/encomendas/sac" className="block">
          <StatTile label="Encomendas em aberto" value={encomendasSolicitadas} />
        </Link>
      </div>

      {/* Primário/secundário -- Guia de Componentes Maia: só "+ Nova
          entrega" é sólido (a ação mais comum aqui), os outros dois
          outline neutro. */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-3">
        <Link
          href="/assistencia/sac/nova"
          className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm text-center whitespace-nowrap transition-all duration-200 hover:brightness-110"
          style={{ background: "var(--brand-green)" }}
        >
          + Nova entrega
        </Link>
        <Link
          href="/assistencia/sac/nova-visita"
          className="text-sm px-4 py-2.5 rounded-lg font-medium text-center whitespace-nowrap border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors duration-150"
        >
          + Nova visita
        </Link>
        <Link
          href="/assistencia/encomendas/solicitar"
          className="text-sm px-4 py-2.5 rounded-lg font-medium text-center whitespace-nowrap border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors duration-150"
        >
          + Nova encomenda
        </Link>
      </div>

      <h2 className="text-xl font-semibold text-gray-800">Solicitações</h2>

      <div className="flex items-center gap-2">
        <FilterPill label="Em aberto" selected={!showCompleted} href="/assistencia/sac" />
        <FilterPill label="Concluídas" selected={showCompleted} href="/assistencia/sac?view=concluidas" />
      </div>

      {requests.length === 0 ? (
        recentlyHandled.length > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <p className="text-xs px-4 pt-3 text-gray-400">
              {showCompleted ? "Nenhuma solicitação concluída ainda." : "Nenhuma notificação externa em aberto no momento."}
              {" "}Últimos chamados que você mexeu:
            </p>
            <div className="divide-y divide-gray-100">
              {recentlyHandled.map((r) => (
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
                    <p className="text-sm font-bold truncate text-gray-800">{r.clientName ?? "Sem nome de cliente"}</p>
                    <p className="text-xs text-gray-400">
                      {r.storeName} · movimentado em {formatDateTimeBr(r.handledAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-400">
              {showCompleted ? "Nenhuma solicitação concluída ainda." : "Nenhuma notificação externa em aberto no momento."}
            </p>
          </div>
        )
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
                    {r.type === "troca_produto" && !r.pickupCompleted && r.status !== "concluida" && r.status !== "cancelada" ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ color: "#8a4c0d", background: "color-mix(in srgb, var(--brand-orange) 14%, white)" }}
                      >
                        Recolher produto
                      </span>
                    ) : null}
                    {r.type === "troca_produto" && r.exchangeRound > 1 ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ color: "#8a5a00", background: "color-mix(in srgb, var(--status-warning) 14%, white)" }}
                      >
                        {r.exchangeRound}ª troca
                      </span>
                    ) : null}
                  </div>
                  <p className="text-base font-bold truncate text-gray-800">{r.clientName ?? "Sem nome de cliente"}</p>
                  <p className="text-xs text-gray-400">
                    {r.storeName}
                    {r.driverName ? ` · Motorista: ${r.driverName}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/assistencia" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
