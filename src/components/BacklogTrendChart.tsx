"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayCount } from "@/lib/kpi";

function formatDate(date: unknown) {
  if (typeof date !== "string") return "";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function BacklogTrendChart({ data }: { data: DayCount[] }) {
  // Sobe = acumulando, desce = vazando -- comparação simples entre os dois
  // últimos pontos, pra dar o sinal de tendência de cara sem precisar ler o
  // gráfico inteiro (pedido do usuário: "o gestor precisa ver se... está
  // subindo ou caindo").
  const trend =
    data.length >= 2 ? data[data.length - 1].count - data[data.length - 2].count : null;

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-orange)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Evolução do backlog
        </h3>
        {trend !== null && trend !== 0 ? (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              color: "#fff",
              background: trend > 0 ? "var(--status-critical)" : "var(--status-good)",
            }}
          >
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)} de ontem pra hoje
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
        <ResponsiveContainer width="100%" height={260}>
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
