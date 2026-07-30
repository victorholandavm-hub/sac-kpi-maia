"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPattern } from "@/lib/customerProfile";

export function ClientSeasonalityChart({ data }: { data: MonthlyPattern[] }) {
  const hasData = data.some((m) => m.count > 0);
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Compras por mês do ano
      </h3>
      {!hasData ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis dataKey="label" stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [`${value} compra(s)`, "Compras"]}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill="var(--brand-orange)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
