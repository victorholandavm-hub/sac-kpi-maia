"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { CD_COOKIE_NAME, CD_SESSION_MAX_AGE, signCdSession, verifyCdSession, verifyPin } from "@/lib/cdAuth";

export type CdFormState = { error?: string } | undefined;

export async function cdSignIn(_state: CdFormState, formData: FormData): Promise<CdFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!/^\d{4}$/.test(pin)) return { error: "Digite os 4 números do seu PIN." };

  const admin = getSupabaseAdmin();
  const { data: operadores } = await admin.from("cd_operadores").select("name, pin_hash");
  const data = (operadores ?? []).find((o) => o.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("cd_operadores", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("cd_operadores", "name", name);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("cd_operadores", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(CD_COOKIE_NAME, signCdSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: CD_SESSION_MAX_AGE,
    path: "/assistencia/encomendas",
  });

  redirect("/assistencia/encomendas/fila");
}

export async function cdSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia/encomendas" });
  redirect("/assistencia/encomendas/cd/login");
}

export async function getCdSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyCdSession(cookieStore.get(CD_COOKIE_NAME)?.value);
}
