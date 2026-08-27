import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getDriverSession,
  driverSignOut,
  driverSetRotaDriverAssignment,
  driverAddRotaExtra,
  driverRemoveRotaExtra,
  driverGetRotaDriverAssignments,
} from "@/app/assistencia/driver-actions";
import { listRequestsForDriver, type DriverRequestView } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { DriverRouteGroup } from "@/components/assistencia/DriverRouteGroup";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";
import { DATE_BUCKET_ORDER, DATE_BUCKET_LABELS, groupByDateBucket } from "@/lib/dateBuckets";
import { ROTAS, ROTA_LABELS, getRotaWeekOverview, JP_DEFAULT_DRIVER, type Rota } from "@/lib/rotas";
import { DISPATCH_SUPERVISOR_DRIVERS } from "@/lib/assistenciaLabels";

// Rota e data no mesmo cabeçalho, lado a lado -- pedido do Victor
// 18/08/2026: "a data... tem que aparecer ao lado da rota, não dentro".
// Cada grupo é um par rota+balde de data (ex.: "Rota Sul · Hoje"), não uma
// rota com sub-grupos de data aninhados. Abre sozinho quando tem algo
// atrasado ou de hoje.
const NO_ROTA = "sem_rota" as const;
type RotaGroupKey = Rota | typeof NO_ROTA;
const ROTA_GROUP_ORDER: RotaGroupKey[] = [...ROTAS, NO_ROTA];
const ROTA_GROUP_LABELS: Record<RotaGroupKey, string> = { ...ROTA_LABELS, [NO_ROTA]: "Sem rota definida" };

type RotaDateGroup = { key: string; label: string; open: boolean; items: DriverRequestView[] };

function groupByRotaAndBucket(items: DriverRequestView[]): RotaDateGroup[] {
  const groups: RotaDateGroup[] = [];
  for (const rotaKey of ROTA_GROUP_ORDER) {
    const rotaItems = items.filter((item) => (item.rota ?? NO_ROTA) === rotaKey);
    if (rotaItems.length === 0) continue;
    const buckets = groupByDateBucket(rotaItems, (r) => r.scheduledDate);
    for (const bucketKey of DATE_BUCKET_ORDER) {
      const bucketItems = buckets.get(bucketKey);
      if (!bucketItems || bucketItems.length === 0) continue;
      groups.push({
        key: `${rotaKey}_${bucketKey}`,
        label: `Rota: ${ROTA_GROUP_LABELS[rotaKey]} · ${DATE_BUCKET_LABELS[bucketKey]}`,
        open: bucketKey === "atrasado" || bucketKey === "hoje",
        items: bucketItems,
      });
    }
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
  // Everton/Samuel (expedição) veem a rota de todo mundo, não só a própria --
  // ver DISPATCH_SUPERVISOR_DRIVERS (assistenciaLabels.ts). Sem reordenar
  // (não são eles quem tá na rua) e com o nome do motorista de cada uma
  // visível.
  const isSupervisor = DISPATCH_SUPERVISOR_DRIVERS.includes(driverName);

  const requests = await listRequestsForDriver(driverName, { onlyCompleted: showCompleted, viewAll: isSupervisor });
  const groups = !showCompleted ? groupByRotaAndBucket(requests) : null;

  // Painel "Motorista do dia" (mesmo componente de /assistencia/sac/notificacoes,
  // ver RotaMotoristaDoDia.tsx) + seleção em bloco pra trocar rota (ver
  // DriverRouteGroup) -- só pra quem organiza a expedição, pedido do Victor
  // 19/08/2026: "conseguir trocar uma notificação de uma rota pra outra" e
  // "adicionar rota e colocar o motorista pra aquela rota extra". Só hoje +
  // amanhã aqui (pedido do Victor, mesma data: "não precisa aparecer todas
  // as rotas da semana... pra deixar os botões maiores") -- diferente da
  // versão cheia (semana + seguinte) que assistência/SAC continuam vendo em
  // /assistencia/fila e /assistencia/sac/notificacoes.
  const today = new Date().toISOString().slice(0, 10);
  const [rotaOverview, drivers] = isSupervisor ? await Promise.all([getRotaWeekOverview(today, 2), listDrivers()]) : [null, []];

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title={`Olá, ${driverName}`}
        subtitle={isSupervisor ? "Todas as rotas de troca/entrega de produto e envio de peça." : "Suas rotas de troca/entrega de produto e envio de peça."}
      >
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

      {isSupervisor && rotaOverview ? (
        <RotaMotoristaDoDia
          today={today}
          initialOverview={rotaOverview}
          drivers={drivers}
          compact
          defaultDriver={JP_DEFAULT_DRIVER}
          actions={{
            setRotaDriverAssignment: driverSetRotaDriverAssignment,
            addRotaExtra: driverAddRotaExtra,
            removeRotaExtra: driverRemoveRotaExtra,
            getRotaDriverAssignments: driverGetRotaDriverAssignments,
          }}
        />
      ) : null}

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
      ) : groups ? (
        groups.map((group) => (
          <details key={group.key} open={group.open}>
            <summary className="text-base font-bold cursor-pointer py-1" style={{ color: "var(--text-primary)" }}>
              {group.label} ({group.items.length})
            </summary>
            <div className="mt-2">
              <DriverRouteGroup
                items={group.items}
                showCompleted={showCompleted}
                reorderable={!isSupervisor}
                showDriverName={isSupervisor}
                canMoveRota={isSupervisor}
              />
            </div>
          </details>
        ))
      ) : (
        <DriverRouteGroup
          items={requests}
          showCompleted={showCompleted}
          reorderable={false}
          showDriverName={isSupervisor}
          canMoveRota={isSupervisor}
        />
      )}
    </div>
  );
}
