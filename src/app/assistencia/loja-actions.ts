"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  LOJA_GERENTE_COOKIE_NAME,
  LOJA_GERENTE_SESSION_MAX_AGE,
  signLojaGerenteSession,
  verifyLojaGerenteSession,
  verifyPin,
} from "@/lib/lojaAuth";

export type LojaGerenteFormState = { error?: string } | undefined;

export async function lojaGerenteSignIn(_state: LojaGerenteFormState, formData: FormData): Promise<LojaGerenteFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  // Nome não diferencia maiúsculas/minúsculas — ver mesma lógica em
  // montadorSignIn (src/app/assistencia/montador-actions.ts).
  const admin = getSupabaseAdmin();
  const { data: gerentes } = await admin.from("gerentes").select("name, pin_hash");
  const data = (gerentes ?? []).find((g) => g.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("gerentes", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("gerentes", "name", name);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("gerentes", "name", name);

  // Path em /assistencia (não só /assistencia/loja) porque o /assistencia/solicitar
  // também precisa ler essa sessão, pra travar a loja da solicitação à(s) loja(s)
  // do gerente — ver createPublicRequest em src/app/assistencia/actions.ts.
  const cookieStore = await cookies();
  cookieStore.set(LOJA_GERENTE_COOKIE_NAME, signLojaGerenteSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: LOJA_GERENTE_SESSION_MAX_AGE,
    path: "/assistencia",
  });

  redirect("/assistencia/loja");
}

export async function lojaGerenteSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: LOJA_GERENTE_COOKIE_NAME, path: "/assistencia" });
  redirect("/assistencia/loja/login");
}

// Retorna o NOME do gerente autenticado (não o id da loja) — use
// getGerenteStoreId(nome) (src/lib/gerentes.ts) pra descobrir a loja dele,
// sempre buscando no banco em vez de confiar em algo guardado no cookie.
export async function getLojaGerenteSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyLojaGerenteSession(cookieStore.get(LOJA_GERENTE_COOKIE_NAME)?.value);
}
