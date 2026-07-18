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
  const storeId = String(formData.get("storeId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!storeId) return { error: "Selecione sua loja." };
  if (!/^\d{4}$/.test(pin)) return { error: "Digite os 4 números do seu PIN." };

  const lockout = await checkPinLockout("stores", "id", storeId);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("stores").select("id, pin_hash").eq("id", storeId).maybeSingle();

  if (error || !data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("stores", "id", storeId);
    return { error: "Loja ou PIN incorretos." };
  }
  await resetPinAttempts("stores", "id", storeId);

  const cookieStore = await cookies();
  cookieStore.set(LOJA_GERENTE_COOKIE_NAME, signLojaGerenteSession(data.id), {
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

export async function getLojaGerenteSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyLojaGerenteSession(cookieStore.get(LOJA_GERENTE_COOKIE_NAME)?.value);
}
