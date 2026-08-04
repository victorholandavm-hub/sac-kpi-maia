import Link from "next/link";
import { redirect } from "next/navigation";
import { getDriverSession, driverSignOut } from "@/app/assistencia/driver-actions";
import { listRequestsForDriver, type DriverRequestView } from "@/lib/serviceRequests";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { DriverRouteGroup } from "@/components/assistencia/DriverRouteGroup";
import { DATE_BUCKET_ORDER, DATE_BUCKET_LABELS, DATE_BUCKET_DEFAULT_OPEN, groupByDateBucket } from "@/lib/dateBuckets";
import { ROTAS, ROTA_LABELS, type Rota } from "@/lib/rotas";

// Dentro de cada dia, sub-agrupa por rota -- pedido do usuário depois de
// perceber que várias entregas do mesmo dia/rota apareciam soltas, uma
// embaixo da outra, sem nada juntando visualmente quem é do mesmo trajeto.
const NO_ROTA = "sem_rota" as const;
type RotaGroupKey = Rota | typeof NO_ROTA;
const ROTA_GROUP_ORDER: RotaGroupKey[] = [...ROTAS, NO_ROTA];
const ROTA_GROUP_LABELS: Record<RotaGroupKey, string> = { ...ROTA_LABELS, [NO_ROTA]: "Sem rota definida" };

function groupByRota(items: DriverRequestView[]): Map<RotaGroupKey, DriverRequestView[]> {
  const groups = new Map<RotaGroupKey, DriverRequestView[]>();
  for (const item of items) {
    const key = item.rota ?? NO_ROTA;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

export const dynamic = "force-dynamic";

export default async function MotoristaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const driverName = await getDriverSession();
  if (!driverName) {
    redirect("/assistencia/motorista/login");
  }

  const { view } = await searchParams;
  const showCompleted = view === "concluidas";

  const requests = await listRequestsForDriver(driverName, { onlyCompleted: showCompleted });
  const buckets = !showCompleted ? groupByDateBucket(requests, (r) => r.scheduledDate) : null;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title={`Olá, ${driverName}`} subtitle="Suas rotas de troca de produto e recolhimento.">
        <div className="flex items-center gap-4">
          <Link href="/assistencia" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
          <form action={driverSignOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/motorista"
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
          href="/assistencia/motorista?view=concluidas"
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
            {showCompleted ? "Nenhuma rota concluída ainda." : "Nenhuma rota em aberto no momento."}
          </p>
        </div>
      ) : buckets ? (
        DATE_BUCKET_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => {
          const rotaGroups = groupByRota(buckets.get(key)!);
          return (
            <details key={key} open={DATE_BUCKET_DEFAULT_OPEN[key]}>
              <summary className="text-base font-bold cursor-pointer py-1" style={{ color: "var(--text-primary)" }}>
                {DATE_BUCKET_LABELS[key]} ({buckets.get(key)!.length})
              </summary>
              <div className="flex flex-col gap-3 mt-2">
                {ROTA_GROUP_ORDER.filter((rotaKey) => (rotaGroups.get(rotaKey)?.length ?? 0) > 0).map((rotaKey) => (
                  <div key={rotaKey}>
                    {/* Só vale a pena rotular quando dá pra diferenciar de outro grupo no mesmo dia -- uma rota
                        sozinha no dia não precisa de rótulo repetindo o óbvio. */}
                    {rotaGroups.size > 1 ? (
                      <p className="text-xs font-semibold uppercase tracking-wide px-1 pb-1" style={{ color: "var(--text-secondary)" }}>
                        Rota: {ROTA_GROUP_LABELS[rotaKey]} ({rotaGroups.get(rotaKey)!.length})
                      </p>
                    ) : null}
                    <DriverRouteGroup items={rotaGroups.get(rotaKey)!} showCompleted={showCompleted} reorderable />
                  </div>
                ))}
              </div>
            </details>
          );
        })
      ) : (
        <DriverRouteGroup items={requests} showCompleted={showCompleted} reorderable={false} />
      )}
    </div>
  );
}
