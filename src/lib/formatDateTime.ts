// Formata data/hora sempre no fuso de João Pessoa (America/Fortaleza,
// UTC-3, sem horário de verão) -- sem isso, `toLocaleString` roda em
// Server Components/Server Actions usando o fuso do processo Node na VPS
// (normalmente UTC), aparecendo até 3h adiantado do horário real. Ver
// BUSINESS_TZ_OFFSET_MS em src/lib/kpi.ts para o mesmo fuso aplicado a
// cálculo de datas (ali é matemática de intervalo, aqui é só exibição).
export function formatDateTimeBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

// Mesma ideia, sem os segundos -- pedido do Victor 23/08/2026: "so precisa
// excluir os segundos, basta deixar hora e minuto do concluido". Só usado
// onde segundo é ruído visual (card compacto da fila) -- telas de
// histórico/auditoria continuam com formatDateTimeBr (precisão completa).
export function formatDateTimeShortBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Só a data, sem hora nenhuma -- pedido do Victor 23/08/2026: "nas
// notificações de assistencia, é necessário ter a data na notificação
// impressa, só a data, sem precisar da hora" (ver DespachoCard.tsx).
export function formatDateOnlyBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
