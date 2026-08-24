import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession, tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { listRequestsForTecnico, ITEM_DESTINO_NEEDS_NOTE, type TecnicoRequestView, type ItemDestino } from "@/lib/tecnicos";
import { listStores } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { TecnicoItemDestino } from "@/components/assistencia/TecnicoItemDestino";
import { TecnicoNotificationModalButton } from "@/components/assistencia/TecnicoNotificationModalButton";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// SAC (troca/entrega/recolhimento de produto, notificação externa) x
// Assistência (envio de peça, montagem/desmontagem/troca de peça/vistoria) --
// pedido do Victor 20/08/2026: "precisa ter também quem solicitou: sac ou
// assistencia". Mesma divisão de SAC_MANAGED_TYPES/ASSISTENCIA_MANAGED_TYPES
// já usada no filtro "Origem" da aba Entregas (fila/page.tsx).
function origemLabel(type: TecnicoRequestView["type"]): "SAC" | "Assistência" {
  return (SAC_MANAGED_TYPES as readonly string[]).includes(type) ? "SAC" : "Assistência";
}

// Três fases -- pedido do Victor 24/08/2026: "preciso de uma nova fase
// alem de pendentes e concluido, que é a fase 'em observação'". Um item
// pendente (destino null) vira "em observação" quando alguém escolhe
// esse destino especificamente (ver ITEM_DESTINO_NEEDS_NOTE/
// TecnicoItemDestino.tsx), e "classificado" quando ganha qualquer outro
// destino de verdade.
type Phase = "pendentes" | "observacao" | "classificados";

function itemPhase(destino: ItemDestino | null): Phase {
  if (destino === null) return "pendentes";
  if (destino === ITEM_DESTINO_NEEDS_NOTE) return "observacao";
  return "classificados";
}

function buildHref(params: { view?: string; q?: string; store?: string }) {
  const sp = new URLSearchParams();
  if (params.view) sp.set("view", params.view);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  const qs = sp.toString();
  return qs ? `/assistencia/tecnico?${qs}` : "/assistencia/tecnico";
}

type DateGroup = { dateKey: string; label: string; requests: TecnicoRequestView[] };

// Organiza por dia de conclusão (o mesmo timestamp já usado pra ordenar a
// lista) -- pedido do Victor 20/08/2026: "a tela da equipe tecnica precisa
// estar organizada por data também". Mesmo padrão de agrupamento recolhível
// já usado em fila/page.tsx e NotificacoesList.tsx.
function groupByCompletedDate(requests: TecnicoRequestView[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const r of requests) {
    const dateKey = r.completedAt ? r.completedAt.slice(0, 10) : "sem_data";
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label =
        dateKey === "sem_data"
          ? "Sem data de conclusão"
          : new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
      group = { dateKey, label, requests: [] };
      groups.push(group);
    }
    group.requests.push(r);
  }
  return groups;
}

