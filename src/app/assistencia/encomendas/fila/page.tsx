import Link from "next/link";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { listStores } from "@/lib/serviceRequests";
import { listAllPedidos, listOpenPedidoEncomendaQueueIds, isPedidoEncomendaStatus } from "@/lib/pedidosEncomenda";
import { encomendaCanAdvance } from "@/lib/dal";
import { INTERNAL_FABRICAS } from "@/lib/fabricas";
import { ROLE_LABELS, PEDIDO_ENCOMENDA_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { PedidoEncomendaFilaList } from "@/components/assistencia/PedidoEncomendaFilaList";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { cdSignOut } from "@/app/assistencia/cd-actions";
import { fabricaSignOut } from "@/app/assistencia/fabrica-actions";
import { signOut } from "@/app/assistencia/actions";

export const dynamic = "force-dynamic";

function buildHref(params: { status?: string; store?: string; fornecedor?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.store) sp.set("store", params.store);
  if (params.fornecedor) sp.set("fornecedor", params.fornecedor);
  const qs = sp.toString();
  return qs ? `/assistencia/encomendas/fila?${qs}` : "/assistencia/encomendas/fila";
}

const FORNECEDOR_FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  ...INTERNAL_FABRICAS.map((f) => ({ label: f.nome, value: f.id })),
  { label: "Externo", value: "externa" },
];

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: "Solicitado", value: "solicitado" },
  { label: "Em produção", value: "em_producao" },
  { label: "Enviado para o CD", value: "pronto_para_expedicao" },
  { label: "Em carga", value: "em_carga" },
  { label: "Faturado", value: "faturado" },
  { label: "Entregue", value: "entregue" },
  { label: "Cancelado", value: "cancelado" },
  { label: "Negado", value: "negado" },
];

export default async function EncomendasQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string; fornecedor?: string }>;
}) {
  // Aceita sessão PIN de CD/fábrica ou perfil Supabase Auth de
  // admin/assistência — ver src/lib/encomendaAuth.ts. Página fora do grupo
  // (app) porque CD/fábrica não têm sessão Supabase Auth.
  const actor = await requireEncomendaActor();
  const { status, store, fornecedor } = await searchParams;
  const filterStatus = isPedidoEncomendaStatus(status) ? status : undefined;

  // Fábrica só enxerga pedidos da própria fábrica (nunca externos, nunca da
  // outra fábrica interna) -- não depende do filtro escolhido na tela, que
  // nem aparece pra esse papel (ver FORNECEDOR_FILTERS abaixo). Pra
  // CD/admin/assistência, o filtro vem da query string.
  const fabricaIdFilter =
    actor.role === "fabrica" ? (actor.fabricaId ?? undefined) : fornecedor && fornecedor !== "externa" ? fornecedor : undefined;
  const fornecedorTipoFilter = actor.role !== "fabrica" && fornecedor === "externa" ? ("fabrica_externa" as const) : undefined;

  const [pedidos, stores, queueIds] = await Promise.all([
    listAllPedidos({ status: filterStatus, storeId: store, fabricaId: fabricaIdFilter, fornecedorTipo: fornecedorTipoFilter }),
    listStores(),
    listOpenPedidoEncomendaQueueIds(),
  ]);
  const queuePosition: [string, number][] = queueIds.map((id, i) => [id, i + 1]);
  const actionNeededIds = new Set(
    pedidos
      .filter((p) => encomendaCanAdvance({ role: actor.role, fabricaId: actor.fabricaId }, { status: p.status, fornecedorTipo: p.fornecedorTipo, fabricaId: p.fabricaId }))
      .map((p) => p.id)
  );
  const canBulkAdvance = actor.role === "fabrica" || actor.role === "admin" || actor.role === "assistencia";
  const showFornecedorFilter = actor.role === "cd" || actor.role === "admin" || actor.role === "assistencia";

  const signOutAction = actor.role === "cd" ? cdSignOut : actor.role === "fabrica" ? fabricaSignOut : signOut;

  return (
    <ToastProvider>
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher
        table="pedidos_encomenda"
        eventsTable="pedido_encomenda_events"
        notifyOnInsert="Novo pedido de encomenda recebido!"
      />

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
        {FILTERS.map((f) => {
          const selected = (f.value ?? undefined) === filterStatus;
          const color = f.value ? PEDIDO_ENCOMENDA_STATUS_COLORS[f.value] ?? "var(--text-secondary)" : "var(--text-secondary)";
          return (
            <Link
              key={f.label}
              href={buildHref({ status: f.value ?? undefined, store, fornecedor })}
              className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
              style={
                f.value
                  ? {
                      color,
                      background: selected ? `color-mix(in srgb, ${color} 18%, transparent)` : "transparent",
                      fontWeight: selected ? 600 : 400,
                      border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${color} 40%, transparent)`}`,
                    }
                  : {
                      border: "1px solid var(--border)",
                      background: selected ? "var(--surface-1)" : "transparent",
                      color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                      fontWeight: selected ? 600 : 400,
                    }
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {showFornecedorFilter ? (
        <div className="flex items-center gap-2 flex-wrap">
          {FORNECEDOR_FILTERS.map((f) => {
            const selected = (f.value ?? undefined) === fornecedor;
            return (
              <Link
                key={f.label}
                href={buildHref({ status, store, fornecedor: f.value ?? undefined })}
                className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
                style={{
                  border: "1px solid var(--border)",
                  background: selected ? "var(--surface-1)" : "transparent",
                  color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      ) : null}

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
        <PedidoEncomendaFilaList
          pedidos={pedidos}
          queuePosition={queuePosition}
          actionNeededIds={actionNeededIds}
          canBulkAdvance={canBulkAdvance}
        />
      )}
    </div>
    </ToastProvider>
  );
}
