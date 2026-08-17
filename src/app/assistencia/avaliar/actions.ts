// Sem "use server" -- essas funções não são mais chamadas direto do client
// (ver /api/avaliar/verify e /api/avaliar/submit, POST comum em vez de
// Server Action: o cliente abre o link do QR quase sempre de dentro de um
// navegador embutido -- WhatsApp, câmera do celular -- com o mesmo bug já
// documentado pro upload de foto de montador/motorista, ver
// /api/montador/upload-photo/route.ts). Continuam exportadas, só que
// chamadas server-to-server pelas rotas de API, não como RPC de client.
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isMostruarioRequest, type RequestType } from "@/lib/serviceRequests";
import { cpfMatches, ratingKind } from "@/lib/clientRating";

export type ClientRatingAccess =
  | { ok: true; kind: "montagem" | "entrega" }
  | { ok: false; reason: "not_found" | "not_completed" | "already_rated" | "no_cpf_on_file" | "wrong_cpf" | "rate_limited" };

type RatingRequestRow = {
  id: string;
  type: RequestType;
  status: string;
  order_code: string | null;
  client_name: string | null;
  // CPF efetivo pra conferir -- não é sempre client_cpf direto (ver abaixo).
  effective_cpf: string | null;
  delivery_rating: number | null;
  store_id: string;
};

// client_cpf só vem preenchido quando o chamado foi aberto pela loja
// (PublicRequestForm, CPF obrigatório). Quando é o SAC que abre (nova
// solicitação, createSacRequest em actions.ts), CPF é OPCIONAL -- código do
// cliente já resolve sozinho -- então client_cpf fica null mesmo pra
// chamado de cliente real. Conferido em produção 17/08/2026 (motorista/
// montador reportando QR "sem funcionar"): 100 dos 126 chamados sem
// client_cpf, mas 56 deles tinham client_protheus_code -- caía sempre em
// "no_cpf_on_file" à toa quando dava pra confirmar mesmo assim, só que via
// tabela de cadastro (totvs_clientes) em vez do campo direto no chamado.
async function loadRatingRequest(requestId: string): Promise<RatingRequestRow | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("service_requests")
    .select("id, type, status, order_code, client_name, client_cpf, client_protheus_code, delivery_rating, store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return null;

  let effectiveCpf = data.client_cpf as string | null;
  if (!effectiveCpf && data.client_protheus_code) {
    const { data: cliente } = await admin
      .from("totvs_clientes")
      .select("cpf_cnpj")
      .eq("protheus_code", data.client_protheus_code)
      .maybeSingle();
    effectiveCpf = (cliente?.cpf_cnpj as string | null) ?? null;
  }

  return {
    id: data.id,
    type: data.type,
    status: data.status,
    order_code: data.order_code,
    client_name: data.client_name,
    effective_cpf: effectiveCpf,
    delivery_rating: data.delivery_rating,
    store_id: data.store_id,
  };
}

// Sem side-effect (não grava tentativa falha) -- usado tanto pela checagem
// inicial de CPF quanto pelo envio final, que precisa reconferir tudo de
// novo (nunca confia que o passo 1 já validou, o cliente pode ter editado a
// URL ou reenviado um form antigo).
function resolveAccess(request: RatingRequestRow | null, cpf: string): ClientRatingAccess {
  if (!request) return { ok: false, reason: "not_found" };
  // Mostruário nunca deveria chegar aqui (a tela do montador não gera QR
  // pra esse caso -- a avaliação é do gerente da loja, ver
  // LojaGerenteRatingPrompt.tsx), mas confere de novo aqui contra acesso
  // direto por URL adivinhada.
  if (isMostruarioRequest(request.order_code, request.client_name)) return { ok: false, reason: "not_found" };
  if (request.status !== "concluida") return { ok: false, reason: "not_completed" };
  if (request.delivery_rating !== null) return { ok: false, reason: "already_rated" };
  if (!request.effective_cpf) return { ok: false, reason: "no_cpf_on_file" };
  if (!cpfMatches(cpf, request.effective_cpf)) return { ok: false, reason: "wrong_cpf" };

  return { ok: true, kind: ratingKind(request.type) };
}

// Passo 1 da tela pública /assistencia/avaliar/[id] -- só confirma o CPF
// antes de liberar as notas. Rate limit por IP porque é uma rota sem login
// nenhum (mesmo padrão de checkAndRecordPublicSubmission em rateLimit.ts).
export async function verifyClientRatingAccess(requestId: string, cpf: string): Promise<ClientRatingAccess> {
  const ip = await getClientIp();
  const limit = await checkIpRateLimit(ip);
  if (limit.locked) return { ok: false, reason: "rate_limited" };

  const request = await loadRatingRequest(requestId);
  const access = resolveAccess(request, cpf);
  if (!access.ok && access.reason === "wrong_cpf") {
    await recordFailedIpAttempt(ip);
  }
  return access;
}

function validRating(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error("Nota inválida.");
  return value;
}

// Passo 2 -- grava a nota. Reconfirma o CPF de novo (não recebe um "já
// validado" do passo 1) e usa .is("delivery_rating", null) como trava de
// corrida, igual ao resto do projeto (ver montador-actions.ts): se duas
// abas conseguirem passar pelo passo 1 ao mesmo tempo, só a primeira grava.
export async function submitClientRating(requestId: string, cpf: string, deliveryRating: number, resolutionRating: number): Promise<void> {
  const ip = await getClientIp();
  const limit = await checkIpRateLimit(ip);
  if (limit.locked) throw new Error("Muitas tentativas. Tente de novo mais tarde.");

  const request = await loadRatingRequest(requestId);
  const access = resolveAccess(request, cpf);
  if (!access.ok) {
    if (access.reason === "wrong_cpf") await recordFailedIpAttempt(ip);
    throw new Error("Não foi possível confirmar sua avaliação. Peça pra recomeçar pelo QR code.");
  }

  const admin = getSupabaseAdmin();
  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ delivery_rating: validRating(deliveryRating), resolution_rating: validRating(resolutionRating) })
    .eq("id", requestId)
    .is("delivery_rating", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Essa avaliação já foi enviada.");

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `Avaliação enviada pelo cliente (CPF confirmado) — nota: ${deliveryRating}, resolução: ${resolutionRating}.`,
  });

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
  revalidatePath("/assistencia/motorista");
  revalidatePath(`/assistencia/motorista/${requestId}`);
}
