// Formata data/hora sempre no fuso de João Pessoa (America/Fortaleza,
// UTC-3, sem horário de verão) -- sem isso, `toLocaleString` roda em
// Server Components/Server Actions usando o fuso do processo Node na VPS
// (normalmente UTC), aparecendo até 3h adiantado do horário real. Ver
// BUSINESS_TZ_OFFSET_MS em src/lib/kpi.ts para o mesmo fuso aplicado a
// cálculo de datas (ali é matemática de intervalo, aqui é só exibição).
export function formatDateTimeBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}
