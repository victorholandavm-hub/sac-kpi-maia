import Link from "next/link";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { listStores } from "@/lib/serviceRequests";
import {
  listAllPedidos,
  listOpenPedidoEncomendaQueueIds,
  isPedidoEncomendaStatus,
  getChegadaCdDates,
  OPEN_PEDIDO_ENCOMENDA_STATUSES,
} from "@/lib/pedidosEncomenda";
import { encomendaCanAdvance, nextQuickAdvance } from "@/lib/dal";
import { INTERNAL_FABRICAS } from "@/lib/fabricas";
import { ROLE_LABELS, PEDIDO_ENCOMENDA_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { PedidoEncomendaFilaList } from "@/components/assistencia/PedidoEncomendaFilaList";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { FabricaProducaoView } from "@/components/assistencia/FabricaProducaoView";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listFabricaOuCdNotificationsAction } from "@/app/assistencia/notifications-actions";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { cdSignOut } from "@/app/assistencia/cd-actions";
import { fabricaSignOut } from "@/app/assistencia/fabrica-actions";
import { signOut } from "@/app/assistencia/actions";
import { switchRafaelToFabrica, switchRafaelToCd } from "@/app/assistencia/rafael-switch-actions";

export const dynamic = "force-dynamic";

function buildHref(params: { status?: string; store?: string; fornecedor?: string; q?: string; view?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.store) sp.set("store", params.store);
  if (params.fornecedor) sp.set("fornecedor", params.fornecedor);
  if (params.q) sp.set("q", params.q);
  if (params.view) sp.set("view", params.view);
  const qs = sp.toString();
  return qs ? `/assistencia/encomendas/fila?${qs}` : "/assistencia/encomendas/fila";
}

const FORNECEDOR_FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  ...INTERNAL_FABRICAS.map((f) => ({ label: f.nome, value: f.id })),
  { label: "Externo", value: "externa" },
];

// "Em andamento" (value null, padrão -- nem aparece na URL) é a fila de
// verdade: só o que ainda não chegou em entregue/cancelado/negado. "Todos"
// é filtro explícito (?status=todos), pra quem quer ver o histórico
// completo -- sem essa distinção, pedido antigo já concluído (bem mais
// numeroso com o tempo) enchia a tela padrão e empurrava pra baixo o que
// precisa de ação agora.
const FILTERS: { label: string; value: string | null }[] = [
  { label: "Em andamento", value: null },
  { label: "Todos", value: "todos" },
  { label: "Solicitado", value: "solicitado" },
  { label: "Em produção", value: "em_producao" },
  { label: "Enviado para o CD", value: "pronto_para_expedicao" },
  { label: "Recebido no CD", value: "recebido_cd" },
  { label: "Em carga", value: "em_carga" },
  { label: "Faturado", value: "faturado" },
  { label: "Entregue", value: "entregue" },
  { label: "Cancelado", value: "cancelado" },
  { label: "Negado", value: "negado" },
];

