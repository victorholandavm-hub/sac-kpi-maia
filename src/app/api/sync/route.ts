import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { businessMinutesBetween } from "@/lib/businessHours";
import { recordSyncRun } from "@/lib/syncRuns";

const BASE_URL = "https://services.leadconnectorhq.com";

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

type GhlMessage = {
  direction: "inbound" | "outbound";
  dateAdded: string;
  body?: string;
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

async function fetchMessages(ghlConversationId: string): Promise<GhlMessage[] | null> {
  const res = await fetch(`${BASE_URL}/conversations/${ghlConversationId}/messages?limit=100`, {
    headers: ghlHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const msgs: GhlMessage[] = data.messages?.messages ?? [];
  return msgs.slice().sort((a, b) => (a.dateAdded || "").localeCompare(b.dateAdded || ""));
}

async function firstResponseMinutes(ghlConversationId: string): Promise<number | null> {
  const msgs = await fetchMessages(ghlConversationId);
  if (!msgs) return null;
  const firstInbound = msgs.find((m) => m.direction === "inbound");
  if (!firstInbound) return null;
  const firstOutbound = msgs.find((m) => m.direction === "outbound" && m.dateAdded > firstInbound.dateAdded);
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
  const msgs = await fetchMessages(ghlConversationId);
  if (!msgs) return null;
  const matches = msgs.filter((m) => m.direction === "inbound" && NPS_PATTERN.test((m.body ?? "").trim()));
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const score = Number(NPS_PATTERN.exec(last.body!.trim())![1]);
  return { score, answeredAt: last.dateAdded };
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

  const ok = errors.length === 0;
  await recordSyncRun("ghl", ok, { conversationsChecked: conversations.length, conversationsUpserted, responsesComputed, npsComputed }, errors);

  return NextResponse.json({
    ok,
    conversationsChecked: conversations.length,
    conversationsUpserted,
    responsesComputed,
    npsComputed,
    errors,
  });
}
