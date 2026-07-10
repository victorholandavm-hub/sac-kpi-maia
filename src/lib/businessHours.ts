// Horário de atendimento: seg-sex 8h-18h, sáb 8h-17h, dom fechado.
// América/Fortaleza (João Pessoa), UTC-3, sem horário de verão.
const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

function businessHoursForWeekday(weekday: number): [number, number] | null {
  if (weekday >= 1 && weekday <= 5) return [8, 18]; // segunda a sexta
  if (weekday === 6) return [8, 17]; // sabado
  return null; // domingo (weekday 0)
}

function atLocalHour(localMs: number, hour: number): number {
  const d = new Date(localMs);
  d.setUTCHours(hour, 0, 0, 0);
  return d.getTime();
}

export function businessMinutesBetween(t0: Date, t1: Date): number {
  if (t1.getTime() <= t0.getTime()) return 0;

  const local0 = t0.getTime() + TZ_OFFSET_MS;
  const local1 = t1.getTime() + TZ_OFFSET_MS;
  const dayMs = 24 * 60 * 60 * 1000;

  let totalMinutes = 0;
  let cursorDay = Math.floor(local0 / dayMs) * dayMs;
  const lastDay = Math.floor(local1 / dayMs) * dayMs;

  while (cursorDay <= lastDay) {
    const weekday = new Date(cursorDay).getUTCDay();
    const hours = businessHoursForWeekday(weekday);
    if (hours) {
      const dayStart = atLocalHour(cursorDay, hours[0]);
      const dayEnd = atLocalHour(cursorDay, hours[1]);
      const windowStart = cursorDay === Math.floor(local0 / dayMs) * dayMs ? Math.max(dayStart, local0) : dayStart;
      const windowEnd = cursorDay === lastDay ? Math.min(dayEnd, local1) : dayEnd;
      if (windowEnd > windowStart) {
        totalMinutes += (windowEnd - windowStart) / 60000;
      }
    }
    cursorDay += dayMs;
  }

  return totalMinutes;
}
