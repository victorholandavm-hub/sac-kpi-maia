import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchInBatches } from "./supabaseBatch";

export type EmAndamentoRow = {
  conversationId: string;
  ghlConversationId: string;
  clientName: string | null;
  clientPhone: string | null;
  storeTag: string | null;
  category: string | null;
  agentName: string | null;
  channel: string | null;
  urgency: string;
  andamentoSince: string;
  horasEmAndamento: number;
};

type StatusTagRow = { conversation_id: string; tag: string; event_at: string };

type TicketInfoRow = {
  conversation_id: string;
  ghl_conversation_id: string;
  contact_id: string;
  store_tag: string | null;
  category: string | null;
  agent_name: string | null;
  channel: string | null;
  urgency: string;
};

type ContactRow = { id: string; name: string | null; phone: string | null };

// A tag de status (dimensão "status" em v_conversation_tags) é um log de
// eventos, não o estado atual -- a mesma conversa acumula uma linha por
// mudança (status-encaminhado -> status-andamento -> status-resolvido).
// "Em andamento agora" é a conversa cuja tag de status mais recente é
// "status-andamento".
export async function getEmAndamentoList(): Promise<EmAndamentoRow[]> {
  const supabase = getSupabaseAdmin();

  const statusRows: StatusTagRow[] = [];
  const pageSize = 1000;
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("v_conversation_tags")
      .select("conversation_id, tag, event_at")
      .eq("dimension", "status")
      .order("event_at", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    statusRows.push(...((data ?? []) as StatusTagRow[]));
    if (!data || data.length < pageSize) break;
  }

  const latestByConversation = new Map<string, StatusTagRow>();
  for (const row of statusRows) {
    latestByConversation.set(row.conversation_id, row);
  }

  const emAndamento = [...latestByConversation.values()].filter((r) => r.tag === "status-andamento");
  if (emAndamento.length === 0) return [];

  // Ver supabaseBatch.ts: `.in()` com lista grande estoura o limite de
  // cabeçalho HTTP da requisição (HeadersOverflowError, bug real em
  // produção 14/08/2026) -- busca em lotes em vez de uma lista só.
  const conversationIds = emAndamento.map((r) => r.conversation_id);
  const ticketRows = await fetchInBatches<TicketInfoRow>(conversationIds, (batch) =>
    supabase
      .from("v_ticket_enriched")
      .select("conversation_id, ghl_conversation_id, contact_id, store_tag, category, agent_name, channel, urgency")
      .in("conversation_id", batch)
  );

  const ticketByConversation = new Map<string, TicketInfoRow>(ticketRows.map((r) => [r.conversation_id, r]));

  const contactIds = [...new Set([...ticketByConversation.values()].map((r) => r.contact_id))];
  const contactRows = await fetchInBatches<ContactRow>(contactIds, (batch) =>
    supabase.from("contacts").select("id, name, phone").in("id", batch)
  );

  const contactById = new Map<string, ContactRow>(contactRows.map((r) => [r.id, r]));

  const now = Date.now();
  const result: EmAndamentoRow[] = [];
  for (const statusRow of emAndamento) {
    const ticket = ticketByConversation.get(statusRow.conversation_id);
    if (!ticket) continue;
    const contact = contactById.get(ticket.contact_id);
    result.push({
      conversationId: ticket.conversation_id,
      ghlConversationId: ticket.ghl_conversation_id,
      clientName: contact?.name ?? null,
      clientPhone: contact?.phone ?? null,
      storeTag: ticket.store_tag,
      category: ticket.category,
      agentName: ticket.agent_name,
      channel: ticket.channel,
      urgency: ticket.urgency,
      andamentoSince: statusRow.event_at,
      horasEmAndamento: Math.round(((now - new Date(statusRow.event_at).getTime()) / 3_600_000) * 10) / 10,
    });
  }

  return result.sort((a, b) => new Date(a.andamentoSince).getTime() - new Date(b.andamentoSince).getTime());
}
