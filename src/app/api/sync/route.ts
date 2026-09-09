import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { businessMinutesBetween } from "@/lib/businessHours";
import { recordSyncRun, getLastSuccessfulRunAt } from "@/lib/syncRuns";
import { fetchGhlMessages, upsertGhlContact, addContactToWorkflow, findGhlConversationId, type GhlMessage } from "@/lib/ghlClient";
import { isMostruarioRequest } from "@/lib/serviceRequests";
import { DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";

const BASE_URL = "https://services.leadconnectorhq.com";

// A cadência real de 2h vem de .github/workflows/sync-cron.yml (curl direto
// pra sac-kpi-maia.vercel.app/api/sync), não do cron nativo em vercel.json
// (que pede 1x/dia mas o plano Hobby da Vercel não deixa ir abaixo disso --
// o workflow do GitHub Actions é o contorno). O workflow também tem
// workflow_dispatch habilitado (disparo manual), então esse teto é só
// segurança pra um disparo manual não coincidir com o agendado e repetir o
// trabalho (request ao GHL + leituras no Supabase) sem necessidade.
const MIN_INTERVAL_MINUTES = 60;

const CHANNEL_MAP: Record<string, string> = {
  TYPE_WHATSAPP: "WhatsApp",
  TYPE_CALL: "Ligação",
  TYPE_SMS: "SMS",
  TYPE_EMAIL: "E-mail",
  TYPE_FACEBOOK: "Facebook",
  TYPE_INSTAGRAM: "Instagram",
};

type GhlConversation = {
  id: string;
  contactId?: string;
  fullName?: string;
  contactName?: string;
  phone?: string;
  assignedTo?: string;
  lastMessageType?: string;
  dateAdded: number;
  dateUpdated: number;
  sort?: number[];
};

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: "2021-07-28",
    Accept: "application/json",
  };
}

