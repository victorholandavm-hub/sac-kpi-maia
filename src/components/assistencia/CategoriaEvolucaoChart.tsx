"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoriaEvolucaoSemana } from "@/lib/vendasProduto";

// Paleta categórica do projeto tem 8 cores fixas (--series-1..8) -- uma 9a
// série nunca deve gerar uma cor nova/ciclada (perde a separação garantida
// pro daltonismo). Como a classificação de produto tem 9 categorias reais
// + "outros", a menos vendida do período entra no balaio de "outros" só
// pra esse gráfico (mantém as 8 cores sempre distintas) -- o ranking/lista
// por categoria em outro lugar da página continua mostrando as 9 à parte.
const MAX_SERIES_COLORIDAS = 8;

function formatSemana(value: unknown) {
  if (typeof value !== "string") return "";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

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

const OUTROS_KEY = "outros";
const OUTROS_LABEL = "Outros";
const OUTROS_COLOR = "var(--text-muted)";

type Categoria = { key: string; label: string };

// Agrupa categorias além do orçamento de 8 cores dentro de "outros",
// somando os valores semana a semana -- decidido pelo volume total do
// período (as menos vendidas entram primeiro), não por ordem alfabética.
function agruparCategorias(
  semanas: CategoriaEvolucaoSemana[],
  categorias: Categoria[]
): { semanas: CategoriaEvolucaoSemana[]; categorias: Categoria[] } {
  if (categorias.length <= MAX_SERIES_COLORIDAS) return { semanas, categorias };

  const reais = categorias.filter((c) => c.key !== OUTROS_KEY);
  const totalPorCategoria = new Map<string, number>();
  for (const cat of reais) {
    let total = 0;
    for (const semana of semanas) total += Number(semana[cat.key] ?? 0);
    totalPorCategoria.set(cat.key, total);
  }
  const ordenadas = [...reais].sort((a, b) => (totalPorCategoria.get(b.key) ?? 0) - (totalPorCategoria.get(a.key) ?? 0));
  const mantidas = ordenadas.slice(0, MAX_SERIES_COLORIDAS - 1);
  const dobradas = ordenadas.slice(MAX_SERIES_COLORIDAS - 1);
  const dobradasKeys = new Set(dobradas.map((c) => c.key));

  const semanasAgrupadas = semanas.map((semana) => {
    let outros = Number(semana[OUTROS_KEY] ?? 0);
    for (const key of dobradasKeys) outros += Number(semana[key] ?? 0);
    return { ...semana, [OUTROS_KEY]: outros };
  });

  const categoriasFinal: Categoria[] = [...mantidas, { key: OUTROS_KEY, label: OUTROS_LABEL }];
  return { semanas: semanasAgrupadas, categorias: categoriasFinal };
}

function corDaCategoria(key: string, index: number): string {
  if (key === OUTROS_KEY) return OUTROS_COLOR;
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export function CategoriaEvolucaoChart({
  semanas,
  categorias,
}: {
  semanas: CategoriaEvolucaoSemana[];
  categorias: Categoria[];
}) {
  const semVendas = categorias.length === 0;
  const { semanas: semanasChart, categorias: categoriasChart } = useMemo(
    () => agruparCategorias(semanas, categorias),
    [semanas, categorias]
  );

  // Clique na legenda isola a categoria (esconde as outras temporariamente)
  // -- com várias linhas cruzando, é o jeito de comparar duas de cada vez
  // sem perder o resto do contexto (o clique de novo desisola).
  const [isoladas, setIsoladas] = useState<Set<string>>(new Set());
  function alternarIsolamento(key: string) {
    setIsoladas((atual) => {
      const todasKeys = categoriasChart.map((c) => c.key);
      // Nada isolado ainda -- primeiro clique isola só essa categoria.
      if (atual.size === 0) return new Set([key]);
      // Só essa já está isolada -- clique de novo desisola tudo (volta ao normal).
      if (atual.size === 1 && atual.has(key)) return new Set();
      // Alguma(s) outra(s) isolada(s) -- clique soma/tira essa da seleção.
      const next = new Set(atual);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === todasKeys.length ? new Set() : next;
    });
  }

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Evolução por família logística
        </h3>
        {isoladas.size > 0 ? (
          <button
            type="button"
            onClick={() => setIsoladas(new Set())}
            className="text-xs underline shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            Mostrar todas
          </button>
        ) : null}
      </div>
      {semVendas ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda no período.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={semanasChart} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
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
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
              onClick={(entry) => alternarIsolamento(String(entry.dataKey))}
              formatter={(value, entry) => {
                const key = String((entry as { dataKey?: unknown }).dataKey ?? "");
                const apagada = isoladas.size > 0 && !isoladas.has(key);
                return <span style={{ opacity: apagada ? 0.4 : 1 }}>{value}</span>;
              }}
            />
            {categoriasChart.map((cat, i) => (
              <Line
                key={cat.key}
                dataKey={cat.key}
                name={cat.label}
                stroke={corDaCategoria(cat.key, i)}
                strokeWidth={2}
                strokeOpacity={isoladas.size > 0 && !isoladas.has(cat.key) ? 0.15 : 1}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
