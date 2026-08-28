import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession, tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { listStockMovements } from "@/lib/stockMovements";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { WithdrawStockMovementButton } from "@/components/assistencia/WithdrawStockMovementButton";

export const dynamic = "force-dynamic";

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function buildHref(view?: string) {
  return view ? `/assistencia/tecnico/estoque?view=${view}` : "/assistencia/tecnico/estoque";
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
  searchParams: Promise<{ view?: string }>;
}) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const { view } = await searchParams;
  const showHistorico = view === "retiradas";

  const movements = showHistorico
    ? (await listStockMovements({ movementType: "retirado" })).filter((m) => m.movementDate)
    : await listStockMovements({ onlyPendingWithdrawal: true });

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader
          title={`Olá, ${tecnicoName}`}
          subtitle="Retiradas de produto do estoque pra Assistência Técnica, registradas pela assistência -- confirme aqui quando retirar de verdade."
        >
          <div className="flex items-center gap-4">
            <Link href="/assistencia/tecnico" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              ← Voltar
            </Link>
            <form action={tecnicoSignOut}>
              <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Sair
              </button>
            </form>
          </div>
        </AssistenciaHeader>

        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              [undefined, "Pendentes de retirada"],
              ["retiradas", "Já retiradas"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={label}
              href={buildHref(value)}
              className="text-xs px-3 py-1.5 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: (value ?? undefined) === view ? "var(--surface-1)" : "transparent",
                color: (value ?? undefined) === view ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: (value ?? undefined) === view ? 600 : 400,
              }}
            >
              {label}
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
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
            <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {m.product}
                      </span>
                      {m.code ? (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {m.code}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {m.clientName ?? "—"}
                      {m.volume ? ` · vol. ${m.volume}` : ""}
                    </p>
                    {m.notes ? (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {m.notes}
                      </p>
                    ) : null}
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Registrado por {m.responsible ?? "—"}
                      {m.loggedDate ? ` em ${formatDateOnly(m.loggedDate)}` : ""}
                    </p>
                  </div>
                  {showHistorico ? (
                    <div className="text-xs text-right shrink-0" style={{ color: "var(--text-muted)" }}>
                      <p>Retirado em {formatDateOnly(m.movementDate)}</p>
                      <p>Por {m.withdrawnBy ?? "—"}</p>
                    </div>
                  ) : (
                    <WithdrawStockMovementButton movementId={m.id} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