export default async function EncomendasQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string; fornecedor?: string; q?: string; view?: string }>;
}) {
  // Aceita sessão PIN de CD/fábrica ou perfil Supabase Auth de
  // admin/assistência — ver src/lib/encomendaAuth.ts. Página fora do grupo
  // (app) porque CD/fábrica não têm sessão Supabase Auth.
  const actor = await requireEncomendaActor();
  const { status, store, fornecedor, q, view } = await searchParams;
  const filterStatus = isPedidoEncomendaStatus(status) ? status : undefined;
  const showAllStatuses = status === "todos";
  // Visão Fábrica -- pedido do Victor 22/08/2026: "Crie um botão no topo
  // [Alternar para Visão Fábrica] que consolida os itens por especificação
  // técnica... enquanto o vendedor precisa ver a ordem por pedido
  // individual". Só troca como os MESMOS `pedidos` já filtrados são
  // exibidos (ver FabricaProducaoView.tsx) -- nenhum filtro/dado novo.
  const fabricaView = view === "fabrica";

  // Fábrica nunca enxerga pedido externo -- só o(s) da(s) fábrica(s)
  // própria(s) que é dela (a maioria tem uma só; fabricaId nulo, caso do
  // Rafael, dá acesso às duas -- ver EncomendaActor.fabricaId em
  // encomendaAuth.ts). Não depende do filtro escolhido na tela, que nem
  // aparece pra esse papel (ver FORNECEDOR_FILTERS abaixo). Pra
  // CD/admin/assistência, o filtro vem da query string.
  const fabricaIdFilter =
    actor.role === "fabrica" ? (actor.fabricaId ?? undefined) : fornecedor && fornecedor !== "externa" ? fornecedor : undefined;
  const fornecedorTipoFilter =
    actor.role === "fabrica"
      ? ("fabrica_interna" as const)
      : fornecedor === "externa"
        ? ("fabrica_externa" as const)
        : undefined;

  const [pedidos, allForCounts, stores, queueIds] = await Promise.all([
    listAllPedidos({
      status: filterStatus,
      onlyOpen: !filterStatus && !showAllStatuses,
      storeId: store,
      fabricaId: fabricaIdFilter,
      fornecedorTipo: fornecedorTipoFilter,
      q,
    }),
    // Contagem por status pros chips do topo -- pedido do Victor 22/08/2026:
    // "torne-os em Chips com Contadores Visuais... A fábrica clica
    // diretamente no chip Em Produção pra focar". Mesmos filtros de
    // loja/fornecedor/busca da lista principal, só sem o filtro de status
    // (senão toda contagem menos a do pill ativo ficaria zerada).
    listAllPedidos({ storeId: store, fabricaId: fabricaIdFilter, fornecedorTipo: fornecedorTipoFilter, q }),
    listStores(),
    listOpenPedidoEncomendaQueueIds(),
  ]);
  const statusCounts = new Map<string, number>();
  for (const p of allForCounts) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  const openCount = allForCounts.filter((p) => (OPEN_PEDIDO_ENCOMENDA_STATUSES as string[]).includes(p.status)).length;
  // Depende dos ids de `pedidos` acima, então não dá pra entrar no mesmo
  // Promise.all -- ver getChegadaCdDates (troca "Prazo p/ CD" por "Chegou no
  // CD: <data>" assim que o CD confirma o pedido, na lista abaixo).
  const chegadaCdByPedido = Object.fromEntries(await getChegadaCdDates(pedidos.map((p) => p.id)));
  const queuePosition: [string, number][] = queueIds.map((id, i) => [id, i + 1]);
  const actionNeededIds = new Set(
    pedidos
      .filter((p) => encomendaCanAdvance({ role: actor.role, fabricaId: actor.fabricaId }, { status: p.status, fornecedorTipo: p.fornecedorTipo, fabricaId: p.fabricaId }))
      .map((p) => p.id)
  );
  // Botão "Avançar" direto na linha (ver PedidoEncomendaFilaList.tsx) --
  // pedido do Victor 25/08/2026: "Botão direto para alterar status ou ver
  // detalhes sem expandir o card". null quando não há uma transição única
  // e segura pra oferecer (ver nextQuickAdvance, dal.ts).
  const quickAdvanceByPedido: Record<string, string | null> = Object.fromEntries(
    pedidos.map((p) => [
      p.id,
      nextQuickAdvance(
        { role: actor.role, fabricaId: actor.fabricaId },
        { status: p.status, fornecedorTipo: p.fornecedorTipo, fabricaId: p.fabricaId, prazoFabricaCd: p.prazoFabricaCd, prazoCdLoja: p.prazoCdLoja }
      ),
    ])
  );
  const canBulkAdvance = actor.role === "fabrica" || actor.role === "admin" || actor.role === "assistencia";
  const showFornecedorFilter = actor.role === "cd" || actor.role === "admin" || actor.role === "assistencia";

  const signOutAction = actor.role === "cd" ? cdSignOut : actor.role === "fabrica" ? fabricaSignOut : signOut;
  const isRafael = actor.name.toLowerCase() === "rafael";

  return (
    <ToastProvider>
    {/* Largura total -- pedido do Victor 31/08/2026: "faltou só a tela
        de fila de encomendas" (fora do grupo (app), CD/fábrica não têm
        sessão Supabase Auth -- ver comentário em requireEncomendaActor
        acima -- por isso não pegou a mudança de (app)/layout.tsx).
        Mesmo AssistenciaHeader de sempre, só o container que deixou de
        limitar em max-w-4xl. */}
    <div className="w-full p-6 flex flex-col gap-4 min-w-0">
      <RealtimeQueueRefresher
        table="pedidos_encomenda"
        eventsTable="pedido_encomenda_events"
        notifyOnInsert="Novo pedido de encomenda recebido!"
      />

      <AssistenciaHeader title="Fila de encomendas" subtitle={`${actor.name} · ${ROLE_LABELS[actor.role] ?? actor.role}`}>
        <div className="flex items-center gap-4">
          {actor.role === "admin" || actor.role === "assistencia" ? (
            <Link href="/assistencia/inicio" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              ← Voltar
            </Link>
          ) : null}
          {actor.role === "cd" || actor.role === "fabrica" ? (
            <NotificationBell fetchAction={listFabricaOuCdNotificationsAction} storageKey={`${actor.role}-${actor.fabricaId ?? ""}`} />
          ) : null}
          {actor.role === "cd" || actor.role === "fabrica" ? (
            <Link href="/assistencia/encomendas/solicitar" className="text-sm underline" style={{ color: "var(--brand-green)" }}>
              + Novo pedido
            </Link>
          ) : null}
          {actor.role === "cd" || actor.role === "admin" || actor.role === "assistencia" ? (
            <Link href="/assistencia/encomendas/fornecedores" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Pedidos a fornecedores
            </Link>
          ) : null}
          {isRafael && actor.role === "cd" ? (
            <form action={switchRafaelToFabrica}>
              <button type="submit" className="text-sm underline" style={{ color: "var(--brand-green)" }}>
                Trocar pra Fábrica
              </button>
            </form>
          ) : null}
          {isRafael && actor.role === "fabrica" ? (
            <form action={switchRafaelToCd}>
              <button type="submit" className="text-sm underline" style={{ color: "var(--brand-green)" }}>
                Trocar pra CD
              </button>
            </form>
          ) : null}
          <form action={signOutAction}>
            <button type="submit" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      {/* Barra de filtros/busca consolidada e fixa (sticky) -- pedido do
          Victor 25/08/2026 (reforma da Fila de Encomendas): "Consolide o
          campo de Busca, o filtro de Lojas e os Chips de Status com
          contadores... em uma barra superior fixa (sticky header)".
          Fundo opaco (var(--background), a mesma cor do body) -- sem
          isso o conteúdo por trás aparece por cima ao rolar. Fornecedor
          (filtro extra, só pra CD/admin/assistência) e o botão "visão
          fábrica" ficam FORA da barra fixa -- o pedido citou só busca +
          loja + chips, esses dois não fazem parte da consolidação. */}
      <div className="sticky top-0 z-20 flex flex-col gap-2 py-2" style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {FILTERS.map((f) => {
            const activeValue = showAllStatuses ? "todos" : (filterStatus ?? null);
            const selected = (f.value ?? null) === activeValue;
            const isStatusPill = !!f.value && f.value !== "todos";
            // Contador visual em cada chip -- pedido do Victor 22/08/2026:
            // "torne-os em Chips com Contadores Visuais (ex: Em Produção
            // (14))". "Em andamento" soma os status ainda abertos, "Todos" é
            // o total, cada status individual usa a própria contagem.
            const count = f.value === null ? openCount : f.value === "todos" ? allForCounts.length : (statusCounts.get(f.value) ?? 0);
            return (
              <FilterPill
                key={f.label}
                href={buildHref({ status: f.value ?? undefined, store, fornecedor, q, view })}
                label={`${f.label} (${count})`}
                selected={selected}
                color={isStatusPill ? PEDIDO_ENCOMENDA_STATUS_COLORS[f.value as string] : undefined}
              />
            );
          })}
        </div>

        <form action="/assistencia/encomendas/fila" method="GET" className="flex items-center gap-2 flex-wrap">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {fornecedor ? <input type="hidden" name="fornecedor" value={fornecedor} /> : null}
          {view ? <input type="hidden" name="view" value={view} /> : null}
          <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nº do pedido, cliente ou produto…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm flex-1 min-w-[240px]"
          />
          <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100">
            Buscar
          </button>
          {q ? (
            <Link href={buildHref({ status, store, fornecedor, view })} className="text-xs underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Limpar busca
            </Link>
          ) : null}
        </form>
      </div>

      {showFornecedorFilter ? (
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {FORNECEDOR_FILTERS.map((f) => (
            <FilterPill
              key={f.label}
              href={buildHref({ status, store, fornecedor: f.value ?? undefined, q, view })}
              label={f.label}
              selected={(f.value ?? undefined) === fornecedor}
            />
          ))}
        </div>
      ) : null}

      {/* Alternar para Visão Fábrica -- pedido do Victor 22/08/2026: "Crie
          um botão no topo [Alternar para Visão Fábrica]... A fábrica
          precisa ver o total do lote para corte e estofamento, enquanto o
          vendedor precisa ver a ordem por pedido individual". Só troca a
          forma de exibir os MESMOS pedidos já filtrados -- ver
          FabricaProducaoView.tsx. */}
      <Link
        href={buildHref({ status, store, fornecedor, q, view: fabricaView ? undefined : "fabrica" })}
        className={`text-sm px-3.5 py-2 rounded-lg font-medium whitespace-nowrap self-start transition-all duration-200 ${
          fabricaView ? "text-white shadow-sm hover:brightness-110" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100"
        }`}
        style={fabricaView ? { background: "var(--brand-orange)" } : undefined}
      >
        {fabricaView ? "📋 Voltar para visão por pedido" : "🏭 Alternar para visão fábrica"}
      </Link>

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum pedido encontrado.</p>
        </div>
      ) : fabricaView ? (
        <FabricaProducaoView pedidos={pedidos} />
      ) : (
        <PedidoEncomendaFilaList
          pedidos={pedidos}
          queuePosition={queuePosition}
          actionNeededIds={actionNeededIds}
          canBulkAdvance={canBulkAdvance}
          chegadaCdByPedido={chegadaCdByPedido}
          quickAdvanceByPedido={quickAdvanceByPedido}
        />
      )}
    </div>
    </ToastProvider>
  );
}
