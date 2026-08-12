import Link from "next/link";
import { requireVendasActor } from "@/lib/vendasAuth";
import {
  getVendaCurvaProduto,
  searchProdutosVenda,
  listRankingProdutos,
  listVendasPorCategoria,
  listVendasPorFamiliaLogisticaPorSemana,
  listVendidoVsDespachadoPorSemana,
  listTendenciaProdutos,
  listSaldoEstoqueProdutos,
  type ProdutoSugestao,
  type ProdutoCategoriaKey,
  type DateRange,
} from "@/lib/vendasProduto";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ProdutoVendaCurvaChart } from "@/components/assistencia/ProdutoVendaCurvaChart";
import { VendasPorCategoriaList } from "@/components/assistencia/VendasPorCategoriaList";
import { ProdutoRankingList } from "@/components/assistencia/ProdutoRankingList";
import { CategoriaEvolucaoChart } from "@/components/assistencia/CategoriaEvolucaoChart";
import { VendidoDespachadoChart } from "@/components/assistencia/VendidoDespachadoChart";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";

const RANKING_LIMIT = 20;
const PERIODOS_ATALHO = [4, 8, 12, 26];
const PERIODO_PADRAO_SEMANAS = 12;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeFromSemanas(semanas: number): DateRange {
  return { from: isoDate(new Date(Date.now() - semanas * 7 * 24 * 60 * 60 * 1000)), to: isoDate(new Date()) };
}

function isValidIsoDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildHref(params: { q?: string; from?: string; to?: string; categoria?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.categoria) sp.set("categoria", params.categoria);
  const qs = sp.toString();
  return qs ? `/assistencia/vendas?${qs}` : "/assistencia/vendas";
}

