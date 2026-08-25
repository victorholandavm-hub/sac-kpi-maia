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

function formatDayMonth(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}/${m}`;
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
    const weekKey = mondayOfWeek(dateKeyOf(day));
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
