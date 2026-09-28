import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { listReclamacoes, buildReclamacoesSummary, listProximasAudiencias } from "@/lib/reclamacoes";
import { isStatusInternoResolvido, STATUS_INTERNO_OPTIONS } from "@/lib/reclamacoesLabels";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { StatTile } from "@/components/StatTile";
import { BarRanking } from "@/components/BarRanking";

function buildHref(params: { status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/assistencia/reclamacoes?${qs}` : "/assistencia/reclamacoes";
}

function formatAudiencia(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Reclamações (Procon/Reclame Aqui/Judicial) -- pedido do Victor
// 28/09/2026: aba admin-only com a "inteligência" da planilha
// RECLAMAÇÕES.xlsx (histórico importado, ver migration 0140) + cadastrável
// daqui pra frente (a planilha para de ser fonte de verdade). Mesmo padrão
// de página de resumo + fila do resto do app (Estornos/financeiro): cards
// de resumo no topo, alerta de próximas audiências (o dado mais acionável,
// independente do status interno -- ver comentário em reclamacoes.ts),
// dois rankings, filtro por status + busca, tabela.
export default async function ReclamacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Acesso restrito ao admin.</p>;
  }

  const reclamacoes = await listReclamacoes();
  const summary = buildReclamacoesSummary(reclamacoes);
  const proximasAudiencias = listProximasAudiencias(reclamacoes);

  const needle = q?.trim().toLowerCase();
  const filtered = reclamacoes.filter((r) => {
    if (status && r.statusInterno !== status) return false;
    if (needle && !r.nome.toLowerCase().includes(needle) && !(r.cpf ?? "").includes(needle)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reclamações"
        description="Procon, Reclame Aqui e processos judiciais"
        cta={
          <Link
            href="/assistencia/reclamacoes/nova"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white"
            style={{ background: "#1B5E3C" }}
          >
            + Nova reclamação
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Total" value={summary.total} accent="var(--brand-green)" />
        <StatTile label="Em aberto" value={summary.emAberto} accent="var(--brand-orange)" />
        <StatTile label="Resolvidos" value={summary.resolvidos} accent="var(--status-good)" />
        <StatTile label="Casos judiciais" value={summary.judiciais} accent="var(--status-critical)" />
      </div>

      {proximasAudiencias.length > 0 ? (
        <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--brand-orange)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Próximas audiências
          </h3>
          <ul className="flex flex-col gap-1.5">
            {proximasAudiencias.map((r) => (
              <li key={r.id} className="text-sm flex items-center justify-between gap-2 flex-wrap">
                <Link href={`/assistencia/reclamacoes/${r.id}/editar`} className="underline" style={{ color: "var(--text-primary)" }}>
                  {r.nome} <span style={{ color: "var(--text-muted)" }}>({r.orgao})</span>
                </Link>
                <span className="tabular-nums font-medium" style={{ color: "var(--brand-orange)" }}>
                  {formatAudiencia(r.dataAudiencia!)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <BarRanking title="Por órgão" data={summary.porOrgao.map((o) => ({ label: o.label, count: o.count }))} />
        <BarRanking title="Por status" data={summary.porStatus.map((s) => ({ label: s.label, count: s.count }))} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <FilterPill href={buildHref({ q })} label="Todos" selected={!status} />
          {STATUS_INTERNO_OPTIONS.map((s) => (
            <FilterPill key={s} href={buildHref({ status: s, q })} label={s} selected={status === s} />
          ))}
        </div>

        <form action="/assistencia/reclamacoes" method="get" className="flex items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou CPF"
            className="rounded border px-3 py-2 text-sm max-w-xs"
            style={{ borderColor: "var(--border)" }}
          />
          <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Buscar
          </button>
        </form>

        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Órgão</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Status externo</th>
                <th className="px-3 py-2 font-medium">Audiência</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    Nenhuma reclamação encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2">
                      <Link href={`/assistencia/reclamacoes/${r.id}/editar`} className="underline" style={{ color: "var(--text-primary)" }}>
                        {r.nome}
                      </Link>
                      {r.cpf ? (
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                          {r.cpf}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                      {r.orgao}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-xs font-medium rounded-full px-2 py-0.5"
                        style={{
                          background: isStatusInternoResolvido(r.statusInterno) ? "var(--status-good)" : "var(--brand-orange)",
                          color: "#fff",
                        }}
                      >
                        {r.statusInterno}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs" style={{ color: "var(--text-secondary)" }}>
                      {r.statusExterno ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {r.dataAudiencia ? formatAudiencia(r.dataAudiencia) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
