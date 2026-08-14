import Link from "next/link";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import {
  getClientesResumo,
  listClientes,
  isClienteStatus,
  CLIENTE_STATUSES,
  CLIENTE_STATUS_LABELS,
  CLIENTE_STATUS_COLORS,
} from "@/lib/clientes";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function buildHref(params: { q?: string; status?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireDashboardAuth();
  const { q, status, page: pageParam } = await searchParams;
  const filterStatus = isClienteStatus(status) ? status : undefined;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

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
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Clientes
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Perfil de compra/relacionamento, direto do cadastro do Protheus — {resumo.totalGeral} clientes sincronizados.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {CLIENTE_STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ q, status: filterStatus === s ? undefined : s })}
            className="rounded-xl border p-5 flex flex-col gap-1"
            style={{
              background: "var(--surface-1)",
              borderColor: filterStatus === s ? CLIENTE_STATUS_COLORS[s] : "var(--border)",
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
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome, telefone, cidade ou CPF/CNPJ…"
          className="text-sm flex-1 min-w-[220px] rounded border px-3 py-2"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          className="text-sm px-4 py-2 rounded font-medium"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Buscar
        </button>
        {q || filterStatus ? (
          <Link href="/clientes" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
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
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Nome</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Status</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Última compra</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Dias sem comprar</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Telefone</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Cidade</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {listResult.items.map((c) => (
                  <tr key={c.protheusCode}>
                    <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                      {c.name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ color: CLIENTE_STATUS_COLORS[c.status], borderColor: CLIENTE_STATUS_COLORS[c.status] }}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ q, status: filterStatus, page: Math.max(1, page - 1) })}
            aria-disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded border"
            style={{ borderColor: "var(--border)", color: page <= 1 ? "var(--text-muted)" : "var(--text-primary)", pointerEvents: page <= 1 ? "none" : undefined }}
          >
            ← Anterior
          </Link>
          <Link
            href={buildHref({ q, status: filterStatus, page: Math.min(totalPages, page + 1) })}
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
    </div>
  );
}
