import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listRequests, listRequestsScheduledOn, listStores, isRequestStatus } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { getRotaWeekOverview, startOfRotaWeek, ROTA_CITY, JP_DEFAULT_DRIVER } from "@/lib/rotas";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { EntregasWeekGroups } from "@/components/assistencia/EntregasWeekGroups";
import { EntregasKanbanHoje } from "@/components/assistencia/EntregasKanbanHoje";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { isDeliveryScheduled } from "@/components/assistencia/DeliveryStatusBadge";
import {
  groupByRota,
  filterOverdueOpen,
  filterSemRotaOpen,
  pinSemRotaFirst,
  ENTREGA_FILTERS,
  ORIGEM_FILTERS,
  CITY_FILTERS,
  ENTREGA_TYPES,
  ENTREGA_TYPES_SAC,
  ENTREGA_TYPES_ASSISTENCIA,
} from "@/lib/entregaQueueGrouping";

export const dynamic = "force-dynamic";

// Isolado numa função à parte (não direto no corpo do componente) --
// Date.now() é impuro (mesmo padrão de fila/page.tsx/admin/page.tsx).
function currentTimeMs(): number {
  return Date.now();
}

function buildHref(params: {
  status?: string;
  q?: string;
  store?: string;
  from?: string;
  to?: string;
  origem?: string;
  sched?: string;
  city?: string;
  urgente?: string;
  semrota?: string;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.origem) sp.set("origem", params.origem);
  if (params.sched) sp.set("sched", params.sched);
  if (params.city) sp.set("city", params.city);
  if (params.urgente) sp.set("urgente", params.urgente);
  if (params.semrota) sp.set("semrota", params.semrota);
  const qs = sp.toString();
  return qs ? `/assistencia/sac/notificacoes?${qs}` : "/assistencia/sac/notificacoes";
}

