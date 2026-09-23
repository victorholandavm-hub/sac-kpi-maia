"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  FINANCEIRO_COOKIE_NAME,
  FINANCEIRO_SESSION_MAX_AGE,
  signFinanceiroSession,
  verifyFinanceiroSession,
  verifyPin,
} from "@/lib/financeiroAuth";

export type FinanceiroFormState = { error?: string } | undefined;

export async function financeiroSignIn(_state: FinanceiroFormState, formData: FormData): Promise<FinanceiroFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

  const admin = getSupabaseAdmin();
  const { data: financeiros } = await admin.from("financeiros").select("name, pin_hash, ativo");
  const data = (financeiros ?? []).find((f) => f.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("financeiros", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.ativo || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("financeiros", "name", name);
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("financeiros", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(FINANCEIRO_COOKIE_NAME, signFinanceiroSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: FINANCEIRO_SESSION_MAX_AGE,
    path: "/",
  });

  redirect("/assistencia/financeiro");
}

export async function financeiroSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: FINANCEIRO_COOKIE_NAME, path: "/" });
  redirect("/assistencia/financeiro/login");
}

export async function getFinanceiroSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyFinanceiroSession(cookieStore.get(FINANCEIRO_COOKIE_NAME)?.value);
}