export default async function TecnicoHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; store?: string }>;
}) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const { view, q, store } = await searchParams;
  const phase: Phase = view === "observacao" ? "observacao" : view === "classificados" ? "classificados" : "pendentes";

  const [todos, stores] = await Promise.all([listRequestsForTecnico(), listStores()]);
  // Um chamado pode ter item pendente E item já classificado ao mesmo tempo
  // (troca com 2 produtos, cada um resolvido em momento diferente) -- por
  // isso o filtro é "tem pelo menos um item nessa fase", não "todos os
  // itens", e a mesma solicitação pode aparecer em mais de uma aba.
  let requests = todos.filter((r) => r.items.some((i) => itemPhase(i.destino) === phase));
  // Filtro por nome/loja/produto -- pedido do Victor 24/08/2026: "coloque
  // uma possibilidade de filtro por nome, loja, produto". Loja é um
  // <select> à parte (ver FilterSelect abaixo); nome do cliente e produto
  // dividem a mesma busca de texto, mesmo padrão de fila/page.tsx
  // ("Buscar por nº do chamado, cliente, produto...").
  if (store) {
    requests = requests.filter((r) => r.storeId === store);
  }
  if (q) {
    const needle = q.trim().toLowerCase();
    requests = requests.filter(
      (r) => (r.clientName ?? "").toLowerCase().includes(needle) || r.items.some((i) => i.product.toLowerCase().includes(needle))
    );
  }
  const groups = groupByCompletedDate(requests);

  return (
    <ToastProvider>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <RealtimeQueueRefresher />
        <AssistenciaHeader title={`Olá, ${tecnicoName}`} subtitle="Chamados que voltaram com o motorista, com produto pra dar destino.">
          <div className="flex items-center gap-4">
            <Link href="/assistencia" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              ← Voltar
            </Link>
            <form action={tecnicoSignOut}>
              <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Sair
              </button>
            </form>
          </div>
        </AssistenciaHeader>

        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              ["pendentes", "Pendentes"],
              ["observacao", "Em observação"],
              ["classificados", "Já classificados"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={buildHref({ view: value === "pendentes" ? undefined : value, q, store })}
              className="text-xs px-3 py-1.5 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: phase === value ? "var(--surface-1)" : "transparent",
                color: phase === value ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: phase === value ? 600 : 400,
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Filtro por nome/loja/produto -- pedido do Victor 24/08/2026. */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        </div>

        <form action="/assistencia/tecnico" method="GET" className="flex items-center gap-2 flex-wrap">
          {phase !== "pendentes" ? <input type="hidden" name="view" value={phase} /> : null}
          {store ? <input type="hidden" name="store" value={store} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por cliente ou produto…"
            className="rounded border px-3 py-2 text-sm flex-1 min-w-[200px]"
            style={{ borderColor: "var(--border)" }}
          />
          <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            Buscar
          </button>
          {q || store ? (
            <Link href={buildHref({ view: phase === "pendentes" ? undefined : phase })} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
              Limpar
            </Link>
          ) : null}
        </form>

        {requests.length === 0 ? (
          <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {phase === "classificados"
                ? "Nenhum item classificado ainda."
                : phase === "observacao"
                  ? "Nenhum item em observação no momento."
                  : "Nenhum item pendente no momento."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              // Recolhido por padrão -- achado do Victor 24/08/2026: "toda
              // vez que eu entrar em qualquer tela, as demandas agrupadas
              // precisam aparecer recolhidas".
              <details key={group.dateKey} className="group flex flex-col gap-2">
                <summary className="flex items-center gap-2 px-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span
                    className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
                    style={{ color: "var(--text-muted)" }}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <h3 className="text-sm font-bold capitalize" style={{ color: "var(--text-primary)" }}>
                    {group.label}
                  </h3>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ({group.requests.length})
                  </span>
                </summary>
                <div className="flex flex-col gap-3">
                  {group.requests.map((r: TecnicoRequestView) => (
                    <div key={r.id} className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2.5" style={{ borderBottom: "1px solid var(--gridline)" }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            #{r.ticketNumber}
                          </span>
                          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                          </span>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={
                              origemLabel(r.type) === "SAC"
                                ? { color: "var(--brand-orange)", background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)" }
                                : { color: "var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 15%, transparent)" }
                            }
                          >
                            {origemLabel(r.type)}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {r.storeName}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Concluído {formatDateTime(r.completedAt)} · {r.driverName ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap px-4 pt-2">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            Cliente: {r.clientName ?? "—"}
                            {r.clientCpf ? ` (${r.clientCpf})` : ""}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Solicitado por: {r.requestedByName ?? "—"}
                          </p>
                        </div>
                        <TecnicoNotificationModalButton request={r} />
                      </div>
                      <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
                        {r.items
                          .filter((i) => itemPhase(i.destino) === phase)
                          .map((i) => (
                            <div key={i.id} className="flex items-center justify-between gap-3 flex-wrap px-4 py-3">
                              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                {i.quantity > 1 ? `${i.quantity}x ` : ""}
                                {i.product}
                                {i.partCode ? <span style={{ color: "var(--text-muted)" }}> · {i.partCode}</span> : null}
                              </span>
                              <TecnicoItemDestino
                                itemId={i.id}
                                destino={i.destino}
                                destinoDefinidoPor={i.destinoDefinidoPor}
                                destinoDefinidoEm={i.destinoDefinidoEm}
                                destinoLojaName={i.destinoLojaName}
                                destinoObservacao={i.destinoObservacao}
                                stores={stores}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
