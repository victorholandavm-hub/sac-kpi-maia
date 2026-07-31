"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  CAIXA_COOKIE_NAME,
  CAIXA_SESSION_MAX_AGE,
  signCaixaSession,
  verifyCaixaSession,
  verifyPin,
} from "@/lib/caixaAuth";
import { CD_COOKIE_NAME } from "@/lib/cdAuth";
import { FABRICA_COOKIE_NAME } from "@/lib/fabricaAuth";
import { LOJA_GERENTE_COOKIE_NAME } from "@/lib/lojaAuth";

export type CaixaFormState = { error?: string } | undefined;

// Caixa virou individual (nome + PIN próprio, 1 loja) — mesmo padrão de
// vendedorSignIn (src/app/assistencia/vendedor-actions.ts).
export async function caixaSignIn(_state: CaixaFormState, formData: FormData): Promise<CaixaFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  // Nome não diferencia maiúsculas/minúsculas — mesma lógica de vendedorSignIn.
  const admin = getSupabaseAdmin();
  const { data: caixas } = await admin.from("caixas").select("name, pin_hash, ativo");
  const data = (caixas ?? []).find((c) => c.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("caixas", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  // Erro genérico (não diferencia "não existe" de "existe mas está inativa")
  // pra não vazar informação de quem tem cadastro desativado.
  if (!data || !data.pin_hash || !data.ativo || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("caixas", "name", name);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("caixas", "name", name);

  const cookieStore = await cookies();
  // Limpa outras sessões de papel de encomenda que possam estar ativas no
  // mesmo navegador -- sem isso, um cookie antigo de CD/fábrica/gerente ainda
  // válido "sequestra" a identidade em resolveEncomendaRequester /
  // requireEncomendaActor, mesmo com esse login de caixa tendo dado certo.
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: LOJA_GERENTE_COOKIE_NAME, path: "/assistencia" });

  cookieStore.set(CAIXA_COOKIE_NAME, signCaixaSession(data.name), {
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

// Retorna o NOME da caixa (não mais o store_id) — use getCaixaStoreId (nome)
// (src/lib/caixas.ts) pra descobrir a loja dela, sempre buscando no banco.
export async function getCaixaSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyCaixaSession(cookieStore.get(CAIXA_COOKIE_NAME)?.value);
}
