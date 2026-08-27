"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Count, Coverage } from "@/lib/kpi";

// Achado 27/08/2026 (KPIs da Assistência, "Chamados por produto"): label
// longo (descrição crua do produto, até ~45 caracteres) estourava a
// largura do eixo Y e ficava sobreposto com a linha de cima/baixo,
// ilegível. Trunca só o texto do eixo (com "…") -- o Tooltip continua
// mostrando o label INTEIRO ao passar o mouse (usa o dado bruto, não o
// tickFormatter), então nenhuma informação se perde, só a barra some de
// visual poluído.
const MAX_TICK_LABEL_LENGTH = 24;

function truncateTick(label: string): string {
  return label.length > MAX_TICK_LABEL_LENGTH ? `${label.slice(0, MAX_TICK_LABEL_LENGTH - 1)}…` : label;
}

export function BarRanking({
  title,
  data,
  coverage,
  onSelect,
}: {
  title: string;
  data: Count[];
  coverage?: Coverage;
  onSelect?: (item: Count) => void;
}) {
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {coverage ? (
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Cobertura: {coverage.pct}% dos chamados têm essa informação ({coverage.withValue} de {coverage.total})
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {onSelect && data.length > 0 ? (
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Clique numa barra pra ver os chamados.
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--gridline)" />
            <XAxis type="number" allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tickFormatter={truncateTick}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--gridline)" }}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--series-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              cursor={onSelect ? "pointer" : undefined}
              onClick={onSelect ? (bar: { payload?: Count }) => bar.payload && onSelect(bar.payload) : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
