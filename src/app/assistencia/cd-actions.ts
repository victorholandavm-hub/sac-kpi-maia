"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { CD_COOKIE_NAME, CD_SESSION_MAX_AGE, signCdSession, verifyCdSession, verifyPin } from "@/lib/cdAuth";
import { FABRICA_COOKIE_NAME } from "@/lib/fabricaAuth";
import { CAIXA_COOKIE_NAME } from "@/lib/caixaAuth";
import { LOJA_GERENTE_COOKIE_NAME } from "@/lib/lojaAuth";

export type CdFormState = { error?: string } | undefined;

export async function cdSignIn(_state: CdFormState, formData: FormData): Promise<CdFormState> {
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
  const { data: operadores } = await admin.from("cd_operadores").select("name, pin_hash");
  const data = (operadores ?? []).find((o) => o.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("cd_operadores", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("cd_operadores", "name", name);
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("cd_operadores", "name", name);

  const cookieStore = await cookies();
  // Limpa outras sessões de papel de encomenda que possam estar ativas no
  // mesmo navegador -- sem isso, um cookie antigo de fábrica/caixa/gerente
  // ainda válido "sequestra" a identidade em resolveEncomendaRequester /
  // requireEncomendaActor, mesmo com esse login de CD tendo dado certo.
  cookieStore.delete({ name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: CAIXA_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: LOJA_GERENTE_COOKIE_NAME, path: "/assistencia" });

  // path "/assistencia" (não só "/assistencia/encomendas") -- descoberto em
  // 2026-08-11: /assistencia/fornecedores (fora de encomendas) precisa ler
  // essa sessão também (ver fornecedorPedidoAuth.ts), e um cookie com path
  // estreito não chega em rotas irmãs fora do prefixo (mesma armadilha de
  // LOJA_GERENTE_COOKIE_NAME, que já usa "/assistencia" por esse motivo --
  // ver getGerenteStoreIds/loja-actions.ts).
  cookieStore.set(CD_COOKIE_NAME, signCdSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: CD_SESSION_MAX_AGE,
    path: "/assistencia",
  });

  redirect("/assistencia/encomendas/fila");
}

export async function cdSignOut() {
  const cookieStore = await cookies();
  // Apaga nos dois paths -- sessões antigas (de antes do path mudar pra
  // "/assistencia") ainda podem existir no navegador de quem já estava
  // logado; sem isso o cookie velho, mais específico, ficava esquecido.
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia" });
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia/encomendas" });
  redirect("/assistencia/encomendas/cd/login");
}

export async function getCdSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyCdSession(cookieStore.get(CD_COOKIE_NAME)?.value);
}
