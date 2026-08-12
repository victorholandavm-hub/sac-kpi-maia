"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BacklogTrend, DayCount } from "@/lib/kpi";

function formatDate(date: unknown) {
  if (typeof date !== "string") return "";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function trendLabel(trend: BacklogTrend | null): { text: string; color: string } | null {
  if (!trend) return null;
  if (trend.direction === "flat") return { text: "Estável desde o início do período.", color: "var(--text-secondary)" };
  if (trend.direction === "up") {
    return { text: `Subiu ${trend.deltaAbs} chamado${trend.deltaAbs === 1 ? "" : "s"} desde o início do período.`, color: "var(--status-critical)" };
  }
  return { text: `Caiu ${trend.deltaAbs} chamado${trend.deltaAbs === 1 ? "" : "s"} desde o início do período.`, color: "var(--status-good)" };
}

export function BacklogTrendChart({ data, trend }: { data: DayCount[]; trend: BacklogTrend | null }) {
  const label = trendLabel(trend);
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Backlog ao longo do tempo
        </h3>
        {label ? (
          <span className="text-xs font-semibold" style={{ color: label.color }}>
            {label.text}
          </span>
        ) : null}
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Quantos chamados estavam em aberto (por tag) no fim de cada dia — sobe se está acumulando, desce se está vazando.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="var(--axis)"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip
              labelFormatter={formatDate}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="count" stroke="var(--series-2)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
