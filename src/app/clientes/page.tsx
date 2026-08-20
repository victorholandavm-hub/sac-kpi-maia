import Link from "next/link";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import {
  getClientesResumo,
  listClientes,
  listClientesPorNivel,
  isClienteStatus,
  isClienteNivel,
  CLIENTE_STATUSES,
  CLIENTE_STATUS_LABELS,
  CLIENTE_STATUS_COLORS,
  CLIENTE_NIVEIS,
  CLIENTE_NIVEL_LABELS,
  CLIENTE_NIVEL_COLORS,
  CLIENTE_NIVEL_CRITERIA,
  type ClienteNivelInfo,
} from "@/lib/clientes";
import { AppHeader } from "@/components/AppHeader";
import { ClienteHistoricoRow } from "@/components/ClienteHistoricoRow";

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

function buildHref(params: { view?: string; q?: string; status?: string; nivel?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.view && params.view !== "nivel") sp.set("view", params.view);
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.nivel) sp.set("nivel", params.nivel);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string; nivel?: string; page?: string }>;
}) {
  await requireDashboardAuth();
  const { view: viewParam, q, status, nivel, page: pageParam } = await searchParams;
  // Nível de relacionamento é a aba de aterrissagem (pedido do Victor
  // 15/08/2026) -- "status" só aparece quando pedido explicitamente na URL.
  const view = viewParam === "status" ? "status" : "nivel";
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

      <div className="flex items-center gap-2">
        <Link
          href={buildHref({ view: "status" })}
          className="text-sm px-3 py-1.5 rounded-full border transition-colors"
          style={{
            borderColor: view === "status" ? "var(--brand-orange)" : "var(--border)",
            background: view === "status" ? "var(--brand-orange)" : "transparent",
            color: view === "status" ? "#fff" : "var(--text-secondary)",
            fontWeight: view === "status" ? 600 : 400,
          }}
        >
          Status (Protheus)
        </Link>
        <Link
          href={buildHref({ view: "nivel" })}
          className="text-sm px-3 py-1.5 rounded-full border transition-colors"
          style={{
            borderColor: view === "nivel" ? "var(--brand-orange)" : "var(--border)",
            background: view === "nivel" ? "var(--brand-orange)" : "transparent",
            color: view === "nivel" ? "#fff" : "var(--text-secondary)",
            fontWeight: view === "nivel" ? 600 : 400,
          }}
        >
          Nível de relacionamento
        </Link>
      </div>

      {view === "status" ? (
        <StatusView q={q} status={status} page={page} />
      ) : (
        <NivelView q={q} nivel={nivel} page={page} />
      )}
    </div>
  );
}

async function StatusView({ q, status, page }: { q?: string; status?: string; page: number }) {
  const filterStatus = isClienteStatus(status) ? status : undefined;

  const [resumo, listResult] = await Promise.all([
    getClientesResumo(),
    listClientes({ q, status: filterStatus, page }),
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
        <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs"
                  style={{ color: "var(--text-secondary)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }}
                >
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nome</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Status</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Última compra</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Dias sem comprar</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Telefone</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Cidade</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {listResult.items.map((c) => (
                  <ClienteHistoricoRow
                    key={c.protheusCode}
                    clientId={c.protheusCode}
                    name={c.name}
                    colSpan={6}
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

async function NivelView({ q, nivel, page }: { q?: string; nivel?: string; page: number }) {
  const filterNivel = isClienteNivel(nivel) ? nivel : undefined;
  const todos = await listClientesPorNivel();

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

      <div className="grid sm:grid-cols-5 gap-4">
        {CLIENTE_NIVEIS.map((n) => (
          <Link
            key={n}
            href={buildHref({ view: "nivel", q, nivel: filterNivel === n ? undefined : n })}
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
        {q || filterNivel ? (
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
        <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--brand-green)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs"
                  style={{ color: "var(--text-secondary)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }}
                >
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Posição</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nome</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Nível</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Compras</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Gasto acumulado</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Cliente desde</th>
                  <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Última compra</th>
                  <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">Dias sem comprar</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {pageItems.map((c: ClienteNivelInfo) => (
                  <ClienteHistoricoRow
                    key={c.clientId}
                    clientId={c.clientId}
                    name={c.nome ?? c.clientId}
                    colSpan={8}
                    accentColor={CLIENTE_NIVEL_COLORS[c.nivel]}
                    leadingCells={
                      <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {c.posicaoNoNivel}º
                      </td>
                    }
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            color: CLIENTE_NIVEL_COLORS[c.nivel],
                            background: `color-mix(in srgb, ${CLIENTE_NIVEL_COLORS[c.nivel]} 15%, transparent)`,
                          }}
                        >
                          {CLIENTE_NIVEL_LABELS[c.nivel]}
                        </span>
                        {c.inativoRecente ? (
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{ color: "#fff", background: "var(--status-critical)" }}
                            title="Sem comprar há 180 dias ou mais -- nível é histórico acumulado, não reflete isso sozinho"
                          >
                            ⚠ inativo
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.compras}
                    </td>
                    <td className="text-right px-4 py-2 whitespace-nowrap font-semibold" style={{ color: "var(--brand-green)" }}>
                      {formatBRL(c.gastoAcumulado)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDateOnly(c.primeiraCompra)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDateOnly(c.ultimaCompra)}
                    </td>
                    <td
                      className="text-right px-4 py-2 whitespace-nowrap"
                      style={{ color: c.inativoRecente ? "var(--status-critical)" : "var(--text-secondary)" }}
                    >
                      {c.diasSemComprar ?? "—"}
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
            href={buildHref({ view: "nivel", q, nivel: filterNivel, page: Math.max(1, pageClamped - 1) })}
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
            href={buildHref({ view: "nivel", q, nivel: filterNivel, page: Math.min(totalPages, pageClamped + 1) })}
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
