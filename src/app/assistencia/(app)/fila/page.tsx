import Link from "next/link";
import { getProfile, redirectIfSac, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { listRequests, listStores, isRequestStatus, type ServiceRequestSummary, type RequestType } from "@/lib/serviceRequests";
import { listAssemblers, listDrivers } from "@/lib/payments";
import { getRotaWeekOverview, startOfRotaWeek } from "@/lib/rotas";
import { ASSISTENCIA_MANAGED_TYPES, DELIVERY_REQUEST_TYPES, STATUS_COLORS, OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaQueueGroup } from "@/components/assistencia/AssistenciaQueueGroup";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";

// listRequests só ordena por created_at (ver comentário lá) -- a ordem
// manual (assistencia_order) só faz sentido DENTRO de um grupo do mesmo dia
// (é onde reordenar aparece na tela), então aplica aqui, por grupo, depois de
// já ter separado por data. Grupos em si vêm sempre do mais novo pro mais
// antigo, direto pela dateKey (string YYYY-MM-DD ordena igual data).
function groupByDate(requests: ServiceRequestSummary[]) {
  const groups: { dateKey: string; label: string; items: ServiceRequestSummary[] }[] = [];
  for (const r of requests) {
    const date = new Date(r.createdAt);
    const dateKey = date.toISOString().slice(0, 10);
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      group = { dateKey, label, items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }
  groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
  for (const group of groups) {
    group.items.sort((a, b) => {
      if (a.assistenciaOrder !== null && b.assistenciaOrder !== null) return a.assistenciaOrder - b.assistenciaOrder;
      if (a.assistenciaOrder !== null) return -1;
      if (b.assistenciaOrder !== null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  return groups;
}

// Isolado numa função à parte (não direto no corpo do componente) --
// Date.now() é impuro, e o lint de pureza do React Compiler só reclama de
// chamada direta no corpo do componente, não dentro de uma função nomeada
// (mesmo padrão de timeAgo em admin/page.tsx).
function currentTimeMs(): number {
  return Date.now();
}

function buildHref(params: {
  status?: string;
  q?: string;
  page?: number;
  store?: string;
  assembler?: string;
  from?: string;
  to?: string;
  tab?: string;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  if (params.assembler) sp.set("assembler", params.assembler);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.tab) sp.set("tab", params.tab);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/assistencia/fila?${qs}` : "/assistencia/fila";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todas", value: null },
  { label: "Abertas", value: "aberta" },
  { label: "Em contato", value: "em_contato" },
  { label: "Em andamento", value: "em_andamento" },
  { label: "Concluídas", value: "concluida" },
  { label: "Canceladas", value: "cancelada" },
];

// Troca/entrega de produto (SAC) e envio de peça (assistência) saem no
// mesmo carro, na mesma rota do dia -- por isso ficam juntos numa aba só,
// visível tanto daqui quanto de /assistencia/sac (ver lá), cada lado vendo
// a rota inteira mesmo só gerenciando o que é seu (canManage já cuida
// disso). Não tem nada a ver com visita de montador (montagem/desmontagem/
// recolhimento/troca de peça/vistoria), que fica exclusiva na outra aba.
const VISITA_TYPES: RequestType[] = ASSISTENCIA_MANAGED_TYPES.filter((t) => t !== "envio_peca");
const ENTREGA_TYPES: RequestType[] = [...DELIVERY_REQUEST_TYPES];

export default async function AssistenciaQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; store?: string; assembler?: string; from?: string; to?: string; tab?: string }>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  const { status, q, page: pageParam, store, assembler, from, to, tab } = await searchParams;
  const filterStatus = isRequestStatus(status) ? status : undefined;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const dateFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const dateTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
  // Aba "Visitas" (padrão) x "Entregas" -- pros dois papéis que chegam
  // aqui (SAC nunca chega, ver redirectIfSac acima; notificação externa
  // continua só em /assistencia/sac, não é entrega de rota).
  const showPecas = tab === "pecas";
  const types = showPecas ? ENTREGA_TYPES : VISITA_TYPES;
  // Entrega de peça não tem montador (é motorista) -- ignora um valor de
  // "assembler" que tenha sobrado na URL de antes de trocar de aba, senão
  // filtra por um campo que essas linhas nunca preenchem e a lista some
  // inteira sem nenhuma explicação.
  const effectiveAssembler = showPecas ? undefined : assembler;
  // Montagem/desmontagem/vistoria de Mamanguape/Campina Grande (lojas com
  // montador próprio) só aparece pra admin e Antonio -- resto da equipe de
  // assistência vê a fila normalmente, só sem essas duas (ver
  // OWN_ASSEMBLER_STORE_IDS). Sem efeito na aba "Entregas", que nunca tem
  // esses tipos.
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const today = new Date().toISOString().slice(0, 10);
  const [{ items: requests, total, pageSize }, stores, assemblers, drivers, rotaOverview] = await Promise.all([
    listRequests({ status: filterStatus, q, page, storeId: store, assemblerName: effectiveAssembler, types, dateFrom, dateTo, excludeOwnAssemblerStoreIds }),
    listStores(),
    listAssemblers(),
    showPecas ? listDrivers() : Promise.resolve([]),
    showPecas ? getRotaWeekOverview(startOfRotaWeek(today), 14) : Promise.resolve([]),
  ]);
  const groups = groupByDate(requests);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Calculado uma vez aqui (Server Component, sem hooks) e repassado pra
  // AssistenciaQueueGroup -- lá dentro é "use client" com hooks, onde
  // chamar Date.now() direto no corpo do render quebra a regra de pureza.
  const now = currentTimeMs();

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher notifyOnInsert="Nova solicitação recebida!" />

      <div className="flex items-center gap-2">
        <Link
          href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo })}
          className="text-sm px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: !showPecas ? "var(--surface-1)" : "transparent",
            color: !showPecas ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: !showPecas ? 600 : 400,
          }}
        >
          Visitas
        </Link>
        <Link
          href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: "pecas" })}
          className="text-sm px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: showPecas ? "var(--surface-1)" : "transparent",
            color: showPecas ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: showPecas ? 600 : 400,
          }}
        >
          Entregas
        </Link>
      </div>

      {showPecas ? <RotaMotoristaDoDia today={today} initialOverview={rotaOverview} drivers={drivers} /> : null}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {FILTERS.map((f) => {
            const selected = (f.value ?? undefined) === filterStatus;
            const color = f.value ? STATUS_COLORS[f.value] ?? "var(--text-secondary)" : "var(--text-secondary)";
            return (
              <Link
                key={f.label}
                href={buildHref({ status: f.value ?? undefined, q, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined })}
                className="text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0"
                style={
                  f.value
                    ? {
                        color: "var(--text-primary)",
                        background: selected ? `color-mix(in srgb, ${color} 35%, var(--surface-1))` : "transparent",
                        fontWeight: selected ? 600 : 400,
                        border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${color} 40%, transparent)`}`,
                      }
                    : {
                        borderColor: "var(--border)",
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
        <Link
          href="/assistencia/nova-rapida"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova solicitação
        </Link>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} solicitaç{total === 1 ? "ão" : "ões"} encontrada{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        {/* Filtro de montador não existe na aba de entrega de peça -- lá é
            motorista, não montador (ver Motorista/Montador em
            AssistenciaQueueGroup.tsx). */}
        {showPecas ? null : <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />}
      </div>

      <form action="/assistencia/fila" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {effectiveAssembler ? <input type="hidden" name="assembler" value={effectiveAssembler} /> : null}
        {showPecas ? <input type="hidden" name="tab" value="pecas" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nº do chamado, cliente, produto, CPF, telefone ou código do pedido…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          De
          <input
            type="date"
            name="from"
            defaultValue={dateFrom ?? ""}
            className="rounded border px-2 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Até
          <input
            type="date"
            name="to"
            defaultValue={dateTo ?? ""}
            className="rounded border px-2 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
        {q || dateFrom || dateTo ? (
          <Link
            href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, tab: showPecas ? "pecas" : undefined })}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Limpar busca/data
          </Link>
        ) : null}
      </form>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma solicitação encontrada.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.dateKey} className="rounded-xl border" style={{ borderColor: "var(--brand-green)" }}>
            <div className="px-4 py-2 rounded-t-xl" style={{ background: "var(--brand-green)" }}>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--brand-green-ink)" }}>
                {group.label}
              </span>
            </div>
            <div style={{ background: "var(--surface-1)" }}>
              <AssistenciaQueueGroup items={group.items} reorderable now={now} />
            </div>
          </div>
        ))
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page - 1, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined })}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              ← Anterior
            </Link>
          ) : null}
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page + 1, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined })}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Próxima →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
