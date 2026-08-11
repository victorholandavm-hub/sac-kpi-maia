import Link from "next/link";
import { requireVendasActor } from "@/lib/vendasAuth";
import {
  getVendaCurvaProduto,
  searchProdutosVenda,
  listRankingProdutos,
  listVendasPorCategoria,
  type ProdutoSugestao,
  type ProdutoCategoriaKey,
} from "@/lib/vendasProduto";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ProdutoVendaCurvaChart } from "@/components/assistencia/ProdutoVendaCurvaChart";
import { VendasPorCategoriaList } from "@/components/assistencia/VendasPorCategoriaList";
import { ProdutoRankingList } from "@/components/assistencia/ProdutoRankingList";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";

const RANKING_LIMIT = 20;
const PERIODOS: { label: string; semanas: number }[] = [
  { label: "4 semanas", semanas: 4 },
  { label: "8 semanas", semanas: 8 },
  { label: "12 semanas", semanas: 12 },
  { label: "26 semanas", semanas: 26 },
];
const PERIODO_PADRAO = 12;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildHref(params: { q?: string; semanas?: number; categoria?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.semanas) sp.set("semanas", String(params.semanas));
  if (params.categoria) sp.set("categoria", params.categoria);
  const qs = sp.toString();
  return qs ? `/assistencia/vendas?${qs}` : "/assistencia/vendas";
}

export default async function VendasProdutoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; semanas?: string; categoria?: string }>;
}) {
  const actor = await requireVendasActor();
  const { q, semanas: semanasParam, categoria } = await searchParams;
  const query = (q ?? "").trim();
  const numSemanas = PERIODOS.some((p) => p.semanas === Number(semanasParam)) ? Number(semanasParam) : PERIODO_PADRAO;
  const categoriaAtiva = (categoria as ProdutoCategoriaKey | undefined) || undefined;
  const backHref = actor.role === "cd" ? "/assistencia/encomendas/fila" : "/assistencia/inicio";

  let curva = query ? await getVendaCurvaProduto(query, numSemanas) : null;
  let sugestoes: ProdutoSugestao[] = [];

  // Não achou por código exato -- tenta como busca por nome/substring. Uma
  // única sugestão já resolve sozinho (sem precisar de mais um clique);
  // mais de uma mostra a lista pra escolher.
  if (query && !curva) {
    sugestoes = await searchProdutosVenda(query);
    if (sugestoes.length === 1) {
      curva = await getVendaCurvaProduto(sugestoes[0].productCode, numSemanas);
      sugestoes = [];
    }
  }

  const [ranking, categorias] = await Promise.all([
    listRankingProdutos(numSemanas, RANKING_LIMIT, categoriaAtiva),
    listVendasPorCategoria(numSemanas),
  ]);

  const variacao =
    curva && curva.semanaAnterior > 0
      ? Math.round(((curva.semanaAtual - curva.semanaAnterior) / curva.semanaAnterior) * 100)
      : null;

  const rankingBaseHref = buildHref({ q: undefined, semanas: numSemanas });

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title="Vendas por produto"
        subtitle={`${actor.name} — curva de venda, ranking e tipo de produto`}
      />

      {/* Período -- controla curva, ranking e o resumo por tipo, todos juntos
          (mesmo período pra tudo, evita confusão de "de qual janela é esse
          número"). */}
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
        {PERIODOS.map((p) => {
          const selected = p.semanas === numSemanas;
          return (
            <Link
              key={p.semanas}
              href={buildHref({ q: query || undefined, semanas: p.semanas, categoria: categoriaAtiva })}
              className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 border"
              style={{
                borderColor: selected ? "transparent" : "var(--border)",
                background: selected ? "var(--brand-green)" : "transparent",
                color: selected ? "var(--brand-green-ink)" : "var(--text-secondary)",
                fontWeight: selected ? 600 : 400,
              }}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <form action="/assistencia/vendas" method="GET" className="flex items-center gap-2 flex-wrap">
        {numSemanas !== PERIODO_PADRAO ? <input type="hidden" name="semanas" value={numSemanas} /> : null}
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
          <Link href={buildHref({ semanas: numSemanas })} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
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
              href={buildHref({ q: s.productCode, semanas: numSemanas })}
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
              <StatTile label={`Total (${numSemanas} sem.)`} value={curva.totalPeriodo} suffix="un" />
              <StatTile label="Essa semana" value={curva.semanaAtual} suffix="un" />
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

      <VendasPorCategoriaList categorias={categorias} baseHref={rankingBaseHref} categoriaAtiva={categoriaAtiva} />

      <ProdutoRankingList
        items={ranking}
        title={
          categoriaAtiva
            ? `Mais vendidos — ${categorias.find((c) => c.key === categoriaAtiva)?.label ?? categoriaAtiva} — últimas ${numSemanas} semanas`
            : `Mais vendidos — últimas ${numSemanas} semanas`
        }
      />

      <Link href={backHref} className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
