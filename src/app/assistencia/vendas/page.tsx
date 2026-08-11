import Link from "next/link";
import { requireVendasActor } from "@/lib/vendasAuth";
import { getVendaCurvaProduto, searchProdutosVenda, listRankingProdutos, type ProdutoSugestao } from "@/lib/vendasProduto";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ProdutoVendaCurvaChart } from "@/components/assistencia/ProdutoVendaCurvaChart";
import { BarRanking } from "@/components/BarRanking";

export const dynamic = "force-dynamic";

const NUM_SEMANAS = 12;
const RANKING_SEMANAS = 4;
const RANKING_LIMIT = 15;

export default async function VendasProdutoPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireVendasActor();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const backHref = actor.role === "cd" ? "/assistencia/encomendas/fila" : "/assistencia/inicio";

  let curva = query ? await getVendaCurvaProduto(query, NUM_SEMANAS) : null;
  let sugestoes: ProdutoSugestao[] = [];

  // Não achou por código exato -- tenta como busca por nome/substring. Uma
  // única sugestão já resolve sozinho (sem precisar de mais um clique);
  // mais de uma mostra a lista pra escolher.
  if (query && !curva) {
    sugestoes = await searchProdutosVenda(query);
    if (sugestoes.length === 1) {
      curva = await getVendaCurvaProduto(sugestoes[0].productCode, NUM_SEMANAS);
      sugestoes = [];
    }
  }

  const ranking = await listRankingProdutos(RANKING_SEMANAS, RANKING_LIMIT);
  const rankingData = ranking.map((p) => ({
    label: `${p.description ?? "(sem descrição)"} (#${p.productCode})`,
    count: p.quantidade,
  }));

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title="Vendas por produto"
        subtitle={`${actor.name} — curva de venda por período e ranking dos mais vendidos`}
      />

      <form action="/assistencia/vendas" method="GET" className="flex items-center gap-2 flex-wrap">
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
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
        {query ? (
          <Link href="/assistencia/vendas" className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
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
        <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Vários produtos batem com &quot;{query}&quot; — escolha um:
          </p>
          {sugestoes.map((s) => (
            <Link
              key={s.productCode}
              href={`/assistencia/vendas?q=${encodeURIComponent(s.productCode)}`}
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
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              #{curva.productCode}
            </span>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {curva.description ?? "Produto sem descrição"}
            </h2>
          </div>
          <ProdutoVendaCurvaChart semanas={curva.semanas} />
        </div>
      ) : null}

      <BarRanking title={`Mais vendidos — últimas ${RANKING_SEMANAS} semanas`} data={rankingData} />

      <Link href={backHref} className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
