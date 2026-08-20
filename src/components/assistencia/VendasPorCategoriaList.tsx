import Link from "next/link";
import type { CategoriaResumo } from "@/lib/vendasProduto";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Barra proporcional ao maior valor da lista -- dá pra comparar categoria
// contra categoria batendo o olho, sem precisar de mais um gráfico
// separado. Clique filtra o ranking de produtos abaixo por essa categoria
// (querystring, ver page.tsx).
export function VendasPorCategoriaList({
  categorias,
  baseHref,
  categoriaAtiva,
}: {
  categorias: CategoriaResumo[];
  baseHref: string;
  categoriaAtiva?: string;
}) {
  const max = Math.max(1, ...categorias.map((c) => c.quantidade));

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Vendas por tipo de produto
      </h3>
      {categorias.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem vendas no período.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {categorias.map((c) => {
            const isActive = categoriaAtiva === c.key;
            const href = isActive ? baseHref : `${baseHref}${baseHref.includes("?") ? "&" : "?"}categoria=${c.key}`;
            return (
              <Link key={c.key} href={href} className="flex flex-col gap-1 group">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {c.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {c.quantidade} un · {formatBRL(c.valor)}
                  </span>
                </div>
                {/* Quantidade líquida (venda - devolução) pode ser negativa numa
                    categoria com bastante devolução no período -- sem o
                    Math.max(0, ...) aqui, isso virava um Math.max(4, negativo)
                    = 4%, uma barrinha visível pra um valor que na verdade é
                    negativo (achado 20/08/2026, revisão pedida pelo Victor).
                    0% (sem barra) é o correto pra esse caso. */}
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--gridline)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${c.quantidade <= 0 ? 0 : Math.max(4, (c.quantidade / max) * 100)}%`,
                      background: isActive ? "var(--brand-green)" : "color-mix(in srgb, var(--brand-green) 45%, var(--gridline))",
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {categoriaAtiva ? (
        <Link href={baseHref} className="text-xs underline self-start" style={{ color: "var(--text-secondary)" }}>
          Limpar filtro de tipo
        </Link>
      ) : null}
    </div>
  );
}
