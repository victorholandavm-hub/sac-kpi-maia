import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStockMovements, isMovementType, isPendingWithdrawal } from "@/lib/stockMovements";
import { MOVEMENT_TYPE_LABELS } from "@/lib/assistenciaLabels";

function formatDateOnly(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function buildHref(params: { type?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/assistencia/estoque?${qs}` : "/assistencia/estoque";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: "Retirados", value: "retirado" },
  { label: "Devolvidos", value: "devolvido" },
  { label: "Reparados", value: "reparado" },
  // Pedido do Victor 28/08/2026: assistência registra a retirada, a
  // equipe técnica dá baixa depois (/assistencia/tecnico/estoque) --
  // esse filtro mostra só o que a assistência ainda tá esperando a
  // equipe técnica confirmar (isPendingWithdrawal, stockMovements.ts).
  { label: "Pendentes de retirada", value: "pendente" },
];

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { type, q } = await searchParams;
  const onlyPending = type === "pendente";
  const filterType = isMovementType(type) ? type : undefined;
  const movements = await listStockMovements({ movementType: filterType, q, onlyPendingWithdrawal: onlyPending });

  return (
    <div className="flex flex-col gap-4">
      {/* "Controle Assistência" -- pedido do Victor 27/08/2026, mesmo
          desenho de pecas/page.tsx (ver lá). */}
      <div className="flex items-center gap-2">
        <Link href="/assistencia/pecas" className="text-base font-bold px-4 py-2 rounded-full" style={{ border: "2px solid var(--border)", color: "var(--text-secondary)" }}>
          Peças
        </Link>
        <Link href="/assistencia/fornecedores" className="text-base font-bold px-4 py-2 rounded-full" style={{ border: "2px solid var(--border)", color: "var(--text-secondary)" }}>
          Fornecedores
        </Link>
        <Link href="/assistencia/estoque" className="text-base font-bold px-4 py-2 rounded-full" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          Estoque
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => {
            // Comparado contra o `type` cru (não `filterType`, que só
            // reconhece os 3 MovementType de verdade) -- "pendente" é um
            // filtro à parte, não um movement_type.
            const active = (f.value ?? undefined) === (type || undefined);
            return (
              <Link
                key={f.label}
                href={buildHref({ type: f.value ?? undefined, q })}
                className="text-xs px-3 py-1 rounded-full border"
                style={{
                  borderColor: "var(--border)",
                  background: active ? "var(--surface-1)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/assistencia/estoque/nova"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova movimentação
        </Link>
      </div>

      <form action="/assistencia/estoque" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterType ? <input type="hidden" name="type" value={filterType} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por produto, código ou cliente…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
      </form>

      {movements.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma movimentação encontrada.
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                    </span>
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
                    {m.factory ? `${m.factory} · ` : ""}
                    {m.clientName ?? ""}
                    {m.volume ? ` · vol. ${m.volume}` : ""}
                  </p>
                  {m.notes ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {m.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {/* Pendente de retirada -- pedido do Victor 28/08/2026:
                      "Assistencia registra e a equipe tecnica é que
                      retira do estoque e lança a data que foi retirada".
                      Sem movement_date ainda pra tipo "retirado" =
                      esperando a equipe técnica dar baixa
                      (/assistencia/tecnico/estoque). */}
                  {isPendingWithdrawal(m) ? (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "var(--brand-orange-soft)", color: "var(--brand-orange)" }}
                    >
                      Pendente de retirada
                    </span>
                  ) : (
                    <>
                      <span>{formatDateOnly(m.movementDate)}</span>
                      <span>
                        {m.movementType === "retirado" && m.withdrawnBy
                          ? `Retirado por ${m.withdrawnBy}`
                          : m.responsible
                            ? `Por ${m.responsible}`
                            : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