async function fetchRecentConversations(sinceMs: number): Promise<{ conversations: GhlConversation[]; error: string | null }> {
  const conversations: GhlConversation[] = [];
  let startAfterDate: number | undefined;
  let error: string | null = null;

  for (let page = 0; page < 30; page++) {
    const params = new URLSearchParams({ locationId: process.env.GHL_LOCATION_ID!, limit: "100" });
    if (startAfterDate) params.set("startAfterDate", String(startAfterDate));

    const res = await fetch(`${BASE_URL}/conversations/search?${params}`, { headers: ghlHeaders() });
    if (!res.ok) {
      // Antes isso só dava `break` silencioso -- a rota terminava e ainda
      // respondia `ok: true`, como se tivesse sincronizado tudo. Sem
      // registrar o erro, uma falha no meio da paginação (token vencido,
      // GHL fora do ar) passava despercebida indefinidamente.
      error = `conversations/search página ${page}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
      break;
    }
    const data = await res.json();
    const batch: GhlConversation[] = data.conversations ?? [];
    if (batch.length === 0) break;

    conversations.push(...batch);
    const oldestInBatch = batch[batch.length - 1];
    if ((oldestInBatch.dateUpdated ?? 0) < sinceMs) break;

    const sortValues = batch.map((c) => c.sort?.[0]).filter((v): v is number => typeof v === "number");
    if (sortValues.length === 0 || batch.length < 100) break;
    startAfterDate = Math.min(...sortValues);
  }

  return { conversations: conversations.filter((c) => (c.dateUpdated ?? 0) >= sinceMs), error };
}

// Só conta como "resposta" mensagem de atendente humano de verdade
// (`source: "app"` + `userId` preenchido) -- excluindo tanto a mensagem
// automática de recepção (`source: "workflow"`) quanto eventos de sistema
// do GHL (ex.: "Opportunity created"), que também chegam com
// `direction: "outbound"` mas não são atendimento nenhum.
function isHumanReply(m: GhlMessage): boolean {
  return m.source === "app" && Boolean(m.userId);
}

async function firstResponseMinutes(ghlConversationId: string): Promise<number | null> {
  const msgs = await fetchGhlMessages(ghlConversationId);
  if (!msgs) return null;
  const firstInbound = msgs.find((m) => m.direction === "inbound");
  if (!firstInbound) return null;
  const firstOutbound = msgs.find(
    (m) => m.direction === "outbound" && m.dateAdded > firstInbound.dateAdded && isHumanReply(m)
  );
  if (!firstOutbound) return null;

  const minutes = businessMinutesBetween(new Date(firstInbound.dateAdded), new Date(firstOutbound.dateAdded));
  return Math.round(minutes * 10) / 10;
}

// Gatilho no GHL: quando o atendente marca a conversa como resolvida, um
// workflow dispara um template de WhatsApp perguntando "de 1 a 5, qual nota
// você dá pro nosso atendimento" (1 = muito insatisfeito, 5 = muito
// satisfeito). A resposta do cliente chega como mensagem inbound comum na
// mesma conversa, com o corpo exatamente igual ao texto da opção escolhida
// (ex.: "4 - Satisfeito") -- confirmado inspecionando mensagens reais via
// API antes de escrever esse regex. Pega a resposta mais recente que bater
// com o padrão, caso o cliente responda a enquete mais de uma vez.
const NPS_PATTERN = /^([1-5])\s*-\s*(muito insatisfeito|insatisfeito|indiferente|satisfeito|muito satisfeito)\s*$/i;

async function detectNpsScore(ghlConversationId: string): Promise<{ score: number; answeredAt: string } | null> {
  const msgs = await fetchGhlMessages(ghlConversationId);
  if (!msgs) return null;
  const matches = msgs.filter((m) => m.direction === "inbound" && NPS_PATTERN.test((m.body ?? "").trim()));
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const score = Number(NPS_PATTERN.exec(last.body!.trim())![1]);
  return { score, answeredAt: last.dateAdded };
}

// NPS pós-montagem/pós-assistência técnica (pedido do Victor 07/09/2026) --
// diferente do NPS do SAC acima (que reage a uma conversa marcada como
// resolvida no GHL), o gatilho aqui é o `service_requests.status` virar
// 'concluida' -- não centralizado em nenhum hook específico (montador,
// motorista, aprovação da loja levam pra 'concluida' por caminhos
// diferentes), então varre por status em vez de depender de cada um deles
// lembrar de avisar aqui.
const MONTAGEM_NPS_TYPES = new Set(["montagem", "desmontagem"]);
// notificacao_externa nunca envolve visita física (ver comentário em
// ADDRESS_NUMBER_REQUIRED_TYPES em serviceRequests.ts) -- não faz sentido
// perguntar NPS de uma visita que não existiu.
const NPS_EXCLUDED_TYPES = new Set(["notificacao_externa"]);
// "Entrega" (motorista) separado de "assistência técnica" (montador) --
// achado 09/09/2026: os dois caíam no mesmo balde ("assistencia_tecnica"),
// desalinhado com o Resumo de /avaliacoes, que já mostra "Pós-entrega" e
// "Pós-assistência técnica" como cards separados. DELIVERY_REQUEST_TYPES
// (troca/entrega de produto, envio/recolhimento de peça) é exatamente o
// que o motorista atende -- mesmo critério que ratingKind (clientRating.ts)
// já usa pra separar a tela de avaliação do motorista da do montador.
const ENTREGA_NPS_TYPES = new Set(DELIVERY_REQUEST_TYPES as readonly string[]);

function classifyNpsTipo(type: string): "montagem" | "assistencia_tecnica" | "entrega" | null {
  if (MONTAGEM_NPS_TYPES.has(type)) return "montagem";
  if (NPS_EXCLUDED_TYPES.has(type)) return null;
  if (ENTREGA_NPS_TYPES.has(type)) return "entrega";
  return "assistencia_tecnica";
}

type NpsCandidate = {
  id: string;
  type: string;
  order_code: string | null;
  client_name: string | null;
  client_phone: string | null;
};

// Só manda pra quem concluiu de verdade nas últimas 48h (mesma janela do
// resto deste sync) -- `service_request_nps` sem linha pro request_id é o
// critério de "ainda não mandei". Workflows ainda sem template aprovado
// (GHL_WORKFLOW_ID_* vazio) -- função vira no-op até esses envs existirem,
// pra nunca matricular ninguém com o placeholder por engano num deploy
// futuro antes da hora.
async function enrollPendingNps(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<{ enrolled: number; errors: string[] }> {
  const montagemWorkflowId = process.env.GHL_WORKFLOW_ID_MONTAGEM;
  const assistenciaWorkflowId = process.env.GHL_WORKFLOW_ID_ASSISTENCIA;
  const entregaWorkflowId = process.env.GHL_WORKFLOW_ID_ENTREGA;
  if (!montagemWorkflowId || !assistenciaWorkflowId || !entregaWorkflowId) return { enrolled: 0, errors: [] };

  const sinceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error } = await supabase
    .from("service_requests")
    .select("id, type, order_code, client_name, client_phone")
    .eq("status", "concluida")
    .gte("completed_at", sinceIso)
    .returns<NpsCandidate[]>();
  if (error) return { enrolled: 0, errors: [`nps candidatos: ${error.message}`] };
  if (!candidates || candidates.length === 0) return { enrolled: 0, errors: [] };

  const { data: already } = await supabase
    .from("service_request_nps")
    .select("request_id")
    .in("request_id", candidates.map((c) => c.id));
  const alreadySent = new Set((already ?? []).map((r) => r.request_id as string));

  const errors: string[] = [];
  let enrolled = 0;
  for (const candidate of candidates) {
    if (alreadySent.has(candidate.id) || !candidate.client_phone) continue;
    if (isMostruarioRequest(candidate.order_code, candidate.client_name)) continue;
    const tipo = classifyNpsTipo(candidate.type);
    if (!tipo) continue;

    const workflowId = tipo === "montagem" ? montagemWorkflowId : tipo === "entrega" ? entregaWorkflowId : assistenciaWorkflowId;
    const contactId = await upsertGhlContact(candidate.client_phone, candidate.client_name);
    if (!contactId) {
      errors.push(`nps ${candidate.id}: não achou/criou contato no GHL`);
      continue;
    }
    if (!(await addContactToWorkflow(contactId, workflowId))) {
      errors.push(`nps ${candidate.id}: falha ao matricular no workflow`);
      continue;
    }
    const { error: insertError } = await supabase.from("service_request_nps").insert({ request_id: candidate.id, tipo, ghl_contact_id: contactId });
    if (insertError) errors.push(`nps ${candidate.id}: ${insertError.message}`);
    else enrolled++;
  }
  return { enrolled, errors };
}

// Resposta é um número sozinho de 0 a 10 (a lista de opções do template
// ecoa só o número escolhido, sem palavra junto -- diferente do padrão
// "N - descrição" do NPS do SAC acima, de propósito, pra nunca colidir os
// dois regex numa mesma conversa). Só considera mensagem inbound DEPOIS de
// enviado_em -- diferente do detectNpsScore acima (que pega a última da
// conversa inteira), aqui precisa disso porque a mesma conversa pode ter
// mais de uma pesquisa (SAC + montagem + assistência) ao longo do tempo.
const NPS_SCORE_PATTERN = /^\s*(10|[0-9])\s*$/;

async function detectPendingNpsResponses(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  const { data: pending } = await supabase
    .from("service_request_nps")
    .select("request_id, ghl_contact_id, enviado_em")
    .is("respondido_em", null)
    .limit(100);
  if (!pending || pending.length === 0) return 0;

  let answered = 0;
  for (const row of pending) {
    const conversationId = await findGhlConversationId(row.ghl_contact_id);
    if (!conversationId) continue;
    const msgs = await fetchGhlMessages(conversationId);
    if (!msgs) continue;
    const sentAtMs = new Date(row.enviado_em).getTime();
    const reply = msgs.find(
      (m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > sentAtMs && NPS_SCORE_PATTERN.test((m.body ?? "").trim())
    );
    if (!reply) continue;
    const score = Number(NPS_SCORE_PATTERN.exec(reply.body!.trim())![1]);
    await supabase.from("service_request_nps").update({ score, respondido_em: reply.dateAdded }).eq("request_id", row.request_id);
    answered++;
  }
  return answered;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // Comparação direta com `Bearer ${process.env.CRON_SECRET}` deixava a
  // rota aberta pra quem mandasse literalmente "Bearer undefined" caso a
  // variável de ambiente sumisse num deploy -- falha aberta, não fechada.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const lastRunAt = await getLastSuccessfulRunAt("ghl");
    if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < MIN_INTERVAL_MINUTES * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true, reason: `última sincronização com sucesso há menos de ${MIN_INTERVAL_MINUTES}min`, lastRunAt });
    }
    return await runSync();
  } catch (err) {
    const message = (err as Error).message;
    await recordSyncRun("ghl", false, {}, [message]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runSync() {
  const supabase = getSupabaseAdmin();
  const sinceMs = Date.now() - 48 * 60 * 60 * 1000;
  const { conversations, error: fetchError } = await fetchRecentConversations(sinceMs);
  const errors: string[] = fetchError ? [fetchError] : [];

  let conversationsUpserted = 0;
  for (const conv of conversations) {
    const ghlContactId = conv.contactId;
    if (!ghlContactId) continue;

    await supabase
      .from("contacts")
      .upsert(
        { ghl_contact_id: ghlContactId, name: conv.fullName ?? conv.contactName, phone: conv.phone },
        { onConflict: "ghl_contact_id" }
      );

    const { data: contactRow } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", ghlContactId)
      .single();
    if (!contactRow) continue;

    const channel = CHANNEL_MAP[conv.lastMessageType ?? ""] ?? conv.lastMessageType ?? null;

    const { error } = await supabase.from("conversations").upsert(
      {
        ghl_conversation_id: conv.id,
        contact_id: contactRow.id,
        assigned_to_id: conv.assignedTo ?? null,
        channel,
        ghl_created_at: new Date(conv.dateAdded).toISOString(),
        ghl_updated_at: new Date(conv.dateUpdated).toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "ghl_conversation_id" }
    );
    if (!error) conversationsUpserted++;
    else errors.push(`conversation ${conv.id}: ${error.message}`);
  }

  const { data: windowRow } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "window_start")
    .single();
  const windowStart = windowRow?.value ? new Date(windowRow.value) : null;

  const { data: pending } = await supabase
    .from("conversations")
    .select("id, ghl_conversation_id, ghl_created_at")
    .is("first_response_minutes", null)
    .order("ghl_created_at", { ascending: false })
    .limit(100);

  let responsesComputed = 0;
  for (const row of pending ?? []) {
    if (windowStart && new Date(row.ghl_created_at) < windowStart) continue;
    const minutes = await firstResponseMinutes(row.ghl_conversation_id);
    if (minutes !== null) {
      await supabase.from("conversations").update({ first_response_minutes: minutes }).eq("id", row.id);
      responsesComputed++;
    }
  }

  // Passo à parte de first_response_minutes de propósito: NPS não tem o
  // corte de windowStart (vale pra qualquer conversa resolvida, não só as
  // que entraram depois que o SLA de 1ª resposta passou a ser medido), e
  // fica pendente até o cliente responder -- pode levar mais que um ciclo
  // de sync pra chegar.
  const { data: pendingNps } = await supabase
    .from("conversations")
    .select("id, ghl_conversation_id")
    .is("nps_score", null)
    .order("ghl_updated_at", { ascending: false })
    .limit(150);

  let npsComputed = 0;
  for (const row of pendingNps ?? []) {
    const result = await detectNpsScore(row.ghl_conversation_id);
    if (result) {
      await supabase.from("conversations").update({ nps_score: result.score, nps_answered_at: result.answeredAt }).eq("id", row.id);
      npsComputed++;
    }
  }

  const { enrolled: montagemAssistNpsEnrolled, errors: npsEnrollErrors } = await enrollPendingNps(supabase);
  errors.push(...npsEnrollErrors);
  const montagemAssistNpsAnswered = await detectPendingNpsResponses(supabase);

  const ok = errors.length === 0;
  await recordSyncRun(
    "ghl",
    ok,
    { conversationsChecked: conversations.length, conversationsUpserted, responsesComputed, npsComputed, montagemAssistNpsEnrolled, montagemAssistNpsAnswered },
    errors
  );

  return NextResponse.json({
    ok,
    conversationsChecked: conversations.length,
    conversationsUpserted,
    responsesComputed,
    npsComputed,
    montagemAssistNpsEnrolled,
    montagemAssistNpsAnswered,
    errors,
  });
}
