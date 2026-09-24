import Link from "next/link";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { ClientesNivelTable } from "@/components/clientes/ClientesNivelTable";
import { UnderlineTab } from "@/components/UnderlineTab";
import { DualScrollTable } from "@/components/DualScrollTable";
import {
  getClientesResumo,
  listClientes,
  listClientesPorNivel,
  listCanalAquisicaoPorCliente,
  listPhonePorClienteIds,
  isClienteStatus,
  isClienteNivel,
  CLIENTE_STATUSES,
  CLIENTE_STATUS_LABELS,
  CLIENTE_STATUS_COLORS,
  CLIENTE_NIVEIS,
  CLIENTE_NIVEL_LABELS,
  CLIENTE_NIVEL_COLORS,
  CLIENTE_NIVEL_CRITERIA,
} from "@/lib/clientes";
import {
  listRecompraCandidatos,
  listRecompraNaoContatarCompleto,
  listClvProjetadoPorCliente,
  listPadroesEDeadsRecompra,
  isRecompraSegmento,
  RECOMPRA_SEGMENTOS,
  RECOMPRA_SEGMENTO_LABELS,
  RECOMPRA_SEGMENTO_DESCRICOES,
  RECOMPRA_SEGMENTO_COLORS,
  CLV_HORIZONTE_ANOS,
  type RecompraSegmento,
  type RecompraCandidato,
  type PadraoAssociacao,
} from "@/lib/recompra";
import { listEstornos } from "@/lib/estornos";
import { AppHeader } from "@/components/AppHeader";
import { ClienteHistoricoRow } from "@/components/ClienteHistoricoRow";
import { RecompraContatoCell } from "@/components/RecompraContatoCell";
import { RecompraNaoContatarManager } from "@/components/RecompraNaoContatarManager";
import { CanalAquisicaoSelect } from "@/components/CanalAquisicaoSelect";
import { EstornoFormCard } from "@/components/clientes/EstornoFormCard";
import { AcionarClienteButton } from "@/components/clientes/AcionarClienteButton";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { Shield, Cloud, BedDouble, Sofa, BedSingle, DoorClosed, Table2, Repeat, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const LIST_PAGE_SIZE = 50;

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildHref(params: {
  view?: string;
  q?: string;
  status?: string;
  nivel?: string;
  segmento?: string;
  padrao?: string;
  inativo?: string;
  loja?: string;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.view && params.view !== "nivel") sp.set("view", params.view);
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.nivel) sp.set("nivel", params.nivel);
  if (params.segmento) sp.set("segmento", params.segmento);
  if (params.padrao) sp.set("padrao", params.padrao);
  if (params.inativo) sp.set("inativo", params.inativo);
  if (params.loja) sp.set("loja", params.loja);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    status?: string;
    nivel?: string;
    segmento?: string;
    padrao?: string;
    inativo?: string;
    loja?: string;
    page?: string;
  }>;
}) {
  await requireDashboardAuth();
  const { view: viewParam, q, status, nivel, segmento, padrao, inativo, loja, page: pageParam } = await searchParams;
  // Nível de relacionamento é a aba de aterrissagem (pedido do Victor
  // 15/08/2026) -- "status"/"recompra"/"estornos"/"frequencia" só aparecem
  // quando pedidos explicitamente na URL.
  const view =
    viewParam === "status"
      ? "status"
      : viewParam === "recompra"
        ? "recompra"
        : viewParam === "frequencia"
          ? "frequencia"
          : viewParam === "estornos"
            ? "estornos"
            : "nivel";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Clientes
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Perfil de compra/relacionamento, direto do histórico do Protheus.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        <UnderlineTab href={buildHref({ view: "status" })} label="Status (Protheus)" active={view === "status"} color="var(--brand-orange)" />
        <UnderlineTab href={buildHref({ view: "nivel" })} label="Nível de relacionamento" active={view === "nivel"} color="var(--brand-orange)" />
        <UnderlineTab href={buildHref({ view: "recompra" })} label="Propensão a recompra" active={view === "recompra"} color="var(--brand-orange)" />
        <UnderlineTab
          href={buildHref({ view: "frequencia" })}
          label="Frequência & Potencial de Recompra"
          active={view === "frequencia"}
          color="var(--brand-orange)"
        />
        <UnderlineTab href={buildHref({ view: "estornos" })} label="Estornos" active={view === "estornos"} color="var(--brand-orange)" />
      </div>

      {view === "status" ? (
        <StatusView q={q} status={status} page={page} />
      ) : view === "recompra" ? (
        <RecompraView q={q} segmento={segmento} page={page} />
      ) : view === "frequencia" ? (
        <FrequenciaView q={q} padrao={padrao} page={page} />
      ) : view === "estornos" ? (
        <EstornosView q={q} loja={loja} page={page} />
      ) : (
        <NivelView q={q} nivel={nivel} inativo={inativo} page={page} />
      )}
    </div>
  );
}

