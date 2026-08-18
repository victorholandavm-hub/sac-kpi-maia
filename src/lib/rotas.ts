import { getSupabaseAdmin } from "./supabaseAdmin";

export type Rota = "praia" | "sul" | "centro";

export const ROTAS: Rota[] = ["praia", "sul", "centro"];

export const ROTA_LABELS: Record<Rota, string> = {
  praia: "Praia",
  sul: "Sul",
  centro: "Centro",
};

// Cor própria por rota na agenda (ver AgendaQueueGroup) -- bate o olho em
// qual região é sem precisar ler o texto.
export const ROTA_COLORS: Record<Rota, string> = {
  praia: "var(--series-5)",
  sul: "var(--series-1)",
  centro: "var(--series-4)",
};

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function isRota(value: string | null | undefined): value is Rota {
  return !!value && (ROTAS as string[]).includes(value);
}

// weekday: 0=domingo ... 6=sábado (mesmo formato de Date.getDay()). null =
// sem rota nesse dia (hoje, só domingo). Configurável pelo admin — ver
// setRotaWeekday e supabase/migrations/0029_sac_tipos_rotas.sql pro valor
// padrão (Praia seg/qui, Sul ter/sex, Centro qua/sáb).
export type RotaWeekdayConfig = Record<number, Rota | null>;

export async function getRotaWeekdayConfig(): Promise<RotaWeekdayConfig> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("rota_weekday_config").select("weekday, rota").order("weekday");
  if (error) throw new Error(error.message);

  const config: RotaWeekdayConfig = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  for (const row of data ?? []) {
    config[row.weekday] = isRota(row.rota) ? row.rota : null;
  }
  return config;
}

export async function setRotaWeekday(weekday: number, rota: Rota | null): Promise<void> {
  if (weekday < 0 || weekday > 6) throw new Error("Dia da semana inválido.");
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rota_weekday_config").upsert({ weekday, rota }, { onConflict: "weekday" });
  if (error) throw new Error(error.message);
}

// Quem dirige cada rota numa data específica -- ver setRotaDriverAssignment
// (actions.ts). Só existe UMA rota "principal" por dia (o carro de sempre,
// pode trocar de região dia a dia) -- carro(s) a mais no mesmo dia entram
// como "extra" (addRotaExtra), sem limite de quantidade. primary null =
// ninguém definido ainda pra essa data.
export type RotaDriverAssignmentEntry = { id: string; rota: Rota; driverName: string };
export type RotaDriverAssignments = { primary: RotaDriverAssignmentEntry | null; extras: RotaDriverAssignmentEntry[] };

export async function getRotaDriverAssignments(date: string): Promise<RotaDriverAssignments> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("rota_driver_assignments")
    .select("id, rota, driver_name, is_extra")
    .eq("assignment_date", date)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);

  let primary: RotaDriverAssignmentEntry | null = null;
  const extras: RotaDriverAssignmentEntry[] = [];
  for (const row of data ?? []) {
    if (!isRota(row.rota)) continue;
    const entry: RotaDriverAssignmentEntry = { id: row.id as string, rota: row.rota, driverName: row.driver_name as string };
    if (row.is_extra) extras.push(entry);
    else primary = entry; // só deve existir uma linha não-extra por data (índice único parcial no banco)
  }
  return { primary, extras };
}

// Acha o motorista do dia pra uma rota específica -- principal primeiro,
// senão procura entre as extras (ex: chamado é de "sul" mas a rota
// principal do dia é "praia" -- só acha se tiver uma extra de "sul").
export function findDriverForRota(assignments: RotaDriverAssignments, rota: Rota): string | null {
  if (assignments.primary?.rota === rota) return assignments.primary.driverName;
  return assignments.extras.find((e) => e.rota === rota)?.driverName ?? null;
}

// Função pura — recebe a data já como string YYYY-MM-DD pra não depender de
// timezone do servidor (new Date("YYYY-MM-DD") é sempre UTC meia-noite).
export function getRotaForDate(dateStr: string, config: RotaWeekdayConfig): Rota | null {
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return config[weekday] ?? null;
}

// Próximas `count` datas (a partir de hoje, inclusive) cujo dia da semana
// está configurado pra essa rota — usado pra sugerir datas válidas na hora
// de agendar, sem precisar de cadastro dia a dia.
export function getNextRotaDates(rota: Rota, config: RotaWeekdayConfig, count = 4): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  for (let i = 0; dates.length < count && i < 60; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (config[cursor.getUTCDay()] === rota) dates.push(dateStr);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Segunda-feira da semana de `dateStr` (formato YYYY-MM-DD) -- ponto de
// partida da visão de 2 semanas do painel "Motorista do dia" (pedido do
// Victor 18/08/2026: rotas da semana atual + semana seguinte sempre
// visíveis, não só o dia escolhido).
export function startOfRotaWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

export type RotaDayOverview = {
  date: string;
  weekday: number;
  // Rota esperada pelo padrão da semana (rota_weekday_config) -- null só no
  // domingo, por padrão. Quem edita "rota do dia" pode fugir disso pra um
  // dia específico (exceção), sem mexer no padrão da semana toda.
  expectedRota: Rota | null;
  assignments: RotaDriverAssignments;
};

// Visão de várias datas seguidas (painel "Motorista do dia") -- uma query só
// pro intervalo inteiro em vez de uma por dia. `days` normalmente é 14 (semana
// atual + semana seguinte).
export async function getRotaWeekOverview(fromDate: string, days: number): Promise<RotaDayOverview[]> {
  const config = await getRotaWeekdayConfig();
  const admin = getSupabaseAdmin();

  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const { data, error } = await admin
    .from("rota_driver_assignments")
    .select("id, assignment_date, rota, driver_name, is_extra")
    .in("assignment_date", dates)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byDate = new Map<string, RotaDriverAssignments>();
  for (const date of dates) byDate.set(date, { primary: null, extras: [] });
  for (const row of data ?? []) {
    if (!isRota(row.rota)) continue;
    const bucket = byDate.get(row.assignment_date as string);
    if (!bucket) continue;
    const entry: RotaDriverAssignmentEntry = { id: row.id as string, rota: row.rota, driverName: row.driver_name as string };
    if (row.is_extra) bucket.extras.push(entry);
    else bucket.primary = entry;
  }

  return dates.map((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, weekday, expectedRota: config[weekday] ?? null, assignments: byDate.get(date)! };
  });
}
