"use client";

import { useState } from "react";
import type { PerformanceMetric, PerformanceReport, PerformanceReportSet } from "@/lib/kpi";

type Granularity = "week" | "month";

function formatValue(metric: PerformanceMetric, value: number | null) {
  if (value === null) return "—";
  if (metric.unit === "count") return `${value}`;
  if (metric.unit === "%") return `${value}%`;
  if (metric.unit === "h") return `${value}h`;
  return `${value}min`;
}

function trendColor(metric: PerformanceMetric) {
  if (metric.improved === true) return "var(--status-good)";
  if (metric.improved === false) return "var(--status-critical)";
  return "var(--text-muted)";
}

function trendLabel(metric: PerformanceMetric) {
  if (metric.deltaPct === null || metric.direction === "flat") return "estável";
  const arrow = metric.direction === "up" ? "▲" : "▼";
  const sign = metric.deltaPct > 0 ? "+" : "";
  return `${arrow} ${sign}${metric.deltaPct}%`;
}

function formatDateBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function pillStyle(active: boolean) {
  return {
    color: active ? "var(--surface-1)" : "var(--text-secondary)",
    background: active ? "var(--brand-green)" : "transparent",
    border: `1px solid ${active ? "var(--brand-green)" : "var(--border)"}`,
  };
}

function ReportTable({ data }: { data: PerformanceReport }) {
  return (
    <>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        {formatDateBr(data.currentFrom)}–{formatDateBr(data.currentTo)} ({data.currentSampleSize} chamados)
        comparado com {formatDateBr(data.previousFrom)}–{formatDateBr(data.previousTo)} (
        {data.previousSampleSize} chamados). Sempre últimos {data.windowDays} dias vs. os {data.windowDays}{" "}
        dias anteriores, independente do período selecionado no painel.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
          <thead>
            <tr className="text-left" style={{ color: "var(--text-muted)" }}>
              <th className="py-1 pr-4 font-normal">Métrica</th>
              <th className="py-1 pr-4 font-normal">Período atual</th>
              <th className="py-1 pr-4 font-normal">Período anterior</th>
              <th className="py-1 pr-4 font-normal">Variação</th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((metric) => (
              <tr key={metric.key} style={{ borderTop: "1px solid var(--gridline)" }}>
                <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                  {metric.label}
                </td>
                <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatValue(metric, metric.current)}
                </td>
                <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatValue(metric, metric.previous)}
                </td>
                <td
                  className="py-2 pr-4 font-medium"
                  style={{ fontVariantNumeric: "tabular-nums", color: trendColor(metric) }}
                >
                  {trendLabel(metric)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PerformanceReportButton({ data }: { data: PerformanceReportSet }) {
  const [open, setOpen] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("week");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-full"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      >
        Relatório de desempenho
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar relatório"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-2xl max-h-[84vh] overflow-y-auto rounded-lg border p-5 shadow-lg"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                Relatório de desempenho do SAC
              </h3>
              <button
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="text-sm px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setGranularity("week")}
                className="text-xs px-3 py-1 rounded-full"
                style={pillStyle(granularity === "week")}
              >
                Semana a semana
              </button>
              <button
                onClick={() => setGranularity("month")}
                className="text-xs px-3 py-1 rounded-full"
                style={pillStyle(granularity === "month")}
              >
                Mês a mês
              </button>
            </div>

            <ReportTable data={data[granularity]} />
          </div>
        </>
      ) : null}
    </>
  );
}
