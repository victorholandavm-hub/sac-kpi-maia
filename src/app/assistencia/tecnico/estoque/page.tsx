import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession, tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { listStockMovements, type StockMovement } from "@/lib/stockMovements";
import { listSuppliers } from "@/lib/partOrders";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { WithdrawStockMovementButton } from "@/components/assistencia/WithdrawStockMovementButton";

export const dynamic = "force-dynamic";

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function buildHref(params: { view?: string; q?: string; factory?: string }) {
  const sp = new URLSearchParams();
  if (params.view) sp.set("view", params.view);
  if (params.q) sp.set("q", params.q);
  if (params.factory) sp.set("factory", params.factory);
  const qs = sp.toString();
  return qs ? `/assistencia/tecnico/estoque?${qs}` : "/assistencia/tecnico/estoque";
}

// Cliente + volume numa linha só, truncada -- mesmo padrão da coluna
// Produto de tecnico/page.tsx (ver productLine lá).
function clienteVolumeLine(m: StockMovement): string {
  if (!m.clientName && !m.volume) return "—";
  return [m.clientName, m.volume ? `vol. ${m.volume}` : null].filter(Boolean).join(" · ");
}

// Retirada de estoque pra Assistência Técnica -- pedido do Victor
// 28/08/2026: "Assistencia registra e a equipe tecnica é que retira do
// estoque e lança a data que foi retirada". A assistência já registra a
// retirada em /assistencia/estoque (formulário "Nova movimentação",
// tipo "Retirado do CD") sem preencher a data -- fica "pendente" (ver
// isPendingWithdrawal, stockMovements.ts) até a equipe técnica confirmar
// aqui, de verdade com o produto em mãos, e lançar a data.
export default async function TecnicoEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; factory?: string }>;
}) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const { view, q, factory } = await searchParams;
  const showHistorico = view === "retiradas";

  // Filtro por produto/código/cliente (q) e fábrica -- pedido do Victor
  // 31/08/2026: "ficou faltando os filtros na tela de estoque". Mesmos
  // dois filtros já usados em (app)/estoque/page.tsx (tela de
  // assistência/admin pra essa mesma tabela) -- "responsável" e "De/Até"
  // ficaram de fora aqui: quem retirou já aparece na própria coluna
  // "Por" da aba Já retiradas, e a equipe técnica olha "o que tá
  // pendente agora"/"o que retirei recentemente", não faz relatório por
  // período. Busca as duas listas (pendentes/histórico) em paralelo --
  // precisa das duas pra mostrar o contador de cada aba ao mesmo tempo.
  const [pendentes, historico, suppliers] = await Promise.all([
    listStockMovements({ onlyPendingWithdrawal: true, q, factory }),
    listStockMovements({ movementType: "retirado", q, factory }).then((rows) => rows.filter((m) => m.movementDate)),
    listSuppliers(),
  ]);
  const movements = showHistorico ? historico : pendentes;

  return (
    <ToastProvider>
      {/* Mesmo tratamento full-width da Fila de Classificação (pedido
          do Victor 31/08/2026) -- cabeçalho próprio desta tela, não o
          AssistenciaHeader compartilhado (evita mudar outras telas do
          sistema de assistência que não foram pedidas). */}
      <div className="w-full flex flex-col min-w-0">
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
                <h1 className="font-bold text-lg text-white truncate">Retiradas de Estoque</h1>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
                  Olá, {tecnicoName} — produto do estoque pra Assistência Técnica, registrado pela assistência.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm shrink-0">
              <Link href="/assistencia/tecnico" className="underline" style={{ color: "rgba(255,255,255,0.9)" }}>
                ← Fila de Classificação
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
          {/* Filtro de fábrica + busca -- mesma barra de tecnico/page.tsx. */}
          <div className="flex items-center gap-3 flex-wrap">
            <FilterSelect name="factory" placeholder="Todas as fábricas" options={suppliers} />
            <form action="/assistencia/tecnico/estoque" method="GET" className="flex items-center gap-2 flex-1 min-w-[280px]">
              {showHistorico ? <input type="hidden" name="view" value="retiradas" /> : null}
              {factory ? <input type="hidden" name="factory" value={factory} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por produto, código ou cliente…"
                className="rounded border px-3 py-2 text-sm flex-1"
                style={{ borderColor: "var(--border)" }}
              />
              <button type="submit" className="text-sm px-3 py-2 rounded border shrink-0" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                Buscar
              </button>
              {q || factory ? (
                <Link href={buildHref({ view: showHistorico ? "retiradas" : undefined })} className="text-xs underline shrink-0" style={{ color: "var(--text-secondary)" }}>
                  Limpar
                </Link>
              ) : null}
            </form>
          </div>

          <div className="flex items-center gap-1">
            {(
              [
                [undefined, "Pendentes de retirada", pendentes.length],
                ["retiradas", "Já retiradas", historico.length],
              ] as const
            ).map(([value, label, count]) => (
              <Link
                key={label}
                href={buildHref({ view: value, q, factory })}
                className="text-sm px-3 py-1.5 rounded-t-md border-b-2"
                style={{
                  borderColor: (value ?? undefined) === view ? "var(--brand-green)" : "transparent",
                  color: (value ?? undefined) === view ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: (value ?? undefined) === view ? 600 : 400,
                }}
              >
                {label}
                <span className="ml-1.5 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  ({count})
                </span>
              </Link>
            ))}
          </div>

          {movements.length === 0 ? (
            <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {showHistorico ? "Nenhuma retirada confirmada ainda." : "Nenhuma retirada pendente no momento."}
              </p>
            </div>
          ) : (
            // Grid horizontal puro, mesmo padrão de tecnico/page.tsx --
            // cada dado na sua própria coluna, texto corrido truncado
            // numa linha só (com title=... pro texto completo aparecer
            // no hover), sem empilhar produto/cliente/observação um
            // embaixo do outro dentro da mesma célula.
            <div className="rounded-lg border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <table className="w-full border-collapse text-xs" style={{ minWidth: "760px", tableLayout: "fixed" }}>
                <colgroup>
                  <col />
                  <col style={{ width: "260px" }} />
                  <col style={{ width: "260px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: showHistorico ? "120px" : "140px" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--gridline)" }}>
                    {["Produto", "Cliente / Volume", "Observação", showHistorico ? "Retirado em" : "Lançado em", showHistorico ? "Por" : ""].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: "var(--text-muted)", fontSize: "10.5px" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, index) => {
                    const productLabel = m.code ? `${m.product} · ${m.code}` : m.product;
                    const clienteVolume = clienteVolumeLine(m);
                    return (
                      <tr
                        key={m.id}
                        style={{
                          background: index % 2 === 1 ? "var(--surface-2)" : "var(--surface-1)",
                          borderBottom: "1px solid var(--gridline)",
                        }}
                      >
                        <td className="px-3 py-2 align-top">
                          <span className="block truncate font-medium" style={{ color: "var(--text-primary)" }} title={productLabel}>
                            {productLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="block truncate" style={{ color: "var(--text-secondary)" }} title={clienteVolume}>
                            {clienteVolume}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="block truncate" style={{ color: "var(--text-muted)" }} title={m.notes ?? ""}>
                            {m.notes ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                          {formatDateOnly(showHistorico ? m.movementDate : m.loggedDate)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {showHistorico ? (
                            <span className="block truncate" style={{ color: "var(--text-muted)" }}>
                              {m.withdrawnBy ?? "—"}
                            </span>
                          ) : (
                            <WithdrawStockMovementButton movementId={m.id} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
