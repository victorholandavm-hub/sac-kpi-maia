import { REQUEST_TYPE_LABELS, STATUS_LABELS, DELIVERY_REQUEST_TYPES } from "./assistenciaLabels";

// Bot do Telegram pro Victor -- pedido 04/09/2026: "criar um bot para me
// avisar quando houver uma nova solicitação de montagem/desmontagem, nova
// notificação de assistencia [esclarecido: chamados de entrega/envio/
// recolhimento], nova solicitação de encomenda e mudança de status de
// todas as solicitações [esclarecido: só status-chave]". Token/chat id
// vêm de variável de ambiente (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no
// .env do servidor) -- nunca comitados no código. Sem as duas, a função
// não faz nada (silenciosamente) -- não trava build/deploy de quem não
// configurou isso ainda.
async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error("[telegram] sendMessage falhou:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    // Nunca deixa um problema no Telegram (rede, API fora do ar) derrubar
    // a ação de verdade (criar chamado, mudar status etc.) -- só loga.
    console.error("[telegram] sendMessage falhou:", err);
  }
}

// Os dois grupos que o Victor pediu aviso na CRIAÇÃO: montagem/desmontagem
// (ASSISTENCIA_MANAGED_TYPES, sem vistoria/troca de peça -- não fizeram
// parte do pedido) e "chamados de entrega/envio/recolhimento"
// (DELIVERY_REQUEST_TYPES) -- esse segundo termo era literalmente "nova
// notificação de assistencia" no pedido original, esclarecido com o
// Victor via pergunta. notificação_externa fica de fora (não é nem um nem
// outro grupo).
export function notifyTelegramNewRequest(params: {
  ticketNumber: number;
  type: string;
  clientName?: string | null;
  storeName?: string | null;
}): Promise<void> {
  const isMontagemDesmontagem = params.type === "montagem" || params.type === "desmontagem";
  const isDelivery = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(params.type);
  if (!isMontagemDesmontagem && !isDelivery) return Promise.resolve();

  const emoji = isMontagemDesmontagem ? "🪑" : "🚚";
  const label = REQUEST_TYPE_LABELS[params.type] ?? params.type;
  const parts = [`${emoji} Nova solicitação: ${label}`, `#${params.ticketNumber}`];
  if (params.storeName) parts.push(params.storeName);
  if (params.clientName) parts.push(params.clientName);
  return sendTelegramMessage(parts.join(" — "));
}

export function notifyTelegramNewEncomenda(params: { pedidoNumber: number; storeName: string }): Promise<void> {
  return sendTelegramMessage(`📦 Novo pedido de encomenda #${params.pedidoNumber} — ${params.storeName}`);
}

// "Só status-chave" (pedido do Victor 04/09/2026, pra não virar ruído):
// concluída, cancelada, remarcar, aguardando aprovação da loja. Passos
// intermediários (em contato, em andamento, assumir chamado) não disparam
// nada.
const TELEGRAM_KEY_STATUSES = new Set(["concluida", "cancelada", "remarcar", "aguardando_aprovacao"]);

export function notifyTelegramStatusChange(params: { ticketNumber: number; type: string; newStatus: string }): Promise<void> {
  if (!TELEGRAM_KEY_STATUSES.has(params.newStatus)) return Promise.resolve();
  const label = REQUEST_TYPE_LABELS[params.type] ?? params.type;
  const statusLabel = STATUS_LABELS[params.newStatus] ?? params.newStatus;
  const emoji = params.newStatus === "concluida" ? "✅" : params.newStatus === "cancelada" ? "❌" : params.newStatus === "remarcar" ? "🔁" : "⏳";
  return sendTelegramMessage(`${emoji} #${params.ticketNumber} (${label}) → ${statusLabel}`);
}
