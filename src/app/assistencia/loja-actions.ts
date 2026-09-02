"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOptionalProfile } from "@/lib/dal";
import { isMostruarioRequest } from "@/lib/serviceRequests";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { notifyAssistencia } from "@/lib/notifications";
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

// Aprovação do gerente da loja pra montagem/desmontagem concluída pelo
// montador -- pedido do Victor 31/08/2026: "a partir de agora, o gerente
// da loja vai precisar aprovar essa conclusão, e precisa ter a opção de
// colocar quais produtos nao foram montados/desmontados". `notDoneItemIds`
// vazio = aprova tudo, vira "concluida" de verdade agora (não quando o
// montador clicou -- é isso que faz pagamento/relatório do montador só
// contarem a partir daqui, ver montadorCompleteRequest em
// montador-actions.ts, ambos já filtram por status = 'concluida').
// `notDoneItemIds` não vazio = chamado vai pra "remarcar" (mesmo desfecho
// que montadorCompletePartially já tinha). Dois jeitos de um item cair
// aqui: o gerente desmarcou algo que o montador tinha marcado como feito
// (reprovado), ou o montador nunca chegou a marcar aquele item pra começo
// de conversa -- ver LojaApprovalActions.tsx: itens não marcados pelo
// montador entram nessa lista automaticamente, então uma conclusão
// PARCIAL nunca vira "concluida" só porque o gerente aprovou o que foi
// mostrado -- sempre sobra pendência real (pedido do Victor 02/09/2026).
export async function lojaApproveMontagemConclusion(requestId: string, notDoneItemIds: string[], note: string): Promise<void> {
  // Pedido do Victor 31/08/2026: "alem do gerente de cada loja, a equipe de
  // assistencia e os admins tambem podem aprovar a montagem". Sessão de
  // gerente (PIN, por loja) continua valendo; quando não há uma, cai pro
  // fallback opcional de sessão Supabase Auth (admin/assistência), que não
  // fica restrito a loja nenhuma -- mesmo acesso irrestrito por loja que
  // admin/assistência já tem no resto do sistema.
  const gerenteName = await getLojaGerenteSession();
  const profile = gerenteName ? null : await getOptionalProfile();
  if (!gerenteName && !(profile && (profile.role === "admin" || profile.role === "assistencia"))) {
    throw new Error("Sessão expirada. Faça login de novo.");
  }
  const actorLabel = gerenteName ? `Gerente ${gerenteName}` : `${profile!.fullName} (assistência)`;

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("status, store_id, ticket_number")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request) throw new Error("Solicitação não encontrada.");
  if (request.status !== "aguardando_aprovacao") throw new Error("Esse chamado não está aguardando aprovação.");

  // Qualquer gerente da loja pode aprovar, não só quem abriu o chamado
  // (mesmo escopo por loja de listOpenRequestsForLoja, ver loja/page.tsx
  // -- diferente de setLojaGerenteRating acima, que é sobre "eu mesmo
  // pedi essa montagem de mostruário", caso mais estreito). Admin/assistência
  // não passa por essa checagem -- aprova de qualquer loja.
  if (gerenteName) {
    const storeIds = await getGerenteStoreIds(gerenteName);
    if (!request.store_id || !storeIds.includes(request.store_id)) {
      throw new Error("Essa solicitação não é da sua loja.");
    }
  }

  const trimmedNote = note.trim();

  if (notDoneItemIds.length === 0) {
    const completedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("service_requests")
      .update({ status: "concluida", completed_at: completedAt })
      .eq("id", requestId)
      .eq("status", "aguardando_aprovacao")
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Esse chamado já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

    await admin.from("service_request_events").insert({
      request_id: requestId,
      actor_id: null,
      event_type: "status_changed",
      from_status: "aguardando_aprovacao",
      to_status: "concluida",
      note: `${actorLabel} aprovou a conclusão.${trimmedNote ? ` Observação: ${trimmedNote}` : ""}`,
    });

    revalidatePath("/assistencia/loja");
    revalidatePath("/assistencia/fila");
    revalidatePath(`/assistencia/${requestId}`);
    return;
  }

  const { error: itemsError } = await admin
    .from("service_request_items")
    .update({ completed: false })
    .eq("request_id", requestId)
    .in("id", notDoneItemIds);
  if (itemsError) throw new Error(itemsError.message);

  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ status: "remarcar" })
    .eq("id", requestId)
    .eq("status", "aguardando_aprovacao")
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("Esse chamado já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

  const { data: pendingItems } = await admin
    .from("service_request_items")
    .select("product, quantity")
    .eq("request_id", requestId)
    .in("id", notDoneItemIds);
  const label = (i: { product: string; quantity: number }) => (i.quantity > 1 ? `${i.quantity}x ${i.product}` : i.product);
  const pendingLabels = (pendingItems ?? []).map(label);

  const eventNote =
    `${actorLabel} não confirmou: ${pendingLabels.join(", ") || "—"}.` + (trimmedNote ? ` Observação: ${trimmedNote}` : "");
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: "aguardando_aprovacao",
    to_status: "remarcar",
    note: eventNote,
  });

  const link = `/assistencia/${requestId}`;
  await notifyAssistencia({
    type: "status_changed",
    title: "Precisa remarcar",
    message: `Chamado #${request.ticket_number} — ${eventNote}`,
    link,
  });

  revalidatePath("/assistencia/loja");
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}
