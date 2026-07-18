"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import {
  LOJA_GERENTE_COOKIE_NAME,
  LOJA_GERENTE_SESSION_MAX_AGE,
  signLojaGerenteSession,
  verifyLojaGerenteSession,
  verifyPin,
} from "@/lib/lojaAuth";

export type LojaGerenteFormState = { error?: string } | undefined;

export async function lojaGerenteSignIn(_state: LojaGerenteFormState, formData: FormData): Promise<LojaGerenteFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!name) return { error: "Selecione seu nome." };
  if (!/^\d{4}$/.test(pin)) return { error: "Digite os 4 números do seu PIN." };

  const lockout = await checkPinLockout("gerentes", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("gerentes").select("name, pin_hash").eq("name", name).maybeSingle();

  if (error || !data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("gerentes", "name", name);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("gerentes", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(LOJA_GERENTE_COOKIE_NAME, signLojaGerenteSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: LOJA_GERENTE_SESSION_MAX_AGE,
    path: "/assistencia/loja",
  });

  redirect("/assistencia/loja");
}

export async function lojaGerenteSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: LOJA_GERENTE_COOKIE_NAME, path: "/assistencia/loja" });
  redirect("/assistencia/loja/login");
}

// Retorna o NOME do gerente autenticado (não o id da loja) — use
// getGerenteStoreId(nome) (src/lib/gerentes.ts) pra descobrir a loja dele,
// sempre buscando no banco em vez de confiar em algo guardado no cookie.
export async function getLojaGerenteSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyLojaGerenteSession(cookieStore.get(LOJA_GERENTE_COOKIE_NAME)?.value);
}