async function StatusView({ q, status, page }: { q?: string; status?: string; page: number }) {
  const filterStatus = isClienteStatus(status) ? status : undefined;

  const [resumo, listResult, canalPorCliente] = await Promise.all([
    getClientesResumo(),
    listClientes({ q, status: filterStatus, page }),
    listCanalAquisicaoPorCliente(),
  ]);

  const totalPages = Math.max(1, Math.ceil(listResult.total / listResult.pageSize));
  const faixasPorStatus = new Map<string, { faixa: string; total: number }[]>();
  for (const f of resumo.porFaixaDias) {
    const arr = faixasPorStatus.get(f.status) ?? [];
    arr.push({ faixa: f.faixa, total: f.total });
    faixasPorStatus.set(f.status, arr);
  }

  return (
    <>
      <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
        {resumo.totalGeral} clientes com cadastro completo sincronizado do Protheus.
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        {CLIENTE_STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ view: "status", q, status: filterStatus === s ? undefined : s })}
            className="rounded-xl border p-5 flex flex-col gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: `color-mix(in srgb, ${CLIENTE_STATUS_COLORS[s]} ${filterStatus === s ? 10 : 5}%, var(--surface-1))`,
              borderColor: `color-mix(in srgb, ${CLIENTE_STATUS_COLORS[s]} ${filterStatus === s ? 100 : 35}%, var(--border))`,
              borderTopWidth: 3,
              borderTopColor: CLIENTE_STATUS_COLORS[s],
            }}
          >
            <span className="text-2xl font-bold" style={{ color: CLIENTE_STATUS_COLORS[s] }}>
              {resumo.porStatus.find((p) => p.status === s)?.total ?? 0}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {CLIENTE_STATUS_LABELS[s]}
            </span>
            {faixasPorStatus.get(s) ? (
              <div className="flex flex-col gap-0.5 pt-2 mt-1" style={{ borderTop: "1px dashed var(--gridline)" }}>
                {faixasPorStatus.get(s)!.map((f) => (
                  <div key={f.faixa} className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{f.faixa}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{f.total}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>

      <form action="/clientes" method="GET" className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="view" value="status" />
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome, telefone, cidade ou CPF/CNPJ…"
          className="text-sm flex-1 min-w-[220px] rounded border px-3 py-2"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="text-sm px-4 py-2 rounded font-medium" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Buscar
        </button>
        {q || filterStatus ? (
          <Link href={buildHref({ view: "status" })} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar
          </Link>
        ) : null}
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {listResult.total} cliente{listResult.total === 1 ? "" : "s"} encontrado{listResult.total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}
      </p>

      {listResult.items.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum cliente encontrado.
          </p>
        </div>
      ) : (
        // min-w-0: este bloco é filho direto do "flex flex-col" da página
        // -- sem isso, o item flex nunca encolhe abaixo da largura natural
        // da tabela e o overflow-x-auto nunca chega a rolar de verdade
        // (mesma causa raiz do bug corrigido em ClientesNivelTable.tsx
        // 15/09/2026).
        <div className="min-w-0 rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Cabeçalho compacto/uppercase -- pedido do Victor
                    16/09/2026: "fiquem com a tabela muito parecida com a
                    lógica dessa" (tela de Entregas, EntregasFlatList.tsx). */}
                <tr
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }}
                >
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nome</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Status</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Última compra</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Dias sem comprar</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Telefone</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Cidade</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Loja</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Canal de aquisição</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Compras</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {listResult.items.map((c) => (
                  <ClienteHistoricoRow
                    key={c.protheusCode}
                    clientId={c.protheusCode}
                    name={c.name}
                    accentColor={CLIENTE_STATUS_COLORS[c.status]}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          color: CLIENTE_STATUS_COLORS[c.status],
                          background: `color-mix(in srgb, ${CLIENTE_STATUS_COLORS[c.status]} 15%, transparent)`,
                        }}
                      >
                        {CLIENTE_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDateOnly(c.lastPurchaseDate)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.daysWithoutBuying ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.phone1 ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.stores.length > 0 ? c.stores.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <CanalAquisicaoSelect clientId={c.protheusCode} canal={canalPorCliente.get(c.protheusCode) ?? null} />
                    </td>
                  </ClienteHistoricoRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ view: "status", q, status: filterStatus, page: Math.max(1, page - 1) })}
            aria-disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded border"
            style={{ borderColor: "var(--border)", color: page <= 1 ? "var(--text-muted)" : "var(--text-primary)", pointerEvents: page <= 1 ? "none" : undefined }}
          >
            ← Anterior
          </Link>
          <Link
            href={buildHref({ view: "status", q, status: filterStatus, page: Math.min(totalPages, page + 1) })}
            aria-disabled={page >= totalPages}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: page >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: page >= totalPages ? "none" : undefined,
            }}
          >
            Próxima →
          </Link>
        </div>
      ) : null}
    </>
  );
}

