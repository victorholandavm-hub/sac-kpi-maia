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
          {/* Colunas -- pedido do Victor 28/08/2026: "quer que fique mais
              organizado e organizado por colunas, como são organizadas
              as outras telas" (a versão anterior repetia "Registrado
              por —"/"Por —" por extenso em toda linha, mesmo quando não
              tinha essa informação -- ficava poluído com dado histórico
              importado, que não tem responsible/withdrawnBy). */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
            <span className="flex-1 min-w-0 text-left">Produto</span>
            <span className="w-28 shrink-0 text-right">Fábrica</span>
            <span className="w-24 shrink-0 text-right">Data</span>
            <span className="w-40 shrink-0 text-right">Situação</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {movements.map((m) => {
              const pending = isPendingWithdrawal(m);
              return (
                <div key={m.id} className="flex items-start gap-3 px-4 py-3 flex-wrap">
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                      >
                        {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                      </span>
                      <span className="text-sm font-medium text-left" style={{ color: "var(--text-primary)" }}>
                        {m.product}
                      </span>
                      {m.code ? (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {m.code}
                        </span>
                      ) : null}
                    </div>
                    {m.clientName || m.volume ? (
                      <span className="text-xs text-left" style={{ color: "var(--text-secondary)" }}>
                        {m.clientName ?? ""}
                        {m.clientName && m.volume ? " · " : ""}
                        {m.volume ? `vol. ${m.volume}` : ""}
                      </span>
                    ) : null}
                    {m.notes ? (
                      <span className="text-xs text-left" style={{ color: "var(--text-muted)" }}>
                        {m.notes}
                      </span>
                    ) : null}
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs" style={{ color: "var(--text-secondary)" }}>
                    {m.factory ?? "—"}
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs" style={{ color: "var(--text-muted)" }}>
                    {pending ? "—" : formatDateOnly(m.movementDate) || "—"}
                  </span>
                  <span className="w-40 shrink-0 text-right">
                    {/* Pendente de retirada -- pedido do Victor 28/08/2026:
                        "Assistencia registra e a equipe tecnica é que
                        retira do estoque e lança a data que foi
                        retirada". Sem movement_date ainda pra tipo
                        "retirado" = esperando a equipe técnica dar baixa
                        (/assistencia/tecnico/estoque). */}
                    {pending ? (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: "var(--brand-orange-soft)", color: "var(--brand-orange)" }}
                      >
                        Pendente de retirada
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {m.movementType === "retirado" && m.withdrawnBy
                          ? `Retirado por ${m.withdrawnBy}`
                          : m.responsible
                            ? `Por ${m.responsible}`
                            : "—"}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
