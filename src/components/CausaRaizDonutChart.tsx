"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CAUSA_RAIZ_ERRO_INTERNO } from "@/lib/assistenciaLabels";

// Gráfico de rosca pra "Trocas de produto por causa raiz" -- pedido do
// Victor 22/08/2026: "A seção de Trocas de produto por causa raiz... é
// perfeita para um gráfico de pizza. Permite identificar o problema
// principal sem ler número por número". Erro interno (retrabalho do time,
// ver CAUSA_RAIZ_ERRO_INTERNO) sempre em vermelho, pra bater o olho mesmo
// sem ler a legenda -- causas externas (transporte, fábrica) e decisão do
// cliente ficam em tons neutros da paleta categórica.
function corDaCausa(key: string): string {
  if (CAUSA_RAIZ_ERRO_INTERNO.includes(key)) return "var(--status-critical)";
  if (key === "avaria_transporte") return "var(--series-2)";
  if (key === "defeito_fabricacao") return "var(--series-5)";
  if (key === "solicitacao_cliente") return "var(--series-7)";
  return "var(--text-muted)";
}

export function CausaRaizDonutChart({ data }: { data: { key: string; name: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fill={corDaCausa(d.key)} stroke="var(--surface-1)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const n = Number(value ?? 0);
            return [`${n} (${((n / total) * 100).toFixed(0)}%)`, name];
          }}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
