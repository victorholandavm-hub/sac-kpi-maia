import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { UnderlineTab } from "@/components/UnderlineTab";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { DateRangeQuickFilter } from "@/components/assistencia/DateRangeQuickFilter";
import { CadastroDetalheModal } from "@/components/assistencia/CadastroDetalheModal";
import { NovoCadastroDrawer } from "@/components/assistencia/NovoCadastroDrawer";
import { EditarCadastroDrawer } from "@/components/assistencia/EditarCadastroDrawer";
import {
  listCadastros,
  getCadastroPillCounts,
  listCadastroLojas,
  getCadastrosResumoPorSolicitante,
  CADASTRO_TIPOS,
  CADASTRO_TIPO_LABELS,
  CADASTRO_TIPO_COLORS,
  CADASTRO_STATUS_LABELS,
  CADASTRO_SOLICITANTES_ATIVOS,
  CADASTROS_PAGE_SIZE,
  type CadastroTipo,
  type CadastroStatus,
  type Cadastro,
} from "@/lib/cadastrosHistorico";

export const dynamic = "force-dynamic";

// "Cadastros" -- pedido do Victor 01/10/2026: histórico de assistência
// pré-sistema (planilha "Solicitações de Assistência", ~3.244 linhas,
// Dez/2024-Out/2026), importado uma vez (ver 0146_assistencia_
// cadastros_historico.sql) e exibido aqui seguindo o mesmo padrão visual
// das outras telas de operação (pills/filtros/tabela). Começou só leitura,
// depois ganhou criação (NovoCadastroDrawer) e, 02/10/2026, edição
// (EditarCadastroDrawer) -- vale tanto pras linhas importadas quanto pras
// lançadas pelo sistema, mesma tabela.

type Filtro = CadastroTipo | "ERROS" | "volta_caixa" | "esperar_fabrica";

const TIPO_PILLS: { key: Filtro; label: string }[] = [
  { key: "ASSISTENCIA", label: CADASTRO_TIPO_LABELS.ASSISTENCIA },
  { key: "TROCA", label: "Trocas" },
  { key: "ERROS", label: "Erros de Entrega/Faturamento" },
  { key: "MONTAGEM", label: "Montagens" },
  { key: "SAC", label: "SAC" },
  { key: "HISTORICO", label: "Histórico" },
];

