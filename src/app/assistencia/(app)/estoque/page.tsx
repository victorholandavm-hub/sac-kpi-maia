import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStockMovements, isMovementType } from "@/lib/stockMovements";
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
];

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { type, q } = await searchParams;
  const filterType = isMovementType(type) ? type : undefined;
  const movements = await listStockMovements({ movementType: filterType, q });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={buildHref({ type: f.value ?? undefined, q })}
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: (f.value ?? undefined) === filterType ? "var(--surface-1)" : "transparent",
                color: (f.value ?? undefined) === filterType ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: (f.value ?? undefined) === filterType ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          ))}
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
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
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
                  <span>{formatDateOnly(m.movementDate)}</span>
                  <span>{m.responsible ? `Por ${m.responsible}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
