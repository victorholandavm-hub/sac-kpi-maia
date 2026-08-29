// Agrupamento por semana -- extraído de AgendaDayGroups.tsx (25/08/2026)
// pra ser compartilhado com a aba Visitas (fila/page.tsx), pedido do
// Victor 25/08/2026: "na tela de visitas preciso que fique organizado
// por semana, como é na tela de agenda". Genérico sobre o tipo de "grupo
// do dia" (T) -- só precisa saber extrair a data (YYYY-MM-DD) de cada um
// via `dateKeyOf`, já que Agenda usa `{dateKey, label, items}` e Visitas
// usa `QueueGroup` (`key`, não `dateKey`), dois tipos diferentes que não
// vale a pena unificar só por causa disso.
export type WeekGroup<T> = { weekKey: string; label: string; days: T[] };

function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function formatDayMonth(day: number, monthKey: string): string {
  const [, m] = monthKey.split("-");
  return `${String(day).padStart(2, "0")}/${m}`;
}

// Último dia de verdade do mês (28, 29, 30 ou 31) -- "dia 0 do mês
// seguinte" é um truque padrão de Date pra isso, sem precisar de tabela
// de dias-por-mês nem checar ano bissexto na mão.
function lastDayOfMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Semana FIXA de 7 dias corridos do mês, não segunda a domingo -- pedido
// do Victor 29/08/2026: "agrupe cada semana com 7 dias, sempre assim:
// dia 01 a dia 07, dia 08 a dia 14, dia 15 a dia 21, dia 22 a dia 28, dia
// 29 a dia 30(ou 31)". Substitui o esquema anterior (semana ISO,
// segunda-feira a domingo, namespaced por mês pra não cruzar virada de
// mês -- pedido do Victor 28/08/2026). O novo esquema já nasce sem
// cruzar mês nenhum (a banda é sempre um intervalo de dias DENTRO do
// mesmo mês), então nem precisa mais desse namespace por cima -- a
// última banda (29 em diante) pode ter só 2 ou 3 dias dependendo do mês,
// mas nunca "vaza" pro mês seguinte. Sempre 4 ou 5 bandas por mês.
const WEEK_BAND_STARTS = [1, 8, 15, 22, 29] as const;

function weekBandStart(day: number): number {
  let start: number = WEEK_BAND_STARTS[0];
  for (const s of WEEK_BAND_STARTS) {
    if (day >= s) start = s;
  }
  return start;
}

function weekKeyOfMonth(dateKey: string): string {
  const day = Number(dateKey.slice(8, 10));
  return `${monthKeyOf(dateKey)}_${String(weekBandStart(day)).padStart(2, "0")}`;
}

// Rótulo vem da banda FIXA em si (01-07, 08-14, ...), não do min/max das
// datas que realmente têm chamado -- é o próprio pedido do Victor
// (bandas sempre iguais, previsíveis, não "encolhem" conforme os dados).
// weekKey já carrega mês + dia de início (ver weekKeyOfMonth) -- dá pra
// recalcular o rótulo só a partir dele, sem precisar reabrir `days`.
function weekLabelFor(weekKey: string): string {
  const [monthKey, startStr] = weekKey.split("_");
  const start = Number(startStr);
  const end = Math.min(start + 6, lastDayOfMonth(monthKey));
  return start === end ? `Semana de ${formatDayMonth(start, monthKey)}` : `Semana de ${formatDayMonth(start, monthKey)} a ${formatDayMonth(end, monthKey)}`;
}

export function groupIntoWeeks<T>(days: T[], dateKeyOf: (day: T) => string): WeekGroup<T>[] {
  const weeks: WeekGroup<T>[] = [];
  for (const day of days) {
    const weekKey = weekKeyOfMonth(dateKeyOf(day));
    let week = weeks.find((w) => w.weekKey === weekKey);
    if (!week) {
      week = { weekKey, label: weekLabelFor(weekKey), days: [] };
      weeks.push(week);
    }
    week.days.push(day);
  }
  return weeks;
}

// Mês -> semana (semana do mês, ver weekKeyOfMonth acima) -- pedido do
// Victor 28/08/2026: "quando fechar o mês, ela ficaria agrupada dentro
// do mês --> semana --> dia". Cada MonthGroup já vem com as semanas
// dela prontas (groupIntoWeeks reaproveitado, não duplicado) -- quem
// renderiza decide se embrulha isso num acordeão de mês ou mostra solto
// (ver isCurrentMonth abaixo pra saber qual mês nasce aberto).
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
    // weekKey é sempre "YYYY-MM_DD" (ver weekKeyOfMonth, DD = dia de
    // início da banda) -- o mês já está namespaced ali, sem precisar
    // reabrir os dias da semana pra recalcular.
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

// "Fechar o mês" -- pedido do Victor 28/08/2026: quando há mais de um mês
// na tela, TODOS ganham o embrulho de acordeão de mês, inclusive o
// corrente (corrigido 29/08/2026: "agosto precisa ficar do mesmo jeito
// que setembro" -- antes só os já fechados ganhavam, o corrente ficava
// com semanas soltas). O que ainda diferencia o mês corrente é nascer
// ABERTO por padrão (ver `defaultOpen` em MonthAccordion.tsx, cada tela
// passa `isCurrentMonth(...)` pra esse prop) -- não esconde o que ainda
// tá em andamento atrás de mais um clique, mesmo estando dentro do
// acordeão como os outros meses. `todayKey` (YYYY-MM-DD) vem de quem
// chama -- essas telas já calculam isso pra outra coisa (badge HOJE/
// ATRASADO), evita chamar `new Date()` de novo aqui dentro (várias
// dessas telas são "use client", onde isso quebraria a regra de pureza
// do React Compiler se fosse direto no corpo do componente).
export function isCurrentMonth(monthKey: string, todayKey: string): boolean {
  return monthKey === todayKey.slice(0, 7);
}
