import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listOpenRequestsForLoja,
  listOpenMontagemQueueIds,
  listStores,
  isMostruarioRequest,
  type DeadlineStatus,
} from "@/lib/serviceRequests";
import { LojaGerenteRatingPrompt } from "@/components/assistencia/LojaGerenteRatingPrompt";
import { getLojaStorePreference } from "@/app/assistencia/actions";
import { getLojaGerenteSession, lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { REQUEST_TYPE_LABELS, STATUS_LABELS, ASSISTENCIA_MANAGED_TYPES, OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { StatTile } from "@/components/StatTile";
import { LojaStoreFilter } from "@/components/assistencia/LojaStoreFilter";
import { LojaTabs } from "@/components/assistencia/LojaTabs";
import { LojaDeadlineControl } from "@/components/assistencia/LojaDeadlineControl";
import { ProductsModalButton } from "@/components/assistencia/ProductsModalButton";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listLojaNotificationsAction } from "@/app/assistencia/notifications-actions";

// Precisa refletir a demanda em aberto em tempo real — nunca gerar estático.
export const dynamic = "force-dynamic";

const DEADLINE_STATUS_COLOR: Record<DeadlineStatus, string> = {
  aprovado: "var(--brand-green)",
  recusado: "var(--status-critical)",
  pendente: "var(--status-warning)",
};

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Prazo só de leitura (sem botão de propor outra data) pra chamado de loja
// que não é do gerente logado — ele pode ver, mas só quem gerencia aquela
// loja pode negociar o prazo (ver proposeNewDeadline no servidor).
function ReadOnlyDeadline({
  requestedDeadline,
  deadlineStatus,
  approvedDeadline,
}: {
  requestedDeadline: string | null;
  deadlineStatus: DeadlineStatus;
  approvedDeadline: string | null;
}) {
  const shownDate = deadlineStatus === "aprovado" ? approvedDeadline : deadlineStatus === "recusado" ? approvedDeadline : requestedDeadline;
  const statusLabel =
    deadlineStatus === "aprovado" ? "aprovado" : deadlineStatus === "recusado" ? "nova data proposta" : "aguardando aprovação";
  const color = DEADLINE_STATUS_COLOR[deadlineStatus] ?? "var(--text-muted)";

  if (!shownDate) {
    return (
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Sem prazo definido
      </span>
    );
  }

  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-lg"
      style={{ color, background: "var(--surface-1)", border: `1.5px solid ${color}` }}
    >
      Prazo: {formatDateOnly(shownDate)} ({statusLabel})
    </span>
  );
}

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

  const [stores, gerenteStoreIds] = await Promise.all([listStores(), getGerenteStoreIds(gerenteName)]);

  // Gerente de loja com montador próprio (Mamanguape/Campina Grande) só
  // enxerga a própria loja pra montagem/desmontagem/vistoria -- nunca
  // "todas as lojas" nem outra loja qualquer pra esses 3 tipos, mesmo
  // trocando o parâmetro na URL. Gerente comum simplesmente não vê essas
  // duas lojas nesses 3 tipos (ver OWN_ASSEMBLER_STORE_IDS/
  // OWN_ASSEMBLER_RESTRICTED_TYPES). Recolhimento/troca de peça/envio de
  // peça continuam cross-loja como sempre, pra todo mundo.
  const ownsRestrictedStore = gerenteStoreIds.some((id) => (OWN_ASSEMBLER_STORE_IDS as readonly string[]).includes(id));
  const excludeOwnAssemblerStoreIds = ownsRestrictedStore
    ? stores.map((s) => s.id).filter((id) => !gerenteStoreIds.includes(id))
    : [...OWN_ASSEMBLER_STORE_IDS];

  const [requests, montagemQueueIds] = await Promise.all([
    listOpenRequestsForLoja({
      storeId: storeId || undefined,
      types: ASSISTENCIA_MANAGED_TYPES,
      onlyCompleted: showCompleted,
      excludeOwnAssemblerStoreIds,
    }),
    showCompleted ? Promise.resolve([]) : listOpenMontagemQueueIds(),
  ]);

  const montagemPosition = new Map(montagemQueueIds.map((id, i) => [id, i + 1]));

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
    {/* Largura total -- pedido do Victor 31/08/2026, mesmo tratamento
        das outras telas fora do grupo (app) (gerente de loja não tem
        sessão Supabase Auth aqui, login por PIN). AssistenciaHeader não
        foi tocado. */}
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <RealtimeQueueRefresher />
      <AssistenciaHeader title="Gerente de loja" subtitle="Montagem, desmontagem, recolhimento e vistoria — todas as lojas">
        <div className="flex items-center gap-3 flex-wrap">
          <NotificationBell fetchAction={listLojaNotificationsAction} storageKey="loja" />
          <Link
            href="/assistencia/solicitar"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Nova solicitação
          </Link>
          <Link
            href="/assistencia/encomendas/solicitar"
            className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap border"
            style={{ borderColor: "var(--brand-green)", color: "var(--brand-green)" }}
          >
            + Nova encomenda
          </Link>
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
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
            {requests.map((r) => {
              const isOwnStore = gerenteStoreIds.includes(r.storeId);
              const isOwnRequest = r.requestedByName === gerenteName;
              const position = montagemPosition.get(r.id);
              const dateLabel = new Date(showCompleted ? (r.completedAt ?? r.createdAt) : r.createdAt).toLocaleDateString("pt-BR");
              // Mostruário concluído, pedido por esse gerente, ainda sem
              // nota -- o montador pulou a avaliação na hora (ver
              // MontadorRequestActions.tsx), fica pendente aqui até o
              // gerente avaliar quando quiser.
              const needsGerenteRating =
                showCompleted && isOwnRequest && r.deliveryRating === null && isMostruarioRequest(r.orderCode, r.clientName);
              return (
                <div
                  key={r.id}
                  className={isOwnRequest ? "flex items-start gap-3 p-4 rounded-lg m-2 flex-wrap" : "flex items-start gap-3 p-4 flex-wrap"}
                  style={
                    isOwnRequest
                      ? { background: "var(--brand-green-soft)", border: "2px solid var(--brand-green)" }
                      : undefined
                  }
                >
                  {/* Selo compacto e fixo à esquerda -- mesma pista visual da posição
                      na fila usada nas telas de encomenda. */}
                  <div className="flex items-center justify-center w-9 shrink-0 pt-0.5">
                    {r.type === "montagem" && position ? (
                      <div
                        className="rounded flex flex-col items-center justify-center px-1 py-0.5 shrink-0 leading-none"
                        style={{ background: "var(--brand-green)", color: "#fff" }}
                      >
                        <span className="text-sm font-bold">{position}º</span>
                        <span className="text-[7px] font-semibold uppercase tracking-wide">na fila</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 flex-1 min-w-0">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                        #{r.ticketNumber}
                      </span>
                      <StatusBadge status={r.status} showInfo size={isOwnRequest ? "md" : "sm"} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        · {r.storeName}
                      </span>
                      {isOwnRequest ? (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ color: "var(--brand-green-ink)", background: "var(--brand-green)" }}
                        >
                          Sua solicitação
                        </span>
                      ) : r.requestedByName ? (
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          · Solicitado por{" "}
                          <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                            {r.requestedByName}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>
                      {r.clientName ?? "Sem nome de cliente"}
                      {r.clientPhone ? ` · 📞 ${r.clientPhone}` : ""}
                      {r.clientNeighborhood ? ` · 📍 ${r.clientNeighborhood}` : ""}
                    </p>
                    {r.assemblerName ? (
                      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        Montador: {r.assemblerName}
                      </p>
                    ) : null}
                    {r.items.length > 0 ? <ProductsModalButton items={r.items} /> : null}
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0 pt-3 mt-1 border-t sm:pt-0 sm:mt-0 sm:border-t-0 w-full sm:w-auto justify-between sm:justify-start" style={{ borderColor: "var(--gridline)" }}>
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {dateLabel}
                    </span>
                    {!showCompleted ? (
                      isOwnStore ? (
                        <LojaDeadlineControl
                          requestId={r.id}
                          requestedDeadline={r.requestedDeadline}
                          deadlineStatus={r.deadlineStatus}
                          approvedDeadline={r.approvedDeadline}
                          highlight={isOwnRequest}
                        />
                      ) : (
                        <ReadOnlyDeadline
                          requestedDeadline={r.requestedDeadline}
                          deadlineStatus={r.deadlineStatus}
                          approvedDeadline={r.approvedDeadline}
                        />
                      )
                    ) : null}
                    {!showCompleted && isOwnStore && r.status === "aberta" ? (
                      <Link
                        href={`/assistencia/loja/${r.id}/editar`}
                        className="text-xs underline whitespace-nowrap"
                        style={{ color: "var(--brand-green)" }}
                      >
                        Editar
                      </Link>
                    ) : null}
                  </div>
                  </div>
                  {needsGerenteRating ? (
                    <div className="w-full pt-2">
                      <LojaGerenteRatingPrompt requestId={r.id} />
                    </div>
                  ) : null}
                </div>
              );
            })}
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
