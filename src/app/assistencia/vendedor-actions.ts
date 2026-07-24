"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  VENDEDOR_COOKIE_NAME,
  VENDEDOR_SESSION_MAX_AGE,
  signVendedorSession,
  verifyVendedorSession,
  verifyPin,
} from "@/lib/vendedorAuth";

export type VendedorFormState = { error?: string } | undefined;

export async function vendedorSignIn(_state: VendedorFormState, formData: FormData): Promise<VendedorFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  // Nome não diferencia maiúsculas/minúsculas — mesma lógica de lojaGerenteSignIn.
  const admin = getSupabaseAdmin();
  const { data: vendedores } = await admin.from("vendedores").select("name, pin_hash, ativo");
  const data = (vendedores ?? []).find((v) => v.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("vendedores", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  // Erro genérico (não diferencia "não existe" de "existe mas está inativo")
  // pra não vazar informação de quem tem cadastro desativado.
  if (!data || !data.pin_hash || !data.ativo || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("vendedores", "name", name);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("vendedores", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(VENDEDOR_COOKIE_NAME, signVendedorSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: VENDEDOR_SESSION_MAX_AGE,
    path: "/assistencia/encomendas",
  });

  redirect("/assistencia/encomendas/caixa");
}

export async function vendedorSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: VENDEDOR_COOKIE_NAME, path: "/assistencia/encomendas" });
  redirect("/assistencia/encomendas/vendedor/login");
}

export async function getVendedorSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyVendedorSession(cookieStore.get(VENDEDOR_COOKIE_NAME)?.value);
}
