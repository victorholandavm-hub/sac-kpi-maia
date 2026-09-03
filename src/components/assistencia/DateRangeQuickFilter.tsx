import { FilterPill } from "./FilterPill";

// Atalhos de período -- pedido do Victor 03/09/2026, com print de
// referência (Hoje/7 dias/30 dias/3 meses/1 ano/Este ano + linha-resumo
// "Exibindo: X a Y (rótulo)"). Complementa os campos De/Até já existentes
// (não substitui -- ainda dá pra digitar uma data manual pra fora de
// qualquer um desses atalhos), então mora ao lado deles na mesma barra de
// filtros.
export type DatePreset = "hoje" | "7d" | "30d" | "3m" | "1a" | "este_ano";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "3m", label: "3 meses" },
  { key: "1a", label: "1 ano" },
  { key: "este_ano", label: "Este ano" },
];

const PRESET_LABELS: Record<DatePreset, string> = Object.fromEntries(PRESETS.map((p) => [p.key, p.label])) as Record<DatePreset, string>;

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "De"/"Até" de cada atalho -- mesmo fuso/critério que o resto da tela já
// usa pra "hoje" (new Date().toISOString().slice(0,10), ver fila/page.tsx).
// "Este ano" é o ano-calendário (1º de janeiro até hoje); "1 ano" é uma
// janela ROLANTE de 365 dias (diferente -- ver print: "03/09/2025 a
// 03/09/2026" com hoje=03/09/2026, não "01/01/2026 a 03/09/2026").
export function computePresetRange(preset: DatePreset, today: Date = new Date()): { from: string; to: string } {
  const to = toYmd(today);
  if (preset === "hoje") return { from: to, to };
  if (preset === "7d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return { from: toYmd(d), to };
  }
  if (preset === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return { from: toYmd(d), to };
  }
  if (preset === "3m") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return { from: toYmd(d), to };
  }
  if (preset === "1a") {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 1);
    return { from: toYmd(d), to };
  }
  // este_ano
  return { from: toYmd(new Date(today.getFullYear(), 0, 1)), to };
}

// Descobre se o `dateFrom`/`dateTo` atual bate exatamente com algum atalho
// (pra destacar o pill certo) -- comparação de string simples (YYYY-MM-DD),
// já que computePresetRange usa o mesmo formato dos dois lados.
function matchingPreset(dateFrom: string | undefined, dateTo: string | undefined, today: Date): DatePreset | null {
  if (!dateFrom) return null;
  const effectiveTo = dateTo ?? toYmd(today);
  for (const { key } of PRESETS) {
    const range = computePresetRange(key, today);
    if (range.from === dateFrom && range.to === effectiveTo) return key;
  }
  return null;
}

function formatBr(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function DateRangeQuickFilter({
  dateFrom,
  dateTo,
  buildHref,
}: {
  dateFrom: string | undefined;
  dateTo: string | undefined;
  buildHref: (range: { from?: string; to?: string }) => string;
}) {
  const today = new Date();
  const active = matchingPreset(dateFrom, dateTo, today);

  return (
    <div className="flex flex-col gap-1.5">
      {dateFrom ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Exibindo: {formatBr(dateFrom)} a {formatBr(dateTo ?? toYmd(today))}
          {active ? ` (${PRESET_LABELS[active]})` : " (personalizado)"}
        </p>
      ) : null}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => {
          const range = computePresetRange(p.key, today);
          return <FilterPill key={p.key} label={p.label} selected={active === p.key} href={buildHref({ from: range.from, to: range.to })} />;
        })}
      </div>
    </div>
  );
}
