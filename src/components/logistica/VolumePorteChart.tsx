"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VolumeDia } from "@/lib/kpisLogistica";

const SERIES = [
  { key: "P", label: "P (pequeno)", color: "var(--porte-p)" },
  { key: "M", label: "M (médio)", color: "var(--porte-m)" },
  { key: "G", label: "G (grande)", color: "var(--porte-g)" },
  { key: "naoClassificado", label: "Sem classe", color: "var(--axis)" },
] as const;

function formatDia(dia: unknown) {
  if (typeof dia !== "string") return "";
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function TooltipVolume({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  const d = payload?.[0]?.payload as VolumeDia | undefined;
  if (!active || !d) return null;
  const total = d.P + d.M + d.G + d.naoClassificado;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <p className="font-semibold mb-1">
        {formatDia(d.dia)} · {d.cargas} carga{d.cargas === 1 ? "" : "s"}
      </p>
      {[...SERIES].reverse().map((s) => (
        <p key={s.key} className="flex items-center gap-2 tabular-nums">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
          <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
          <span className="ml-auto font-medium">{fmt(d[s.key])}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 flex justify-between font-semibold tabular-nums" style={{ borderTop: "1px solid var(--border)" }}>
        <span>Total</span>
        <span>{fmt(total)} un.</span>
      </p>
    </div>
  );
}

export function VolumePorteChart({ data }: { data: VolumeDia[] }) {
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma carga despachada no período.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis dataKey="dia" tickFormatter={formatDia} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={44} />
            <Tooltip content={(p) => <TooltipVolume active={p.active} payload={p.payload} />} cursor={{ fill: "var(--surface-2)" }} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="porte"
                fill={s.color}
                stroke="var(--surface-1)"
                strokeWidth={1}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
