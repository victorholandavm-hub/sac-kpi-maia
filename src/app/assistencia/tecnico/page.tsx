import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession, tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import {
  listRequestsForTecnico,
  ITEM_DESTINO_NEEDS_NOTE,
  type TecnicoRequestView,
  type TecnicoItem,
  type ItemDestino,
} from "@/lib/tecnicos";
import { listStores } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { TecnicoItemDestino } from "@/components/assistencia/TecnicoItemDestino";
import { TecnicoNotificationModalButton } from "@/components/assistencia/TecnicoNotificationModalButton";

export const dynamic = "force-dynamic";

// Ícone sutil de loja pra coluna "Loja" -- pedido do Victor 31/08/2026.
// Inline (não o StoreIcon de RoleIcons.tsx, que é 28px, pensado pra tela
// de escolha de papel, grande demais pra uma célula de tabela densa).
function StoreIconSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }}>
      <path
        d="M4 10.5V19a1 1 0 0 0 1 1h5v-5h4v5h5a1 1 0 0 0 1-1v-8.5M3 10l1.5-5.5A1 1 0 0 1 5.46 3.5h13.08a1 1 0 0 1 .96 1L21 10M3 10a2 2 0 0 0 4 0M7 10a2 2 0 0 0 4 0M11 10a2 2 0 0 0 4 0M15 10a2 2 0 0 0 4 0M19 10a2 2 0 0 0 2 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// SAC (troca/entrega/recolhimento de produto, notificação externa) x
// Assistência (envio de peça, montagem/desmontagem/troca de peça/vistoria) --
// pedido do Victor 20/08/2026: "precisa ter também quem solicitou: sac ou
// assistencia". Mesma divisão de SAC_MANAGED_TYPES/ASSISTENCIA_MANAGED_TYPES
// já usada no filtro "Origem" da aba Entregas (fila/page.tsx).
function origemLabel(type: TecnicoRequestView["type"]): "SAC" | "Assistência" {
  return (SAC_MANAGED_TYPES as readonly string[]).includes(type) ? "SAC" : "Assistência";
}

// Três fases -- pedido do Victor 24/08/2026: "preciso de uma nova fase
// alem de pendentes e concluido, que é a fase 'em observação'". Um item
// pendente (destino null) vira "em observação" quando alguém escolhe
// esse destino especificamente (ver ITEM_DESTINO_NEEDS_NOTE/
// TecnicoItemDestino.tsx), e "classificado" quando ganha qualquer outro
// destino de verdade.
type Phase = "pendentes" | "observacao" | "classificados";

const PHASES: { value: Phase; label: string }[] = [
  { value: "pendentes", label: "Pendentes" },
  { value: "observacao", label: "Em observação" },
  { value: "classificados", label: "Já classificados" },
];

function itemPhase(destino: ItemDestino | null): Phase {
  if (destino === null) return "pendentes";
  if (destino === ITEM_DESTINO_NEEDS_NOTE) return "observacao";
  return "classificados";
}

// Quantos CHAMADOS (não itens) têm pelo menos 1 item numa fase -- mesma
// regra de "pelo menos um item" usada pra decidir em quais abas um
// chamado aparece (ver o filtro de `requests` mais abaixo). Contador das
// abas -- pedido do Victor 31/08/2026: "contadores numéricos limpos ao
// lado de cada nome". Calculado sobre a lista já filtrada por loja (mas
// não pela busca de texto, que é um filtro mais pontual) pra não ficar
// mostrando "Pendentes (12)" quando a loja escolhida só tem 3.
function countByPhase(requests: TecnicoRequestView[]): Record<Phase, number> {
  return {
    pendentes: requests.filter((r) => r.items.some((i) => itemPhase(i.destino) === "pendentes")).length,
    observacao: requests.filter((r) => r.items.some((i) => itemPhase(i.destino) === "observacao")).length,
    classificados: requests.filter((r) => r.items.some((i) => itemPhase(i.destino) === "classificados")).length,
  };
}

function buildHref(params: { view?: string; q?: string; store?: string }) {
  const sp = new URLSearchParams();
  if (params.view) sp.set("view", params.view);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  const qs = sp.toString();
  return qs ? `/assistencia/tecnico?${qs}` : "/assistencia/tecnico";
}

type DateGroup = { dateKey: string; label: string; requests: TecnicoRequestView[] };

