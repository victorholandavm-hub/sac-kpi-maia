"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductBreakageStat } from "@/lib/kpiAssistencia";

// Taxa de Quebra por produto -- pedido do Victor 10/09/2026: substitui o
// antigo "Chamados por produto" (que só ordenava por volume, sem cruzar
// com venda nenhuma). Componente PRÓPRIO, não uma variante de
// BarRanking.tsx -- o formato de dado tem 5 campos além de label/count
// (código, unidades, venda do período, custo, prejuízo) e o tooltip
// precisa mostrar todos eles, diferente de todo o resto do relatório
// (que só mostra count/percentual do total). Ver ProductBreakageStat em
// kpiAssistencia.ts pro racional completo do cálculo.

const MAX_TICK_LABEL_LENGTH = 24;

function truncateTick(label: string): string {
  return label.length > MAX_TICK_LABEL_LENGTH ? `${label.slice(0, MAX_TICK_LABEL_LENGTH - 1)}…` : label;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ChartRow = ProductBreakageStat & { barValue: number };

// Tooltip customizado (não dá pra usar o genérico do BarRanking -- aqui
// tem 6 campos pra mostrar, não só "count"). `active`/`payload` vêm do
// recharts, tipados frouxos de propósito (mesmo padrão de outros
// tooltips customizados no projeto) -- só o suficiente pra ler o dado
// bruto de volta.
function BreakageTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const isNaoIdentificado = d.partCode === "9999";
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs flex flex-col gap-1 max-w-[240px]"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}
    >
      <span className="font-semibold">{d.label}</span>
      {!isNaoIdentificado ? <span style={{ color: "var(--text-muted)" }}>Código: {d.partCode}</span> : null}
      <span>Chamados: {d.count}</span>
      <span>Unidades trocadas/enviadas: {d.itensQuantidade}</span>
      {!isNaoIdentificado ? <span>Vendas no período: {d.vendaQtd}</span> : null}
      <span>Taxa de quebra: {d.taxaQuebraPct != null ? `${d.taxaQuebraPct.toFixed(1)}%` : "N/A"}</span>
      {/* Discrimina produto x operação -- pedido do Victor 10/09/2026:
          "atualize os tooltips... pra discriminar o que é custo do
          produto e o que é custo de operação". Custo de produto some
          quando não sabemos o custo unitário (bucket "Não identificado"
          ou produto sem custo sincronizado); custo operacional é sempre
          um número (estimativa fixa por tipo, pode ser R$0,00 pros tipos
          sem valor definido ainda). */}
      <div className="border-t pt-1 mt-0.5 flex flex-col gap-0.5" style={{ borderColor: "var(--border)" }}>
        <span>
          Custo do produto: {d.custoUnitario != null ? formatBRL(d.custoUnitario) : "—"}
          {d.custoUnitario != null ? ` × ${d.itensQuantidade} un. = ${formatBRL(d.prejuizoEstoque ?? 0)}` : ""}
        </span>
        <span>Custo de operação (estimado por tipo): {formatBRL(d.custoOperacionalEstimado)}</span>
        <span className="font-medium">Prejuízo total estimado: {formatBRL(d.prejuizoEstimado)}</span>
      </div>
    </div>
  );
}

export function ProductBreakageRanking({
  data,
  onSelect,
}: {
  data: ProductBreakageStat[];
  onSelect?: (item: ProductBreakageStat) => void;
}) {
  const height = Math.max(160, data.length * 36 + 24);
  // Bar precisa de número pro tamanho -- N/A (taxaQuebraPct null) vira 0
  // só pro TAMANHO da barra; o LabelList abaixo lê o campo original
  // (não `barValue`) e mostra "N/A" de verdade em vez de "0%" nesse caso.
  const chartData: ChartRow[] = data.map((d) => ({ ...d, barValue: d.taxaQuebraPct ?? 0 }));

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Taxa de quebra por produto (top 20)
      </h3>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        Chamados ÷ vendas do mesmo produto no período, cruzando pelo código Protheus. Produto sem código vira
        &quot;Não identificados&quot; e produto com poucas vendas no período aparece como N/A — os dois ficam de
        fora do cálculo de %, mas continuam contando no total de chamados.
      </p>
      {data.length > 0 ? (
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Passe o mouse numa barra pra ver o prejuízo estimado. Clique pra ver os chamados.
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--gridline)" />
            <XAxis type="number" allowDecimals={false} unit="%" stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tickFormatter={truncateTick}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            />
            <Tooltip content={<BreakageTooltip />} cursor={{ fill: "var(--gridline)" }} />
            <Bar
              dataKey="barValue"
              fill="var(--status-critical)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              cursor={onSelect ? "pointer" : undefined}
              onClick={onSelect ? (bar: { payload?: ChartRow }) => bar.payload && onSelect(bar.payload) : undefined}
            >
              <LabelList
                dataKey="taxaQuebraPct"
                position="insideRight"
                formatter={(label: unknown) => {
                  const value = label == null ? NaN : Number(label);
                  return Number.isFinite(value) ? `${value.toFixed(0)}%` : "N/A";
                }}
                style={{ fill: "#fff", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
