import { KpiCardShell } from "./KpiCardShell";

// Card de métrica com a PORCENTAGEM como protagonista -- pedido do Victor
// 19/09/2026 (spec de UX/UI detalhada): "a métrica principal deve ser a
// porcentagem... é o indicador crítico de sucesso. O número absoluto e o
// contexto total devem vir logo abaixo em tamanho menor". Diferente do
// StatTile genérico (usado em todo o resto do painel, valor absoluto em
// destaque) -- esse aqui é específico pra métricas de TAXA com meta
// definida (hoje: Total de chamados do SAC/assistência vs. meta ideal,
// ver Dashboard.tsx/KpisAssistenciaView.tsx), por isso é um componente à
// parte em vez de mais uma variante dentro do StatTile. Usa KpiCardShell
// (KpiCardShell.tsx) -- mesma casca visual dos outros cards da fileira
// (pedido do Victor 21/09/2026: "manter a consistência visual").
//
// Achado 21/09/2026 (Victor, duas mensagens no mesmo dia): 1ª -- "tire a
// tarja de 'fora da meta' e coloque o numero percentual em vermelho caso
// esteja fora da meta, e verde se estiver dentro da meta" (a StatusPill
// saiu, só a cor do número ficou). 2ª -- pediu a tag de volta ("tag de
// status... ao lado do número"), mas com um estilo específico (rounded-md,
// não rounded-full) -- não é a mesma StatusPill de KpiCardShell.tsx
// (reaproveitada no card de Prejuízo, com rounded-full -- não mexida aqui
// pra não mudar aquele também), é uma tag local só deste componente. Cor
// do número + tag convivem agora -- os dois sinalizam o mesmo status,
// nenhum pedido cancelou o outro de verdade. Vale pras duas abas (SAC e
// assistência) porque as duas usam este mesmo componente.
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
  // pro estado "sem dado" (sem cor de status, sem porcentagem).
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
  const pctColor = pct === null ? "var(--text-primary)" : foraDaMeta ? "var(--status-critical)" : "var(--status-good)";

  return (
    <KpiCardShell accentColor={pct !== null ? pctColor : undefined}>
      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </span>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-5xl font-bold leading-none" style={{ color: pctColor }}>
          {pct !== null ? pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
          {pct !== null ? <span className="text-2xl font-semibold ml-0.5">%</span> : null}
        </span>
        {pct !== null ? (
          <span
            className="text-xs font-semibold rounded-md px-2 py-1 shrink-0"
            style={{ background: `color-mix(in srgb, ${pctColor} 14%, var(--surface-1))`, color: pctColor }}
          >
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
    </KpiCardShell>
  );
}
