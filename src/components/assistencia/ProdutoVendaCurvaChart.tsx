"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SemanaVenda } from "@/lib/vendasProduto";

function formatSemana(value: unknown) {
  if (typeof value !== "string") return "";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export function ProdutoVendaCurvaChart({ semanas }: { semanas: SemanaVenda[] }) {
  const totalPeriodo = semanas.reduce((sum, s) => sum + s.quantidade, 0);

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Vendas por semana
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Total no período: <strong style={{ color: "var(--text-primary)" }}>{totalPeriodo}</strong>
        </span>
      </div>
      {semanas.every((s) => s.quantidade === 0) ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda desse produto no período.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={semanas} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="semanaInicio"
              tickFormatter={formatSemana}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "var(--gridline)" }}
              labelFormatter={(value) => `Semana de ${formatSemana(value)}`}
              formatter={(value) => [value, "Unidades"] as [number, string]}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="quantidade" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
