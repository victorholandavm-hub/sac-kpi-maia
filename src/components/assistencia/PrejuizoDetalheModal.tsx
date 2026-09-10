"use client";

import type { ProductBreakageStat, CustoOperacionalPorTipoRow } from "@/lib/kpiAssistencia";
import type { Coverage } from "@/lib/kpi";

// Detalhamento do card "Prejuízo Total Estimado em Estoque" -- pedido do
// Victor 10/09/2026: "quando clicar nesse prejuízo, mostre os valores
// detalhados e como chegou a esse valor". Mesmo padrão visual de
// AssistenciaTicketsModal.tsx (overlay + painel central), conteúdo
// próprio: a fórmula (estoque + operacional = total), o breakdown
// operacional por tipo de chamado e os produtos que mais pesaram no
// prejuízo de estoque.

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TOP_PRODUTOS_LIMIT = 10;

export function PrejuizoDetalheModal({
  prejuizoTotalEstimado,
  prejuizoEstoqueTotalEstimado,
  custoOperacionalTotalEstimado,
  custoOperacionalPorTipo,
  prejuizoCobertura,
  byProductBreakageTopValor,
  onClose,
}: {
  prejuizoTotalEstimado: number;
  prejuizoEstoqueTotalEstimado: number;
  custoOperacionalTotalEstimado: number;
  custoOperacionalPorTipo: CustoOperacionalPorTipoRow[];
  prejuizoCobertura: Coverage;
  // Já vem ordenado por prejuízo em R$ (não por Taxa de Quebra, %) e
  // calculado sobre o conjunto INTEIRO de produtos, não só o top 20 do
  // gráfico principal -- ver byProductBreakageTopValor em
  // kpiAssistencia.ts.
  byProductBreakageTopValor: ProductBreakageStat[];
  onClose: () => void;
}) {
  // Só os que têm algum prejuízo > 0 (o bucket "Não identificado" pode
  // aparecer aqui se tiver custo operacional, mesmo sem custo de estoque).
  const topProdutos = byProductBreakageTopValor.filter((p) => p.prejuizoEstimado > 0).slice(0, TOP_PRODUTOS_LIMIT);

  return (
    <>
      <button
        aria-label="Fechar detalhamento do prejuízo"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-w-2xl max-h-[88vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Como chegamos a {formatBRL(prejuizoTotalEstimado)}
          </h3>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>

        {/* Fórmula -- soma das duas parcelas, igual ao cálculo real em
            kpiAssistencia.ts (prejuizoTotalEstimado = prejuizoEstoqueTotal
            + custoOperacionalTotal). */}
        <div
          className="rounded-lg p-3 flex flex-col sm:flex-row items-center gap-2 text-center text-sm font-semibold flex-wrap justify-center"
          style={{ background: "var(--gridline)", color: "var(--text-primary)" }}
        >
          <span>Prejuízo de estoque: {formatBRL(prejuizoEstoqueTotalEstimado)}</span>
          <span style={{ color: "var(--text-muted)" }}>+</span>
          <span>Custo operacional: {formatBRL(custoOperacionalTotalEstimado)}</span>
          <span style={{ color: "var(--text-muted)" }}>=</span>
          <span style={{ color: "var(--status-critical)" }}>{formatBRL(prejuizoTotalEstimado)}</span>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            1. Prejuízo de estoque (produto)
          </h4>
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Unidades trocadas/enviadas × custo de reposição do Protheus (totvs_stock.unit_cost). Rastreado em{" "}
            {prejuizoCobertura.withValue} de {prejuizoCobertura.total} chamados ({prejuizoCobertura.pct}%) — o resto não tem código do
            produto ou custo sincronizado, então só entra com o custo operacional abaixo.
          </p>
          {topProdutos.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nenhum produto com prejuízo calculado nesse período.
            </p>
          ) : (
            <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-xs" style={{ minWidth: "480px" }}>
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                      Produto
                    </th>
                    <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                      Estoque
                    </th>
                    <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                      Operacional
                    </th>
                    <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                  {topProdutos.map((p) => (
                    <tr key={p.tag}>
                      <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                        {p.label}
                        {p.partCode !== "9999" ? <span style={{ color: "var(--text-muted)" }}> · {p.partCode}</span> : null}
                      </td>
                      <td className="text-right px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                        {p.prejuizoEstoque != null ? formatBRL(p.prejuizoEstoque) : "—"}
                      </td>
                      <td className="text-right px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                        {formatBRL(p.custoOperacionalEstimado)}
                      </td>
                      <td className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatBRL(p.prejuizoEstimado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
            2. Custo operacional (estimativa fixa por tipo)
          </h4>
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Sem custo real de frete/operação no ERP — valor fixo por chamado, definido manualmente por tipo de solicitação.
          </p>
          <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-xs" style={{ minWidth: "420px" }}>
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                    Tipo
                  </th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                    Chamados
                  </th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                    Valor/chamado
                  </th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {custoOperacionalPorTipo.map((r) => (
                  <tr key={r.type}>
                    <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                      {r.label}
                    </td>
                    <td className="text-right px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {r.count}
                    </td>
                    <td className="text-right px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {formatBRL(r.valorUnitario)}
                    </td>
                    <td className="text-right px-2 py-1.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                      {formatBRL(r.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
