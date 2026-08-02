"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  FABRICA_COOKIE_NAME,
  FABRICA_SESSION_MAX_AGE,
  signFabricaSession,
  verifyFabricaSession,
  verifyPin,
} from "@/lib/fabricaAuth";
import { CD_COOKIE_NAME } from "@/lib/cdAuth";
import { CAIXA_COOKIE_NAME } from "@/lib/caixaAuth";
import { LOJA_GERENTE_COOKIE_NAME } from "@/lib/lojaAuth";

export type FabricaFormState = { error?: string } | undefined;

export async function fabricaSignIn(_state: FabricaFormState, formData: FormData): Promise<FabricaFormState> {
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
  const { data: operadores } = await admin.from("fabrica_operadores").select("name, pin_hash");
  const data = (operadores ?? []).find((o) => o.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("fabrica_operadores", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("fabrica_operadores", "name", name);
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("fabrica_operadores", "name", name);

  const cookieStore = await cookies();
  // Limpa outras sessões de papel de encomenda que possam estar ativas no
  // mesmo navegador -- sem isso, um cookie antigo de CD/caixa/gerente ainda
  // válido "sequestra" a identidade em resolveEncomendaRequester /
  // requireEncomendaActor, mesmo com esse login de fábrica tendo dado certo.
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: CAIXA_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: LOJA_GERENTE_COOKIE_NAME, path: "/assistencia" });

  cookieStore.set(FABRICA_COOKIE_NAME, signFabricaSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: FABRICA_SESSION_MAX_AGE,
    path: "/assistencia/encomendas",
  });

  redirect("/assistencia/encomendas/fila");
}

export async function fabricaSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" });
  redirect("/assistencia/encomendas/fabrica/login");
}

export async function getFabricaSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyFabricaSession(cookieStore.get(FABRICA_COOKIE_NAME)?.value);
}