async function NivelView({ q, nivel, inativo, page }: { q?: string; nivel?: string; inativo?: string; page: number }) {
  const filterNivel = isClienteNivel(nivel) ? nivel : undefined;
  // "Só inativos" -- pedido do Victor 21/09/2026: já existia o badge
  // ⚠ por linha/card (inativoRecente, sem comprar há 180+ dias, ver
  // DIAS_INATIVO_RECENTE em clientes.ts), mas sem jeito de FILTRAR só
  // esses clientes -- precisava rolar a lista inteira procurando os ⚠.
  const filterInativo = inativo === "1";
  const [todos, clvPorCliente] = await Promise.all([listClientesPorNivel(), listClvProjetadoPorCliente()]);
  // Potencial de receita projetado -- soma sobre TODOS os clientes (não só
  // a página/filtro atual), mesmo espírito de "prejuízo total" na Taxa de
  // Quebra (kpiAssistencia.ts): o card de total sempre reflete o conjunto
  // inteiro, o corte é só pra exibição em lista.
  const clvTotalProjetado = todos.reduce((sum, c) => sum + (clvPorCliente.get(c.clientId) ?? 0), 0);

  const porNivel = new Map<string, number>();
  const inativosPorNivel = new Map<string, number>();
  for (const c of todos) {
    porNivel.set(c.nivel, (porNivel.get(c.nivel) ?? 0) + 1);
    if (c.inativoRecente) inativosPorNivel.set(c.nivel, (inativosPorNivel.get(c.nivel) ?? 0) + 1);
  }

  const qLower = q?.trim().toLowerCase();
  let filtrados = todos;
  if (filterNivel) filtrados = filtrados.filter((c) => c.nivel === filterNivel);
  if (qLower) {
    filtrados = filtrados.filter(
      (c) => (c.nome ?? "").toLowerCase().includes(qLower) || (c.cpfCnpj ?? "").toLowerCase().includes(qLower)
    );
  }
  // Contagem ANTES do filtro de inativo (não depois) -- é o "quantos tem
  // pra filtrar" que o toggle abaixo mostra, dentro do recorte de
  // nível/busca já aplicado.
  const totalInativosNoRecorte = filtrados.filter((c) => c.inativoRecente).length;
  if (filterInativo) filtrados = filtrados.filter((c) => c.inativoRecente);
  // Maior gasto primeiro dentro de cada nível já filtrado -- ordem que
  // mais importa pra achar rápido quem vale mais dentro do recorte.
  filtrados = [...filtrados].sort((a, b) => b.gastoAcumulado - a.gastoAcumulado);

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = filtrados.slice((pageClamped - 1) * LIST_PAGE_SIZE, pageClamped * LIST_PAGE_SIZE);

  return (
    <>
      <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
        {todos.length} clientes com pelo menos um pedido no Protheus (compra, devolução ou ambos).
      </p>
      {/* CLV preditivo (Fase 4 do Motor de Recompra) -- pedido do Victor
          07/09/2026, retomado 12/09/2026 depois do backfill do totvs_orders
          terminar. Projeção por ciclo de reposição por categoria, não
          "gasto ÷ anos" genérico -- ver comentário completo em
          calcularClvProjetado/CLV preditivo em recompra.ts. */}
      <p className="text-xs -mt-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
        Potencial de receita projetado (próximos {CLV_HORIZONTE_ANOS} anos):{" "}
        <strong style={{ color: "var(--brand-green)" }}>{formatBRL(clvTotalProjetado)}</strong>
        <span
          title="Soma do CLV projetado de cada cliente: pra cada categoria que ele já comprou (colchão, roupeiro, travesseiro...), projeta quantos ciclos de reposição cabem nos próximos 5 anos × o valor médio que ele já gastou nessa categoria. Só ~2/3 dos itens vendidos batem numa categoria reconhecida -- cliente que só compra fora delas fica de fora dessa conta."
          aria-label="Como o potencial de receita projetado é calculado"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)", cursor: "help" }}
        >
          i
        </span>
      </p>

      <div className="grid sm:grid-cols-5 gap-4">
        {CLIENTE_NIVEIS.map((n) => (
          <Link
            key={n}
            href={buildHref({ view: "nivel", q, nivel: filterNivel === n ? undefined : n, inativo: filterInativo ? "1" : undefined })}
            className="rounded-xl border p-4 flex flex-col gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: `color-mix(in srgb, ${CLIENTE_NIVEL_COLORS[n]} ${filterNivel === n ? 10 : 5}%, var(--surface-1))`,
              borderColor: `color-mix(in srgb, ${CLIENTE_NIVEL_COLORS[n]} ${filterNivel === n ? 100 : 35}%, var(--border))`,
              borderTopWidth: 3,
              borderTopColor: CLIENTE_NIVEL_COLORS[n],
            }}
          >
            <span className="text-2xl font-bold" style={{ color: CLIENTE_NIVEL_COLORS[n] }}>
              {porNivel.get(n) ?? 0}
            </span>
            <span className="text-sm font-medium flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
              {CLIENTE_NIVEL_LABELS[n]}
              <span
                title={CLIENTE_NIVEL_CRITERIA[n]}
                aria-label={`Como um cliente vira ${CLIENTE_NIVEL_LABELS[n]}: ${CLIENTE_NIVEL_CRITERIA[n]}`}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)", cursor: "help" }}
              >
                i
              </span>
            </span>
            {/* Nível é histórico acumulado e nunca esfria sozinho -- esse
                sub-contador é o que avisa quando o número acima está inflado
                por gente que não compra há 180+ dias (ver DIAS_INATIVO_RECENTE
                em clientes.ts). Só aparece quando tem pelo menos 1, senão
                polui todo card com "0 inativos". */}
            {inativosPorNivel.get(n) ? (
              <span className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
                ⚠ {inativosPorNivel.get(n)} sem comprar há 180+ dias
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <form action="/clientes" method="GET" className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="view" value="nivel" />
        {filterNivel ? <input type="hidden" name="nivel" value={filterNivel} /> : null}
        {filterInativo ? <input type="hidden" name="inativo" value="1" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome ou CPF/CNPJ…"
          className="text-sm flex-1 min-w-[220px] rounded border px-3 py-2"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="text-sm px-4 py-2 rounded font-medium" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Buscar
        </button>
        {/* Toggle "só inativos" -- pedido do Victor 21/09/2026. Link (não
            checkbox) pra ficar no mesmo padrão de navegação GET dos cards
            de nível acima (clicar de novo desliga o filtro); contagem no
            próprio rótulo já reflete nível/busca em vigor (totalInativosNoRecorte). */}
        <Link
          href={buildHref({ view: "nivel", q, nivel: filterNivel, inativo: filterInativo ? undefined : "1" })}
          className="text-sm px-3 py-2 rounded border font-medium flex items-center gap-1.5 whitespace-nowrap"
          style={{
            borderColor: filterInativo ? "var(--status-critical)" : "var(--border)",
            color: filterInativo ? "var(--status-critical)" : "var(--text-secondary)",
            background: filterInativo ? "color-mix(in srgb, var(--status-critical) 12%, var(--surface-1))" : "transparent",
          }}
        >
          ⚠ Só inativos ({totalInativosNoRecorte})
        </Link>
        {q || filterNivel || filterInativo ? (
          <Link href={buildHref({ view: "nivel" })} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar
          </Link>
        ) : null}
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} cliente{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${pageClamped} de ${totalPages}` : ""}
      </p>

      {pageItems.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum cliente encontrado.
          </p>
        </div>
      ) : (
        // Teste local shadcn/ui + TanStack Table -- pedido do Victor
        // 15/09/2026. A tabela hand-rolled original (mesmo padrão do resto
        // do app) continua intocada mais abaixo neste arquivo pelo git --
        // é só trocar essa chamada de volta se ele preferir o padrão de
        // sempre. `clvPorCliente` (Map) vira objeto simples pra atravessar
        // a borda Server -> Client Component sem ambiguidade.
        <ClientesNivelTable items={pageItems} clvByClientId={Object.fromEntries(clvPorCliente)} />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ view: "nivel", q, nivel: filterNivel, inativo: filterInativo ? "1" : undefined, page: Math.max(1, pageClamped - 1) })}
            aria-disabled={pageClamped <= 1}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped <= 1 ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped <= 1 ? "none" : undefined,
            }}
          >
            ← Anterior
          </Link>
          <Link
            href={buildHref({ view: "nivel", q, nivel: filterNivel, inativo: filterInativo ? "1" : undefined, page: Math.min(totalPages, pageClamped + 1) })}
            aria-disabled={pageClamped >= totalPages}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped >= totalPages ? "none" : undefined,
            }}
          >
            Próxima →
          </Link>
        </div>
      ) : null}
    </>
  );
}

// Aba "Propensão a recompra" -- pedido do Victor 07/09/2026 (motor de
// recompra, Fase 1): régua determinística cruzando ciclo de reposição por
// categoria com índice de atrito pós-venda (ver src/lib/recompra.ts).
// Mesmo padrão visual das outras duas abas (cartões de filtro + busca +
// tabela expansível) -- só o cálculo por trás é novo.
async function RecompraView({ q, segmento, page }: { q?: string; segmento?: string; page: number }) {
  const filterSegmento = isRecompraSegmento(segmento) ? segmento : undefined;
  const [todos, naoContatar] = await Promise.all([listRecompraCandidatos(), listRecompraNaoContatarCompleto()]);

  const porSegmento = new Map<RecompraSegmento, number>();
  for (const c of todos) porSegmento.set(c.segmento, (porSegmento.get(c.segmento) ?? 0) + 1);

  const qLower = q?.trim().toLowerCase();
  let filtrados = todos;
  if (filterSegmento) filtrados = filtrados.filter((c) => c.segmento === filterSegmento);
  if (qLower) {
    filtrados = filtrados.filter(
      (c) => (c.nome ?? "").toLowerCase().includes(qLower) || (c.cpfCnpj ?? "").toLowerCase().includes(qLower)
    );
  }

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = filtrados.slice((pageClamped - 1) * LIST_PAGE_SIZE, pageClamped * LIST_PAGE_SIZE);

  return (
    <>
      <p className="text-xs -mt-4 max-w-2xl" style={{ color: "var(--text-muted)" }}>
        {todos.length} clientes com pelo menos 1 compra, cruzando ciclo de reposição por categoria
        (dias desde a última compra da categoria ÷ vida útil típica dela) com o histórico de
        troca/envio/recolhimento ligado a cada um. Regra fixa hoje, sem modelo estatístico -- ver o
        desenho completo pra saber o que falta pra virar previsão de verdade.
      </p>

      <div className="grid sm:grid-cols-4 gap-4">
        {RECOMPRA_SEGMENTOS.map((s) => (
          <Link
            key={s}
            href={buildHref({ view: "recompra", q, segmento: filterSegmento === s ? undefined : s })}
            className="rounded-xl border p-4 flex flex-col gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: `color-mix(in srgb, ${RECOMPRA_SEGMENTO_COLORS[s]} ${filterSegmento === s ? 10 : 5}%, var(--surface-1))`,
              borderColor: `color-mix(in srgb, ${RECOMPRA_SEGMENTO_COLORS[s]} ${filterSegmento === s ? 100 : 35}%, var(--border))`,
              borderTopWidth: 3,
              borderTopColor: RECOMPRA_SEGMENTO_COLORS[s],
            }}
          >
            <span className="text-2xl font-bold" style={{ color: RECOMPRA_SEGMENTO_COLORS[s] }}>
              {porSegmento.get(s) ?? 0}
            </span>
            <span className="text-sm font-medium flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
              {RECOMPRA_SEGMENTO_LABELS[s]}
              <span
                title={RECOMPRA_SEGMENTO_DESCRICOES[s]}
                aria-label={RECOMPRA_SEGMENTO_DESCRICOES[s]}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)", cursor: "help" }}
              >
                i
              </span>
            </span>
          </Link>
        ))}
      </div>

      <form action="/clientes" method="GET" className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="view" value="recompra" />
        {filterSegmento ? <input type="hidden" name="segmento" value={filterSegmento} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome ou CPF/CNPJ…"
          className="text-sm flex-1 min-w-[220px] rounded border px-3 py-2"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="text-sm px-4 py-2 rounded font-medium" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Buscar
        </button>
        {q || filterSegmento ? (
          <Link href={buildHref({ view: "recompra" })} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar
          </Link>
        ) : null}
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} cliente{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${pageClamped} de ${totalPages}` : ""}
      </p>

      {pageItems.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum cliente encontrado.
          </p>
        </div>
      ) : (
        // min-w-0: este bloco é filho direto do "flex flex-col" da página
        // -- sem isso, o item flex nunca encolhe abaixo da largura natural
        // da tabela e o overflow-x-auto nunca chega a rolar de verdade
        // (mesma causa raiz do bug corrigido em ClientesNivelTable.tsx
        // 15/09/2026).
        <div className="min-w-0 rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <DualScrollTable>
            <table className="w-full text-sm">
              <thead>
                {/* Cabeçalho compacto/uppercase -- pedido do Victor
                    16/09/2026: "fiquem com a tabela muito parecida com a
                    lógica dessa" (tela de Entregas, EntregasFlatList.tsx). */}
                <tr
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }}
                >
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nome</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Segmento</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Categoria em janela</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Sugestão (cross-sell)</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nível</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Atrito</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Última compra</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Gasto acumulado</th>
                  {/* CLV preditivo (Fase 4) ajustado pelo índice de atrito
                      desta mesma linha -- metade do CLV bruto quando
                      "Atrito" (coluna acima) é alto, ver comentário completo
                      em recompra.ts. */}
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CLV ajustado
                      <span
                        title={`CLV projetado (${CLV_HORIZONTE_ANOS} anos, mesmo cálculo da aba Nível de relacionamento) com 50% de desconto quando o atrito é alto -- cliente insatisfeito tende a não voltar no mesmo ritmo. '—' = sem categoria reconhecida pra projetar.`}
                        aria-label="Como o CLV ajustado é calculado"
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)", cursor: "help" }}
                      >
                        i
                      </span>
                    </span>
                  </th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Contato</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Compras</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {pageItems.map((c: RecompraCandidato) => (
                  <ClienteHistoricoRow
                    key={c.clientId}
                    clientId={c.clientId}
                    name={c.nome ?? c.clientId}
                    comprasCount={c.compras}
                    accentColor={RECOMPRA_SEGMENTO_COLORS[c.segmento]}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          color: RECOMPRA_SEGMENTO_COLORS[c.segmento],
                          background: `color-mix(in srgb, ${RECOMPRA_SEGMENTO_COLORS[c.segmento]} 15%, transparent)`,
                        }}
                      >
                        {RECOMPRA_SEGMENTO_LABELS[c.segmento]}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {/* "📦 entrega confirmada" saiu 12/09/2026 -- a
                          cross-referência com totvs_delivery_cargas que
                          calculava isso era a maior parte do custo da
                          view/materialized view (ver comentário em
                          recompra.ts). Agora conta sempre a partir da data
                          do pedido, direto. */}
                      {c.categoriaJanela ? (
                        `${c.categoriaJanela} · há ${c.diasDesdeCategoria} dias`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: c.sugestaoCrossSell ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {c.sugestaoCrossSell ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {CLIENTE_NIVEL_LABELS[c.nivel]}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={
                          c.atritoAlto
                            ? { color: "var(--status-critical)", background: "color-mix(in srgb, var(--status-critical) 15%, transparent)" }
                            : { color: "var(--text-muted)", background: "var(--surface-2)" }
                        }
                        title={`${c.atritoScore} ponto${c.atritoScore === 1 ? "" : "s"} de atrito acumulado`}
                      >
                        {c.atritoAlto ? "alto" : "baixo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDateOnly(c.ultimaCompra)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap font-semibold" style={{ color: "var(--brand-green)" }}>
                      {formatBRL(c.gastoAcumulado)}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.clvAjustado !== null ? formatBRL(c.clvAjustado) : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <RecompraContatoCell clientId={c.clientId} segmento={c.segmento} contato={c.ultimoContato} />
                    </td>
                  </ClienteHistoricoRow>
                ))}
              </tbody>
            </table>
          </DualScrollTable>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ view: "recompra", q, segmento: filterSegmento, page: Math.max(1, pageClamped - 1) })}
            aria-disabled={pageClamped <= 1}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped <= 1 ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped <= 1 ? "none" : undefined,
            }}
          >
            ← Anterior
          </Link>
          <Link
            href={buildHref({ view: "recompra", q, segmento: filterSegmento, page: Math.min(totalPages, pageClamped + 1) })}
            aria-disabled={pageClamped >= totalPages}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped >= totalPages ? "none" : undefined,
            }}
          >
            Próxima →
          </Link>
        </div>
      ) : null}

      <RecompraNaoContatarManager items={naoContatar} />
    </>
  );
}

