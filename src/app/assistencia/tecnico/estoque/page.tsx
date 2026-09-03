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
// estoque e lança a data que foi retirada" (esclarecido 01/09/2026: quem
// retira o produto fisicamente do CD é a própria assistência -- a
// equipe técnica confirma aqui que essa saída já foi lançada no
// Protheus, e informa a data desse lançamento). A assistência já
// registra a retirada em /assistencia/estoque (formulário "Nova
// movimentação", tipo "Retirado do CD") sem preencher a data -- fica
// "pendente" (ver isPendingWithdrawal, stockMovements.ts) até a equipe
// técnica confirmar aqui, e lançar a data do lançamento no Protheus.
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
  // "Por" da aba Confirmadas, e a equipe técnica olha "o que tá
  // pendente agora"/"o que confirmei recentemente", não faz relatório por
  // período. Busca as duas listas (pendentes/histórico) em paralelo --
  // precisa das duas pra mostrar o contador de cada aba ao mesmo tempo.
  const [pendentes, historico, suppliers] = await Promise.all([
    listStockMovements({ onlyPendingWithdrawal: true, q, factory }),
    // Confirmada = `withdrawnBy` preenchido, não `movementDate` preenchido
    // (esclarecido 01/09/2026: ver isPendingWithdrawal em stockMovements.ts
    // -- `movementDate` pode já vir preenchido em registros antigos/importados
    // sem que a equipe técnica tenha realmente confirmado o lançamento).
    listStockMovements({ movementType: "retirado", q, factory }).then((rows) => rows.filter((m) => m.withdrawnBy)),
    listSuppliers(),
  ]);
  const movements = showHistorico ? historico : pendentes;

  return (
    <ToastProvider>
      {/* Mesmo tratamento full-width da Fila de Classificação (pedido
          do Victor 31/08/2026) -- cabeçalho próprio desta tela, não o
          AssistenciaHeader compartilhado (evita mudar outras telas do
          sistema de assistência que não foram pedidas). */}
      <div className="w-full flex flex-col min-w-0 bg-[#F9FAFB] min-h-screen">
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
                  Olá, {tecnicoName} — produto já retirado do CD pela assistência; confirme aqui quando o lançamento no Protheus estiver feito.
                </p>
              </div>
            </div>
            {/* Ações do cabeçalho como pílulas ghost (vidro fosco) --
                Guia de Componentes Maia (Design System, 01/09/2026). */}
            <div className="flex items-center gap-1 text-sm shrink-0">
              <Link
                href="/assistencia/tecnico"
                className="px-3 py-1.5 rounded-lg font-medium text-white/80 hover:text-white hover:bg-white dark:hover:bg-gray-700/10 transition-colors duration-150"
              >
                ← Fila de Classificação
              </Link>
              <form action={tecnicoSignOut}>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg font-medium text-white/80 hover:text-white hover:bg-white dark:hover:bg-gray-700/10 transition-colors duration-150"
                >
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
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2 text-sm flex-1 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
              />
              <button
                type="submit"
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150 shrink-0"
              >
                Buscar
              </button>
              {q || factory ? (
                <Link
                  href={buildHref({ view: showHistorico ? "retiradas" : undefined })}
                  className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 shrink-0"
                >
                  Limpar
                </Link>
              ) : null}
            </form>
          </div>

          {/* Segmented Control -- mesmo componente de tecnico/page.tsx
              (Guia de Componentes Maia, Design System 01/09/2026): duas
              opções trocando o contexto inteiro da tabela abaixo. */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 p-1 self-start">
            {(
              [
                [undefined, "Pendentes de retirada", pendentes.length],
                ["retiradas", "Confirmadas", historico.length],
              ] as const
            ).map(([value, label, count]) => (
              <Link
                key={label}
                href={buildHref({ view: value, q, factory })}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ${
                  (value ?? undefined) === view ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {label}
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500">({count})</span>
              </Link>
            ))}
          </div>

          {movements.length === 0 ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {showHistorico ? "Nenhuma retirada confirmada ainda." : "Nenhuma retirada pendente no momento."}
              </p>
            </div>
          ) : (
            // Grid horizontal puro, mesmo padrão de tecnico/page.tsx --
            // cada dado na sua própria coluna, texto corrido truncado
            // numa linha só (com title=... pro texto completo aparecer
            // no hover), sem empilhar produto/cliente/observação um
            // embaixo do outro dentro da mesma célula.
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: "760px", tableLayout: "fixed" }}>
                <colgroup>
                  <col />
                  <col style={{ width: "260px" }} />
                  <col style={{ width: "260px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: showHistorico ? "120px" : "140px" }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                    {["Produto", "Cliente / Volume", "Observação", showHistorico ? "Confirmado em" : "Lançado em", showHistorico ? "Por" : ""].map(
                      (h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {movements.map((m) => {
                    const productLabel = m.code ? `${m.product} · ${m.code}` : m.product;
                    const clienteVolume = clienteVolumeLine(m);
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                        <td className="px-3 py-2.5 align-top">
                          <span className="block truncate font-medium text-gray-800 dark:text-gray-100" title={productLabel}>
                            {productLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block truncate text-gray-600 dark:text-gray-300" title={clienteVolume}>
                            {clienteVolume}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block truncate text-gray-400 dark:text-gray-500" title={m.notes ?? ""}>
                            {m.notes ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap text-gray-400 dark:text-gray-500">
                          {formatDateOnly(showHistorico ? m.movementDate : m.loggedDate)}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {showHistorico ? (
                            <span className="block truncate text-gray-400 dark:text-gray-500">{m.withdrawnBy ?? "—"}</span>
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
