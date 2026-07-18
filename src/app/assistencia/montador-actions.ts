"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MONTADOR_COOKIE_NAME,
  MONTADOR_SESSION_MAX_AGE,
  signMontadorSession,
  verifyMontadorSession,
  verifyPin,
} from "@/lib/montadorAuth";

export type MontadorFormState = { error?: string } | undefined;

export async function montadorSignIn(_state: MontadorFormState, formData: FormData): Promise<MontadorFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!name) return { error: "Selecione seu nome." };
  if (!/^\d{4}$/.test(pin)) return { error: "Digite os 4 números do seu PIN." };

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name, pin_hash").eq("name", name).maybeSingle();

  if (error || !data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    return { error: "Nome ou PIN incorretos." };
  }

  const cookieStore = await cookies();
  cookieStore.set(MONTADOR_COOKIE_NAME, signMontadorSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MONTADOR_SESSION_MAX_AGE,
    path: "/assistencia/montador",
  });

  redirect("/assistencia/montador");
}

export async function montadorSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: MONTADOR_COOKIE_NAME, path: "/assistencia/montador" });
  redirect("/assistencia/montador/login");
}

export async function getMontadorSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyMontadorSession(cookieStore.get(MONTADOR_COOKIE_NAME)?.value);
}