// Ícone por categoria (Lucide) -- confirmados existentes no pacote
// instalado via grep no .d.ts antes de usar (evita o gotcha do
// MessageSquareStar de mais cedo hoje, que não existia nessa versão).
const CATEGORIA_ICONS: Record<string, typeof Shield> = {
  protetor: Shield,
  travesseiro: Cloud,
  colchao: BedDouble,
  estofado: Sofa,
  cama: BedSingle,
  roupeiro: DoorClosed,
  mesa: Table2,
};

function confiancaBadge(pct: number): { label: string; color: string } {
  if (pct >= 60) return { label: "Alto", color: "var(--status-good)" };
  if (pct >= 35) return { label: "Médio", color: "var(--status-warning)" };
  return { label: "Baixo", color: "var(--status-critical)" };
}

function padraoLabelCurto(padrao: PadraoAssociacao): string {
  return padrao.tipo === "fidelidade" ? "Fidelidade Ativa" : `${padrao.categoriaOrigem.label} → ${padrao.categoriaDestino.label}`;
}

// Mensagem personalizada por padrão -- pedido do Victor 24/09/2026
// ("Gerar Oferta Personalizada via WhatsApp"): cross-sell menciona a
// categoria que o cliente já tem e a sugerida; fidelidade é genérica
// (não tem uma 2ª categoria específica pra citar).
function mensagemOferta(nome: string | null, padrao: PadraoAssociacao | undefined): string | undefined {
  if (!padrao) return undefined;
  if (padrao.tipo === "fidelidade") {
    return `Olá${nome ? `, ${nome}` : ""}! Você já é cliente de confiança da Lojas Maia -- separamos uma condição especial pra sua próxima compra. Quer que a gente te mande mais detalhes?`;
  }
  return `Olá${nome ? `, ${nome}` : ""}! Notamos que você já tem um(a) ${padrao.categoriaOrigem.label.toLowerCase()} -- que tal completar com um(a) ${padrao.categoriaDestino.label.toLowerCase()}? Temos uma condição especial pra você.`;
}

