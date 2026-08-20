import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession, tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { listRequestsForTecnico, type TecnicoRequestView } from "@/lib/tecnicos";
import { REQUEST_TYPE_LABELS, SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { TecnicoItemDestino } from "@/components/assistencia/TecnicoItemDestino";

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
  searchParams: Promise<{ view?: string }>;
}) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const { view } = await searchParams;
  const showClassificados = view === "classificados";

  const todos = await listRequestsForTecnico();
  // Um chamado pode ter item pendente E item já classificado ao mesmo tempo
  // (troca com 2 produtos, cada um resolvido em momento diferente) -- por
  // isso o filtro é "tem pelo menos um item nesse estado", não "todos os
  // itens", e a mesma solicitação pode aparecer nas duas abas.
  const requests = todos.filter((r) => r.items.some((i) => (showClassificados ? i.destino !== null : i.destino === null)));
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

        <div className="flex items-center gap-2">
          <Link
            href="/assistencia/tecnico"
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: !showClassificados ? "var(--surface-1)" : "transparent",
              color: !showClassificados ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: !showClassificados ? 600 : 400,
            }}
          >
            Pendentes
          </Link>
          <Link
            href="/assistencia/tecnico?view=classificados"
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: showClassificados ? "var(--surface-1)" : "transparent",
              color: showClassificados ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: showClassificados ? 600 : 400,
            }}
          >
            Já classificados
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {showClassificados ? "Nenhum item classificado ainda." : "Nenhum item pendente no momento."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <details key={group.dateKey} className="group flex flex-col gap-2" open>
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
                      <p className="text-xs px-4 pt-2" style={{ color: "var(--text-muted)" }}>
                        Solicitado por: {r.requestedByName ?? "—"}
                      </p>
                      <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
                        {r.items
                          .filter((i) => (showClassificados ? i.destino !== null : i.destino === null))
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
