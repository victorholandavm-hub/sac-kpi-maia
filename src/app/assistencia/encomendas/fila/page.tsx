import Link from "next/link";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { listStores } from "@/lib/serviceRequests";
import { listAllPedidos, listOpenPedidoEncomendaQueueIds, isPedidoEncomendaStatus } from "@/lib/pedidosEncomenda";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { PedidoEncomendaStatusBadge } from "@/components/assistencia/PedidoEncomendaStatusBadge";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { cdSignOut } from "@/app/assistencia/cd-actions";
import { fabricaSignOut } from "@/app/assistencia/fabrica-actions";
import { signOut } from "@/app/assistencia/actions";

export const dynamic = "force-dynamic";

// Espelha ROLE_CAN_ADVANCE (PedidoEncomendaActions.tsx) -- usado só pra
// destacar na fila os pedidos que dependem de uma ação do papel logado,
// sem duplicar a regra de verdade (essa continua em requireEncomendaAction,
// dal.ts).
const ROLE_ACTION_STATUSES: Record<string, string[]> = {
  fabrica: ["solicitado", "em_producao"],
  cd: ["pronto_para_expedicao", "em_carga", "faturado"],
};

function buildHref(params: { status?: string; store?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.store) sp.set("store", params.store);
  const qs = sp.toString();
  return qs ? `/assistencia/encomendas/fila?${qs}` : "/assistencia/encomendas/fila";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: "Solicitado", value: "solicitado" },
  { label: "Em produção", value: "em_producao" },
  { label: "Pronto p/ expedição", value: "pronto_para_expedicao" },
  { label: "Em carga", value: "em_carga" },
  { label: "Faturado", value: "faturado" },
  { label: "Entregue", value: "entregue" },
  { label: "Cancelado", value: "cancelado" },
  { label: "Negado", value: "negado" },
];

export default async function EncomendasQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string }>;
}) {
  // Aceita sessão PIN de CD/fábrica ou perfil Supabase Auth de
  // admin/assistência — ver src/lib/encomendaAuth.ts. Página fora do grupo
  // (app) porque CD/fábrica não têm sessão Supabase Auth.
  const actor = await requireEncomendaActor();
  const { status, store } = await searchParams;
  const filterStatus = isPedidoEncomendaStatus(status) ? status : undefined;

  const [pedidos, stores, queueIds] = await Promise.all([
    listAllPedidos({ status: filterStatus, storeId: store }),
    listStores(),
    listOpenPedidoEncomendaQueueIds(),
  ]);
  const queuePosition = new Map(queueIds.map((id, i) => [id, i + 1]));
  const actionStatuses = ROLE_ACTION_STATUSES[actor.role] ?? [];

  const signOutAction = actor.role === "cd" ? cdSignOut : actor.role === "fabrica" ? fabricaSignOut : signOut;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher table="pedidos_encomenda" eventsTable="pedido_encomenda_events" />

      <AssistenciaHeader title="Fila de encomendas" subtitle={`${actor.name} · ${ROLE_LABELS[actor.role] ?? actor.role}`}>
        <div className="flex items-center gap-4">
          {actor.role === "cd" || actor.role === "fabrica" ? (
            <Link href="/assistencia/encomendas/solicitar" className="text-sm underline" style={{ color: "var(--brand-green)" }}>
              + Novo pedido
            </Link>
          ) : null}
          {actor.role === "cd" || actor.role === "admin" || actor.role === "assistencia" ? (
            <Link href="/assistencia/encomendas/fornecedores" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Pedidos a fornecedores
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={buildHref({ status: f.value ?? undefined, store })}
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: (f.value ?? undefined) === filterStatus ? "var(--surface-1)" : "transparent",
              color: (f.value ?? undefined) === filterStatus ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: (f.value ?? undefined) === filterStatus ? 600 : 400,
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum pedido encontrado.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {pedidos.map((p) => {
              const needsAction = actionStatuses.includes(p.status);
              return (
              <Link
                key={p.id}
                href={`/assistencia/encomendas/fila/${p.id}`}
                className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80"
                style={needsAction ? { borderLeft: "4px solid var(--status-warning)" } : undefined}
              >
                <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                  {queuePosition.get(p.id) ? (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap self-start"
                      style={{ color: "#fff", background: "var(--brand-orange)" }}
                    >
                      {queuePosition.get(p.id)}º na fila
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      #{p.pedidoNumber}
                    </span>
                    <PedidoEncomendaStatusBadge status={p.status} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {p.storeName}
                    </span>
                  </div>
                  <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                    {p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}
                  </p>
                  {p.clienteCodigo ? (
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      Cliente: {p.clienteCodigo}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{new Date(p.createdAt).toLocaleString("pt-BR")}</span>
                  <span>Pedido por {p.requestedByName}</span>
                  {p.prazoEntrega ? (
                    <span style={{ color: "var(--status-good)", fontWeight: 600 }}>
                      Previsão: {new Date(`${p.prazoEntrega}T00:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                  {p.carga ? <span>Carga {p.carga}</span> : null}
                  {p.nfE ? <span>NF-e {p.nfE}</span> : null}
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