// Aba "Frequência & Potencial de Recompra" -- Motor de Recomendação por
// Padrões de Associação, pedido do Victor 24/09/2026 (2ª versão -- a 1ª,
// linha por cliente×categoria com selo de ciclo de reposição, foi
// substituída inteiramente por essa). Ver comentário completo em
// listPadroesEDeadsRecompra (recompra.ts) pro que é medido de verdade
// (Fidelidade Ativa) vs. estimado (janela do cross-sell) e por quê.
// Telefone (AcionarClienteButton) só é buscado pra página visível
// (listPhonePorClienteIds), nunca pro dataset inteiro filtrado.
async function FrequenciaView({ q, padrao, page }: { q?: string; padrao?: string; page: number }) {
  const { padroes, leads: todosLeads } = await listPadroesEDeadsRecompra();
  const padroesPorId = new Map(padroes.map((p) => [p.id, p]));

  const filtroPadrao = padrao && padroesPorId.has(padrao) ? padrao : undefined;
  let filtrados = filtroPadrao ? todosLeads.filter((l) => l.padraoId === filtroPadrao) : todosLeads;
  const qLower = q?.trim().toLowerCase();
  if (qLower) filtrados = filtrados.filter((l) => (l.nome ?? "").toLowerCase().includes(qLower));

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItemsRaw = filtrados.slice((pageClamped - 1) * LIST_PAGE_SIZE, pageClamped * LIST_PAGE_SIZE);

  const clientIdsNaPagina = [...new Set(pageItemsRaw.map((l) => l.clientId))];
  const phonePorCliente = await listPhonePorClienteIds(clientIdsNaPagina);
  const pageItems = pageItemsRaw.map((l) => ({ ...l, phone: phonePorCliente.get(l.clientId) ?? null }));

  return (
    <>
      <p className="text-xs -mt-4 max-w-2xl" style={{ color: "var(--text-muted)" }}>
        {todosLeads.length} clientes prontos pra contato, a partir de {padroes.length} padrão
        {padroes.length === 1 ? "" : "ões"} de comportamento detectado{padroes.length === 1 ? "" : "s"} no histórico
        real de vendas -- não é dado simulado, é o mesmo motor de afinidade de categoria já usado na aba
        &quot;Propensão a recompra&quot;, mais um padrão novo de recorrência.
      </p>

      {padroes.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum padrão com amostra suficiente ainda.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {padroes.map((p) => {
            const badge = confiancaBadge(p.confiancaPct);
            if (p.tipo === "fidelidade") {
              return (
                <div
                  key={p.id}
                  className="rounded-xl border p-4 flex flex-col gap-2"
                  style={{ background: "color-mix(in srgb, var(--brand-orange) 5%, var(--surface-1))", borderColor: "var(--border)", borderTopWidth: 3, borderTopColor: "var(--brand-orange)" }}
                >
                  <div className="flex items-center gap-2">
                    <Repeat className="w-5 h-5" style={{ color: "var(--brand-orange)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Fidelidade Ativa
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Clientes com {p.compraMinima}+ compras tendem a retornar a cada{" "}
                    <strong>~{Math.round(p.intervaloMedioDias / 30)} meses</strong> (mediana medida, não estimada).
                  </p>
                  <div className="flex items-center gap-1.5 mt-auto">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ color: badge.color, background: `color-mix(in srgb, ${badge.color} 15%, transparent)` }}
                    >
                      {badge.label} · {p.confiancaPct}%
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      com base em {p.amostraTotal} clientes
                    </span>
                  </div>
                </div>
              );
            }
            const IconeOrigem = CATEGORIA_ICONS[p.categoriaOrigem.key] ?? Table2;
            const IconeDestino = CATEGORIA_ICONS[p.categoriaDestino.key] ?? Table2;
            return (
              <div
                key={p.id}
                className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ background: "color-mix(in srgb, var(--brand-orange) 5%, var(--surface-1))", borderColor: "var(--border)", borderTopWidth: 3, borderTopColor: "var(--brand-orange)" }}
              >
                <div className="flex items-center gap-2">
                  <IconeOrigem className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                  <ArrowRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <IconeDestino className="w-5 h-5" style={{ color: "var(--brand-orange)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {p.categoriaOrigem.label} → {p.categoriaDestino.label}
                  </span>
                </div>
                <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                  Janela estimada: ~{p.janelaMesesEstimativa} meses
                  <span
                    title="Estimativa pelo ciclo típico de reposição da categoria seguinte (mesmo número usado no resto do motor) -- não é o intervalo medido entre as duas compras. Medir isso de verdade exigiria reescanear o histórico de item inteiro, fora de escopo por ora."
                    aria-label="Como a janela é estimada"
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)", cursor: "help" }}
                  >
                    i
                  </span>
                </p>
                <div className="flex items-center gap-1.5 mt-auto flex-wrap">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ color: badge.color, background: `color-mix(in srgb, ${badge.color} 15%, transparent)` }}
                  >
                    {badge.label} · {p.confiancaPct}%
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    com base em {p.amostraOrigem} clientes
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill href={buildHref({ view: "frequencia", q })} label="Todos" selected={!filtroPadrao} />
        {padroes.map((p) => (
          <FilterPill key={p.id} href={buildHref({ view: "frequencia", q, padrao: p.id })} label={padraoLabelCurto(p)} selected={filtroPadrao === p.id} />
        ))}
      </div>

      <form action="/clientes" method="GET" className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="view" value="frequencia" />
        {filtroPadrao ? <input type="hidden" name="padrao" value={filtroPadrao} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome…"
          className="text-sm flex-1 min-w-[220px] rounded border px-3 py-2"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="text-sm px-4 py-2 rounded font-medium" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Buscar
        </button>
        {q ? (
          <Link href={buildHref({ view: "frequencia", padrao: filtroPadrao })} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar
          </Link>
        ) : null}
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} lead{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${pageClamped} de ${totalPages}` : ""}
      </p>

      {pageItems.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum cliente encontrado.
          </p>
        </div>
      ) : (
        <div className="min-w-0 rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <DualScrollTable>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }}
                >
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Cliente</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nível</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Padrão ativado</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Próxima compra provável</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Confiança</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Ação</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Compras</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {pageItems.map((l) => {
                  const badge = confiancaBadge(l.confiancaPct);
                  const padraoDoLead = padroesPorId.get(l.padraoId);
                  return (
                    <ClienteHistoricoRow
                      key={`${l.clientId}::${l.padraoId}`}
                      clientId={l.clientId}
                      name={l.nome ?? l.clientId}
                      accentColor={badge.color}
                    >
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {CLIENTE_NIVEL_LABELS[l.nivel]}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {l.padraoLabel}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        {l.proximaCompraProvavel}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ color: badge.color, background: `color-mix(in srgb, ${badge.color} 15%, transparent)` }}
                        >
                          {badge.label} · {l.confiancaPct}%
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <AcionarClienteButton nome={l.nome} phone={l.phone} mensagem={mensagemOferta(l.nome, padraoDoLead)} />
                      </td>
                    </ClienteHistoricoRow>
                  );
                })}
              </tbody>
            </table>
          </DualScrollTable>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ view: "frequencia", q, padrao: filtroPadrao, page: Math.max(1, pageClamped - 1) })}
            aria-disabled={pageClamped <= 1}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped <= 1 ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped <= 1 ? "none" : undefined,
            }}
          >
            ← Anterior
          </Link>
          <Link
            href={buildHref({ view: "frequencia", q, padrao: filtroPadrao, page: Math.min(totalPages, pageClamped + 1) })}
            aria-disabled={pageClamped >= totalPages}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped >= totalPages ? "none" : undefined,
            }}
          >
            Próxima →
          </Link>
        </div>
      ) : null}
    </>
  );
}

// Aba "Estornos" -- pedido do Victor 22/09/2026: histórico de pedidos de
// reembolso do SAC/lojas, curado à mão a partir do grupo de WhatsApp "Lojas
// Maia e Líder Caixas" (backfill de 59 casos, 27/07 a 06/09/2026 -- ver
// migration 0135_estornos.sql) + cadastro de novos casos direto por aqui
// daqui pra frente (EstornoFormCard.tsx), mesmo espírito de Avaliações
// Google (sem API pra puxar isso automaticamente, registro manual). Sem
// paginação/filtro no banco (listEstornos busca tudo) -- mesmo padrão de
// NivelView/RecompraView acima, tabela pequena o bastante pra caber
// inteira na memória.
async function EstornosView({ q, loja, page }: { q?: string; loja?: string; page: number }) {
  const todos = await listEstornos();

  // Loja é texto livre (como foi digitado no grupo do WhatsApp, não um ID
  // de `stores`) -- agrupamento por string exata, não um enum fechado como
  // nível/status/segmento nas outras abas. Ordenado por valor reembolsado
  // (quem pesa mais no total primeiro), não por nome -- é a pergunta mais
  // provável ("onde está saindo mais dinheiro em estorno").
  const porLoja = new Map<string, { count: number; total: number }>();
  for (const e of todos) {
    const entry = porLoja.get(e.loja) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += e.valorReembolso;
    porLoja.set(e.loja, entry);
  }
  const lojasOrdenadas = [...porLoja.entries()].sort((a, b) => b[1].total - a[1].total);

  const qLower = q?.trim().toLowerCase();
  let filtrados = todos;
  if (loja) filtrados = filtrados.filter((e) => e.loja === loja);
  if (qLower) {
    filtrados = filtrados.filter(
      (e) =>
        e.cliente.toLowerCase().includes(qLower) ||
        (e.cpfCnpj ?? "").toLowerCase().includes(qLower) ||
        (e.produto ?? "").toLowerCase().includes(qLower) ||
        (e.motivo ?? "").toLowerCase().includes(qLower) ||
        (e.status ?? "").toLowerCase().includes(qLower)
    );
  }
  // Já vem ordenado por data_solicitacao desc (listEstornos) -- filtro
  // acima preserva a ordem, sem precisar resortear.

  const totalValorGeral = todos.reduce((sum, e) => sum + e.valorReembolso, 0);
  const totalValorFiltrado = filtrados.reduce((sum, e) => sum + e.valorReembolso, 0);
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = filtrados.slice((pageClamped - 1) * LIST_PAGE_SIZE, pageClamped * LIST_PAGE_SIZE);

  return (
    <>
      <p className="text-xs -mt-4 max-w-2xl" style={{ color: "var(--text-muted)" }}>
        {todos.length} estornos registrados desde 27/07/2026 — R${" "}
        <strong style={{ color: "var(--status-critical)" }}>{formatBRL(totalValorGeral)}</strong> reembolsados no total. Histórico curado à
        mão a partir do grupo de WhatsApp &quot;Lojas Maia e Líder Caixas&quot; (o WhatsApp Web só libera histórico a partir da data em que
        o time entrou no grupo, não cobre período anterior) + cadastro manual direto aqui.
      </p>

      <EstornoFormCard />

      <div className="grid sm:grid-cols-4 gap-4">
        {lojasOrdenadas.map(([lojaNome, info]) => (
          <Link
            key={lojaNome}
            href={buildHref({ view: "estornos", q, loja: loja === lojaNome ? undefined : lojaNome })}
            className="rounded-xl border p-4 flex flex-col gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: `color-mix(in srgb, var(--status-critical) ${loja === lojaNome ? 10 : 5}%, var(--surface-1))`,
              borderColor: `color-mix(in srgb, var(--status-critical) ${loja === lojaNome ? 100 : 35}%, var(--border))`,
              borderTopWidth: 3,
              borderTopColor: "var(--status-critical)",
            }}
          >
            <span className="text-2xl font-bold" style={{ color: "var(--status-critical)" }}>
              {info.count}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {lojaNome}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatBRL(info.total)}
            </span>
          </Link>
        ))}
      </div>

      <form action="/clientes" method="GET" className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="view" value="estornos" />
        {loja ? <input type="hidden" name="loja" value={loja} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por cliente, CPF, produto, motivo ou status…"
          className="text-sm flex-1 min-w-[220px] rounded border px-3 py-2"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="text-sm px-4 py-2 rounded font-medium" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Buscar
        </button>
        {q || loja ? (
          <Link href={buildHref({ view: "estornos" })} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar
          </Link>
        ) : null}
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} estorno{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"} · R$ {formatBRL(totalValorFiltrado)} no recorte
        {totalPages > 1 ? ` · página ${pageClamped} de ${totalPages}` : ""}
      </p>

      {pageItems.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum estorno encontrado.
          </p>
        </div>
      ) : (
        <div className="min-w-0 rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <DualScrollTable>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }}
                >
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Solicitação</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Cliente</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Loja</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Valor</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Venda</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Pagamento</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Motivo</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Produto</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Autorizado por</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {pageItems.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDateOnly(e.dataSolicitacao)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      <span className="font-medium">{e.cliente}</span>
                      {e.cpfCnpj ? (
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                          {e.cpfCnpj}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {e.loja}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap font-semibold" style={{ color: "var(--status-critical)" }}>
                      {formatBRL(e.valorReembolso)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDateOnly(e.dataVenda)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {e.formaPagamento ?? "—"}
                    </td>
                    <td className="px-4 py-2 max-w-[280px]" style={{ color: "var(--text-secondary)" }}>
                      {e.motivo ?? "—"}
                    </td>
                    <td className="px-4 py-2 max-w-[280px]" style={{ color: "var(--text-secondary)" }}>
                      {e.produto ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {e.autorizadoPor ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {e.status ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DualScrollTable>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ view: "estornos", q, loja, page: Math.max(1, pageClamped - 1) })}
            aria-disabled={pageClamped <= 1}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped <= 1 ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped <= 1 ? "none" : undefined,
            }}
          >
            ← Anterior
          </Link>
          <Link
            href={buildHref({ view: "estornos", q, loja, page: Math.min(totalPages, pageClamped + 1) })}
            aria-disabled={pageClamped >= totalPages}
            className="text-sm px-3 py-1.5 rounded border"
            style={{
              borderColor: "var(--border)",
              color: pageClamped >= totalPages ? "var(--text-muted)" : "var(--text-primary)",
              pointerEvents: pageClamped >= totalPages ? "none" : undefined,
            }}
          >
            Próxima →
          </Link>
        </div>
      ) : null}
    </>
  );
}
