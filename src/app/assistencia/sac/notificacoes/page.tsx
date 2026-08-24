import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listRequests, listStores, isRequestStatus } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { getRotaWeekOverview, startOfRotaWeek } from "@/lib/rotas";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { EntregasGroupsList } from "@/components/assistencia/EntregasGroupsList";
import { isDeliveryScheduled } from "@/components/assistencia/DeliveryStatusBadge";
import {
  groupByRota,
  ENTREGA_FILTERS,
  ORIGEM_FILTERS,
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

function buildHref(params: { status?: string; q?: string; store?: string; from?: string; to?: string; origem?: string; sched?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.origem) sp.set("origem", params.origem);
  if (params.sched) sp.set("sched", params.sched);
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
  searchParams: Promise<{ status?: string; q?: string; store?: string; from?: string; to?: string; origem?: string; sched?: string }>;
}) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const { status, q, store, from, to, origem, sched } = await searchParams;
  const filterStatus = isRequestStatus(status) ? status : undefined;
  const dateFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const dateTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
  const filterOrigem = origem === "sac" || origem === "assistencia" ? origem : undefined;
  const filterSched: boolean | undefined = filterStatus === "aberta" && (sched === "1" || sched === "0") ? sched === "1" : undefined;
  const schedParam = filterSched === true ? "1" : filterSched === false ? "0" : undefined;
  const types = filterOrigem === "sac" ? ENTREGA_TYPES_SAC : filterOrigem === "assistencia" ? ENTREGA_TYPES_ASSISTENCIA : ENTREGA_TYPES;
  const today = new Date().toISOString().slice(0, 10);

  const [{ items: rawRequests }, stores, drivers, rotaOverview] = await Promise.all([
    listRequests({ status: filterStatus, q, storeId: store, types, dateFrom, dateTo }),
    listStores(),
    listDrivers(),
    getRotaWeekOverview(startOfRotaWeek(today), 14),
  ]);
  // Mesmo raciocínio de fila/page.tsx: Programado/Não programado não são
  // status de verdade no banco, só dá pra separar em JS depois da busca.
  const requests = filterSched === undefined ? rawRequests : rawRequests.filter((r) => isDeliveryScheduled(r.scheduledDate, r.rota) === filterSched);
  const groups = groupByRota(requests);
  const now = currentTimeMs();

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher notifyOnInsert="Nova solicitação recebida!" />

      <AssistenciaHeader title="Notificação de Assistência" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />

      <SacTabs active="notificacoes" />

      {/* Mesmo painel de /assistencia/fila (aba Entregas) -- SAC não
          alcança a fila da assistência, precisa desse atalho aqui também
          pra não depender de pedir pra assistência mudar o motorista do
          dia. Junior como motorista padrão -- pedido do Victor 21/08/2026. */}
      <RotaMotoristaDoDia today={today} initialOverview={rotaOverview} drivers={drivers} defaultDriver="Junior" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {ENTREGA_FILTERS.map((f) => {
            const selected = (f.value.status ?? undefined) === filterStatus && (f.value.sched ?? undefined) === filterSched;
            return (
              <Link
                key={f.label}
                href={buildHref({
                  status: f.value.status ?? undefined,
                  q,
                  store,
                  from: dateFrom,
                  to: dateTo,
                  origem: filterOrigem,
                  sched: f.value.sched === true ? "1" : f.value.sched === false ? "0" : undefined,
                })}
                className="text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0"
                style={
                  f.value.status
                    ? {
                        color: "var(--text-primary)",
                        background: selected ? `color-mix(in srgb, ${f.color} 35%, var(--surface-1))` : "transparent",
                        fontWeight: selected ? 600 : 400,
                        border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${f.color} 40%, transparent)`}`,
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
          href="/assistencia/sac/nova"
          className="text-sm px-4 py-2.5 rounded-lg font-bold shadow-md"
          style={{ background: "var(--brand-orange)", color: "#fff", border: "2px solid var(--brand-orange)" }}
        >
          + Nova solicitação
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Origem:
        </span>
        {ORIGEM_FILTERS.map((f) => {
          const selected = (f.value ?? undefined) === filterOrigem;
          return (
            <Link
              key={f.label}
              href={buildHref({ status: filterStatus, q, store, from: dateFrom, to: dateTo, origem: f.value ?? undefined, sched: schedParam })}
              className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
              style={{
                border: "1px solid var(--border)",
                background: selected ? "var(--brand-green)" : "transparent",
                color: selected ? "var(--brand-green-ink)" : "var(--text-secondary)",
                fontWeight: selected ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {requests.length} solicitaç{requests.length === 1 ? "ão" : "ões"} encontrada{requests.length === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
      </div>

      <form action="/assistencia/sac/notificacoes" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {filterOrigem ? <input type="hidden" name="origem" value={filterOrigem} /> : null}
        {schedParam ? <input type="hidden" name="sched" value={schedParam} /> : null}
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
            href={buildHref({ status: filterStatus, store, origem: filterOrigem, sched: schedParam })}
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
        <EntregasGroupsList groups={groups} now={now} />
      )}
    </div>
  );
}
