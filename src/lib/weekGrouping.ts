// Agrupamento por semana (segunda a domingo) -- extraído de
// AgendaDayGroups.tsx (25/08/2026) pra ser compartilhado com a aba
// Visitas (fila/page.tsx), pedido do Victor 25/08/2026: "na tela de
// visitas preciso que fique organizado por semana, como é na tela de
// agenda". Genérico sobre o tipo de "grupo do dia" (T) -- só precisa
// saber extrair a data (YYYY-MM-DD) de cada um via `dateKeyOf`, já que
// Agenda usa `{dateKey, label, items}` e Visitas usa `QueueGroup`
// (`key`, não `dateKey`), dois tipos diferentes que não vale a pena
// unificar só por causa disso.
export type WeekGroup<T> = { weekKey: string; label: string; days: T[] };

function mondayOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function formatDayMonth(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}/${m}`;
}

// "Semana do mês", não semana corrida -- pedido do Victor 28/08/2026:
// "mantenha a divisão por semana mas de acordo com as semanas do mês".
// Antes a chave da semana era só a segunda-feira daquela semana
// corrida, o que misturava dias de meses diferentes numa mesma semana
// quando a virada de mês caía no meio dela (ex.: semana de 26/01 a
// 01/02 juntava janeiro com fevereiro). Namespacear a chave com o mês
// do PRÓPRIO dia (não o mês da segunda-feira) resolve isso sozinho: dois
// dias do mesmo mês com a mesma segunda-feira caem na mesma chave (mesma
// semana de sempre); um dia de fevereiro cuja segunda-feira "de
// calendário" caiu em janeiro ganha uma chave diferente de qualquer dia
// de janeiro, indo pra sua própria semana (curta, só com os dias que já
// são de fevereiro) -- sem precisar recalcular segunda-feira nenhuma,
// só isolar por mês antes de agrupar.
function weekKeyOfMonth(dateKey: string): string {
  return `${monthKeyOf(dateKey)}_${mondayOfWeek(dateKey)}`;
}

// Rótulo usa as datas de verdade que têm chamado (não a semana inteira
// teórica) -- sem implicar que existe algo num dia sem nenhum. Min/max de
// verdade sobre as chaves, não "primeiro/último do array" -- os dias
// chegam em ordem crescente (Agenda antes de 25/08/2026) OU decrescente
// (Agenda e Visitas depois, "mais recentes primeiro") dependendo de quem
// chama, então o rótulo não pode assumir uma direção.
export function groupIntoWeeks<T>(days: T[], dateKeyOf: (day: T) => string): WeekGroup<T>[] {
  const weeks: WeekGroup<T>[] = [];
  for (const day of days) {
    const weekKey = weekKeyOfMonth(dateKeyOf(day));
    let week = weeks.find((w) => w.weekKey === weekKey);
    if (!week) {
      week = { weekKey, label: "", days: [] };
      weeks.push(week);
    }
    week.days.push(day);
  }
  for (const week of weeks) {
    const keys = week.days.map(dateKeyOf);
    const first = keys.reduce((min, k) => (k < min ? k : min));
    const last = keys.reduce((max, k) => (k > max ? k : max));
    week.label = first === last ? `Semana de ${formatDayMonth(first)}` : `Semana de ${formatDayMonth(first)} a ${formatDayMonth(last)}`;
  }
  return weeks;
}

// Mês -> semana (semana do mês, ver weekKeyOfMonth acima) -- pedido do
// Victor 28/08/2026: "quando fechar o mês, ela ficaria agrupada dentro
// do mês --> semana --> dia". Cada MonthGroup já vem com as semanas
// dela prontas (groupIntoWeeks reaproveitado, não duplicado) -- quem
// renderiza decide se embrulha isso num acordeão de mês ou mostra solto
// (ver isCurrentMonth abaixo: o mês corrente não ganha esse embrulho a
// mais, só os meses já fechados).
export type MonthGroup<T> = { monthKey: string; label: string; weeks: WeekGroup<T>[] };

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} de ${y}`;
}

export function groupIntoMonths<T>(days: T[], dateKeyOf: (day: T) => string): MonthGroup<T>[] {
  const weeks = groupIntoWeeks(days, dateKeyOf);
  const months: MonthGroup<T>[] = [];
  for (const week of weeks) {
    // weekKey é sempre "YYYY-MM_YYYY-MM-DD" (ver weekKeyOfMonth) -- o mês
    // já está namespaced ali, sem precisar reabrir os dias da semana pra
    // recalcular.
    const mKey = week.weekKey.slice(0, 7);
    let month = months.find((m) => m.monthKey === mKey);
    if (!month) {
      month = { monthKey: mKey, label: formatMonthLabel(mKey), weeks: [] };
      months.push(month);
    }
    month.weeks.push(week);
  }
  return months;
}

// "Fechar o mês" -- pedido do Victor 28/08/2026: só os meses que já
// passaram (não o corrente) ganham o embrulho extra de acordeão de mês;
// o mês corrente continua mostrando semana > dia direto, sem esconder o
// que ainda tá em andamento atrás de mais um clique. `todayKey`
// (YYYY-MM-DD) vem de quem chama -- essas telas já calculam isso pra
// outra coisa (badge HOJE/ATRASADO), evita chamar `new Date()` de novo
// aqui dentro (várias dessas telas são "use client", onde isso quebraria
// a regra de pureza do React Compiler se fosse direto no corpo do
// componente).
export function isCurrentMonth(monthKey: string, todayKey: string): boolean {
  return monthKey === todayKey.slice(0, 7);
}