// Essa tela precisa ser exatamente a mesma coisa que a aba Entregas de
// /assistencia/fila (admin/assistência) -- achado do Victor 24/08/2026: "A
// tela de notificação de assistencia do sac deve ser igual a de admin, só
// essa tela, hoje nao está. Inclusive, na tela do sac, as notificações de
// assistencia de hoje, ta contando 11 e na minha tela de admin mostra 16".
// A causa raiz do número diferente: essa página tinha sua PRÓPRIA cópia da
// busca/agrupamento (via NotificacoesList.tsx), que só buscava chamados em
// aberto por padrão (excluía concluída/cancelada sempre) enquanto a aba
// Entregas do admin mostra tudo por padrão com o status dividido por
// dentro de cada grupo -- duas fontes de verdade divergentes contando
// coisas diferentes. Reescrita pra usar exatamente os mesmos filtros,
// busca e agrupamento de fila/page.tsx (groupByRota/ENTREGA_FILTERS/
// ORIGEM_FILTERS, ver src/lib/entregaQueueGrouping.ts, e a mesma
// renderização, ver EntregasGroupsList.tsx) -- não duas cópias que podem
// voltar a divergir.
export default async function SacNotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    store?: string;
    from?: string;
    to?: string;
    origem?: string;
    sched?: string;
    city?: string;
    urgente?: string;
    semrota?: string;
  }>;
}) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const { status, q, store, from, to, origem, sched, city, urgente, semrota } = await searchParams;
  const filterStatus = isRequestStatus(status) ? status : undefined;
  const dateFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const dateTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
  const filterOrigem = origem === "sac" || origem === "assistencia" ? origem : undefined;
  const filterSched: boolean | undefined = filterStatus === "aberta" && (sched === "1" || sched === "0") ? sched === "1" : undefined;
  const schedParam = filterSched === true ? "1" : filterSched === false ? "0" : undefined;
  // Filtro por cidade (ver CITY_FILTERS) -- pedido do Victor 24/08/2026.
  const filterCity: "joao_pessoa" | "campina_grande" | undefined = city === "joao_pessoa" || city === "campina_grande" ? city : undefined;
  // Banner "Remarcar urgente" (ver filterOverdueOpen) -- pedido do Victor
  // 25/08/2026, mesmo motivo de fila/page.tsx.
  const filterUrgente = urgente === "1";
  // Pill "sem rota" -- mesmo padrão de fila/page.tsx (ver lá).
  const filterSemRota = semrota === "1";
  const types = filterOrigem === "sac" ? ENTREGA_TYPES_SAC : filterOrigem === "assistencia" ? ENTREGA_TYPES_ASSISTENCIA : ENTREGA_TYPES;
  const today = new Date().toISOString().slice(0, 10);

  const [{ items: rawRequests }, stores, drivers, rotaOverview, todayRequestsFull] = await Promise.all([
    listRequests({ status: filterStatus, q, storeId: store, types, dateFrom, dateTo }),
    listStores(),
    listDrivers(),
    getRotaWeekOverview(startOfRotaWeek(today), 14),
    // Board "Hoje" busca à parte, sem o limite de 100 linhas de
    // listRequests -- achado do Victor 27/08/2026: "a notificação de
    // Raemilly que está com everton para hoje, eu só consigo ver na
    // página 2" (aqui nem página 2 existe -- essa tela não tem paginação
    // nenhuma, então um chamado fora das 100 mais recentes por criação
    // simplesmente nunca aparecia). Ver listRequestsScheduledOn/
    // fila/page.tsx (mesmo motivo, mesma correção).
    listRequestsScheduledOn(today, { storeId: store, types, status: filterStatus }),
  ]);
  // Mesmo raciocínio de fila/page.tsx: Programado/Não programado não são
  // status de verdade no banco, só dá pra separar em JS depois da busca.
  let requests = filterSched === undefined ? rawRequests : rawRequests.filter((r) => isDeliveryScheduled(r.scheduledDate, r.rota) === filterSched);
  // Cidade não é coluna no banco -- é derivada da rota (ver ROTA_CITY em
  // rotas.ts), mesmo raciocínio do filtro de programado acima. Sem rota
  // ainda (`r.rota === null`) não entra em nenhuma cidade.
  if (filterCity !== undefined) {
    requests = requests.filter((r) => r.rota !== null && ROTA_CITY[r.rota] === filterCity);
  }
  // Quantas estão atrasadas dentro do que já foi buscado -- ANTES do
  // filtro de status/programado (mesmo raciocínio de fila/page.tsx).
  const overdueCount = filterOverdueOpen(rawRequests).length;
  const semRotaCount = filterSemRotaOpen(rawRequests).length;
  if (filterUrgente) {
    requests = filterOverdueOpen(rawRequests);
  } else if (filterSemRota) {
    requests = filterSemRotaOpen(rawRequests);
  }
  const groups = pinSemRotaFirst(groupByRota(requests));
  // Kanban só pra hoje -- mesmo motivo/desenho de fila/page.tsx (ver lá).
  // Vem de `todayRequestsFull` (sem paginação), não de `groups` -- mesmos
  // filtros de cidade/sem-rota aplicados, busca por texto (`q`) continua
  // sendo a exceção (cai pro comportamento antigo).
  let todayRequests = filterCity !== undefined ? todayRequestsFull.filter((r) => r.rota !== null && ROTA_CITY[r.rota] === filterCity) : todayRequestsFull;
  if (filterSemRota) todayRequests = todayRequests.filter((r) => r.rota === null);
  const todayGroups = q ? groups.filter((g) => g.dateBucket === "hoje") : pinSemRotaFirst(groupByRota(todayRequests));
  const restGroups = groups.filter((g) => g.dateBucket !== "hoje");
  const todayOverview = rotaOverview.find((d) => d.date === today) ?? null;
  const now = currentTimeMs();

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher notifyOnInsert="Nova solicitação recebida!" />

      <AssistenciaHeader title="Notificação de Assistência" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />

      <SacTabs active="notificacoes" />

      {/* Título + descrição + CTA no canto direito -- pedido do Victor
          25/08/2026 ("guia de padronização"), mesmo padrão de
          fila/page.tsx (aba Entregas) -- essa tela é o equivalente pro
          papel SAC. */}
      <PageHeader
        title="Entregas"
        description="Rotas de motorista -- troca, entrega e recolhimento de produto, envio e recolhimento de peça."
        cta={
          <Link
            href="/assistencia/sac/nova"
            className="text-sm px-4 py-2.5 rounded-lg font-bold shadow-md"
            style={{ background: "var(--brand-orange)", color: "#fff", border: "2px solid var(--brand-orange)" }}
          >
            + Nova solicitação
          </Link>
        }
      />

      {/* Mesmo painel de /assistencia/fila (aba Entregas) -- SAC não
          alcança a fila da assistência, precisa desse atalho aqui também
          pra não depender de pedir pra assistência mudar o motorista do
          dia. Junior como motorista padrão -- pedido do Victor 21/08/2026. */}
      <RotaMotoristaDoDia today={today} initialOverview={rotaOverview} drivers={drivers} defaultDriver={JP_DEFAULT_DRIVER} />

      {/* Linha 1 do guia de padronização -- mesmo desenho/motivo de
          fila/page.tsx (aba Entregas, ver lá). */}
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
        {ENTREGA_FILTERS.map((f) => (
          <FilterPill
            key={f.label}
            label={f.label}
            color={f.color}
            selected={(f.value.status ?? undefined) === filterStatus && (f.value.sched ?? undefined) === filterSched}
            href={buildHref({
              status: f.value.status ?? undefined,
              q,
              store,
              from: dateFrom,
              to: dateTo,
              origem: filterOrigem,
              sched: f.value.sched === true ? "1" : f.value.sched === false ? "0" : undefined,
              city: filterCity,
            })}
          />
        ))}
        {/* Badge "pra remarcar" -- pedido do Victor 25/08/2026: "nao
            gostei da badge gigante... colocar uma badge em vermelho
            com a quantidade a remarcar ao lado de Todas/Programado/
            Não programado/Concluídas/Canceladas, pouca coisa maior em
            tamanho que os outros, mas bem vermelho e piscando".
            Mesmo desenho de fila/page.tsx (ver comentário lá). */}
        {overdueCount > 0 || filterUrgente ? (
          <Link
            href={
              filterUrgente
                ? buildHref({ store, from: dateFrom, to: dateTo, origem: filterOrigem, city: filterCity })
                : buildHref({ store, from: dateFrom, to: dateTo, origem: filterOrigem, city: filterCity, urgente: "1" })
            }
            className={`text-sm px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 font-bold ${filterUrgente ? "" : "animate-pulse"}`}
            style={{
              background: "var(--status-critical)",
              color: "#fff",
              border: filterUrgente ? "2px solid var(--text-primary)" : "2px solid var(--status-critical)",
            }}
          >
            ⚠ {overdueCount} pra remarcar
          </Link>
        ) : null}
        {/* Pill "sem rota" -- mesmo desenho/motivo de fila/page.tsx (ver
            lá), cor de atenção em vez de crítica. */}
        {semRotaCount > 0 || filterSemRota ? (
          <Link
            href={
              filterSemRota
                ? buildHref({ store, from: dateFrom, to: dateTo, origem: filterOrigem, city: filterCity })
                : buildHref({ store, from: dateFrom, to: dateTo, origem: filterOrigem, city: filterCity, semrota: "1" })
            }
            className="text-sm px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 font-bold"
            style={{
              background: "var(--status-warning)",
              color: "#fff",
              border: filterSemRota ? "2px solid var(--text-primary)" : "2px solid var(--status-warning)",
            }}
          >
            🧭 {semRotaCount} sem rota
          </Link>
        ) : null}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {requests.length} solicitaç{requests.length === 1 ? "ão" : "ões"} encontrada{requests.length === 1 ? "" : "s"}
      </p>

      {/* Filtros avançados consolidados numa barra só -- pedido do Victor
          25/08/2026: "os filtros estão espalhados em vários blocos...
          crie uma barra única de filtragem". Origem/Cidade eram fileiras
          de pills próprias (ver git blame) -- viram dropdown junto de
          Loja, mesmas opções de sempre (ORIGEM_FILTERS/CITY_FILTERS), só
          reaproveitadas aqui em vez de lá. Mesmo padrão de fila/page.tsx
          (aba Entregas). */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect
          name="origem"
          placeholder="Origem: todas"
          options={ORIGEM_FILTERS.filter((f) => f.value !== null).map((f) => ({ value: f.value as string, label: f.label }))}
        />
        <FilterSelect
          name="city"
          placeholder="Cidade: todas"
          options={CITY_FILTERS.filter((f) => f.value !== null).map((f) => ({ value: f.value as string, label: f.label }))}
        />
      </div>

      <form action="/assistencia/sac/notificacoes" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {filterOrigem ? <input type="hidden" name="origem" value={filterOrigem} /> : null}
        {schedParam ? <input type="hidden" name="sched" value={schedParam} /> : null}
        {filterCity ? <input type="hidden" name="city" value={filterCity} /> : null}
        {filterUrgente ? <input type="hidden" name="urgente" value="1" /> : null}
        {filterSemRota ? <input type="hidden" name="semrota" value="1" /> : null}
        {/* Ícone de lupa -- mesmo padrão de fila/page.tsx (ver lá). */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }} aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nº do chamado, cliente, produto, CPF ou telefone…"
            className="rounded border pl-8 pr-3 py-2 text-sm w-full"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          De
          <input type="date" name="from" defaultValue={dateFrom ?? ""} className="rounded border px-2 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Até
          <input type="date" name="to" defaultValue={dateTo ?? ""} className="rounded border px-2 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Buscar
        </button>
        {q || dateFrom || dateTo ? (
          <Link
            href={buildHref({ status: filterStatus, store, origem: filterOrigem, sched: schedParam, city: filterCity, urgente: filterUrgente ? "1" : undefined, semrota: filterSemRota ? "1" : undefined })}
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
        // Hoje fica no Kanban (todayGroups); o resto (futuro + atrasado +
        // sem rota) agrupado por semana -- pedido do Victor 26/08/2026:
        // "divida os agrupamentos igual é na tela de visitas, agrupados
        // por semana" (mesmo componente que a aba Entregas do admin usa,
        // ver EntregasWeekGroups.tsx -- as duas telas não podem divergir
        // de novo, ver comentário no topo deste arquivo).
        <div className="flex flex-col gap-4">
          <EntregasKanbanHoje groups={todayGroups} todayOverview={todayOverview} />
          {restGroups.length > 0 ? <EntregasWeekGroups groups={restGroups} now={now} /> : null}
        </div>
      )}
    </div>
  );
}
