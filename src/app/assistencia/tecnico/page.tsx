import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession, tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { listRequestsForTecnico, type TecnicoRequestView } from "@/lib/tecnicos";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { TecnicoItemDestino } from "@/components/assistencia/TecnicoItemDestino";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
            {requests.map((r: TecnicoRequestView) => (
              <div key={r.id} className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
                <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2.5" style={{ borderBottom: "1px solid var(--gridline)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      #{r.ticketNumber}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {r.storeName}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Concluído {formatDateTime(r.completedAt)} · {r.driverName ?? "—"}
                  </span>
                </div>
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
        )}
      </div>
    </ToastProvider>
  );
}
