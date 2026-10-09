// Formatação/limiares compartilhados entre a página (Server Component) e
// os componentes client do "terminal" de logística (TabelaMotoristasOrdenavel,
// IndiceTicker via page.tsx) -- extraído de kpis/logistica/page.tsx
// 09/10/2026 pra não duplicar (e não poder importar direto da page, que
// carrega requireDashboardAuth/next-headers, inválido num bundle client).

export const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export const pct = (v: number | null, casas = 1) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const dataBr = (dia: string) => dia.split("-").reverse().join("/");

// Motorista com menos visitas que isso tem índice instável (1 volta em 5
// visitas = 20%) -- aparece na tabela, mas apagado.
export const VISITAS_MINIMAS = 20;

// Semáforo do Índice de Volta/Volta Logística -- pedido do Victor
// 09/10/2026: verde até 5%, amarelo até 10%, vermelho acima disso (mesmas
// faixas no card de topo e na coluna por motorista da tabela, pra não
// contradizer visualmente). Ajustável aqui, num lugar só, se a meta mudar.
export const META_VOLTA_BOA = 0.05;
export const META_VOLTA_ALERTA = 0.1;

export function toneIndiceVolta(v: number | null): "good" | "warning" | "critical" | "neutral" {
  if (v === null) return "neutral";
  if (v <= META_VOLTA_BOA) return "good";
  if (v <= META_VOLTA_ALERTA) return "warning";
  return "critical";
}

export const TONE_COLOR: Record<"good" | "warning" | "critical" | "neutral", string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  neutral: "var(--text-primary)",
};