// Uma linha da grade = um ITEM (destino é por item, não por chamado -- ver
// tecnicos.ts). `isFirst`/`itemCount` dizem pra tabela quando repetir as
// colunas do chamado (Chamado/Origem/Loja/Cliente) com rowSpan em vez de
// duplicá-las em cada linha -- pedido do Victor 31/08/2026: "transforme o
// layout... numa tabela de dados de alta densidade". Na prática quase todo
// chamado tem 1 item só (118 de 139 concluídos em 31/08/2026), então o
// rowSpan raramente entra em ação, mas evita repetir cliente/loja/chamado
// nos poucos casos de troca com 2+ produtos.
//
// Achado do Victor 31/08/2026, rodada 3: pediu pra juntar os produtos de
// um mesmo chamado numa linha só, corrida ("Mesa..., Cadeira... / Box...").
// Isso quebraria a regra de negócio -- destino é escolhido POR ITEM (uma
// troca pode ter um produto "voltar pro estoque" e outro "sem condições"
// ao mesmo tempo), então um seletor só por linha não serve pra chamados
// com mais de 1 item. Mantido 1 linha por item (única forma de garantir
// 1 seletor de destino por item), mas a MESMA altura fixa em toda linha
// -- ver "truncate" na coluna Produto abaixo, que resolve o problema real
// (linha 3x mais alta que as outras por causa de descrição de produto
// comprida) sem tocar na regra de negócio.
type GridRow = {
  request: TecnicoRequestView;
  item: TecnicoItem;
  isFirst: boolean;
  itemCount: number;
  requestIndex: number;
};

function flattenForGrid(requests: TecnicoRequestView[], phase: Phase): GridRow[] {
  const rows: GridRow[] = [];
  requests.forEach((request, requestIndex) => {
    const items = request.items.filter((i) => itemPhase(i.destino) === phase);
    items.forEach((item, i) => {
      rows.push({ request, item, isFirst: i === 0, itemCount: items.length, requestIndex });
    });
  });
  return rows;
}

function productLine(item: TecnicoItem): string {
  return `${item.quantity > 1 ? `${item.quantity}x ` : ""}${item.product}${item.partCode ? ` · ${item.partCode}` : ""}`;
}

// Organiza por dia de conclusão (o mesmo timestamp já usado pra ordenar a
// lista) -- pedido do Victor 20/08/2026: "a tela da equipe tecnica precisa
// estar organizada por data também". Mesmo padrão de agrupamento recolhível
// já usado em fila/page.tsx e NotificacoesList.tsx.
function groupByCompletedDate(requests: TecnicoRequestView[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const r of requests) {
    const dateKey = r.completedAt ? r.completedAt.slice(0, 10) : "sem_data";
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label =
        dateKey === "sem_data"
          ? "Sem data de conclusão"
          : new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
      group = { dateKey, label, requests: [] };
      groups.push(group);
    }
    group.requests.push(r);
  }
  return groups;
}

