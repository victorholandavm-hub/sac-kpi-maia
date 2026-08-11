"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SemanaVenda } from "@/lib/vendasProduto";

function formatSemana(value: unknown) {
  if (typeof value !== "string") return "";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export function ProdutoVendaCurvaChart({ semanas }: { semanas: SemanaVenda[] }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
        Vendas por semana
      </h3>
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
            <Bar dataKey="quantidade" fill="var(--brand-green)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
