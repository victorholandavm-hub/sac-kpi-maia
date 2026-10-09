"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CausasVolta } from "@/lib/kpisLogistica";

// Detalhamento das causas do Índice de Volta -- pedido do Victor
// 09/10/2026 ("detalhamento das causas da volta" na tela de KPIs de
// logística). A soma das 7 barras é exatamente o numerador de
// resumo.indiceVolta (ver resumirLogistica, kpisLogistica.ts) -- nenhum
// número novo, só a mesma conta já feita por motorista, agregada e
// exposta aqui.
//
// Cor: só "Insucesso de logística" vai em --status-critical -- é
// literalmente a definição de "Volta Logística" na tela (insucessos de
// logística + assistências por erro de transporte), a única causa 100%
// nossa/controlável dessa lista. Insucesso de CD fica de fora dessa conta
// de propósito (ver nota "Volta Logística" na tela -- "exceto L06"), então
// não leva a cor crítica também, mesmo sendo "nosso". O resto (cliente, CD,
// outros, parciais, devoluções ≈, assistências ≈) são causas externas ou
// mistas -- tons neutros da paleta categórica, mesmo critério de
// CausaRaizDonutChart.tsx (causa externa/decisão do cliente = tom neutro,
// só erro interno controlável vira vermelho).
const CAUSAS: { key: keyof CausasVolta; label: string; color: string; hint: string }[] = [
  {
    key: "insucessoLogistica",
    label: "Insucesso — logística",
    color: "var(--status-critical)",
    hint: "Entrega não feita por falha do transporte/motorista -- a única causa 100% controlável por nós (conta em Volta Logística).",
  },
  {
    key: "insucessoCliente",
    label: "Insucesso — cliente",
    color: "var(--series-7)",
    hint: "Entrega não feita por recusa, ausência ou indisponibilidade do cliente.",
  },
  {
    key: "insucessoCd",
    label: "Insucesso — CD",
    color: "var(--series-5)",
    hint: "Falha do CD antes de sair pra entrega (L06, pedido não carregado etc.) -- fica fora de Volta Logística de propósito.",
  },
  {
    key: "assistencias",
    label: "Assistência pós-entrega ≈",
    color: "var(--series-2)",
    hint: "Troca/envio de peça, recolhimento ou nova entrega depois da visita -- estimado por carga/NF/CPF (ver aviso da tela).",
  },
  {
    key: "devolucoes",
    label: "Devolução ≈",
    color: "var(--series-8)",
    hint: "Produto devolvido depois da entrega -- estimado por CPF (ver aviso da tela).",
  },
  { key: "parciais", label: "Entrega parcial", color: "var(--series-3)", hint: "Visita que entregou só parte do pedido." },
  {
    key: "insucessoOutros",
    label: "Insucesso — outros",
    color: "var(--text-muted)",
    hint: "Entrega não feita por outro motivo, sem categoria própria.",
  },
];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function CausaTooltip({ active, payload, total }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; total: number }) {
  const d = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !d) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs flex flex-col gap-1 max-w-[260px]"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}
    >
      <span className="font-semibold">{d.label}</span>
      <span>
        {fmt(d.value)} ocorrência{d.value === 1 ? "" : "s"} · {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "0%"} do total de voltas
      </span>
      <span style={{ color: "var(--text-secondary)" }}>{d.hint}</span>
    </div>
  );
}

type ChartRow = { key: string; label: string; value: number; color: string; hint: string };

export function CausasVoltaChart({ causas }: { causas: CausasVolta }) {
  const total = Object.values(causas).reduce((s, v) => s + v, 0);
  const data: ChartRow[] = CAUSAS.map((c) => ({ key: c.key, label: c.label, value: causas[c.key], color: c.color, hint: c.hint })).sort(
    (a, b) => b.value - a.value
  );
  const height = Math.max(160, data.length * 36 + 24);

  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma volta registrada no período.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis type="number" allowDecimals={false} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={170}
          stroke="var(--axis)"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
        />
        <Tooltip content={(p) => <CausaTooltip active={p.active} payload={p.payload} total={total} />} cursor={{ fill: "var(--gridline)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(label: unknown) => fmt(Number(label ?? 0))}
            style={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
