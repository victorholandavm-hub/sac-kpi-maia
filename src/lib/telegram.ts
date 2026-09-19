import { REQUEST_TYPE_LABELS, STATUS_LABELS, DELIVERY_REQUEST_TYPES, VISITA_REQUEST_TYPES } from "./assistenciaLabels";

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
// Segundo bot, só a aba "Visitas" (pedido do Victor 19/09/2026: "tenho o
// robo que me tras informações sobre entregas, visitas e etc, agora eu
// preciso de um robô apenas com montagem/demonstagem, apenas da aba de
// visitas" -- e, no mesmo dia, ampliado: "coloque as atualizações de manoel
// tambem no bot" e "adicione um evento tambem quando a equipe de
// assistencia escolher o montador para uma visita"). Token/chat ids
// PRÓPRIOS (bot separado no Telegram, não reaproveita TELEGRAM_BOT_TOKEN),
// mesmo padrão de "sem as duas env vars, não faz nada" do bot principal.
// Escopo = VISITA_REQUEST_TYPES (montagem, desmontagem, troca_peca,
// vistoria -- os 2 últimos são sempre o Manoel, MANOEL_ONLY_TYPES em
// assistenciaLabels.ts) -- sem exclusão de montador nenhuma, ao contrário
// da 1ª versão desse bot (que tirava o Manoel de propósito).
async function sendTelegramMessage(text: string, tokenEnvVar = "TELEGRAM_BOT_TOKEN", chatIdsEnvVar = "TELEGRAM_CHAT_IDS"): Promise<void> {
  const token = process.env[tokenEnvVar];
  const chatIds = (process.env[chatIdsEnvVar] ?? "")
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
  // Montador faz sentido pra qualquer tipo da aba "Visitas" (montagem,
  // desmontagem, troca de peça, vistoria); motorista pro resto (entrega/
  // envio/recolhimento) -- mesmo corte de sempre (ver DELIVERY_REQUEST_TYPES/
  // VISITA_REQUEST_TYPES), pra não mostrar "Motorista: —" numa montagem.
  if ((VISITA_REQUEST_TYPES as readonly string[]).includes(params.type)) {
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
// Ver comentário do bot separado acima -- escopo é só o tipo (VISITA_REQUEST_TYPES),
// sem checar quem é o montador.
function isVisitaBotType(type: string): boolean {
  return (VISITA_REQUEST_TYPES as readonly string[]).includes(type);
}

export function notifyTelegramNewRequest(params: RequestNotifyParams): Promise<void> {
  const isMontagemDesmontagem = params.type === "montagem" || params.type === "desmontagem";
  const isDelivery = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(params.type);
  // Bot principal só monta/desmonta + entrega/envio/recolhimento na criação
  // (nunca incluiu vistoria/troca de peça -- não fizeram parte do pedido
  // original de 04/09/2026). Bot da aba Visitas (abaixo) é mais amplo.
  const sendsToMainBot = isMontagemDesmontagem || isDelivery;
  const sendsToVisitaBot = isVisitaBotType(params.type);
  if (!sendsToMainBot && !sendsToVisitaBot) return Promise.resolve();

  const emoji = isMontagemDesmontagem ? "🪑" : "🚚";
  const label = REQUEST_TYPE_LABELS[params.type] ?? params.type;
  const lines = [`${emoji} Nova solicitação: ${label}`, `#${params.ticketNumber}`, ...requestNotifyLines(params)];
  const text = lines.join("\n");

  const sends: Promise<void>[] = [];
  if (sendsToMainBot) sends.push(sendTelegramMessage(text));
  if (sendsToVisitaBot) sends.push(sendTelegramMessage(text, "TELEGRAM_BOT_TOKEN_MONTAGEM", "TELEGRAM_CHAT_IDS_MONTAGEM"));
  return Promise.all(sends).then(() => undefined);
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
  const text = lines.join("\n");

  const sends = [sendTelegramMessage(text)];
  if (isVisitaBotType(params.type)) {
    sends.push(sendTelegramMessage(text, "TELEGRAM_BOT_TOKEN_MONTAGEM", "TELEGRAM_CHAT_IDS_MONTAGEM"));
  }
  return Promise.all(sends).then(() => undefined);
}

// Pedido do Victor 19/09/2026: "adicione um evento tambem quando a equipe
// de assistencia escolher o montador para uma visita" -- ver setAssemblerName
// (actions.ts). Só nesse 2º bot (aba Visitas) -- o bot principal nunca
// avisou de atribuição de montador, só criação/status-chave.
export function notifyTelegramAssemblerAssigned(params: RequestNotifyParams): Promise<void> {
  if (!isVisitaBotType(params.type)) return Promise.resolve();
  const label = REQUEST_TYPE_LABELS[params.type] ?? params.type;
  const lines = [`🔧 Montador definido: ${label}`, `#${params.ticketNumber}`, ...requestNotifyLines(params)];
  return sendTelegramMessage(lines.join("\n"), "TELEGRAM_BOT_TOKEN_MONTAGEM", "TELEGRAM_CHAT_IDS_MONTAGEM");
}
