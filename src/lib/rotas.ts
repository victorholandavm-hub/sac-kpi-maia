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
