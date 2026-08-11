import Link from "next/link";
import type { ProdutoRankingItem } from "@/lib/vendasProduto";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProdutoRankingList({
  items,
  title,
  productHref,
}: {
  items: ProdutoRankingItem[];
  title: string;
  productHref: (productCode: string) => string;
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <h3 className="text-sm font-bold p-4 pb-2" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm px-4 pb-4" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda encontrada nesse período/tipo.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
          {items.map((item, i) => (
            <Link
              key={item.productCode}
              href={productHref(item.productCode)}
              className="flex items-center gap-3 p-3 hover:opacity-80"
            >
              <span
                className="text-sm font-bold shrink-0 w-6 text-center"
                style={{ color: i < 3 ? "var(--brand-green)" : "var(--text-muted)" }}
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {item.description ?? "(sem descrição)"}
                </span>
                <span className="text-xs flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <span className="font-mono">#{item.productCode}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}
                  >
                    {item.categoria.label}
                  </span>
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {item.quantidade} un
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatBRL(item.valor)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