function buildHref(params: {
  filtro?: string;
  status?: string;
  loja?: string;
  solicitante?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
}) {
  const sp = new URLSearchParams();
  if (params.filtro) sp.set("filtro", params.filtro);
  if (params.status) sp.set("status", params.status);
  if (params.loja) sp.set("loja", params.loja);
  if (params.solicitante) sp.set("solicitante", params.solicitante);
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/assistencia/cadastros?${qs}` : "/assistencia/cadastros";
}

const PT_MONTHS_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Pills por mês -- pedido do Victor 02/10/2026: "separar por mês de janeiro
// de 2026 até esse mês, e os de antes desse período ficar todos juntos
// igual da planilha" -- mesma organização da planilha original importada
// (uma aba por mês a partir de um certo ponto, tudo antes disso numa aba só,
// ver 0146_assistencia_cadastros_historico.sql). Início fixo em
// janeiro/2026 (pedido explícito, não "desde o dado mais antigo") -- fim é
// sempre o mês corrente, calculado, não precisa mexer aqui mês que vem.
function buildMonthFilters(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const filters: { label: string; from: string; to: string }[] = [];
  for (let year = 2026; year <= now.getFullYear(); year++) {
    const endMonth = year === now.getFullYear() ? now.getMonth() : 11;
    for (let m = 0; m <= endMonth; m++) {
      const from = `${year}-${String(m + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, m + 1, 0).getDate();
      const to = `${year}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      filters.push({ label: `${PT_MONTHS_ABBR[m]}/${String(year).slice(2)}`, from, to });
    }
  }
  return filters;
}
const MONTH_FILTERS = buildMonthFilters();
// Tudo antes de janeiro/2026 fica junto, igual a aba mais antiga da
// planilha original (Dez/2024-Set/2025, sem coluna de tipo -- ver
// comentário da migration 0146) -- só `to`, sem `from` (pega o registro
// mais antigo de qualquer jeito).
const ANTES_2026_TO = "2025-12-31";

function formatDateBr(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Vencido ou a menos de 5 dias -- pedido do Victor (regra do prompt
// original). Comparação por data-calendário simples (sem hora) -- esses
// são todos campos `date`, não timestamp, não tem fração de dia pra
// tratar com fuso.
function prazoUrgencia(prazoIso: string | null): "vencido" | "proximo" | null {
  if (!prazoIso) return null;
  const today = new Date().toISOString().slice(0, 10);
  const diffDays = Math.round((new Date(prazoIso).getTime() - new Date(today).getTime()) / 86_400_000);
  if (diffDays < 0) return "vencido";
  if (diffDays <= 5) return "proximo";
  return null;
}

function StatusBadge({ status }: { status: CadastroStatus }) {
  const colors: Record<CadastroStatus, string> = {
    PROGRAMADO: "var(--brand-green)",
    CONCLUIDO: "var(--status-good)",
    CANCELADO: "var(--status-critical)",
  };
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap text-white"
      style={{ background: colors[status] }}
    >
      {CADASTRO_STATUS_LABELS[status]}
    </span>
  );
}

function CadastroRow({ cadastro }: { cadastro: Cadastro }) {
  const urgencia = prazoUrgencia(cadastro.prazoData);
  return (
    <tr className="border-b align-top" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {cadastro.nf ? `NF ${cadastro.nf}` : "—"}
          </span>
          <span
            className="inline-flex self-start items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap"
            style={{ background: CADASTRO_TIPO_COLORS[cadastro.tipo] }}
          >
            {CADASTRO_TIPO_LABELS[cadastro.tipo]}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 min-w-[180px]">
        <div className="text-sm font-medium uppercase" style={{ color: "var(--text-primary)" }}>
          {cadastro.cliente ?? "—"}
        </div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {cadastro.telefone ?? "—"}
          {cadastro.loja ? ` · ${cadastro.loja}` : ""}
        </div>
      </td>
      <td className="px-3 py-2.5 max-w-[240px] truncate" title={cadastro.produto ?? undefined} style={{ color: "var(--text-secondary)" }}>
        {cadastro.produto ?? "—"}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="text-sm" style={{ color: "var(--text-primary)" }}>
          {cadastro.solicitante ?? "—"}
        </div>
        {cadastro.quemMontou ? (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Montou: {cadastro.quemMontou}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <StatusBadge status={cadastro.status} />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-sm" style={{ color: "var(--text-secondary)" }}>
        {formatDateBr(cadastro.dataAbertura) ?? "—"}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {cadastro.prazoData ? (
          <span
            className="text-sm font-medium"
            style={{ color: urgencia === "vencido" ? "var(--status-critical)" : urgencia === "proximo" ? "var(--status-warning)" : "var(--text-secondary)" }}
          >
            {formatDateBr(cadastro.prazoData)}
            {cadastro.prazoCalculado ? <span className="text-xs font-normal"> (estimado)</span> : ""}
          </span>
        ) : cadastro.prazoNota ? (
          <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
            {cadastro.prazoNota}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <CadastroDetalheModal cadastro={cadastro} />
          <EditarCadastroDrawer cadastro={cadastro} />
        </div>
      </td>
    </tr>
  );
}

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{
    filtro?: string;
    status?: string;
    loja?: string;
    solicitante?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  // Mesmo gate de (app)/estoque/page.tsx (aba irmã dentro de Controle
  // Assistência) -- SAC não tem nada a ver com histórico de assistência,
  // redireciona pra própria área dele.
  redirectIfSac(await getProfile());

  const { filtro, status, loja, solicitante, q, from, to, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const filterStatus = status === "PROGRAMADO" || status === "CONCLUIDO" || status === "CANCELADO" ? (status as CadastroStatus) : undefined;

  const [{ items, total }, counts, lojas, resumo] = await Promise.all([
    listCadastros({
      tipo: (CADASTRO_TIPOS as readonly string[]).includes(filtro ?? "") ? (filtro as CadastroTipo) : undefined,
      tipos: filtro === "ERROS" ? ["ERRO_ENTREGA", "ERRO_FATURAMENTO"] : undefined,
      especial: filtro === "volta_caixa" ? "volta_caixa" : filtro === "esperar_fabrica" ? "esperar_fabrica" : undefined,
      status: filterStatus,
      loja,
      solicitante,
      q,
      dateFrom: from,
      dateTo: to,
      page,
    }),
    getCadastroPillCounts(),
    listCadastroLojas(),
    getCadastrosResumoPorSolicitante({ dateFrom: from, dateTo: to }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / CADASTROS_PAGE_SIZE));
  const erroCount = counts.ERRO_ENTREGA + counts.ERRO_FATURAMENTO;

  return (
    <div className="flex flex-col gap-4">
      {/* "Cadastros" é a PRIMEIRA aba de Controle Assistência (pedido do
          Victor) -- UnderlineTab igual Peças/Estoque já usam, cada
          página renderiza sua própria fileira (ver comentário em
          pecas/page.tsx). */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        <UnderlineTab href="/assistencia/cadastros" label="Cadastros" active />
        <UnderlineTab href="/assistencia/pecas" label="Peças" active={false} />
        <UnderlineTab href="/assistencia/estoque" label="Estoque" active={false} />
      </div>

      {/* Botão "+ Adicionar novo cadastro" -- pedido do Victor 01/10/2026,
          depois de aprovar o protótipo em Artifact. Lança direto nessa
          mesma tabela (assistencia_cadastros_historico), ver
          cadastros-actions.ts/NovoCadastroDrawer.tsx. */}
      <div className="flex items-center justify-end">
        <NovoCadastroDrawer />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
        <FilterPill href={buildHref({ status, loja, solicitante, q, from, to })} label={`Todas (${counts.total})`} selected={!filtro} />
        {TIPO_PILLS.map((p) => {
          const count = p.key === "ERROS" ? erroCount : counts[p.key as CadastroTipo];
          return (
            <FilterPill
              key={p.key}
              href={buildHref({ filtro: p.key, status, loja, solicitante, q, from, to })}
              label={`${p.label} (${count})`}
              selected={filtro === p.key}
              color={CADASTRO_TIPO_COLORS[p.key === "ERROS" ? "ERRO_ENTREGA" : (p.key as CadastroTipo)]}
            />
          );
        })}
        {counts.voltaCaixa > 0 || filtro === "volta_caixa" ? (
          <FilterPill
            href={buildHref({ filtro: filtro === "volta_caixa" ? undefined : "volta_caixa", status, loja, solicitante, q, from, to })}
            label={`🔁 Volta pra caixa (${counts.voltaCaixa})`}
            selected={filtro === "volta_caixa"}
            color="var(--status-warning)"
          />
        ) : null}
        {counts.esperarFabrica > 0 || filtro === "esperar_fabrica" ? (
          <FilterPill
            href={buildHref({ filtro: filtro === "esperar_fabrica" ? undefined : "esperar_fabrica", status, loja, solicitante, q, from, to })}
            label={`🏭 Esperar de fábrica (${counts.esperarFabrica})`}
            selected={filtro === "esperar_fabrica"}
            color="var(--status-warning)"
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="loja" placeholder="Todas as lojas" options={lojas} />
        <FilterSelect
          name="status"
          placeholder="Situação: todas"
          options={(["PROGRAMADO", "CONCLUIDO", "CANCELADO"] as CadastroStatus[]).map((s) => ({ value: s, label: CADASTRO_STATUS_LABELS[s] }))}
        />
        {/* Atendente -- pedido do Victor 09/10/2026: "precisa ter um filtro
            por atendente, Iasmyn, Michael e Luis". Mesma lista de
            CADASTRO_SOLICITANTES_ATIVOS (quem está de fato em atendimento
            hoje) que já alimenta os cards "Equipe X" abaixo e o campo
            "Solicitante" do formulário -- um lugar só pra manter os 3
            sincronizados. `solicitante` já era aceito por listCadastros e
            propagado em todo buildHref desde a criação da tela, só
            faltava esse controle visível pra setar o filtro.  */}
        <FilterSelect name="solicitante" placeholder="Atendente: todos" options={[...CADASTRO_SOLICITANTES_ATIVOS]} />
      </div>

      <DateRangeQuickFilter
        dateFrom={from}
        dateTo={to}
        buildHref={(range) => buildHref({ filtro, status, loja, solicitante, q, from: range.from, to: range.to })}
      />

      {/* Por mês, igual a planilha original -- pedido do Victor 02/10/2026,
          print circulando a fileira de atalhos de período acima. Linha à
          parte (não mexe no DateRangeQuickFilter, que é compartilhado com
          outras telas) -- cada pill é um mês de verdade (01 a 28-31),
          "Antes de 2026" cobre tudo que a planilha original já tinha
          consolidado numa aba só. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Por mês (igual à planilha original)
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill
            label="Antes de 2026"
            href={buildHref({ filtro, status, loja, solicitante, q, to: ANTES_2026_TO })}
            selected={!from && to === ANTES_2026_TO}
          />
          {MONTH_FILTERS.map((mf) => (
            <FilterPill
              key={mf.label}
              label={mf.label}
              href={buildHref({ filtro, status, loja, solicitante, q, from: mf.from, to: mf.to })}
              selected={from === mf.from && to === mf.to}
            />
          ))}
        </div>
      </div>

      <form action="/assistencia/cadastros" method="GET" className="flex items-center gap-2 flex-wrap">
        {filtro ? <input type="hidden" name="filtro" value={filtro} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {loja ? <input type="hidden" name="loja" value={loja} /> : null}
        {solicitante ? <input type="hidden" name="solicitante" value={solicitante} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nº do chamado, cliente, produto, CPF ou telefone…"
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-[260px]"
          style={{ borderColor: "var(--border)" }}
        />
        {/* Período manual (data de abertura) -- complementa os atalhos do
            DateRangeQuickFilter acima, mesmo padrão de De/Até usado em
            fila/page.tsx. */}
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          De
          <input type="date" name="from" defaultValue={from ?? ""} className="rounded-lg border px-2 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          Até
          <input type="date" name="to" defaultValue={to ?? ""} className="rounded-lg border px-2 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <button type="submit" className="text-sm px-4 py-2 rounded-lg border font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Buscar
        </button>
        {q || from || to ? (
          <Link href={buildHref({ filtro, status, loja, solicitante })} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
            Limpar busca/período
          </Link>
        ) : null}
      </form>

      {/* Cards "Equipe X" -- agrupado por solicitante, pedido do Victor
          01/10/2026. Só quem está de fato em atendimento hoje (Iasmyn,
          Victor, Michael -- ver CADASTRO_SOLICITANTES_ATIVOS,
          cadastrosHistorico.ts), filtrado em getCadastrosResumoPorSolicitante
          -- pedido do Victor 02/10/2026: "deixa apenas os que estão em
          atendimento". Nomes antigos da planilha (Luisa, Mayara, Kelly
          etc.) continuam nos registros, só saem desses cards. `.slice(0,
          12)` é só uma trava de segurança agora (nunca passa de 3). Virou
          atalho clicável 09/10/2026 (mesmo pedido do filtro "Atendente"
          acima): clicar filtra `solicitante` igual ao FilterSelect, de
          novo no mesmo card desmarca -- `solicitante` já era aceito por
          listCadastros/buildHref desde sempre, só faltava um jeito de
          setar clicando. */}
      {resumo.length > 0 ? (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {resumo.slice(0, 12).map((r) => {
            const ativo = solicitante === r.solicitante;
            return (
              <Link
                key={r.solicitante}
                href={buildHref({ filtro, status, loja, solicitante: ativo ? undefined : r.solicitante, q, from, to })}
                className="shrink-0 rounded-xl border p-3 flex flex-col gap-1.5 min-w-[160px] transition-colors duration-150"
                style={{ borderColor: ativo ? "var(--brand-green)" : "var(--border)", background: ativo ? "var(--brand-green-soft)" : "var(--surface-1)" }}
              >
                <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  Equipe {r.solicitante}
                </span>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span style={{ color: "var(--text-muted)" }}>{r.programado} em processo</span>
                  <span style={{ color: "var(--status-good)" }}>{r.concluido} concluído</span>
                  <span style={{ color: "var(--status-critical)" }}>{r.cancelado} não concl.</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} registro{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum registro encontrado.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  ID / Tipo
                </th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Cliente
                </th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Produto
                </th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Solicitante / Montador
                </th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Situação
                </th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Data
                </th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Prazo
                </th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <CadastroRow key={c.id} cadastro={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <Link
            href={buildHref({ filtro, status, loja, solicitante, q, from, to, page: page - 1 })}
            aria-disabled={page <= 1}
            className="text-sm px-3 py-2 rounded-lg border font-medium"
            style={{ borderColor: "var(--border)", color: page <= 1 ? "var(--text-muted)" : "var(--text-secondary)", pointerEvents: page <= 1 ? "none" : "auto" }}
          >
            ← Anterior
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          <Link
            href={buildHref({ filtro, status, loja, solicitante, q, from, to, page: page + 1 })}
            aria-disabled={page >= totalPages}
            className="text-sm px-3 py-2 rounded-lg border font-medium"
            style={{ borderColor: "var(--border)", color: page >= totalPages ? "var(--text-muted)" : "var(--text-secondary)", pointerEvents: page >= totalPages ? "none" : "auto" }}
          >
            Próxima →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
