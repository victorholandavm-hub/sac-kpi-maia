import { REQUEST_TYPE_LABELS, STATUS_LABELS, DELIVERY_REQUEST_TYPES } from "./assistenciaLabels";

// Bot do Telegram -- pedido do Victor 04/09/2026: "criar um bot para me
// avisar quando houver uma nova solicitação de montagem/desmontagem, nova
// notificação de assistencia [esclarecido: chamados de entrega/envio/
// recolhimento], nova solicitação de encomenda e mudança de status de
// todas as solicitações [esclarecido: só status-chave]". Token/chat ids
// vêm de variável de ambiente (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_IDS no
// .env do servidor) -- nunca comitados no código. Sem as duas, a função
// não faz nada (silenciosamente) -- não trava build/deploy de quem não
// configurou isso ainda.
//
// TELEGRAM_CHAT_IDS (plural, separado por vírgula) -- pedido do Victor
// 05/09/2026: "outro membros da equipe estao com acesso ao bot" -- cada
// pessoa manda uma mensagem qualquer pro bot (é assim que o Telegram
// libera ele mandar de volta pra ela) e o chat_id dela entra na lista.
// Disparo em paralelo (Promise.all) -- uma pessoa com bloqueio/erro no
// Telegram não atrasa nem derruba o envio pras outras.
async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (!res.ok) {
          console.error("[telegram] sendMessage falhou:", chatId, res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        // Nunca deixa um problema no Telegram (rede, API fora do ar) derrubar
        // a ação de verdade (criar chamado, mudar status etc.) -- só loga.
        console.error("[telegram] sendMessage falhou:", chatId, err);
      }
    })
  );
}

// Achado do Victor 04/09/2026, testando o primeiro aviso: "preciso receber
// com o nome do solicitante e o nome do cliente, e quando for montagem e
// entrega, nome do montador e do motorista". Cada campo só entra na
// mensagem quando o chamado de fato tem esse dado (ex.: motorista raramente
// já está definido na hora da CRIAÇÃO de uma entrega, só depois que a rota
// é atribuída) -- omitido em silêncio em vez de aparecer como "—" ou vazio.
type RequestNotifyParams = {
  ticketNumber: number;
  type: string;
  clientName?: string | null;
  storeName?: string | null;
  requestedByName?: string | null;
  assemblerName?: string | null;
  driverName?: string | null;
};

function requestNotifyLines(params: RequestNotifyParams): string[] {
  const lines: string[] = [];
  if (params.storeName) lines.push(`Loja: ${params.storeName}`);
  if (params.clientName) lines.push(`Cliente: ${params.clientName}`);
  if (params.requestedByName) lines.push(`Solicitado por: ${params.requestedByName}`);
  // Montador só faz sentido pra montagem/desmontagem; motorista pro resto
  // (entrega/envio/recolhimento) -- mesmo corte de sempre (ver
  // DELIVERY_REQUEST_TYPES), pra não mostrar "Motorista: —" numa montagem.
  if (params.type === "montagem" || params.type === "desmontagem") {
    if (params.assemblerName) lines.push(`Montador: ${params.assemblerName}`);
  } else if (params.driverName) {
    lines.push(`Motorista: ${params.driverName}`);
  }
  return lines;
}

// Os dois grupos que o Victor pediu aviso na CRIAÇÃO: montagem/desmontagem
// (ASSISTENCIA_MANAGED_TYPES, sem vistoria/troca de peça -- não fizeram
// parte do pedido) e "chamados de entrega/envio/recolhimento"
// (DELIVERY_REQUEST_TYPES) -- esse segundo termo era literalmente "nova
// notificação de assistencia" no pedido original, esclarecido com o
// Victor via pergunta. notificação_externa fica de fora (não é nem um nem
// outro grupo).
export function notifyTelegramNewRequest(params: RequestNotifyParams): Promise<void> {
  const isMontagemDesmontagem = params.type === "montagem" || params.type === "desmontagem";
  const isDelivery = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(params.type);
  if (!isMontagemDesmontagem && !isDelivery) return Promise.resolve();

  const emoji = isMontagemDesmontagem ? "🪑" : "🚚";
  const label = REQUEST_TYPE_LABELS[params.type] ?? params.type;
  const lines = [`${emoji} Nova solicitação: ${label}`, `#${params.ticketNumber}`, ...requestNotifyLines(params)];
  return sendTelegramMessage(lines.join("\n"));
}

export function notifyTelegramNewEncomenda(params: {
  pedidoNumber: number;
  storeName: string;
  requestedByName: string;
  fornecedorLabel: string;
  products: string[];
}): Promise<void> {
  const lines = [
    `📦 Novo pedido de encomenda #${params.pedidoNumber}`,
    `Loja: ${params.storeName}`,
    `Solicitado por: ${params.requestedByName}`,
    `Fábrica/fornecedor: ${params.fornecedorLabel}`,
    `Produto${params.products.length > 1 ? "s" : ""}: ${params.products.join(", ")}`,
  ];
  return sendTelegramMessage(lines.join("\n"));
}

// "Só status-chave" (pedido do Victor 04/09/2026, pra não virar ruído):
// concluída, cancelada, remarcar, aguardando aprovação da loja. Passos
// intermediários (em contato, em andamento, assumir chamado) não disparam
// nada.
const TELEGRAM_KEY_STATUSES = new Set(["concluida", "cancelada", "remarcar", "aguardando_aprovacao"]);

export function notifyTelegramStatusChange(params: RequestNotifyParams & { newStatus: string }): Promise<void> {
  if (!TELEGRAM_KEY_STATUSES.has(params.newStatus)) return Promise.resolve();
  const label = REQUEST_TYPE_LABELS[params.type] ?? params.type;
  const statusLabel = STATUS_LABELS[params.newStatus] ?? params.newStatus;
  const emoji = params.newStatus === "concluida" ? "✅" : params.newStatus === "cancelada" ? "❌" : params.newStatus === "remarcar" ? "🔁" : "⏳";
  const lines = [`${emoji} #${params.ticketNumber} (${label}) → ${statusLabel}`, ...requestNotifyLines(params)];
  return sendTelegramMessage(lines.join("\n"));
}
