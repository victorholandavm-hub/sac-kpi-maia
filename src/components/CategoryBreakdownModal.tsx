"use client";

import type { Count } from "@/lib/kpi";

// Modal de distribuição (não lista de chamados individuais) -- pedido do
// Victor 20/08/2026: "dá pra colocar dentro dos chamados por loja quais as
// categorias desses chamados?". Diferente de CategoryTicketsModal (que
// mostra os chamados um a um): aqui é a contagem por categoria daquela
// loja, com barra proporcional pra comparar rápido -- mesmo padrão visual
// de VendasPorCategoriaList.tsx.
export function CategoryBreakdownModal({
  title,
  totalCount,
  categories,
  onClose,
}: {
  title: string;
  totalCount: number;
  categories: Count[];
  onClose: () => void;
}) {
  const max = Math.max(1, ...categories.map((c) => c.count));

  return (
    <>
      <button
        aria-label="Fechar distribuição por categoria"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4 mb-1">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {totalCount} chamado{totalCount === 1 ? "" : "s"} no período.
        </p>
        {categories.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum chamado classificado por categoria ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {categories.map((c) => (
              <div key={c.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span style={{ color: "var(--text-primary)" }}>{c.label}</span>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                    {c.count} · {totalCount > 0 ? Math.round((c.count / totalCount) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--gridline)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(4, (c.count / max) * 100)}%`, background: "var(--series-1)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
