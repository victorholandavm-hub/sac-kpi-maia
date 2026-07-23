"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import {
  CAIXA_COOKIE_NAME,
  CAIXA_SESSION_MAX_AGE,
  signCaixaSession,
  verifyCaixaSession,
  verifyPin,
} from "@/lib/caixaAuth";

export type CaixaFormState = { error?: string } | undefined;

// PIN é por loja, não por pessoa (ver 0028_encomenda_pin_auth.sql) — a caixa
// escolhe a própria loja num select em vez de digitar um nome.
export async function caixaSignIn(_state: CaixaFormState, formData: FormData): Promise<CaixaFormState> {
  const storeId = String(formData.get("store_id") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!storeId) return { error: "Selecione a loja." };
  if (!/^\d{4}$/.test(pin)) return { error: "Digite os 4 números do PIN da loja." };

  const admin = getSupabaseAdmin();
  const { data } = await admin.from("encomenda_caixa_pins").select("store_id, pin_hash").eq("store_id", storeId).maybeSingle();

  const lockout = await checkPinLockout("encomenda_caixa_pins", "store_id", storeId);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("encomenda_caixa_pins", "store_id", storeId);
    return { error: "PIN incorreto." };
  }
  await resetPinAttempts("encomenda_caixa_pins", "store_id", storeId);

  const cookieStore = await cookies();
  cookieStore.set(CAIXA_COOKIE_NAME, signCaixaSession(storeId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: CAIXA_SESSION_MAX_AGE,
    path: "/assistencia/encomendas",
  });

  redirect("/assistencia/encomendas/caixa");
}

export async function caixaSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: CAIXA_COOKIE_NAME, path: "/assistencia/encomendas" });
  redirect("/assistencia/encomendas/caixa/login");
}

// Retorna o store_id da sessão (não o nome de ninguém — PIN é por loja).
export async function getCaixaSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyCaixaSession(cookieStore.get(CAIXA_COOKIE_NAME)?.value);
}
