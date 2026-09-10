export function StatTile({
  label,
  value,
  suffix,
  accent = "var(--brand-green)",
  size = "md",
  valueColor,
  badge,
  onClick,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
  // "lg" -- usado no banner de resumo do topo do painel de KPIs, onde os
  // números precisam ser lidos à distância/de relance.
  size?: "md" | "lg";
  valueColor?: string;
  // Selo pequeno abaixo do valor (ex.: "Volume alto" vs. referência de
  // mercado) -- `title` vira tooltip nativo do navegador com a explicação/
  // metodologia, pra não esconder a ressalva mas também não poluir a tela.
  badge?: { label: string; color: string; title?: string };
  // Abre um detalhamento (ex.: modal explicando como o número foi
  // calculado) -- pedido do Victor 10/09/2026 pro card de Prejuízo Total.
  // Opcional: sem isso o card continua só leitura, mesmo comportamento de
  // sempre.
  onClick?: () => void;
}) {
  // "lg" é pensado pra números curtos ("130") -- valor longo (ex.: "R$
  // 105.768,50") estourava a largura do card, cortado pela borda (achado
  // do Victor 10/09/2026, print do card "Prejuízo total estimado em
  // estoque"). Reduz a fonte quando o texto é longo, mantendo "lg" grande
  // pra número curto continuar legível à distância.
  const valueStr = String(value);
  const lgSizeClass = valueStr.length > 8 ? "text-2xl sm:text-3xl font-bold" : "text-4xl sm:text-5xl font-bold";
  const sizeClass = size === "lg" ? lgSizeClass : "text-3xl font-semibold";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-lg border p-4 flex flex-col gap-1 min-w-0 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow duration-150" : ""}`}
      style={{
        background: "var(--surface-1)",
        borderColor: "var(--border)",
        borderTop: `3px solid ${accent}`,
      }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
        {onClick ? (
          <span className="ml-1" style={{ color: "var(--text-muted)" }} aria-hidden="true">
            ⓘ
          </span>
        ) : null}
      </span>
      <span className={`${sizeClass} break-words`} style={{ color: valueColor ?? "var(--text-primary)", overflowWrap: "anywhere" }}>
        {value}
        {suffix ? (
          <span className="text-base font-normal ml-1" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        ) : null}
      </span>
      {badge ? (
        <span
          title={badge.title}
          className="text-xs font-medium rounded-full px-2 py-0.5 self-start cursor-help"
          style={{ background: badge.color, color: "#fff" }}
        >
          {badge.label}
        </span>
      ) : null}
    </div>
  );
}
