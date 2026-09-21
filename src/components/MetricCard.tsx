import { AlertTriangle, CheckCircle2 } from "lucide-react";

// Card de métrica com a PORCENTAGEM como protagonista -- pedido do Victor
// 21/09/2026 (spec de UX/UI detalhada): "a métrica principal deve ser a
// porcentagem... é o indicador crítico de sucesso. O número absoluto e o
// contexto total devem vir logo abaixo em tamanho menor". Diferente do
// StatTile genérico (usado em todo o resto do painel, valor absoluto em
// destaque) -- esse aqui é específico pra métricas de TAXA com meta
// definida (hoje: Total de chamados do SAC/assistência vs. meta ideal,
// ver Dashboard.tsx/KpisAssistenciaView.tsx), por isso é um componente à
// parte em vez de mais uma variante dentro do StatTile.
export function MetricCard({
  title,
  pct,
  count,
  countNoun,
  totalLabel,
  metaIdealPct,
}: {
  title: string;
  // null quando não há vendas no período pra calcular a taxa -- card cai
  // pro estado "sem dado" (sem tag de meta, sem porcentagem).
  pct: number | null;
  count: number;
  // "chamado"/"chamados" -- singular/plural de quem chama (SAC usa
  // "chamados", assistência também, mas deixado configurável em vez de
  // fixo pra não prender o componente a um texto só).
  countNoun: string;
  // "de 4.792 vendas no período" -- já formatado por quem chama (mesmo
  // texto que já existia no note do StatTile).
  totalLabel: string;
  metaIdealPct: number;
}) {
  const foraDaMeta = pct !== null && pct > metaIdealPct;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm p-5 flex flex-col gap-3 min-w-0">
      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </span>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <span className="text-5xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>
          {pct !== null ? pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
          {pct !== null ? <span className="text-2xl font-semibold ml-0.5">%</span> : null}
        </span>

        {pct !== null ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 shrink-0"
            style={{
              background: `color-mix(in srgb, ${foraDaMeta ? "var(--status-critical)" : "var(--status-good)"} 16%, var(--surface-1))`,
              color: foraDaMeta ? "var(--status-critical)" : "var(--status-good)",
            }}
          >
            {foraDaMeta ? <AlertTriangle size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
            {foraDaMeta ? "Fora da meta" : "Dentro da meta"}
          </span>
        ) : null}
      </div>

      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        {count.toLocaleString("pt-BR")} {countNoun} {totalLabel}
      </span>

      <div className="pt-2 mt-1 border-t" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Meta ideal do período: menos de {metaIdealPct.toLocaleString("pt-BR")}%
        </span>
      </div>
    </div>
  );
}
