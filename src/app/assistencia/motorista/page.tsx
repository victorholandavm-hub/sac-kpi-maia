import Link from "next/link";
import { redirect } from "next/navigation";
import { getDriverSession, driverSignOut } from "@/app/assistencia/driver-actions";
import { listRequestsForDriver, type DriverRequestView } from "@/lib/serviceRequests";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { DriverRouteGroup } from "@/components/assistencia/DriverRouteGroup";
import { DATE_BUCKET_ORDER, DATE_BUCKET_LABELS, groupByDateBucket } from "@/lib/dateBuckets";
import { ROTAS, ROTA_LABELS, type Rota } from "@/lib/rotas";

// Rota por fora, data por dentro -- pedido do Victor 18/08/2026: mesma
// ordem de hierarquia da fila da assistência (ver groupByRota em
// fila/page.tsx). Antes era o contrário (data por fora, rota por dentro).
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
  const rotaGroups = !showCompleted ? groupByRota(requests) : null;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title={`Olá, ${driverName}`} subtitle="Suas rotas de troca/entrega de produto e envio de peça.">
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
      ) : rotaGroups ? (
        ROTA_GROUP_ORDER.filter((rotaKey) => (rotaGroups.get(rotaKey)?.length ?? 0) > 0).map((rotaKey) => {
          const items = rotaGroups.get(rotaKey)!;
          const buckets = groupByDateBucket(items, (r) => r.scheduledDate);
          // Abre sozinho quando tem algo atrasado ou de hoje -- é o que
          // precisa de atenção imediata (mesmo critério que antes decidia
          // abrir o balde de data; agora é a rota que abre/fecha).
          const hasUrgent = (buckets.get("atrasado")?.length ?? 0) > 0 || (buckets.get("hoje")?.length ?? 0) > 0;
          const bucketKeysPresent = DATE_BUCKET_ORDER.filter((k) => (buckets.get(k)?.length ?? 0) > 0);
          return (
            <details key={rotaKey} open={hasUrgent}>
              <summary className="text-base font-bold cursor-pointer py-1" style={{ color: "var(--text-primary)" }}>
                Rota: {ROTA_GROUP_LABELS[rotaKey]} ({items.length})
              </summary>
              <div className="flex flex-col gap-3 mt-2">
                {bucketKeysPresent.map((bucketKey) => (
                  <div key={bucketKey}>
                    {/* Só vale a pena rotular quando dá pra diferenciar de outro balde na mesma rota -- uma data
                        sozinha na rota não precisa de rótulo repetindo o óbvio. */}
                    {bucketKeysPresent.length > 1 ? (
                      <p className="text-xs font-semibold uppercase tracking-wide px-1 pb-1" style={{ color: "var(--text-secondary)" }}>
                        {DATE_BUCKET_LABELS[bucketKey]} ({buckets.get(bucketKey)!.length})
                      </p>
                    ) : null}
                    <DriverRouteGroup items={buckets.get(bucketKey)!} showCompleted={showCompleted} reorderable />
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