export default async function TecnicoHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; store?: string }>;
}) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const { view, q, store } = await searchParams;
  const phase: Phase = view === "observacao" ? "observacao" : view === "classificados" ? "classificados" : "pendentes";

  const [todos, stores] = await Promise.all([listRequestsForTecnico(), listStores()]);
  const byStore = store ? todos.filter((r) => r.storeId === store) : todos;
  const tabCounts = countByPhase(byStore);

  // Um chamado pode ter item pendente E item já classificado ao mesmo tempo
  // (troca com 2 produtos, cada um resolvido em momento diferente) -- por
  // isso o filtro é "tem pelo menos um item nessa fase", não "todos os
  // itens", e a mesma solicitação pode aparecer em mais de uma aba.
  let requests = byStore.filter((r) => r.items.some((i) => itemPhase(i.destino) === phase));
  // Busca por nome/produto -- pedido do Victor 24/08/2026: "coloque uma
  // possibilidade de filtro por nome, loja, produto".
  if (q) {
    const needle = q.trim().toLowerCase();
    requests = requests.filter(
      (r) => (r.clientName ?? "").toLowerCase().includes(needle) || r.items.some((i) => i.product.toLowerCase().includes(needle))
    );
  }
  const groups = groupByCompletedDate(requests);

  return (
    <ToastProvider>
      <RealtimeQueueRefresher />

      {/* Largura total -- pedido do Victor 31/08/2026: "o container
          principal do sistema e a barra superior verde devem ocupar
          100% da largura da tela". Sem max-w/mx-auto nenhum -- só
          padding interno (px-6), que não é limitação de largura, é
          respiro em relação à borda da janela. */}
      <div className="w-full flex flex-col min-w-0">
        {/* Barra de marca -- verde institucional, cheia, só nesta tela
            (não é o AssistenciaHeader compartilhado com o resto do
            sistema de assistência -- trocar aquele componente mudaria
            TODAS as outras telas, não só esta). */}
        <div className="w-full" style={{ background: "var(--brand-green)" }}>
          <div className="flex items-center justify-between gap-4 px-6 py-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Image
                src="/logo.png"
                alt="Lojas Maia"
                width={72}
                height={72}
                className="h-9 w-9 object-contain rounded-full shrink-0"
                style={{ background: "rgba(255,255,255,0.9)" }}
              />
              <div className="leading-tight min-w-0">
                <h1 className="font-bold text-lg text-white truncate">Fila de Classificação</h1>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
                  Olá, {tecnicoName} — chamados que voltaram com o motorista, com produto pra dar destino.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm shrink-0">
              {/* Pedido do Victor 28/08/2026: "preciso que a equipe
                  tecnica tambem tenha acesso" à tela de estoque (dar
                  baixa em retirada registrada pela assistência). */}
              <Link href="/assistencia/tecnico/estoque" className="underline" style={{ color: "rgba(255,255,255,0.9)" }}>
                Estoque
              </Link>
              <Link href="/assistencia" className="underline" style={{ color: "rgba(255,255,255,0.9)" }}>
                ← Voltar
              </Link>
              <form action={tecnicoSignOut}>
                <button type="submit" className="underline" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 pt-4 pb-6">
          {/* Barra de busca + filtro de loja -- ampla, integrada logo
              acima da tabela (pedido do Victor 31/08/2026). */}
          <div className="flex items-center gap-3 flex-wrap">
            <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
            <form action="/assistencia/tecnico" method="GET" className="flex items-center gap-2 flex-1 min-w-[280px]">
              {phase !== "pendentes" ? <input type="hidden" name="view" value={phase} /> : null}
              {store ? <input type="hidden" name="store" value={store} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por cliente ou produto…"
                className="rounded border px-3 py-2 text-sm flex-1"
                style={{ borderColor: "var(--border)" }}
              />
              <button type="submit" className="text-sm px-3 py-2 rounded border shrink-0" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                Buscar
              </button>
              {q || store ? (
                <Link href={buildHref({ view: phase === "pendentes" ? undefined : phase })} className="text-xs underline shrink-0" style={{ color: "var(--text-secondary)" }}>
                  Limpar
                </Link>
              ) : null}
            </form>
          </div>

          {/* Abas -- imediatamente acima da tabela, alinhadas à
              esquerda, contador ao lado de cada nome (pedido do Victor
              31/08/2026). */}
          <div className="flex items-center gap-1">
            {PHASES.map(({ value, label }) => (
              <Link
                key={value}
                href={buildHref({ view: value === "pendentes" ? undefined : value, q, store })}
                className="text-sm px-3 py-1.5 rounded-t-md border-b-2 flex items-center gap-1.5"
                style={{
                  borderColor: phase === value ? "var(--brand-green)" : "transparent",
                  color: phase === value ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: phase === value ? 600 : 400,
                }}
              >
                {label}
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  ({tabCounts[value]})
                </span>
              </Link>
            ))}
          </div>

          {requests.length === 0 ? (
            <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {phase === "classificados"
                  ? "Nenhum item classificado ainda."
                  : phase === "observacao"
                    ? "Nenhum item em observação no momento."
                    : "Nenhum item pendente no momento."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => {
                const gridRows = flattenForGrid(group.requests, phase);
                return (
                  // Recolhido por padrão -- achado do Victor 24/08/2026: "toda
                  // vez que eu entrar em qualquer tela, as demandas agrupadas
                  // precisam aparecer recolhidas".
                  <details key={group.dateKey} className="group flex flex-col gap-2">
                    <summary className="flex items-center gap-2 px-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <span
                        className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
                        style={{ color: "var(--text-muted)" }}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                      <h3 className="text-sm font-bold capitalize" style={{ color: "var(--text-primary)" }}>
                        {group.label}
                      </h3>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        ({group.requests.length})
                      </span>
                    </summary>

                    {/* Grid horizontal puro -- pedido do Victor 31/08/2026:
                        "elimine qualquer empilhamento de blocos de texto
                        dentro das células" e "fixe uma altura máxima
                        padrão para as linhas". Toda coluna de texto corrido
                        (Produto, Loja, Cliente) trunca numa linha só com
                        "…" e título nativo (tooltip) com o texto completo
                        -- é isso que garante altura uniforme, não um
                        max-height (que não é confiável em <tr>/<td>).
                        overflow-x-auto -- a tabela nunca deve empurrar a
                        página inteira pro lado, só rolar por dentro do
                        próprio cartão em telas mais estreitas. */}
                    <div className="rounded-lg border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--border)" }}>
                      <table className="w-full border-collapse text-xs" style={{ minWidth: "880px", tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "140px" }} />
                          <col style={{ width: "90px" }} />
                          <col style={{ width: "150px" }} />
                          <col style={{ width: "190px" }} />
                          <col />
                          <col style={{ width: "230px" }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--gridline)" }}>
                            {["ID / Tipo", "Setor", "Loja", "Cliente", "Produto", "Destino"].map((h) => (
                              <th
                                key={h}
                                className={`px-3 py-2 font-semibold uppercase tracking-wide whitespace-nowrap ${h === "Setor" ? "text-center" : "text-left"}`}
                                style={{ color: "var(--text-muted)", fontSize: "10.5px" }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gridRows.map(({ request: r, item: i, isFirst, itemCount, requestIndex }) => (
                            <tr
                              key={i.id}
                              style={{
                                background: requestIndex % 2 === 1 ? "var(--surface-2)" : "var(--surface-1)",
                                borderBottom: "1px solid var(--gridline)",
                              }}
                            >
                              {/* Coluna 1: ID / Tipo */}
                              {isFirst ? (
                                <td className="px-3 py-2 align-top whitespace-nowrap" rowSpan={itemCount}>
                                  <div className="font-mono" style={{ color: "var(--text-muted)" }}>
                                    #{r.ticketNumber}
                                  </div>
                                  <div className="font-bold truncate" style={{ color: "var(--text-primary)" }}>
                                    {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                                  </div>
                                </td>
                              ) : null}

                              {/* Coluna 2: Setor -- texto simples centralizado, sem pílula */}
                              {isFirst ? (
                                <td className="px-3 py-2 align-top text-center whitespace-nowrap" rowSpan={itemCount}>
                                  <span
                                    className="font-semibold"
                                    style={{ color: origemLabel(r.type) === "SAC" ? "var(--brand-orange)" : "var(--brand-green)" }}
                                  >
                                    {origemLabel(r.type)}
                                  </span>
                                </td>
                              ) : null}

                              {/* Coluna 3: Loja -- ícone sutil + nome */}
                              {isFirst ? (
                                <td className="px-3 py-2 align-top" rowSpan={itemCount}>
                                  <span className="flex items-center gap-1.5 truncate" style={{ color: "var(--text-secondary)" }} title={r.storeName}>
                                    <StoreIconSmall />
                                    <span className="truncate">{r.storeName}</span>
                                  </span>
                                </td>
                              ) : null}

                              {/* Coluna 4: Cliente */}
                              {isFirst ? (
                                <td className="px-3 py-2 align-top" rowSpan={itemCount}>
                                  <div className="font-semibold truncate" style={{ color: "var(--text-primary)" }} title={r.clientName ?? "—"}>
                                    {r.clientName ?? "—"}
                                  </div>
                                  {r.clientCpf || r.clientPhone ? (
                                    <div className="font-mono truncate" style={{ color: "var(--text-muted)" }}>
                                      {r.clientCpf ?? r.clientPhone}
                                    </div>
                                  ) : null}
                                  <TecnicoNotificationModalButton request={r} />
                                </td>
                              ) : null}

                              {/* Coluna 5: Produto -- texto corrido, uma linha só, trava a altura da linha */}
                              <td className="px-3 py-2 align-top">
                                <span className="block truncate" style={{ color: "var(--text-primary)" }} title={productLine(i)}>
                                  {i.quantity > 1 ? `${i.quantity}x ` : ""}
                                  {i.product}
                                  {i.partCode ? <span style={{ color: "var(--text-muted)" }}> · {i.partCode}</span> : null}
                                </span>
                              </td>

                              {/* Coluna 6: Destino -- isolada, minimalista */}
                              <td className="px-3 py-2 align-top">
                                <TecnicoItemDestino
                                  itemId={i.id}
                                  destino={i.destino}
                                  destinoDefinidoPor={i.destinoDefinidoPor}
                                  destinoDefinidoEm={i.destinoDefinidoEm}
                                  destinoLojaName={i.destinoLojaName}
                                  destinoObservacao={i.destinoObservacao}
                                  stores={stores}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
