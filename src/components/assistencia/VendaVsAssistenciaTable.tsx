import type { VendaVsAssistenciaStat } from "@/lib/kpiAssistencia";

// "Vendas x Assistência Técnica" por loja -- pedido do Victor 14/09/2026:
// "quero ver o percentual de quantidade de vendas (entregas) x quantidade
// de assistencia tecnica". Cruza duas fontes independentes pro MESMO
// período: Vendas vem do Protheus (totvs_orders, sincronizado via TOTVS
// Sync), Chamados vem do sistema integrado (service_requests, TODOS os
// tipos -- entrega/troca/peça/montagem/desmontagem/vistoria/etc., decisão
// explícita do Victor ao perguntar, diferente do resto desta página que só
// conta os tipos de Entregas). Mesmo estilo de tabela de
// StoreBreakdownTable.tsx (painel de KPIs geral) -- já ordenado por
// percentual (maior primeiro) em kpiAssistencia.ts, sem reordenar aqui.
export function VendaVsAssistenciaTable({ data }: { data: VendaVsAssistenciaStat[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Vendas x Assistência técnica por loja
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Vendas = pedidos de venda do Protheus no período. Assistência técnica = todos os chamados do sistema integrado no
        mesmo período (entrega, troca, peça, montagem, desmontagem, vistoria etc.) — duas fontes diferentes, sem vínculo
        pedido a pedido.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-1 pr-4 font-normal">Loja</th>
                <th className="py-1 pr-4 font-normal text-right">Vendas (Protheus)</th>
                <th className="py-1 pr-4 font-normal text-right">Assistência técnica</th>
                <th className="py-1 pr-4 font-normal text-right">% assistência / venda</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.storeId} style={{ borderTop: "1px solid var(--gridline)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                    {row.storeName}
                  </td>
                  <td className="py-2 pr-4 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.vendas}
                  </td>
                  <td className="py-2 pr-4 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.chamados}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium" style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                    {row.percentual != null ? (
                      `${row.percentual.toFixed(1)}%`
                    ) : (
                      <span className="font-normal" style={{ color: "var(--text-muted)" }} title="Sem venda sincronizada no período -- não dá pra calcular percentual.">
                        — sem venda
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