export default async function VendasProdutoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; categoria?: string }>;
}) {
  const actor = await requireVendasActor();
  const { q, from, to, categoria } = await searchParams;
  const query = (q ?? "").trim();
  const categoriaAtiva = (categoria as ProdutoCategoriaKey | undefined) || undefined;
  const backHref = actor.role === "cd" ? "/assistencia/encomendas/fila" : "/assistencia/inicio";

  // Data exata (from+to) tem prioridade sobre o atalho de semanas -- só cai
  // no padrão (12 semanas) quando nem um nem outro foi informado.
  const customRange = isValidIsoDate(from) && isValidIsoDate(to) && from <= to;
  const range: DateRange = customRange ? { from: from!, to: to! } : rangeFromSemanas(PERIODO_PADRAO_SEMANAS);
  const periodoLabel = customRange
    ? `${new Date(`${range.from}T00:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${range.to}T00:00:00`).toLocaleDateString("pt-BR")}`
    : `últimas ${PERIODO_PADRAO_SEMANAS} semanas`;

  let curva = query ? await getVendaCurvaProduto(query, range) : null;
  let sugestoes: ProdutoSugestao[] = [];

  // Não achou por código exato -- tenta como busca por nome/substring. Uma
  // única sugestão já resolve sozinho (sem precisar de mais um clique);
  // mais de uma mostra a lista pra escolher.
  if (query && !curva) {
    sugestoes = await searchProdutosVenda(query);
    if (sugestoes.length === 1) {
      curva = await getVendaCurvaProduto(sugestoes[0].productCode, range);
      sugestoes = [];
    }
  }

  const [ranking, categorias, evolucao, vendidoDespachado] = await Promise.all([
    listRankingProdutos(range, RANKING_LIMIT, categoriaAtiva),
    listVendasPorCategoria(range),
    listVendasPorFamiliaLogisticaPorSemana(range),
    listVendidoVsDespachadoPorSemana(range),
  ]);
  // Dependem dos códigos do ranking acima, por isso vêm depois -- ambas são
  // sempre relativas a hoje, não ao período filtrado (ver
  // listTendenciaProdutos/listSaldoEstoqueProdutos).
  const rankingCodes = ranking.map((r) => r.productCode);
  const [tendencias, saldos] = await Promise.all([
    listTendenciaProdutos(rankingCodes),
    listSaldoEstoqueProdutos(rankingCodes),
  ]);

  const variacao =
    curva && curva.semanaAnterior > 0
      ? Math.round(((curva.semanaAtual - curva.semanaAnterior) / curva.semanaAnterior) * 100)
      : null;

  const rankingBaseHref = customRange ? buildHref({ from: range.from, to: range.to }) : buildHref({});

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title="Vendas por produto"
        subtitle={`${actor.name} — curva de venda, ranking e tipo de produto`}
      />

      {/* Período -- controla curva, ranking, resumo por tipo e evolução,
          todos juntos (mesmo período pra tudo, evita confusão de "de qual
          janela é esse número"). Atalhos por semana OU data exata, numa
          única barra horizontal (rola no mobile) pra não empilhar linhas
          acima do gráfico. */}
      <div
        className="rounded-lg p-3 flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-4"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        {PERIODOS_ATALHO.map((semanas) => {
          const selected = !customRange && semanas === PERIODO_PADRAO_SEMANAS;
          return (
            <Link
              key={semanas}
              href={buildHref({ q: query || undefined, categoria: categoriaAtiva, ...rangeFromSemanas(semanas) })}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 border"
              style={{
                borderColor: selected ? "transparent" : "var(--border)",
                background: selected ? "var(--brand-green)" : "transparent",
                color: selected ? "var(--brand-green-ink)" : "var(--text-secondary)",
                fontWeight: selected ? 600 : 400,
              }}
            >
              {semanas} semanas
            </Link>
          );
        })}

        <span className="h-5 w-px shrink-0" style={{ background: "var(--gridline)" }} />

        <form action="/assistencia/vendas" method="GET" className="flex items-center gap-2 flex-nowrap shrink-0">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {categoriaAtiva ? <input type="hidden" name="categoria" value={categoriaAtiva} /> : null}
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
            De
            <input type="date" name="from" defaultValue={range.from} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }} />
          </label>
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
            Até
            <input type="date" name="to" defaultValue={range.to} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }} />
          </label>
          <button type="submit" className="text-xs px-3 py-1.5 rounded border font-medium whitespace-nowrap shrink-0" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            Aplicar
          </button>
        </form>
      </div>

      <form action="/assistencia/vendas" method="GET" className="flex items-center gap-2 flex-wrap">
        {customRange ? <input type="hidden" name="from" value={range.from} /> : null}
        {customRange ? <input type="hidden" name="to" value={range.to} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Código ou nome do produto…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Buscar
        </button>
        {query ? (
          <Link
            href={customRange ? buildHref({ from: range.from, to: range.to }) : buildHref({})}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Limpar busca
          </Link>
        ) : null}
      </form>

      {query && !curva && sugestoes.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum produto encontrado pra &quot;{query}&quot;.
          </p>
        </div>
      ) : null}

      {sugestoes.length > 1 ? (
        <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Vários produtos batem com &quot;{query}&quot; — escolha um:
          </p>
          {sugestoes.map((s) => (
            <Link
              key={s.productCode}
              href={buildHref({ q: s.productCode, from: customRange ? range.from : undefined, to: customRange ? range.to : undefined })}
              className="text-sm hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {s.description ?? "(sem descrição)"}{" "}
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                #{s.productCode}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {curva ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  #{curva.productCode}
                </span>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {curva.description ?? "Produto sem descrição"}
                </h2>
              </div>
              <span className="text-xs px-2 py-1 rounded-full shrink-0" style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}>
                {curva.categoria.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label={`Total (${periodoLabel})`} value={curva.totalPeriodo} suffix="un" />
              <StatTile label="Última semana c/ dado" value={curva.semanaAtual} suffix="un" />
              <StatTile label="Semana anterior" value={curva.semanaAnterior} suffix="un" />
              <StatTile
                label="Variação"
                value={variacao === null ? "—" : `${variacao > 0 ? "+" : ""}${variacao}`}
                suffix={variacao === null ? undefined : "%"}
                accent={variacao === null ? undefined : variacao >= 0 ? "var(--brand-green)" : "var(--status-critical)"}
              />
            </div>

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Faturamento no período: <strong style={{ color: "var(--text-primary)" }}>{formatBRL(curva.valorPeriodo)}</strong>
            </p>
          </div>

          <ProdutoVendaCurvaChart semanas={curva.semanas} />
        </div>
      ) : null}

      <CategoriaEvolucaoChart semanas={evolucao.semanas} categorias={evolucao.familias} />

      <VendidoDespachadoChart semanas={vendidoDespachado} />

      <VendasPorCategoriaList categorias={categorias} baseHref={rankingBaseHref} categoriaAtiva={categoriaAtiva} />

      <ProdutoRankingList
        items={ranking}
        tendencias={tendencias}
        saldos={saldos}
        title={
          categoriaAtiva
            ? `Mais vendidos — ${categorias.find((c) => c.key === categoriaAtiva)?.label ?? categoriaAtiva} — ${periodoLabel}`
            : `Mais vendidos — ${periodoLabel}`
        }
        productHref={(code) => buildHref({ q: code, from: customRange ? range.from : undefined, to: customRange ? range.to : undefined })}
      />

      <Link href={backHref} className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
