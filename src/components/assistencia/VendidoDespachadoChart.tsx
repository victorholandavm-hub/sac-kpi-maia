"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VendidoDespachadoSemana } from "@/lib/vendasProduto";

function formatSemana(value: unknown) {
  if (typeof value !== "string") return "";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export function VendidoDespachadoChart({ semanas }: { semanas: VendidoDespachadoSemana[] }) {
  const semDados = semanas.every((s) => s.vendido === 0 && s.despachado === 0);
  const backlogTotal = semanas.reduce((acc, s) => acc + (s.vendido - s.despachado), 0);

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Vendido vs. despachado
        </h3>
        {!semDados && backlogTotal > 0 ? (
          <span className="text-xs font-semibold" style={{ color: "var(--status-warning)" }}>
            Backlog do período: {backlogTotal} un
          </span>
        ) : null}
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Despachado = entregas concluídas (não temos um evento de &quot;saiu do CD&quot; separado). A
        diferença entre as barras é o que a logística ainda tem pra carregar/entregar.
      </p>
      {semDados ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda no período.
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
              labelFormatter={(value) => `Semana de ${formatSemana(value)}`}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Bar dataKey="vendido" name="Vendido" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="despachado" name="Despachado" fill="var(--series-5)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
