import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Variacao } from "@/lib/kpisLogistica";

// "Ticker" compacto estilo home broker -- pedido do Victor 09/10/2026
// (evolução do redesenho anterior, PR #584): fileira de mini-cards com
// valor atual + variação vs. período anterior (mesma duração, ver
// periodoAnterior em kpisLogistica.ts). Puramente apresentação -- os
// números em si (Variacao) já vêm prontos calculados em calcularVariacao,
// nenhum dado novo inventado aqui.
//
// Cor por JULGAMENTO (bom/ruim), não por sinal da seta -- índice de volta
// caindo é bom (verde), mesmo a seta apontando pra baixo. Pra contagem
// bruta (cargas, pedidos, volume) não existe "melhor/pior" (mais carga
// despachada não é bom nem ruim por si só), então fica sempre neutro,
// só a seta indicando direção. `melhorou` já vem `null` nesses casos
// (ver calcularVariacao).
function Seta({ delta }: { delta: number | null }) {
  if (delta === null || Math.abs(delta) < 1e-9) return <Minus aria-hidden size={13} />;
  return delta > 0 ? <TrendingUp aria-hidden size={13} /> : <TrendingDown aria-hidden size={13} />;
}

function corVariacao(melhorou: boolean | null): string {
  if (melhorou === null) return "var(--text-muted)";
  return melhorou ? "var(--status-good)" : "var(--status-critical)";
}

type TickerItem = {
  key: string;
  label: string;
  valor: string;
  variacao: Variacao;
  // Formata só o delta (sem o valor absoluto) -- cada métrica tem unidade
  // diferente (pp pros índices, inteiro pras contagens).
  formatarDelta: (delta: number) => string;
};

export function IndiceTicker({ items, labelComparacao }: { items: TickerItem[]; labelComparacao: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
      {items.map((item) => {
        const cor = corVariacao(item.variacao.melhorou);
        return (
          <div
            key={item.key}
            className="rounded-lg px-2 py-1.5 flex flex-col gap-0.5 min-w-0"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>
              {item.label}
            </span>
            <span className="text-lg font-bold leading-tight tabular-nums" style={{ color: "var(--text-primary)" }}>
              {item.valor}
            </span>
            <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: cor }}>
              {item.variacao.delta === null ? (
                <span style={{ color: "var(--text-muted)" }}>sem {labelComparacao}</span>
              ) : (
                <>
                  <Seta delta={item.variacao.delta} />
                  {item.formatarDelta(item.variacao.delta)}
                  <span style={{ color: "var(--text-muted)" }}>vs. {labelComparacao}</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type { TickerItem };
