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

// Paginação por MÊS -- pedido do Victor 01/09/2026: "nas listas estão
// ficando 2/3 páginas sem necessidade... deixe tudo numa única página,
// só quando tiver mais de 3 meses, que aí você coloca o mês mais antigo
// para a página seguinte e assim por diante". Substitui a paginação por
// LINHA que existia antes (100 chamados por página, sem relação nenhuma
// com os meses mostrados na tela -- um mês só com 150 chamados já virava
// "página 1 de 2" no meio da semana, mesmo sem nenhum mês de verdade
// sobrando). Usado pelas 3 telas que já agrupam por mês via
// groupIntoMonths (Visitas/Entregas em fila/page.tsx, Agenda em
// agenda/page.tsx): página 1 sempre cabe até 3 meses inteiros; a partir
// do 4º mês (sempre o mais antigo que ainda não apareceu, já que
// `months` vem ordenado do mais recente pro mais antigo), cada página
// seguinte carrega só mais UM mês -- "e assim por diante" enquanto
// sobrar mês mais velho.
export function paginateMonths<T>(months: MonthGroup<T>[], page: number): { pageMonths: MonthGroup<T>[]; totalPages: number } {
  if (months.length <= 3) return { pageMonths: months, totalPages: 1 };
  const totalPages = months.length - 2;
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  if (clampedPage === 1) return { pageMonths: months.slice(0, 3), totalPages };
  return { pageMonths: [months[clampedPage + 1]], totalPages };
}

// Qual página (1-based, mesma regra de paginateMonths acima) contém um
// mês específico -- usado pela Agenda pra abrir direto na página que tem
// o mês corrente por padrão quando a URL não pede nenhuma página
// explícita, no lugar da navegação "‹ Mês ›" de antes (que trocava
// `month` na URL em vez de `page`). Mês não encontrado (raro: nenhum
// chamado agendado nesse mês) cai na página 1.
export function pageContainingMonth<T>(months: MonthGroup<T>[], monthKey: string): number {
  const idx = months.findIndex((m) => m.monthKey === monthKey);
  if (idx < 0 || idx < 3) return 1;
  return idx - 1;
}
