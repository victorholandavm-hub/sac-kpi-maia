import { getSupabaseAdmin } from "./supabaseAdmin";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos — PIN de 4 dígitos precisa de limite de tentativas

export type PinTable = "assemblers" | "gerentes" | "drivers" | "cd_operadores" | "fabrica_operadores" | "encomenda_caixa_pins";

export async function checkPinLockout(
  table: PinTable,
  idColumn: string,
  idValue: string
): Promise<{ locked: boolean; minutesLeft?: number }> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from(table).select("pin_locked_until").eq(idColumn, idValue).maybeSingle();
  const lockedUntil = data?.pin_locked_until as string | null | undefined;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    return { locked: true, minutesLeft: Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000) };
  }
  return { locked: false };
}

export async function recordFailedPinAttempt(table: PinTable, idColumn: string, idValue: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from(table).select("failed_pin_attempts").eq(idColumn, idValue).maybeSingle();
  const attempts = ((data?.failed_pin_attempts as number | undefined) ?? 0) + 1;
  const update: Record<string, unknown> = { failed_pin_attempts: attempts };
  if (attempts >= MAX_ATTEMPTS) {
    update.pin_locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
  }
  await admin.from(table).update(update).eq(idColumn, idValue);
}

export async function resetPinAttempts(table: PinTable, idColumn: string, idValue: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from(table).update({ failed_pin_attempts: 0, pin_locked_until: null }).eq(idColumn, idValue);
}
