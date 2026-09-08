const BASE_URL = "https://services.leadconnectorhq.com";

export type GhlMessage = {
  direction: "inbound" | "outbound";
  dateAdded: string;
  body?: string;
  // Usados só pra distinguir mensagem de atendente humano de mensagem
  // automática -- ver firstResponseMinutes em api/sync/route.ts.
  // `source: "workflow"` é automação (ex.: saudação automática) e não tem
  // `userId`; eventos de sistema do GHL (ex.: "Opportunity created") também
  // vêm com `direction: "outbound"` mas sem `userId`. Confirmado inspecionando
  // ~700 mensagens reais via API antes de escrever esse filtro.
  source?: string;
  userId?: string;
};

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: "2021-07-28",
    Accept: "application/json",
  };
}

// Extraído de api/sync/route.ts -- usado ali (1ª resposta/NPS) e também por
// ticketClassification.ts (lê o texto da conversa pra classificar categoria
// real / produto / loja). Mesma lógica, um lugar só.
export async function fetchGhlMessages(ghlConversationId: string): Promise<GhlMessage[] | null> {
  const res = await fetch(`${BASE_URL}/conversations/${ghlConversationId}/messages?limit=100`, {
    headers: ghlHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const msgs: GhlMessage[] = data.messages?.messages ?? [];
  return msgs.slice().sort((a, b) => (a.dateAdded || "").localeCompare(b.dateAdded || ""));
}

// NPS pós-montagem/pós-assistência técnica (pedido do Victor 07/09/2026) --
// ainda não tem chamador (falta o workflowId de cada pesquisa, criado no
// GHL). "Upsert" pelo telefone: acha o contato existente ou cria um novo,
// sempre devolvendo o ghlContactId -- é o mesmo contato que já pode existir
// de uma conversa antiga do SAC, então não duplica.
export async function upsertGhlContact(phone: string, name: string | null): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/contacts/upsert`, {
    method: "POST",
    headers: { ...ghlHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: process.env.GHL_LOCATION_ID, phone, name: name ?? undefined }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.contact?.id ?? null;
}

// Matricular o contato num workflow é o próprio gatilho de envio -- o
// workflow (configurado no GHL, fora daqui) tem "Contact tag added" como
// trigger (numa tag exclusiva, nunca aplicada por mais nada) e a ação de
// mandar o template de WhatsApp logo em seguida. Não confirma entrega
// nenhuma, só que a matrícula foi aceita.
export async function addContactToWorkflow(ghlContactId: string, workflowId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/contacts/${ghlContactId}/workflow/${workflowId}`, {
    method: "POST",
    headers: { ...ghlHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.ok;
}

// Pra ler a resposta da pesquisa de NPS precisa saber em qual conversa ela
// foi parar -- a matrícula no workflow não devolve isso, só o fetchGhlMessages
// (que já existe) precisa de um conversationId. Pega a mais recente do
// contato (é sempre a mesma conversa de WhatsApp que o SAC já usa).
export async function findGhlConversationId(ghlContactId: string): Promise<string | null> {
  const params = new URLSearchParams({ locationId: process.env.GHL_LOCATION_ID ?? "", contactId: ghlContactId, limit: "1" });
  const res = await fetch(`${BASE_URL}/conversations/search?${params}`, { headers: ghlHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.conversations?.[0]?.id ?? null;
}
