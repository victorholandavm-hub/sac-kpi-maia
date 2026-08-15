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
