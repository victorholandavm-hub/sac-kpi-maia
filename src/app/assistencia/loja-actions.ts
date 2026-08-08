"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isMostruarioRequest } from "@/lib/serviceRequests";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  LOJA_GERENTE_COOKIE_NAME,
  LOJA_GERENTE_SESSION_MAX_AGE,
  signLojaGerenteSession,
  verifyLojaGerenteSession,
  verifyPin,
} from "@/lib/lojaAuth";
import { CD_COOKIE_NAME } from "@/lib/cdAuth";
import { FABRICA_COOKIE_NAME } from "@/lib/fabricaAuth";
import { CAIXA_COOKIE_NAME } from "@/lib/caixaAuth";

export type LojaGerenteFormState = { error?: string } | undefined;

export async function lojaGerenteSignIn(_state: LojaGerenteFormState, formData: FormData): Promise<LojaGerenteFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

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
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("gerentes", "name", name);

  // Path em /assistencia (não só /assistencia/loja) porque o /assistencia/solicitar
  // também precisa ler essa sessão, pra travar a loja da solicitação à(s) loja(s)
  // do gerente — ver createPublicRequest em src/app/assistencia/actions.ts.
  const cookieStore = await cookies();
  // Limpa outras sessões de papel de encomenda que possam estar ativas no
  // mesmo navegador -- sem isso, um cookie antigo de CD/fábrica/caixa ainda
  // válido pode confundir telas que leem essas sessões (mesmo com a
  // prioridade de gerente em resolveEncomendaRequester, mais robusto já
  // não deixar nenhuma outra sessão pendurada).
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.delete({ name: CAIXA_COOKIE_NAME, path: "/assistencia/encomendas" });

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

function validGerenteRating(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error("Nota inválida.");
  return value;
}

// Avaliação de montagem/desmontagem de Mostruário (item de exposição da
// própria loja, sem cliente real) -- nesse caso não existe "virar o celular
// pro cliente avaliar" (ver MontadorRequestActions.tsx, que pula direto pra
// concluir sem pedir nota). Quem avalia é o próprio gerente que pediu,
// depois, na própria tela dele -- não o montador na hora.
export async function setLojaGerenteRating(requestId: string, deliveryRating: number, resolutionRating: number): Promise<void> {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("status, order_code, client_name, requested_by_name, delivery_rating")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request) throw new Error("Solicitação não encontrada.");
  if (request.requested_by_name !== gerenteName) throw new Error("Essa solicitação não é sua.");
  if (request.status !== "concluida") throw new Error("Só dá pra avaliar depois de concluída.");
  if (!isMostruarioRequest(request.order_code, request.client_name)) {
    throw new Error("Avaliação pelo gerente só se aplica a chamado de mostruário.");
  }
  if (request.delivery_rating !== null) throw new Error("Essa montagem já foi avaliada.");

  const { error: updateError } = await admin
    .from("service_requests")
    .update({
      delivery_rating: validGerenteRating(deliveryRating),
      resolution_rating: validGerenteRating(resolutionRating),
    })
    .eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `Avaliação do gerente ${gerenteName} — montagem: ${deliveryRating}, resolução: ${resolutionRating}.`,
  });

  revalidatePath("/assistencia/loja");
  revalidatePath(`/assistencia/${requestId}`);
}
