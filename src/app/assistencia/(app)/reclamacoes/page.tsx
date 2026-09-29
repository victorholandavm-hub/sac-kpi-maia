import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { listReclamacoes, buildReclamacoesSummary, listProximasAudiencias } from "@/lib/reclamacoes";
import { STATUS_INTERNO_OPTIONS, ORGAO_GRUPO_LABELS, orgaoGrupo, isStatusInternoResolvido, type OrgaoGrupo } from "@/lib/reclamacoesLabels";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { StatTile } from "@/components/StatTile";
import { BarRanking } from "@/components/BarRanking";
import { SupervisaoTabs } from "@/components/assistencia/SupervisaoTabs";
import { ReclamacaoTableRow } from "@/components/assistencia/ReclamacaoTableRow";
import { UnderlineTab } from "@/components/UnderlineTab";

const ORGAO_GRUPOS: OrgaoGrupo[] = ["procon", "judicial", "reclame_aqui"];

function buildHref(params: { org?: string; status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.org) sp.set("org", params.org);
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
  searchParams: Promise<{ org?: string; status?: string; q?: string }>;
}) {
  const { org, status, q } = await searchParams;
  // Procon (todos os 4 municípios/estadual juntos) é a aba padrão -- ver
  // orgaoGrupo/ORGAO_GRUPOS em reclamacoesLabels.ts. Diferente do filtro de
  // status (que tem "Todos" de verdade), aqui sempre tem uma das 3 abas
  // ativa -- pedido do Victor 29/09/2026.
  const grupo: OrgaoGrupo = org === "judicial" || org === "reclame_aqui" ? org : "procon";
  const profile = await getProfile();

  // Papel "supervisao" (Akyla Thais, pedido do Victor 28/09/2026): vê essa
  // tela, mas só leitura -- sem "+ Nova reclamação" nem link pra editar
  // (ver readOnly abaixo). /nova e /[id]/editar continuam travadas pra
  // admin só (ela nunca chega lá, nem pela URL direta).
  if (profile.role !== "admin" && profile.role !== "supervisao") {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Acesso restrito ao admin.</p>;
  }
  const readOnly = profile.role === "supervisao";

  const reclamacoes = await listReclamacoes();
  const summary = buildReclamacoesSummary(reclamacoes);
  const proximasAudiencias = listProximasAudiencias(reclamacoes);

  const needle = q?.trim().toLowerCase();
  const filtered = reclamacoes.filter((r) => {
    if (orgaoGrupo(r.orgao) !== grupo) return false;
    if (status && r.statusInterno !== status) return false;
    if (needle && !r.nome.toLowerCase().includes(needle) && !(r.cpf ?? "").includes(needle)) return false;
    return true;
  });

  const pendentesPorGrupo = Object.fromEntries(
    ORGAO_GRUPOS.map((g) => [g, reclamacoes.filter((r) => orgaoGrupo(r.orgao) === g && !isStatusInternoResolvido(r.statusInterno)).length])
  ) as Record<OrgaoGrupo, number>;

  return (
    <div className="flex flex-col gap-6">
      {readOnly ? <SupervisaoTabs active="reclamacoes" /> : null}
      <PageHeader
        title="Reclamações"
        description="Procon, Reclame Aqui e processos judiciais"
        cta={
          readOnly ? undefined : (
            <Link
              href="/assistencia/reclamacoes/nova"
              className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white"
              style={{ background: "#1B5E3C" }}
            >
              + Nova reclamação
            </Link>
          )
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
                {readOnly ? (
                  <span style={{ color: "var(--text-primary)" }}>
                    {r.nome} <span style={{ color: "var(--text-muted)" }}>({r.orgao})</span>
                  </span>
                ) : (
                  <Link href={`/assistencia/reclamacoes/${r.id}/editar`} className="underline" style={{ color: "var(--text-primary)" }}>
                    {r.nome} <span style={{ color: "var(--text-muted)" }}>({r.orgao})</span>
                  </Link>
                )}
                <span className="tabular-nums font-medium" style={{ color: "var(--brand-orange)" }}>
                  {formatAudiencia(r.dataAudiencia!)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {ORGAO_GRUPOS.map((g) => (
          <UnderlineTab
            key={g}
            href={buildHref({ org: g === "procon" ? undefined : g, q })}
            label={ORGAO_GRUPO_LABELS[g]}
            active={grupo === g}
            count={pendentesPorGrupo[g]}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <FilterPill href={buildHref({ org, q })} label="Todos" selected={!status} />
          {STATUS_INTERNO_OPTIONS.map((s) => (
            <FilterPill key={s} href={buildHref({ org, status: s, q })} label={s} selected={status === s} />
          ))}
        </div>

        <form action="/assistencia/reclamacoes" method="get" className="flex items-center gap-2">
          {org ? <input type="hidden" name="org" value={org} /> : null}
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
                filtered.map((r) => <ReclamacaoTableRow key={r.id} reclamacao={r} readOnly={readOnly} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos no final da tela -- pedido do Victor 29/09/2026: o
          resumo (StatTile) e o alerta de audiências continuam no topo (é
          o que muda de urgente pra urgente), os rankings ficam de apoio
          depois da lista de verdade. Sempre com o total geral (não
          filtrado pela aba/busca de cima) -- é visão consolidada, não
          repete o recorte da tabela. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <BarRanking title="Por órgão" data={summary.porOrgao.map((o) => ({ label: o.label, count: o.count }))} />
        <BarRanking title="Por status" data={summary.porStatus.map((s) => ({ label: s.label, count: s.count }))} />
      </div>
    </div>
  );
}
