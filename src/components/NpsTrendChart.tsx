"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NpsWeekPoint } from "@/lib/npsTrend";
import { NPS_INDEX_TARGET } from "./NpsCard";

function formatDate(value: unknown) {
  if (typeof value !== "string") return "";
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
}

// Índice NPS por semana (mesma fórmula de NpsCard/buildNpsSummary, ver
// getNpsTrend em npsTrend.ts) -- pedido do Victor 18/08/2026, aba
// Avaliações: "linha do tempo de evolução dessas notas".
export function NpsTrendChart({ data }: { data: NpsWeekPoint[] }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-orange)" }}>
      <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        Evolução do NPS (por semana)
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Índice = % de promotores (nota 4-5) menos % de detratores (nota 1-2) dos que responderam a enquete naquela
        semana. Meta: {NPS_INDEX_TARGET}.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem respostas de enquete suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis dataKey="weekStart" tickFormatter={formatDate} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip
              labelFormatter={formatDate}
              contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="npsIndex" stroke="var(--brand-orange)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
