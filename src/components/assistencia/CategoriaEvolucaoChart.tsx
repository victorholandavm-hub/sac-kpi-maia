"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoriaEvolucaoSemana, ProdutoCategoriaKey } from "@/lib/vendasProduto";

function formatSemana(value: unknown) {
  if (typeof value !== "string") return "";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

// Uma cor por categoria (--series-1..8, já usado em REQUEST_TYPE_COLORS
// pra esse mesmo tipo de gráfico) -- foge de propósito da regra de "uma
// cor de destaque só" ([[lojas-maia-ui-visual]]): aquela regra é sobre
// texto/badge/UI de navegação, não sobre gráfico de dado de verdade, onde
// várias séries sem cor própria ficam ilegíveis. "Outros" fica cinza
// neutro -- é a categoria "não classificada", não merece cor de destaque.
const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

function corDaCategoria(key: ProdutoCategoriaKey, index: number): string {
  if (key === "outros") return "var(--text-muted)";
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export function CategoriaEvolucaoChart({
  semanas,
  categorias,
}: {
  semanas: CategoriaEvolucaoSemana[];
  categorias: { key: ProdutoCategoriaKey; label: string }[];
}) {
  const semVendas = categorias.length === 0;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
        Evolução por tipo de produto
      </h3>
      {semVendas ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda no período.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
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
            {categorias.map((cat, i) => (
              <Bar key={cat.key} dataKey={cat.key} name={cat.label} stackId="categorias" fill={corDaCategoria(cat.key, i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
